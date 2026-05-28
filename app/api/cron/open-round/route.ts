import { NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { env } from "@/lib/env";
import { getSql } from "@/lib/db";

const OPEN_ROUND_OPCODE = 51917385; // 0x03183249

function getClosesAt(): number {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 0);
  return Math.floor(d.getTime() / 1000);
}

async function getContractRoundId(client: TonClient, vaultAddress: string): Promise<number> {
  try {
    const result = await client.runMethod(
      Address.parse(vaultAddress),
      "getRoundState",
      []
    );
    return Number(result.stack.readNumber());
  } catch (err) {
    console.warn("[cron/open-round] getRoundState 호출 실패:", err);
    return 0;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const adminKey = request.headers.get("x-admin-key");

  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = adminKey === env.adminApiKey;

  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mnemonic = process.env.OWNER_MNEMONIC?.split(" ");
  if (!mnemonic || mnemonic.length < 24) {
    return NextResponse.json(
      { error: "OWNER_MNEMONIC 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const closesAt = getClosesAt();

  try {
    const sql = getSql();

    // 오늘 challenge 확인
    const [challenge] = await sql<{ id: string; on_chain_round_id: number }[]>`
      select id, on_chain_round_id from challenge
      where challenge_date = current_date
      limit 1
    `;

    if (!challenge) {
      return NextResponse.json({ error: "오늘 challenge 레코드가 없습니다." }, { status: 400 });
    }

    const client = new TonClient({
      endpoint:
        process.env.TON_NETWORK === "mainnet"
          ? "https://toncenter.com/api/v2/jsonRPC"
          : "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });

    // 컨트랙트에서 현재 roundId 조회
    const contractRoundId = await getContractRoundId(client, env.stakeVaultAddress);
    // 다음 roundId = 현재 + 1
    const nextRoundId = contractRoundId + 1;

    // DB에 이미 같은 roundId가 설정돼 있으면 이미 열린 것
    if (challenge.on_chain_round_id === nextRoundId) {
      console.log(`[cron/open-round] 이미 처리됨. roundId=${nextRoundId}, skip.`);
      return NextResponse.json({ ok: true, skipped: true, reason: "already processed", roundId: nextRoundId });
    }

    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const walletAddress = wallet.address.toString({ bounceable: false });
    console.log(`[cron/open-round] wallet: ${walletAddress}, nextRoundId: ${nextRoundId}`);

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    const body = beginCell()
      .storeUint(OPEN_ROUND_OPCODE, 32)
      .storeUint(0, 64)                  // queryId
      .storeUint(nextRoundId, 32)        // roundId
      .storeCoins(toNano("0.5"))         // minStake
      .storeUint(closesAt, 32)           // closesAt
      .endCell();

    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages: [
        internal({
          to: Address.parse(env.stakeVaultAddress),
          value: toNano("0.05"),
          bounce: false,
          body,
        }),
      ],
    });

    // DB의 on_chain_round_id 업데이트
    await sql`
      update challenge
      set on_chain_round_id = ${nextRoundId}
      where challenge_date = current_date
    `;

    console.log(`[cron/open-round] OpenRound sent & DB updated: roundId=${nextRoundId}, seqno=${seqno}`);
    return NextResponse.json({ ok: true, skipped: false, roundId: nextRoundId, closesAt, seqno, walletAddress });

  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "OpenRound 실패";
    console.error("[cron/open-round] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

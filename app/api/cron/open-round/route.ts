import { NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { env } from "@/lib/env";
import { getSql } from "@/lib/db";

const OPEN_ROUND_OPCODE = 0x620f76ad;

function getTodayRoundId(): number {
  return parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ""), 10);
}

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
    console.warn("[cron/open-round] getRoundState 호출 실패, 0으로 가정:", err);
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

  const roundId = getTodayRoundId();
  const closesAt = getClosesAt();

  try {
    // 1. DB에서 오늘 challenge 레코드 확인
    const sql = getSql();
    const [existing] = await sql<{ id: string }[]>`
      select id from challenge
      where challenge_date = current_date
      limit 1
    `;

    if (!existing) {
      return NextResponse.json(
        { error: "오늘 challenge 레코드가 없습니다." },
        { status: 400 }
      );
    }

    // 2. TonClient 초기화
    const client = new TonClient({
      endpoint:
        process.env.TON_NETWORK === "mainnet"
          ? "https://toncenter.com/api/v2/jsonRPC"
          : "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });

    // 3. 컨트랙트 상태 확인 → 오늘 roundId면 이미 열린 것 → skip
    const contractRoundId = await getContractRoundId(client, env.stakeVaultAddress);
    if (contractRoundId === roundId) {
      console.log(`[cron/open-round] 이미 열린 라운드입니다. roundId=${roundId}, skip.`);
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "round already open",
        roundId,
      });
    }

    // 4. OpenRound 트랜잭션 전송
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    const body = beginCell()
      .storeUint(OPEN_ROUND_OPCODE, 32)
      .storeUint(0, 64)
      .storeUint(roundId, 32)
      .storeCoins(toNano("0.5"))
      .storeUint(closesAt, 32)
      .endCell();

    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages: [
        internal({
          to: Address.parse(env.stakeVaultAddress),
          value: toNano("0.05"),
          bounce: true,
          body,
        }),
      ],
    });

    console.log(`[cron/open-round] OpenRound sent: roundId=${roundId}, seqno=${seqno}`);

    return NextResponse.json({ ok: true, skipped: false, roundId, closesAt, seqno });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "OpenRound 실패";
    console.error("[cron/open-round] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

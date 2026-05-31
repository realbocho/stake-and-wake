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

async function waitForRoundId(
  client: TonClient,
  vaultAddress: string,
  expectedRoundId: number,
  maxWaitMs = 30000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 3000));
    const current = await getContractRoundId(client, vaultAddress);
    if (current === expectedRoundId) return true;
  }
  return false;
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
    return NextResponse.json({ error: "OWNER_MNEMONIC 없음" }, { status: 500 });
  }

  const closesAt = getClosesAt();

  try {
    const sql = getSql();

    // 오늘 challenge 조회 — 없으면 자동 생성
    let [challenge] = await sql<{ id: string; on_chain_round_id: number }[]>`
      select id, on_chain_round_id from challenge
      where challenge_date = current_date
      limit 1
    `;

    if (!challenge) {
      const { getOrCreateTonightChallenge } = await import("@/lib/repositories/challenges");
      await getOrCreateTonightChallenge();
      [challenge] = await sql<{ id: string; on_chain_round_id: number }[]>`
        select id, on_chain_round_id from challenge
        where challenge_date = current_date
        limit 1
      `;
    }

    if (!challenge) {
      return NextResponse.json({ error: "오늘 challenge 레코드 생성 실패." }, { status: 500 });
    }

    const client = new TonClient({
      endpoint:
        process.env.TON_NETWORK === "mainnet"
          ? "https://toncenter.com/api/v2/jsonRPC"
          : "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });

    const contractRoundId = await getContractRoundId(client, env.stakeVaultAddress);
    const nextRoundId = contractRoundId + 1;

    if (challenge.on_chain_round_id === contractRoundId && contractRoundId > 0) {
      console.log(`[cron/open-round] 이미 처리됨. roundId=${contractRoundId}, skip.`);
      return NextResponse.json({ ok: true, skipped: true, reason: "already processed", roundId: contractRoundId });
    }

    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const walletAddress = wallet.address.toString({ bounceable: false });
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    const body = beginCell()
      .storeUint(OPEN_ROUND_OPCODE, 32)
      .storeUint(0, 64)
      .storeUint(nextRoundId, 32)
      .storeCoins(toNano("0.5"))
      .storeUint(closesAt, 32)
      .endCell();

    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages: [internal({
        to: Address.parse(env.stakeVaultAddress),
        value: toNano("0.05"),
        bounce: false,
        body,
      })],
    });

    const confirmed = await waitForRoundId(client, env.stakeVaultAddress, nextRoundId);

    if (confirmed) {
      await sql`
        update challenge
        set on_chain_round_id = ${nextRoundId}
        where challenge_date = current_date
      `;
      return NextResponse.json({ ok: true, skipped: false, roundId: nextRoundId, closesAt, seqno, walletAddress });
    } else {
      return NextResponse.json({
        ok: false,
        error: "Tx sent but not confirmed on-chain within 30s. DB not updated. Will retry next run.",
        roundId: nextRoundId,
        seqno,
      }, { status: 202 });
    }

  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "OpenRound 실패";
    console.error("[cron/open-round] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

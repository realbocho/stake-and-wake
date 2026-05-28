import { NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { env } from "@/lib/env";
import { getSql } from "@/lib/db";

const FINALIZE_ROUND_OPCODE = 2016600536; // 0x78277dd8

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const adminKey = request.headers.get("x-admin-key");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = adminKey === env.adminApiKey;
  if (!isCron && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const mnemonic = process.env.OWNER_MNEMONIC?.split(" ");
  if (!mnemonic || mnemonic.length < 24)
    return NextResponse.json({ error: "OWNER_MNEMONIC 없음" }, { status: 500 });

  try {
    const sql = getSql();

    // 전날 challenge 조회
    const [challenge] = await sql<{ on_chain_round_id: number; status: string }[]>`
      select on_chain_round_id, status
      from challenge
      where challenge_date = current_date - interval '1 day'
      limit 1
    `;

    if (!challenge) return NextResponse.json({ error: "전날 challenge 없음" }, { status: 400 });
    if (challenge.status !== "settled") return NextResponse.json({ error: "close-round를 먼저 실행하세요" }, { status: 400 });
    if (!challenge.on_chain_round_id) return NextResponse.json({ error: "roundId 없음" }, { status: 400 });

    const roundId = challenge.on_chain_round_id;

    const client = new TonClient({
      endpoint: process.env.TON_NETWORK === "mainnet"
        ? "https://toncenter.com/api/v2/jsonRPC"
        : "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });

    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages: [internal({
        to: Address.parse(env.stakeVaultAddress),
        value: toNano("0.05"),
        bounce: false,
        body: beginCell()
          .storeUint(FINALIZE_ROUND_OPCODE, 32)
          .storeUint(0, 64)
          .storeUint(roundId, 32)
          .endCell(),
      })],
    });

    console.log(`[cron/finalize-round] FinalizeRound sent: roundId=${roundId}, seqno=${seqno}`);
    return NextResponse.json({ ok: true, roundId, seqno });

  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "finalize-round 실패";
    console.error("[cron/finalize-round] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

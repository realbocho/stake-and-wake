import { NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { env } from "@/lib/env";
import { getSql } from "@/lib/db";

const FINALIZE_ROUND_OPCODE = 2016600536; // 0x78277dd8
const CREDIT_WINNER_OPCODE  = 2221878711; // 0x8455b5b7

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

    const [challenge] = await sql<{
      id: string;
      on_chain_round_id: number;
      status: string;
    }[]>`
      select id, on_chain_round_id, status
      from challenge
      where challenge_date = current_date
      limit 1
    `;

    if (!challenge) return NextResponse.json({ error: "오늘 challenge 없음" }, { status: 400 });
    if (challenge.status === "settled") return NextResponse.json({ ok: true, skipped: true, reason: "already settled" });
    if (!challenge.on_chain_round_id) return NextResponse.json({ error: "roundId 없음" }, { status: 400 });

    const roundId = challenge.on_chain_round_id;

    // winner 목록 조회 (on_chain_credited = false인 것만)
    const winners = await sql<{
      user_id: string;
      wallet_address: string;
    }[]>`
      select p.user_id, u.wallet_address
      from challenge_participation p
      join app_user u on u.id = p.user_id
      where p.challenge_id = ${challenge.id}
        and p.status = 'settled'
        and p.on_chain_credited = false
        and u.wallet_address is not null
    `;

    const client = new TonClient({
      endpoint: process.env.TON_NETWORK === "mainnet"
        ? "https://toncenter.com/api/v2/jsonRPC"
        : "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });

    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const contract = client.open(wallet);
    const vaultAddr = Address.parse(env.stakeVaultAddress);

    // 1. FinalizeRound
    let seqno = await contract.getSeqno();
    await contract.sendTransfer({
      secretKey: keyPair.secretKey, seqno,
      messages: [internal({
        to: vaultAddr, value: toNano("0.05"), bounce: false,
        body: beginCell()
          .storeUint(FINALIZE_ROUND_OPCODE, 32)
          .storeUint(0, 64)
          .storeUint(roundId, 32)
          .endCell(),
      })],
    });
    console.log(`[finalize-round] FinalizeRound sent, seqno=${seqno}`);

    // 2. CreditWinner 각 winner에게
    let credited = 0;
    for (const winner of winners) {
      await new Promise(r => setTimeout(r, 2000));
      seqno = await contract.getSeqno();

      await contract.sendTransfer({
        secretKey: keyPair.secretKey, seqno,
        messages: [internal({
          to: vaultAddr, value: toNano("0.05"), bounce: false,
          body: beginCell()
            .storeUint(CREDIT_WINNER_OPCODE, 32)
            .storeUint(0, 64)
            .storeUint(roundId, 32)
            .storeAddress(Address.parse(winner.wallet_address))
            .endCell(),
        })],
      });

      await sql`
        update challenge_participation
        set on_chain_credited = true
        where challenge_id = ${challenge.id}
          and user_id = ${winner.user_id}
      `;

      console.log(`[finalize-round] CreditWinner ${winner.wallet_address}, seqno=${seqno}`);
      credited++;
    }

    return NextResponse.json({ ok: true, roundId, credited });

  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "finalize-round 실패";
    console.error("[finalize-round] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { assertAdmin } from "@/lib/admin";
import { env } from "@/lib/env";
import { getSql } from "@/lib/db";

const MARK_PARTICIPANT_OPCODE = 2075659638; // 0x7bd44d76

export async function POST(request: Request) {
  try {
    assertAdmin(request);
    const mnemonic = process.env.OWNER_MNEMONIC?.split(" ");
    if (!mnemonic || mnemonic.length < 24)
      return NextResponse.json({ error: "OWNER_MNEMONIC 없음" }, { status: 500 });

    const sql = getSql();
    const [challenge] = await sql<{ id: string; on_chain_round_id: number }[]>`
      select id, on_chain_round_id from challenge
      where challenge_date = current_date limit 1
    `;
    if (!challenge) return NextResponse.json({ error: "challenge 없음" }, { status: 400 });

    const participants = await sql<{ wallet_address: string; status: string }[]>`
      select u.wallet_address, p.status
      from challenge_participation p
      join app_user u on u.id = p.user_id
      where p.challenge_id = ${challenge.id}
        and p.status in ('settled', 'failed')
        and u.wallet_address is not null
    `;

    if (participants.length === 0)
      return NextResponse.json({ ok: true, marked: 0, reason: "no participants" });

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
    const roundId = challenge.on_chain_round_id;

    let marked = 0;
    for (const p of participants) {
      await new Promise(r => setTimeout(r, 2000));
      const seqno = await contract.getSeqno();
      const success = p.status === "settled";
      await contract.sendTransfer({
        secretKey: keyPair.secretKey, seqno,
        messages: [internal({
          to: vaultAddr, value: toNano("0.05"), bounce: false,
          body: beginCell()
            .storeUint(MARK_PARTICIPANT_OPCODE, 32)
            .storeUint(0, 64)
            .storeUint(roundId, 32)
            .storeAddress(Address.parse(p.wallet_address))
            .storeBit(success)
            .endCell(),
        })],
      });
      console.log(`[mark-participants] ${p.wallet_address} success=${success}, seqno=${seqno}`);
      marked++;
    }

    return NextResponse.json({ ok: true, marked, roundId });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "failed" }, { status: 500 });
  }
}

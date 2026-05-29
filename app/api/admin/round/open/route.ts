import { NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { assertAdmin } from "@/lib/admin";
import { env } from "@/lib/env";
import { getSql } from "@/lib/db";

const OPEN_ROUND_OPCODE = 51917385;

export async function POST(request: Request) {
  try {
    assertAdmin(request);
    const mnemonic = process.env.OWNER_MNEMONIC?.split(" ");
    if (!mnemonic || mnemonic.length < 24) return NextResponse.json({ error: "OWNER_MNEMONIC 없음" }, { status: 500 });

    const d = new Date();
    d.setUTCHours(23, 59, 59, 0);
    const closesAt = Math.floor(d.getTime() / 1000);

    const client = new TonClient({
      endpoint: process.env.TON_NETWORK === "mainnet" ? "https://toncenter.com/api/v2/jsonRPC" : "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const contract = client.open(wallet);
    const result = await client.runMethod(Address.parse(env.stakeVaultAddress), "getRoundState", []);
    const currentRoundId = Number(result.stack.readNumber());
    const nextRoundId = currentRoundId + 1;
    const seqno = await contract.getSeqno();
    await contract.sendTransfer({
      secretKey: keyPair.secretKey, seqno,
      messages: [internal({ to: Address.parse(env.stakeVaultAddress), value: toNano("0.05"), bounce: false,
        body: beginCell()
          .storeUint(OPEN_ROUND_OPCODE, 32)
          .storeUint(0, 64)
          .storeUint(nextRoundId, 32)
          .storeCoins(toNano("0.5"))
          .storeUint(closesAt, 32)
          .endCell()
      })],
    });

    // DB 업데이트
    const sql = getSql();
    await sql`
      update challenge set on_chain_round_id = ${nextRoundId}
      where challenge_date = current_date
    `;

    return NextResponse.json({ ok: true, roundId: nextRoundId, seqno });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "failed" }, { status: 500 });
  }
}

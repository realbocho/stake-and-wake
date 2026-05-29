import { NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { assertAdmin } from "@/lib/admin";
import { env } from "@/lib/env";

const FINALIZE_ROUND_OPCODE = 2016600536;

export async function POST(request: Request) {
  try {
    assertAdmin(request);
    const mnemonic = process.env.OWNER_MNEMONIC?.split(" ");
    if (!mnemonic || mnemonic.length < 24) return NextResponse.json({ error: "OWNER_MNEMONIC 없음" }, { status: 500 });

    const client = new TonClient({
      endpoint: process.env.TON_NETWORK === "mainnet" ? "https://toncenter.com/api/v2/jsonRPC" : "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
    const contract = client.open(wallet);
    const result = await client.runMethod(Address.parse(env.stakeVaultAddress), "getRoundState", []);
    const roundId = Number(result.stack.readNumber());
    const seqno = await contract.getSeqno();
    await contract.sendTransfer({
      secretKey: keyPair.secretKey, seqno,
      messages: [internal({ to: Address.parse(env.stakeVaultAddress), value: toNano("0.05"), bounce: false,
        body: beginCell().storeUint(FINALIZE_ROUND_OPCODE, 32).storeUint(0, 64).storeUint(roundId, 32).endCell()
      })],
    });
    return NextResponse.json({ ok: true, roundId, seqno });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "failed" }, { status: 500 });
  }
}

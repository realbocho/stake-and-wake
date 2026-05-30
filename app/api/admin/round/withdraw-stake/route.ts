import { NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { assertAdmin } from "@/lib/admin";
import { env } from "@/lib/env";

const WITHDRAW_STAKE_OPCODE = 2245961321; // 0x85D6FE69

export async function POST(request: Request) {
  try {
    assertAdmin(request);

    const body = await request.json() as { amount: number; to: string };
    if (!body.amount || !body.to) {
      return NextResponse.json({ error: "amount and to are required" }, { status: 400 });
    }

    const mnemonic = process.env.OWNER_MNEMONIC?.split(" ");
    if (!mnemonic || mnemonic.length < 24)
      return NextResponse.json({ error: "OWNER_MNEMONIC 없음" }, { status: 500 });

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
          .storeUint(WITHDRAW_STAKE_OPCODE, 32)
          .storeUint(0, 64)                          // queryId
          .storeCoins(toNano(body.amount.toString())) // amount
          .storeAddress(Address.parse(body.to))       // to
          .endCell(),
      })],
    });

    return NextResponse.json({ ok: true, amount: body.amount, to: body.to, seqno });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

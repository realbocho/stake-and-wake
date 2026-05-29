/**
 * POST /api/admin/round/reset
 * 현재 라운드를 강제로 CloseRound → FinalizeRound → OpenRound
 */
import { NextResponse } from "next/server";
import { TonClient, WalletContractV4, internal, toNano, Address, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { assertAdmin } from "@/lib/admin";
import { env } from "@/lib/env";
import { getSql } from "@/lib/db";

const CLOSE_ROUND_OPCODE    = 2771548579;
const FINALIZE_ROUND_OPCODE = 2016600536;
const OPEN_ROUND_OPCODE     = 51917385;

function getClosesAt(): number {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 0);
  return Math.floor(d.getTime() / 1000);
}

async function getContractRoundId(client: TonClient): Promise<number> {
  const result = await client.runMethod(Address.parse(env.stakeVaultAddress), "getRoundState", []);
  return Number(result.stack.readNumber());
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function POST(request: Request) {
  try {
    assertAdmin(request);

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
    const vaultAddr = Address.parse(env.stakeVaultAddress);

    const currentRoundId = await getContractRoundId(client);
    const nextRoundId = currentRoundId + 1;
    const closesAt = getClosesAt();

    // 1. CloseRound
    let seqno = await contract.getSeqno();
    await contract.sendTransfer({
      secretKey: keyPair.secretKey, seqno,
      messages: [internal({ to: vaultAddr, value: toNano("0.05"), bounce: false,
        body: beginCell().storeUint(CLOSE_ROUND_OPCODE, 32).storeUint(0, 64).storeUint(currentRoundId, 32).endCell()
      })],
    });
    await sleep(5000);

    // 2. FinalizeRound
    seqno = await contract.getSeqno();
    await contract.sendTransfer({
      secretKey: keyPair.secretKey, seqno,
      messages: [internal({ to: vaultAddr, value: toNano("0.05"), bounce: false,
        body: beginCell().storeUint(FINALIZE_ROUND_OPCODE, 32).storeUint(0, 64).storeUint(currentRoundId, 32).endCell()
      })],
    });
    await sleep(5000);

    // 3. OpenRound
    seqno = await contract.getSeqno();
    await contract.sendTransfer({
      secretKey: keyPair.secretKey, seqno,
      messages: [internal({ to: vaultAddr, value: toNano("0.05"), bounce: false,
        body: beginCell()
          .storeUint(OPEN_ROUND_OPCODE, 32)
          .storeUint(0, 64)
          .storeUint(nextRoundId, 32)
          .storeCoins(toNano("0.5"))
          .storeUint(closesAt, 32)
          .endCell()
      })],
    });
    await sleep(8000);

    // 컨트랙트 확인 후 DB 업데이트
    const confirmedRoundId = await getContractRoundId(client);
    if (confirmedRoundId === nextRoundId) {
      const sql = getSql();
      await sql`
        update challenge
        set on_chain_round_id = ${nextRoundId}
        where challenge_date = current_date
      `;
      return NextResponse.json({ ok: true, roundId: nextRoundId });
    } else {
      return NextResponse.json({
        ok: false,
        error: "Txs sent but not confirmed yet. Check tonviewer.",
        contractRoundId: confirmedRoundId,
        expectedRoundId: nextRoundId,
      }, { status: 202 });
    }

  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

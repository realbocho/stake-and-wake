/**
 * POST /api/admin/round/sync
 * 컨트랙트 실제 roundId를 읽어서 DB에 맞춤
 */
import { NextResponse } from "next/server";
import { TonClient, Address } from "@ton/ton";
import { assertAdmin } from "@/lib/admin";
import { env } from "@/lib/env";
import { getSql } from "@/lib/db";

export async function POST(request: Request) {
  try {
    assertAdmin(request);

    const client = new TonClient({
      endpoint: process.env.TON_NETWORK === "mainnet" ? "https://toncenter.com/api/v2/jsonRPC" : "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });

    const result = await client.runMethod(Address.parse(env.stakeVaultAddress), "getRoundState", []);
    const contractRoundId = Number(result.stack.readNumber());

    const sql = getSql();
    await sql`
      update challenge set on_chain_round_id = ${contractRoundId}
      where challenge_date = current_date
    `;

    return NextResponse.json({ ok: true, contractRoundId, message: "DB synced to contract roundId" });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "failed" }, { status: 500 });
  }
}

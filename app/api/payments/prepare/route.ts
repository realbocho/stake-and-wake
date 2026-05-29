import { ok, fail } from "@/lib/api";
import { loadBootstrap } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { buildStakePayload, toNanoTon } from "@/lib/ton";
import { paymentPrepareSchema } from "@/lib/validators-extra";
import { createPaymentIntent } from "@/lib/repositories/payments";
import { TonClient, Address } from "@ton/ton";
import { getSql } from "@/lib/db";

async function getContractRoundId(): Promise<number> {
  const client = new TonClient({
    endpoint: process.env.TON_NETWORK === "mainnet"
      ? "https://toncenter.com/api/v2/jsonRPC"
      : "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY,
  });
  const result = await client.runMethod(
    Address.parse(env.stakeVaultAddress),
    "getRoundState",
    []
  );
  return Number(result.stack.readNumber());
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = paymentPrepareSchema.parse(await request.json());
    const bootstrap = await loadBootstrap();
    const challenge = bootstrap.challenge;

    // 컨트랙트에서 실제 roundId 직접 조회
    const contractRoundId = await getContractRoundId();

    if (!contractRoundId || contractRoundId === 0) {
      return fail("Round is not open yet.", 400);
    }

    // DB가 컨트랙트와 다르면 자동 동기화
    if (challenge.onChainRoundId !== contractRoundId) {
      const sql = getSql();
      await sql`
        update challenge set on_chain_round_id = ${contractRoundId}
        where challenge_date = current_date
      `;
      console.log(`[prepare] DB roundId synced: ${challenge.onChainRoundId} → ${contractRoundId}`);
    }

    const payload = buildStakePayload({
      roundId: contractRoundId,
      telegramId: session.telegramId,
    });

    const intentId = await createPaymentIntent({
      userId: session.userId,
      challengeId: challenge.id,
      amountTon: body.stakeAmountTon,
      payload,
      walletAddress: body.walletAddress,
    });

    return ok({
      id: intentId,
      challengeId: challenge.id,
      amountTon: body.stakeAmountTon,
      amountNano: (toNanoTon(body.stakeAmountTon) + toNanoTon(0.05)).toString(),
      to: env.stakeVaultAddress,
      payload,
      validUntil: Math.floor(Date.now() / 1000) + 300,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Payment preparation failed.";
    return fail(message);
  }
}

import { ok, fail } from "@/lib/api";
import { loadBootstrap } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { buildStakePayload, toNanoTon } from "@/lib/ton";
import { paymentPrepareSchema } from "@/lib/validators-extra";
import { createPaymentIntent } from "@/lib/repositories/payments";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = paymentPrepareSchema.parse(await request.json());
    const bootstrap = await loadBootstrap();
    const challenge = bootstrap.challenge;
    const intentId = await createPaymentIntent({
      userId: session.userId,
      challengeId: challenge.id,
      amountTon: body.stakeAmountTon,
      payload: buildStakePayload({
        challengeId: challenge.id,
        telegramId: session.telegramId,
        wakeTime: body.wakeTime
      }),
      walletAddress: body.walletAddress
    });

    const payload = buildStakePayload({
      challengeId: challenge.id,
      telegramId: session.telegramId,
      wakeTime: body.wakeTime
    });

    return ok({
      id: intentId,
      challengeId: challenge.id,
      amountTon: body.stakeAmountTon,
      amountNano: toNanoTon(body.stakeAmountTon).toString(),
      to: env.stakeVaultAddress,
      payload,
      validUntil: Math.floor(Date.now() / 1000) + 300
    });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Payment preparation failed.";
    return fail(message);
  }
}

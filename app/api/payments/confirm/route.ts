import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { paymentConfirmSchema } from "@/lib/validators-extra";
import { confirmPaymentIntent } from "@/lib/repositories/payments";
import { stakeForTonight } from "@/lib/repositories/challenges";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = paymentConfirmSchema.parse(await request.json());
    await confirmPaymentIntent({
      intentId: body.intentId,
      userId: session.userId,
      boc: body.boc
    });
    await stakeForTonight({
      userId: session.userId,
      stakeAmountTon: body.stakeAmountTon,
      wakeTime: body.wakeTime
    });
    return ok({ ok: true });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Payment confirmation failed.";
    return fail(message);
  }
}

import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { checkInSchema } from "@/lib/validators";
import { passVerification } from "@/lib/repositories/challenges";
import { findUserById } from "@/lib/repositories/users";
import { sendSuccessToGroup } from "@/lib/telegram-bot";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = checkInSchema.parse(await request.json());
    const verification = await passVerification({
      userId: session.userId,
      challengeId: body.challengeId,
      reactionMs: body.reactionMs
    });
    const user = await findUserById(session.userId);
    if (user) {
      await sendSuccessToGroup({
        displayName: user.displayName,
        wakeTime: verification.wakeTime,
        profitTon: 1 + verification.weeklyBonusTon
      });
    }
    return ok({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Check-in failed.";
    return fail(message);
  }
}

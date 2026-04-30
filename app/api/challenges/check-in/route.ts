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

    // ── [수정] reactionMs는 서버에서 계산, response 필드는 참고용으로만 사용
    // passVerification 내부에서 시간 윈도우 + sleep_lock 상태도 검증합니다.
    const verification = await passVerification({
      userId: session.userId,
      challengeId: body.challengeId,
    });

    const user = await findUserById(session.userId);
    if (user) {
      await sendSuccessToGroup({
        displayName: user.displayName,
        wakeTime: verification.wakeTime,
        profitTon: 1 + verification.weeklyBonusTon
      });
    }

    return ok({ ok: true, reactionMs: verification.reactionMs });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Check-in failed.";
    return fail(message);
  }
}

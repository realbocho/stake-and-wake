import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { checkInSchema } from "@/lib/validators";
import { passVerification } from "@/lib/repositories/challenges";
import { findUserById } from "@/lib/repositories/users";
import { sendSuccessToGroup } from "@/lib/telegram-bot";
import { getSql } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = checkInSchema.parse(await request.json());

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

    // 온체인 Claim에 필요한 roundId 반환
    const sql = getSql();
    const [challenge] = await sql<{ on_chain_round_id: number }[]>`
      select on_chain_round_id
      from challenge
      where id = ${body.challengeId}
      limit 1
    `;

    return ok({
      ok: true,
      reactionMs: verification.reactionMs,
      onChainRoundId: challenge?.on_chain_round_id ?? null,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Check-in failed.";
    return fail(message);
  }
}

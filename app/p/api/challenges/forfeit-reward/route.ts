/**
 * POST /api/challenges/forfeit-reward
 *
 * 유저가 온체인 Claim을 거절/무시했을 때 호출.
 * - DB에서 강제 claimed 처리 (paidSuccessCount 문제 방지)
 * - settled_reward_ton을 0으로 초기화
 * - 해당 보상금은 다음 라운드 pool에 자동 편입 (operator_injection_ton으로 적립)
 */

import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { getSql } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = (await request.json().catch(() => ({}))) as { challengeId?: string };
    if (!body.challengeId) return fail("challengeId required", 400);

    const sql = getSql();

    // 1. 해당 participation 조회
    const [participation] = await sql<{
      id: string;
      status: string;
      settled_reward_ton: number;
      challenge_id: string;
    }[]>`
      select id, status, settled_reward_ton, challenge_id
      from challenge_participation
      where challenge_id = ${body.challengeId}
        and user_id = ${session.userId}
      limit 1
    `;

    if (!participation) return fail("Participation not found", 404);
    if (participation.status !== "settled") {
      return ok({ ok: true, skipped: true, reason: "not in settled state" });
    }

    const forfeitedTon = Number(participation.settled_reward_ton);

    await sql.begin(async (tx) => {
      // 2. claimed 처리 + 보상 0으로
      await tx`
        update challenge_participation
        set status = 'claimed',
            settled_reward_ton = 0
        where id = ${participation.id}
      `;

      // 3. net_profit_ton에서도 제거 (settle 시 이미 더해졌을 경우)
      await tx`
        update app_user
        set net_profit_ton = greatest(0, net_profit_ton - ${forfeitedTon})
        where id = ${session.userId}
      `;

      // 4. 포기된 보상을 다음 라운드 pool로 편입
      //    내일 challenge가 있으면 거기에, 없으면 오늘 챌린지의 pool에 적립
      if (forfeitedTon > 0) {
        await tx`
          update challenge
          set operator_injection_ton = operator_injection_ton + ${forfeitedTon}
          where challenge_date = current_date + interval '1 day'
             or (
               challenge_date = current_date
               and not exists (
                 select 1 from challenge where challenge_date = current_date + interval '1 day'
               )
             )
          limit 1
        `;
      }
    });

    return ok({
      ok: true,
      forfeitedTon,
      message: "Reward forfeited and added to the next round's prize pool.",
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Forfeit failed";
    return fail(message, 500);
  }
}

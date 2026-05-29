import { randomUUID } from "crypto";
import { getSql } from "@/lib/db";
import { env } from "@/lib/env";
import { calculatePoolPayout, calculateWinnerReward } from "@/lib/rewards";
import type { ChallengeView, LeaderboardEntry } from "@/lib/types";

type ChallengeRow = {
  id: string;
  title: string;
  status: ChallengeView["status"];
  wake_time: string;
  random_check_in_from: string;
  random_check_in_to: string;
  pool_ton: number;
  operator_injection_ton: number;
  on_chain_round_id: number;
};

function mapChallenge(row: ChallengeRow): ChallengeView {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    wakeTime: row.wake_time,
    randomCheckInFrom: row.random_check_in_from,
    randomCheckInTo: row.random_check_in_to,
    poolTon: Number(row.pool_ton),
    operatorInjectionTon: Number(row.operator_injection_ton ?? 0),
    onChainRoundId: Number(row.on_chain_round_id ?? 0)
  };
}

/** 현재 시각을 해당 timezone 기준 "시간 * 60 + 분" 으로 반환 */
function getLocalMinutes(timezone: string): number {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h * 60 + m;
  } catch {
    const now = new Date();
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

function getLocalDate(timezone: string): string {
  try {
    const now = new Date();
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function timeStringToDateInTimezone(hhmm: string, timezone: string): Date {
  const localDate = getLocalDate(timezone);
  const [h, m] = hhmm.split(":").map(Number);
  const localDateObj = new Date(`${localDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  const tzOffset =
    new Date().getTime() -
    new Date(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(new Date())
    ).getTime();
  return new Date(localDateObj.getTime() + tzOffset);
}

export async function getActiveChallengeForUser(userId: string) {
  const sql = getSql();
  const [row] = await sql<ChallengeRow[]>`
    select c.id, c.title, p.status, p.wake_time, p.random_check_in_from,
           p.random_check_in_to, c.pool_ton, c.operator_injection_ton,
           c.on_chain_round_id
    from challenge_participation p
    join challenge c on c.id = p.challenge_id
    where p.user_id = ${userId}
      and c.challenge_date >= current_date - interval '1 day'
    order by c.challenge_date desc
    limit 1
  `;
  return row ? mapChallenge(row) : null;
}

export async function getOrCreateTonightChallenge() {
  const sql = getSql();
  const [existing] = await sql<ChallengeRow[]>`
    select id, title, 'open'::text as status, default_wake_time as wake_time,
           default_random_from as random_check_in_from,
           default_random_to as random_check_in_to,
           pool_ton, operator_injection_ton, on_chain_round_id
    from challenge
    where challenge_date = current_date
    limit 1
  `;
  if (existing) return mapChallenge(existing);

  const onChainRoundId = 0;

  const id = randomUUID();
  await sql`
    insert into challenge (
      id, challenge_date, title, default_wake_time, default_random_from, default_random_to,
      min_stake_ton, daily_fee_ton, pool_ton, platform_fee_rate, on_chain_round_id
    ) values (
      ${id}, current_date, 'Morning Discipline Pool', '05:30', '05:18', '05:42',
      0.5, ${env.dailyFeeTon}, 0, ${env.platformFeeRate}, ${onChainRoundId}
    )
  `;
  return {
    id,
    title: "Morning Discipline Pool",
    status: "open",
    wakeTime: "05:30",
    randomCheckInFrom: "05:18",
    randomCheckInTo: "05:42",
    poolTon: 0,
    operatorInjectionTon: 0,
    onChainRoundId
  } satisfies ChallengeView;
}

export async function stakeForTonight(input: {
  userId: string;
  stakeAmountTon: number;
  wakeTime: string;
  durationDays: number;
}) {
  const sql = getSql();
  const challenge = await getOrCreateTonightChallenge();
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + input.durationDays);

  await sql.begin(async (transaction) => {
    await transaction`
      insert into challenge_participation (
        id, challenge_id, user_id, stake_amount_ton, wake_time, random_check_in_from,
        random_check_in_to, status, anti_cheat_flags, duration_days, ends_at
      ) values (
        ${randomUUID()}, ${challenge.id}, ${input.userId}, ${input.stakeAmountTon},
        ${input.wakeTime}, '05:18', '05:42', 'staked', '{}',
        ${input.durationDays}, ${endsAt.toISOString()}
      )
      on conflict (challenge_id, user_id)
      do update set
        stake_amount_ton = excluded.stake_amount_ton,
        wake_time = excluded.wake_time,
        duration_days = excluded.duration_days,
        ends_at = excluded.ends_at,
        status = 'staked'
    `;

    await transaction`
      update challenge
      set status = 'active',
          pool_ton = (
        select coalesce(sum(stake_amount_ton), 0)
        from challenge_participation
        where challenge_id = ${challenge.id}
      )
      where id = ${challenge.id}
    `;
  });
}

export async function closeTodayChallenge() {
  const sql = getSql();
  await sql`
    update challenge
    set status = 'closed'
    where challenge_date = current_date
  `;
}

export async function markSleepMode(input: { userId: string; deviceIdHash: string }) {
  const sql = getSql();
  await sql`
    update challenge_participation p
    set status = 'sleep_locked',
        sleep_locked_at = now(),
        device_id_hash = ${input.deviceIdHash}
    from challenge c
    where p.challenge_id = c.id
      and p.user_id = ${input.userId}
      and c.challenge_date = current_date
      and p.status = 'staked'
  `;
}

export async function logActivity(input: {
  userId: string;
  hidden: boolean;
  timestamp: string;
}) {
  const sql = getSql();
  await sql`
    insert into anti_cheat_event (id, user_id, hidden, observed_at)
    values (${randomUUID()}, ${input.userId}, ${input.hidden}, ${input.timestamp})
  `;
}

export async function passVerification(input: {
  userId: string;
  challengeId: string;
}) {
  const sql = getSql();

  const [participation] = await sql<{
    wake_time: string;
    random_check_in_from: string;
    random_check_in_to: string;
    status: string;
    sleep_locked_at: string | null;
    user_timezone: string | null;
  }[]>`
    select p.wake_time, p.random_check_in_from, p.random_check_in_to,
           p.status, p.sleep_locked_at, u.timezone as user_timezone
    from challenge_participation p
    join app_user u on u.id = p.user_id
    where p.challenge_id = ${input.challengeId}
      and p.user_id = ${input.userId}
    limit 1
  `;

  if (!participation) {
    throw new Error("Participation record not found.");
  }

  if (participation.status !== "sleep_locked") {
    throw new Error("You must enable Sleep Lock before completing a wake check-in.");
  }

  const timezone = participation.user_timezone ?? "UTC";
  const now = new Date();

  const localMins = getLocalMinutes(timezone);
  const [fromH, fromM] = participation.random_check_in_from.split(":").map(Number);
  const [toH, toM] = participation.random_check_in_to.split(":").map(Number);
  const fromMins = fromH * 60 + fromM;
  const toMins = toH * 60 + toM;

  if (localMins < fromMins || localMins > toMins) {
    throw new Error(
      `Wake check-in is only available between ${participation.random_check_in_from} and ${participation.random_check_in_to} (${timezone}).`
    );
  }

  const sleepLockedAt = participation.sleep_locked_at ? new Date(participation.sleep_locked_at) : now;
  const reactionMs = Math.max(0, now.getTime() - sleepLockedAt.getTime());

  await sql.begin(async (transaction) => {
    await transaction`
      update challenge_participation
      set status = 'passed',
          verified_at = now(),
          reaction_ms = ${reactionMs}
      where challenge_id = ${input.challengeId}
        and user_id = ${input.userId}
    `;

    await transaction`
      update app_user
      set success_streak = success_streak + 1
      where id = ${input.userId}
    `;
  });

  return {
    wakeTime: participation.wake_time,
    reactionMs,
    weeklyBonusTon: 0
  };
}

export async function settleByTimezone() {
  const sql = getSql();

  const participants = await sql<{
    participation_id: string;
    user_id: string;
    status: string;
    stake_amount_ton: number;
    challenge_id: string;
    user_timezone: string | null;
  }[]>`
    select p.id as participation_id, p.user_id, p.status,
           p.stake_amount_ton, p.challenge_id,
           u.timezone as user_timezone
    from challenge_participation p
    join app_user u on u.id = p.user_id
    join challenge c on c.id = p.challenge_id
    where p.status in ('staked', 'sleep_locked', 'passed')
      and c.challenge_date = current_date
  `;

  const toSettle = participants.filter((p) => {
    const tz = p.user_timezone ?? "UTC";
    const localMins = getLocalMinutes(tz);
    if (p.status === "sleep_locked") return false;
    if (p.status === "passed") return false;
    return localMins >= 6 * 60;
  });

  if (toSettle.length === 0) return { settled: 0 };

  const byChallengeId = new Map<string, typeof toSettle>();
  for (const p of toSettle) {
    const group = byChallengeId.get(p.challenge_id) ?? [];
    group.push(p);
    byChallengeId.set(p.challenge_id, group);
  }

  let totalSettled = 0;

  for (const [challengeId, group] of byChallengeId) {
    const winners = group.filter((p) => p.status === "passed");
    const losers = group.filter(
      (p) => p.status !== "passed" && p.status !== "sleep_locked"
    );
    const failedStakeTon = losers.reduce((sum, p) => sum + Number(p.stake_amount_ton), 0);
    const totalSuccessStakeTon = winners.reduce((sum, p) => sum + Number(p.stake_amount_ton), 0);

    const [injRow] = await sql<{ operator_injection_ton: number }[]>`
      select operator_injection_ton from challenge where id = ${challengeId} limit 1
    `;
    const operatorInjectionTon = Number(injRow?.operator_injection_ton ?? 0);

    const payout = calculatePoolPayout({
      failedStakeTon,
      totalSuccessStakeTon,
      operatorInjectionTon
    });
    const averageWinnerRewardTon = winners.length > 0 ? payout.distributablePool / winners.length : 0;

    await sql.begin(async (transaction) => {
      for (const loser of losers) {
        await transaction`
          update challenge_participation
          set status = 'failed', settled_reward_ton = 0
          where id = ${loser.participation_id}
        `;
      }

      for (const winner of winners) {
        const reward = calculateWinnerReward({
          distributablePool: payout.distributablePool,
          myStakeTon: Number(winner.stake_amount_ton),
          totalSuccessStakeTon
        });
        // 원금(stake_amount_ton) + 보상(losers pool 분배분)을 합산해 반환
        const totalReturn = reward + Number(winner.stake_amount_ton);

        await transaction`
          update challenge_participation
          set status = 'settled', settled_reward_ton = ${reward}
          where id = ${winner.participation_id}
        `;

        await transaction`
          update app_user
          set net_profit_ton = net_profit_ton + ${totalReturn}
          where id = ${winner.user_id}
        `;
      }

      const [remaining] = await transaction<{ cnt: number }[]>`
        select count(*)::int as cnt
        from challenge_participation
        where challenge_id = ${challengeId}
          and status in ('staked', 'sleep_locked', 'passed')
      `;
      if ((remaining?.cnt ?? 0) === 0) {
        await transaction`
          update challenge
          set status = 'settled',
              platform_fee_ton = ${payout.platformFeeTon},
              per_winner_reward_ton = ${averageWinnerRewardTon}
          where id = ${challengeId}
        `;
      }
    });

    totalSettled += group.length;
  }

  return { settled: totalSettled };
}

export async function settleTodayChallenge(challengeDate?: string) {
  const sql = getSql();
  const [challenge] = await sql<{
    id: string;
    platform_fee_rate: number;
    operator_injection_ton: number;
  }[]>`
    select id, platform_fee_rate, operator_injection_ton
    from challenge
    where challenge_date = coalesce(${challengeDate ?? null}::date, current_date)
    limit 1
  `;

  if (!challenge) {
    throw new Error("No challenge exists for the requested day.");
  }

  const participants = await sql<{
    participation_id: string;
    user_id: string;
    status: string;
    stake_amount_ton: number;
  }[]>`
    select p.id as participation_id, p.user_id, p.status, p.stake_amount_ton
    from challenge_participation p
    where p.challenge_id = ${challenge.id}
  `;

  const winners = participants.filter((item) => item.status === "passed");
  const losers = participants.filter(
    (item) => item.status !== "passed" && item.status !== "sleep_locked"
  );
  const failedStakeTon = losers.reduce((sum, item) => sum + Number(item.stake_amount_ton), 0);
  const totalSuccessStakeTon = winners.reduce((sum, item) => sum + Number(item.stake_amount_ton), 0);
  const payout = calculatePoolPayout({
    failedStakeTon,
    totalSuccessStakeTon,
    operatorInjectionTon: Number(challenge.operator_injection_ton ?? 0)
  });

  const averageWinnerRewardTon = winners.length > 0 ? payout.distributablePool / winners.length : 0;

  await sql.begin(async (transaction) => {
    await transaction`
      update challenge
      set status = 'settled',
          platform_fee_ton = ${payout.platformFeeTon},
          per_winner_reward_ton = ${averageWinnerRewardTon}
      where id = ${challenge.id}
    `;

    for (const loser of losers) {
      await transaction`
        update challenge_participation
        set status = 'failed', settled_reward_ton = 0
        where id = ${loser.participation_id}
      `;
    }

    for (const winner of winners) {
      const reward = calculateWinnerReward({
        distributablePool: payout.distributablePool,
        myStakeTon: Number(winner.stake_amount_ton),
        totalSuccessStakeTon
      });
      // 원금(stake_amount_ton) + 보상(losers pool 분배분)을 합산해 반환
      const totalReturn = reward + Number(winner.stake_amount_ton);

      await transaction`
        update challenge_participation
        set status = 'settled', settled_reward_ton = ${reward}
        where id = ${winner.participation_id}
      `;

      await transaction`
        update app_user
        set net_profit_ton = net_profit_ton + ${totalReturn}
        where id = ${winner.user_id}
      `;
    }
  });

  return {
    challengeId: challenge.id,
    winners: winners.length,
    failedStakeTon,
    perWinnerTon: averageWinnerRewardTon,
    platformFeeTon: payout.platformFeeTon,
    operatorInjectionTon: payout.operatorInjectionTon
  };
}

export async function getLeaderboard() {
  const sql = getSql();
  const rows = await sql<{
    id: string;
    display_name: string;
    success_count: number;
    best_wake_time: string;
    net_profit_ton: number;
  }[]>`
    select u.id, u.display_name,
           count(p.id) filter (where p.status in ('passed', 'settled'))::int as success_count,
           coalesce(min(p.wake_time), '05:30') as best_wake_time,
           u.net_profit_ton
    from app_user u
    left join challenge_participation p on p.user_id = u.id
    group by u.id
    order by u.net_profit_ton desc, success_count desc
    limit 10
  `;

  return rows.map(
    (row) =>
      ({
        userId: row.id,
        displayName: row.display_name,
        successCount: Number(row.success_count),
        bestWakeTime: row.best_wake_time,
        netProfitTon: Number(row.net_profit_ton)
      }) satisfies LeaderboardEntry
  );
}

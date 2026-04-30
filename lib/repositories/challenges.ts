import { randomUUID } from "crypto";
import { getSql } from "@/lib/db";
import { env } from "@/lib/env";
import {
  calculatePoolPayout,
  calculateWeeklyPerfectGroupBonus
} from "@/lib/rewards";
import type { ChallengeView, LeaderboardEntry } from "@/lib/types";

type ChallengeRow = {
  id: string;
  title: string;
  status: ChallengeView["status"];
  wake_time: string;
  random_check_in_from: string;
  random_check_in_to: string;
  pool_ton: number;
};

function mapChallenge(row: ChallengeRow): ChallengeView {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    wakeTime: row.wake_time,
    randomCheckInFrom: row.random_check_in_from,
    randomCheckInTo: row.random_check_in_to,
    poolTon: Number(row.pool_ton)
  };
}

// ── [수정] HH:MM 문자열 → 오늘 날짜 기준 Date 객체 ─────────────────────────
function timeStringToTodayDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export async function getActiveChallengeForUser(userId: string) {
  const sql = getSql();
  const [row] = await sql<ChallengeRow[]>`
    select c.id, c.title, p.status, p.wake_time, p.random_check_in_from, p.random_check_in_to, c.pool_ton
    from challenge_participation p
    join challenge c on c.id = p.challenge_id
    where p.user_id = ${userId}
      and c.challenge_date = current_date
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
           pool_ton
    from challenge
    where challenge_date = current_date
    limit 1
  `;
  if (existing) return mapChallenge(existing);

  const id = randomUUID();
  await sql`
    insert into challenge (
      id, challenge_date, title, default_wake_time, default_random_from, default_random_to,
      min_stake_ton, daily_fee_ton, pool_ton, platform_fee_rate
    ) values (
      ${id}, current_date, 'Morning Discipline Pool', '05:30', '05:18', '05:42',
      0.5, ${env.dailyFeeTon}, 0, ${env.platformFeeRate}
    )
  `;
  return {
    id,
    title: "Morning Discipline Pool",
    status: "open",
    wakeTime: "05:30",
    randomCheckInFrom: "05:18",
    randomCheckInTo: "05:42",
    poolTon: 0
  } satisfies ChallengeView;
}

// ── [수정] durationDays 파라미터 추가 + DB 저장 ───────────────────────────
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
        select coalesce(sum(stake_amount_ton), 0) from challenge_participation where challenge_id = ${challenge.id}
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

// ── [수정] 기상 시간 윈도우 + sleep_lock 상태 검증 ───────────────────────────
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
  }[]>`
    select wake_time, random_check_in_from, random_check_in_to, status, sleep_locked_at
    from challenge_participation
    where challenge_id = ${input.challengeId}
      and user_id = ${input.userId}
    limit 1
  `;

  if (!participation) {
    throw new Error("참여 정보를 찾을 수 없습니다.");
  }

  // ── [수정] sleep_locked 상태 검사 ─────────────────────────────────────
  if (participation.status !== "sleep_locked") {
    throw new Error("Sleep Lock을 먼저 활성화해야 기상 인증이 가능합니다.");
  }

  // ── [수정] 서버 시간으로 기상 윈도우 검증 ─────────────────────────────
  const now = new Date();
  const fromDate = timeStringToTodayDate(participation.random_check_in_from);
  const toDate = timeStringToTodayDate(participation.random_check_in_to);

  if (now < fromDate || now > toDate) {
    const from = participation.random_check_in_from;
    const to = participation.random_check_in_to;
    throw new Error(
      `기상 인증 가능 시간이 아닙니다. 인증 가능 시간: ${from} ~ ${to}`
    );
  }

  // ── [수정] reactionMs를 서버에서 직접 계산 ────────────────────────────
  const sleepLockedAt = participation.sleep_locked_at
    ? new Date(participation.sleep_locked_at)
    : now;
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

    // ── [수정] success_streak만 증가 (net_profit은 정산 시 반영) ──────────
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

export async function settleTodayChallenge(challengeDate?: string) {
  const sql = getSql();
  const [challenge] = await sql<{
    id: string;
    platform_fee_rate: number;
  }[]>`
    select id, platform_fee_rate
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
    group_member_count: number;
  }[]>`
    select p.id as participation_id, p.user_id, p.status, p.stake_amount_ton, u.group_member_count
    from challenge_participation p
    join app_user u on u.id = p.user_id
    where p.challenge_id = ${challenge.id}
  `;

  const winners = participants.filter((item) => item.status === "passed");
  const losers = participants.filter((item) => item.status !== "passed");
  const failedStakeTon = losers.reduce((sum, item) => sum + Number(item.stake_amount_ton), 0);
  const payout = calculatePoolPayout({
    failedStakeTon,
    successCount: winners.length
  });

  await sql.begin(async (transaction) => {
    await transaction`
      update challenge
      set status = 'settled',
          platform_fee_ton = ${payout.platformFeeTon},
          per_winner_reward_ton = ${payout.perWinnerTon}
      where id = ${challenge.id}
    `;

    for (const loser of losers) {
      await transaction`
        update challenge_participation
        set status = 'failed',
            settled_reward_ton = 0
        where id = ${loser.participation_id}
      `;
    }

    for (const winner of winners) {
      const groupBonus = calculateWeeklyPerfectGroupBonus(winner.group_member_count);
      const totalReward = payout.perWinnerTon + groupBonus;

      await transaction`
        update challenge_participation
        set status = 'settled',
            settled_reward_ton = ${totalReward}
        where id = ${winner.participation_id}
      `;

      // ── [수정] net_profit_ton을 정산 시점에 실제 증가 ──────────────────
      await transaction`
        update app_user
        set net_profit_ton = net_profit_ton + ${totalReward}
        where id = ${winner.user_id}
      `;
    }
  });

  return {
    challengeId: challenge.id,
    winners: winners.length,
    failedStakeTon,
    perWinnerTon: payout.perWinnerTon,
    platformFeeTon: payout.platformFeeTon
  };
}

// ── [수정] leaderboard: success_count를 streak이 아닌 실제 passed 건수로 ──
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

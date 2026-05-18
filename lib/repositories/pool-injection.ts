import { randomUUID } from "crypto";
import { getSql } from "@/lib/db";

export type InjectionSource = "manual" | "scheduled_daily" | "scheduled_weekly";
export type ScheduleFrequency = "daily" | "weekly";

// ─────────────────────────────────────────────────────────
// 단일 주입 (오늘 챌린지에 즉시 적용)
// ─────────────────────────────────────────────────────────

/**
 * 오늘(또는 지정 날짜) 챌린지의 실패자 풀에 TON을 직접 주입한다.
 * challenge.operator_injection_ton 에 누적하고 이력 테이블에 기록한다.
 */
export async function injectIntoPool(input: {
  amountTon: number;
  source?: InjectionSource;
  note?: string;
  challengeDate?: string; // YYYY-MM-DD, 생략하면 today
}) {
  const sql = getSql();

  // 대상 챌린지 조회 (없으면 오늘자 생성 없이 에러)
  const [challenge] = await sql<{ id: string; status: string }[]>`
    select id, status
    from challenge
    where challenge_date = coalesce(${input.challengeDate ?? null}::date, current_date)
    limit 1
  `;
  if (!challenge) {
    throw new Error("No challenge found for the specified date. Create it first.");
  }

  const source = input.source ?? "manual";
  const injectionId = randomUUID();

  await sql.begin(async (tx) => {
    // 챌린지 누적 주입량 업데이트
    await tx`
      update challenge
      set operator_injection_ton = operator_injection_ton + ${input.amountTon}
      where id = ${challenge.id}
    `;

    // 이력 기록
    await tx`
      insert into operator_pool_injection (id, challenge_id, amount_ton, source, note)
      values (${injectionId}, ${challenge.id}, ${input.amountTon}, ${source}, ${input.note ?? null})
    `;
  });

  return { injectionId, challengeId: challenge.id, amountTon: input.amountTon };
}

// ─────────────────────────────────────────────────────────
// 주입 이력 조회
// ─────────────────────────────────────────────────────────

export async function getInjectionHistory(limit = 50) {
  const sql = getSql();
  const rows = await sql<{
    id: string;
    challenge_id: string;
    challenge_date: string;
    amount_ton: number;
    source: string;
    note: string | null;
    injected_by: string;
    created_at: string;
  }[]>`
    select i.id, i.challenge_id, c.challenge_date, i.amount_ton,
           i.source, i.note, i.injected_by, i.created_at
    from operator_pool_injection i
    join challenge c on c.id = i.challenge_id
    order by i.created_at desc
    limit ${limit}
  `;
  return rows;
}

// ─────────────────────────────────────────────────────────
// 스케줄 관리
// ─────────────────────────────────────────────────────────

export async function listSchedules() {
  const sql = getSql();
  return sql<{
    id: string;
    frequency: string;
    amount_ton: number;
    day_of_week: number | null;
    enabled: boolean;
    note: string | null;
    last_run_at: string | null;
    created_at: string;
  }[]>`
    select id, frequency, amount_ton, day_of_week, enabled, note, last_run_at, created_at
    from operator_injection_schedule
    order by created_at
  `;
}

export async function upsertSchedule(input: {
  id?: string;
  frequency: ScheduleFrequency;
  amountTon: number;
  dayOfWeek?: number | null; // weekly 전용 (0=일 ~ 6=토)
  enabled?: boolean;
  note?: string;
}) {
  const sql = getSql();
  const id = input.id ?? randomUUID();

  await sql`
    insert into operator_injection_schedule
      (id, frequency, amount_ton, day_of_week, enabled, note, updated_at)
    values (
      ${id},
      ${input.frequency},
      ${input.amountTon},
      ${input.dayOfWeek ?? null},
      ${input.enabled ?? true},
      ${input.note ?? null},
      now()
    )
    on conflict (id)
    do update set
      frequency    = excluded.frequency,
      amount_ton   = excluded.amount_ton,
      day_of_week  = excluded.day_of_week,
      enabled      = excluded.enabled,
      note         = excluded.note,
      updated_at   = now()
  `;
  return id;
}

export async function deleteSchedule(id: string) {
  const sql = getSql();
  await sql`delete from operator_injection_schedule where id = ${id}`;
}

// ─────────────────────────────────────────────────────────
// 크론잡에서 호출: 활성 스케줄에 따라 오늘 자동 주입
// ─────────────────────────────────────────────────────────

/**
 * 활성화된 스케줄을 모두 확인하고,
 * 오늘 아직 실행하지 않은 스케줄을 오늘 챌린지에 주입한다.
 *
 * - daily  : 오늘 last_run_at 이 없거나 오늘 날짜가 아닌 경우 실행
 * - weekly : day_of_week 가 오늘 요일과 일치하고 이번 주 아직 미실행인 경우 실행
 */
export async function runScheduledInjections() {
  const sql = getSql();

  const schedules = await sql<{
    id: string;
    frequency: string;
    amount_ton: number;
    day_of_week: number | null;
    last_run_at: string | null;
  }[]>`
    select id, frequency, amount_ton, day_of_week, last_run_at
    from operator_injection_schedule
    where enabled = true
  `;

  const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const todayDow = new Date().getUTCDay(); // 0=일 ~ 6=토

  const results: Array<{ scheduleId: string; skipped: boolean; reason?: string; result?: object }> = [];

  for (const schedule of schedules) {
    const lastRun = schedule.last_run_at ? schedule.last_run_at.slice(0, 10) : null;

    // daily: 오늘 이미 실행했으면 스킵
    if (schedule.frequency === "daily") {
      if (lastRun === todayUtc) {
        results.push({ scheduleId: schedule.id, skipped: true, reason: "already_run_today" });
        continue;
      }
    }

    // weekly: 요일 불일치 또는 이번 주 이미 실행했으면 스킵
    if (schedule.frequency === "weekly") {
      if (schedule.day_of_week !== todayDow) {
        results.push({ scheduleId: schedule.id, skipped: true, reason: "wrong_day_of_week" });
        continue;
      }
      // 이번 주 같은 요일에 이미 실행했는지 확인
      if (lastRun) {
        const lastDate = new Date(lastRun);
        const diffDays = (new Date(todayUtc).getTime() - lastDate.getTime()) / 86_400_000;
        if (diffDays < 7) {
          results.push({ scheduleId: schedule.id, skipped: true, reason: "already_run_this_week" });
          continue;
        }
      }
    }

    // 실행
    try {
      const source: InjectionSource =
        schedule.frequency === "daily" ? "scheduled_daily" : "scheduled_weekly";

      const result = await injectIntoPool({
        amountTon: Number(schedule.amount_ton),
        source,
        note: `Auto-injected by schedule ${schedule.id}`,
      });

      // last_run_at 업데이트
      await sql`
        update operator_injection_schedule
        set last_run_at = now(), updated_at = now()
        where id = ${schedule.id}
      `;

      results.push({ scheduleId: schedule.id, skipped: false, result });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown_error";
      results.push({ scheduleId: schedule.id, skipped: true, reason });
    }
  }

  return results;
}

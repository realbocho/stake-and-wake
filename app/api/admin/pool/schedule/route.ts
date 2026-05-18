/**
 * GET  /api/admin/pool/schedule   — 전체 스케줄 목록
 * POST /api/admin/pool/schedule   — 스케줄 생성 또는 수정
 * DELETE /api/admin/pool/schedule — 스케줄 삭제  (?id=<uuid>)
 *
 * POST Body:
 *   id          string   (optional) 기존 스케줄 UUID → 수정, 생략 → 신규 생성
 *   frequency   "daily" | "weekly"
 *   amountTon   number   양수
 *   dayOfWeek   0-6      (weekly 전용, 0=일 ~ 6=토)
 *   enabled     boolean  (optional, default true)
 *   note        string   (optional)
 *
 * Headers:
 *   x-admin-key: <ADMIN_API_KEY>
 */

import { ok, fail } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { listSchedules, upsertSchedule, deleteSchedule } from "@/lib/repositories/pool-injection";
import { z } from "zod";

const upsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    frequency: z.enum(["daily", "weekly"]),
    amountTon: z.number().positive(),
    dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
    enabled: z.boolean().optional(),
    note: z.string().max(200).optional(),
  })
  .refine(
    (d) => d.frequency !== "weekly" || d.dayOfWeek != null,
    { message: "dayOfWeek is required when frequency is 'weekly'", path: ["dayOfWeek"] }
  );

export async function GET(request: Request) {
  try {
    assertAdmin(request);
    const schedules = await listSchedules();
    return ok({ schedules });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to list schedules.";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

export async function POST(request: Request) {
  try {
    assertAdmin(request);
    const body = upsertSchema.parse(await request.json());
    const id = await upsertSchedule({
      id: body.id,
      frequency: body.frequency,
      amountTon: body.amountTon,
      dayOfWeek: body.dayOfWeek,
      enabled: body.enabled,
      note: body.note,
    });
    return ok({ success: true, id });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to save schedule.";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

export async function DELETE(request: Request) {
  try {
    assertAdmin(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return fail("id query param is required.");
    await deleteSchedule(id);
    return ok({ success: true, deleted: id });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to delete schedule.";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

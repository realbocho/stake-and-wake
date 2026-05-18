/**
 * POST /api/admin/pool/inject
 *
 * 운영자가 실패자 풀에 TON을 직접 주입한다.
 * 오늘(또는 지정 날짜)의 챌린지 pool_ton · operator_injection_ton 을 즉시 증가시키고
 * 이력을 남긴다.
 *
 * Body:
 *   amountTon      number   (required) 주입할 TON 양 (양수)
 *   challengeDate  string   (optional) YYYY-MM-DD, 생략 시 today
 *   note           string   (optional) 메모
 *
 * Headers:
 *   x-admin-key: <ADMIN_API_KEY>
 */

import { ok, fail } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { injectIntoPool } from "@/lib/repositories/pool-injection";
import { z } from "zod";

const schema = z.object({
  amountTon: z.number().positive("amountTon must be a positive number"),
  challengeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "challengeDate must be YYYY-MM-DD")
    .optional(),
  note: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    assertAdmin(request);

    const body = schema.parse(await request.json());
    const result = await injectIntoPool({
      amountTon: body.amountTon,
      source: "manual",
      note: body.note,
      challengeDate: body.challengeDate,
    });

    return ok({
      success: true,
      ...result,
      message: `${body.amountTon} TON injected into the failed pool.`,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Injection failed.";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

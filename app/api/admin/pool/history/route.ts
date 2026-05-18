/**
 * GET /api/admin/pool/history
 *
 * 운영자 풀 주입 이력을 최신순으로 반환한다.
 *
 * Query:
 *   limit  number  (optional, default 50, max 200)
 *
 * Headers:
 *   x-admin-key: <ADMIN_API_KEY>
 */

import { ok, fail } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { getInjectionHistory } from "@/lib/repositories/pool-injection";

export async function GET(request: Request) {
  try {
    assertAdmin(request);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
    const history = await getInjectionHistory(limit);
    return ok({ history });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to fetch history.";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

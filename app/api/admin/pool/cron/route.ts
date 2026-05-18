/**
 * POST /api/admin/pool/cron
 *
 * Vercel Cron / 외부 스케줄러에서 주기적으로 호출.
 * 활성화된 모든 injection schedule 을 확인하고,
 * 조건에 맞는 스케줄을 오늘 챌린지에 자동 주입한다.
 *
 * Vercel cron 설정 예시 (vercel.json):
 * {
 *   "crons": [
 *     {
 *       "path": "/api/admin/pool/cron",
 *       "schedule": "0 0 * * *"   // 매일 UTC 00:00
 *     }
 *   ]
 * }
 *
 * Vercel Cron은 자동으로 Authorization: Bearer <CRON_SECRET> 헤더를 붙인다.
 * 이 엔드포인트는 x-admin-key 또는 Vercel Cron 헤더 둘 다 수락한다.
 *
 * Headers (둘 중 하나):
 *   x-admin-key: <ADMIN_API_KEY>
 *   authorization: Bearer <CRON_SECRET>   (Vercel Cron 자동 주입)
 */

import { ok, fail } from "@/lib/api";
import { env } from "@/lib/env";
import { runScheduledInjections } from "@/lib/repositories/pool-injection";

function authorizeRequest(request: Request): boolean {
  // 1) Admin key
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey && adminKey === env.adminApiKey) return true;

  // 2) Vercel Cron secret (CRON_SECRET env var)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    if (!authorizeRequest(request)) {
      return fail("Forbidden", 403);
    }

    const results = await runScheduledInjections();

    const executed = results.filter((r) => !r.skipped);
    const skipped = results.filter((r) => r.skipped);

    return ok({
      success: true,
      executed: executed.length,
      skipped: skipped.length,
      details: results,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Cron injection failed.";
    return fail(message, 500);
  }
}

// Vercel Cron은 GET도 지원하므로 GET 핸들러도 제공
export async function GET(request: Request) {
  return POST(request);
}

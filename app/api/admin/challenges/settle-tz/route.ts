import { ok, fail } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { settleByTimezone } from "@/lib/repositories/challenges";

export async function POST(request: Request) {
  try {
    assertAdmin(request);
    const result = await settleByTimezone();
    return ok(result);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Settlement failed.";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

import { ok, fail } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { settleTodayChallenge } from "@/lib/repositories/challenges";
import { settleChallengeSchema } from "@/lib/validators-extra";

export async function POST(request: Request) {
  try {
    assertAdmin(request);
    const body = settleChallengeSchema.parse(await request.json().catch(() => ({})));
    return ok(await settleTodayChallenge(body.challengeDate));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Settlement failed.";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

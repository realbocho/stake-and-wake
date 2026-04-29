import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { claimReferralBalance } from "@/lib/repositories/users";

export async function POST() {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const result = await claimReferralBalance(session.userId);
    return ok({ ok: true, claimedTon: Number(result?.referral_credit_ton ?? 0) });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Referral claim failed.";
    return fail(message);
  }
}

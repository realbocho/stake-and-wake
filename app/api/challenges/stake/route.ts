import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { stakeSchema } from "@/lib/validators";
import { stakeForTonight } from "@/lib/repositories/challenges";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = stakeSchema.parse(await request.json());
    await stakeForTonight({
      userId: session.userId,
      stakeAmountTon: body.stakeAmountTon,
      wakeTime: body.wakeTime,
      durationDays: body.durationDays
    });
    return ok({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Stake failed.";
    return fail(message);
  }
}

import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { sleepSchema } from "@/lib/validators";
import { markSleepMode } from "@/lib/repositories/challenges";
import { sha256Hex } from "@/lib/crypto";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = sleepSchema.parse(await request.json());
    await markSleepMode({
      userId: session.userId,
      deviceIdHash: sha256Hex(body.deviceId)
    });
    return ok({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Sleep mode failed.";
    return fail(message);
  }
}

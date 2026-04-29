import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { activitySchema } from "@/lib/validators";
import { logActivity } from "@/lib/repositories/challenges";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = activitySchema.parse(await request.json());
    await logActivity({
      userId: session.userId,
      hidden: body.hidden,
      timestamp: body.timestamp
    });
    return ok({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Activity log failed.";
    return fail(message);
  }
}

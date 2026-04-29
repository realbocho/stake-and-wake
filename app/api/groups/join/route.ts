import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { joinGroupByInviteCode } from "@/lib/repositories/groups";
import { joinGroupSchema } from "@/lib/validators-extra";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = joinGroupSchema.parse(await request.json());
    const group = await joinGroupByInviteCode(session.userId, body.inviteCode);
    return ok({ ok: true, group });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Group join failed.";
    return fail(message);
  }
}

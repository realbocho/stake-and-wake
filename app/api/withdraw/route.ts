import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/repositories/users";

export async function POST() {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const user = await findUserById(session.userId);
    if (!user) return fail("User not found", 404);

    const withdrawableTon = user.netProfitTon ?? 0;
    if (withdrawableTon <= 0) return fail("No balance available to withdraw.", 400);

    // finalize-round cron이 자동으로 온체인 전송 처리
    // 여기서는 잔액 확인만
    return ok({
      withdrawableTon,
      message: "Your reward will be sent to your wallet automatically after the round is finalized.",
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Withdrawal failed.";
    return fail(message);
  }
}

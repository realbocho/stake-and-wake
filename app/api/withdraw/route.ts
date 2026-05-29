import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/repositories/users";
import { env } from "@/lib/env";
import { encodeBase64 } from "@/lib/ton";
import { beginCell } from "@ton/core";

const WITHDRAW_OPCODE = 3296668067; // 0xc46a11a3

function buildWithdrawPayload(): string {
  return encodeBase64(
    beginCell()
      .storeUint(WITHDRAW_OPCODE, 32)
      .storeUint(0, 64) // queryId
      .endCell()
      .toBoc()
  );
}

export async function POST() {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const user = await findUserById(session.userId);
    if (!user) return fail("User not found", 404);
    if (!user.walletAddress) return fail("Please connect your wallet first.", 400);

    const withdrawableTon = user.netProfitTon ?? 0;
    if (withdrawableTon <= 0) return fail("No balance available to withdraw.", 400);

    return ok({
      to: env.stakeVaultAddress,
      // 소량의 가스비만 전송 (컨트랙트가 pendingWithdraw에서 보냄)
      amountNano: "50000000", // 0.05 TON 가스비
      payload: buildWithdrawPayload(),
      withdrawableTon,
      validUntil: Math.floor(Date.now() / 1000) + 300,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Withdrawal failed.";
    return fail(message);
  }
}

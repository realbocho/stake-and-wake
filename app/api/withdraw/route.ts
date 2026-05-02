import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/repositories/users";
import { getActiveChallengeForUser } from "@/lib/repositories/challenges";
import { env } from "@/lib/env";
import { toNanoTon, encodeBase64 } from "@/lib/ton";
import { beginCell } from "@ton/core";

// Claim opcode — confirmed from ABI: 1504906600 = 0x59A1C3E8
const CLAIM_OPCODE = 0x59A1C3E8;

function buildClaimPayload(roundId: number): string {
  return encodeBase64(
    beginCell()
      .storeUint(CLAIM_OPCODE, 32) // opcode
      .storeUint(0, 64)            // queryId
      .storeUint(roundId, 32)      // roundId
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

    const challenge = await getActiveChallengeForUser(session.userId);
    if (!challenge) return fail("No active challenge found.", 400);

    const roundId = Number(challenge.id);

    return ok({
      to: env.stakeVaultAddress,
      // Gas fee only — contract sends back principal + reward to user wallet
      amountNano: toNanoTon(0.05).toString(),
      withdrawableTon,
      payload: buildClaimPayload(roundId),
      validUntil: Math.floor(Date.now() / 1000) + 300
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Withdrawal failed.";
    return fail(message);
  }
}

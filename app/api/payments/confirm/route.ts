import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { paymentConfirmSchema } from "@/lib/validators-extra";
import { confirmPaymentIntent, getPaymentIntent } from "@/lib/repositories/payments";
import { stakeForTonight } from "@/lib/repositories/challenges";
import { verifyOnChainDeposit, toNanoTon } from "@/lib/ton";
import { env } from "@/lib/env";
import { findUserById } from "@/lib/repositories/users";
import { getSql } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = paymentConfirmSchema.parse(await request.json());

    // ── 1. Look up payment_intent ─────────────────────────────────────────────
    const intent = await getPaymentIntent(body.intentId, session.userId);
    if (!intent) return fail("Payment record not found.", 404);
    if (intent.status !== "prepared") return fail("This payment has already been processed.", 409);

    // ── 2. Fetch onChainRoundId for this challenge ────────────────────────────
    const sql = getSql();
    const [challengeRow] = await sql<{ on_chain_round_id: number }[]>`
      select on_chain_round_id from challenge where id = ${intent.challengeId} limit 1
    `;
    if (!challengeRow?.on_chain_round_id) {
      return fail("Round is not open yet.", 400);
    }

    // ── 3. Verify actual on-chain TON deposit ─────────────────────────────────
    const user = await findUserById(session.userId);
    if (!user?.walletAddress) return fail("Wallet is not connected.", 400);

    const txHash = await verifyOnChainDeposit({
      fromWallet: user.walletAddress,
      toVault: env.stakeVaultAddress,
      expectedNano: toNanoTon(body.stakeAmountTon),
      roundId: challengeRow.on_chain_round_id,
      telegramId: session.telegramId,
    });

    if (!txHash) {
      return fail(
        "Unable to confirm deposit on the blockchain. Transactions may take up to 30 seconds to reflect. Please try again shortly.",
        402
      );
    }

    // ── 4. Save verified tx hash and process staking ──────────────────────────
    await confirmPaymentIntent({
      intentId: body.intentId,
      userId: session.userId,
      boc: body.boc,
      txHash,
    });

    await stakeForTonight({
      userId: session.userId,
      stakeAmountTon: body.stakeAmountTon,
      wakeTime: body.wakeTime,
      durationDays: body.durationDays,
    });

    return ok({ ok: true, txHash });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Payment confirmation failed.";
    return fail(message);
  }
}

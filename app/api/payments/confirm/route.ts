import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { paymentConfirmSchema } from "@/lib/validators-extra";
import { confirmPaymentIntent, getPaymentIntent } from "@/lib/repositories/payments";
import { stakeForTonight } from "@/lib/repositories/challenges";
import { verifyOnChainDeposit, toNanoTon } from "@/lib/ton";
import { env } from "@/lib/env";
import { findUserById } from "@/lib/repositories/users";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  try {
    const body = paymentConfirmSchema.parse(await request.json());

    // ── [수정] 1. payment_intent 조회해서 walletAddress 확인 ──────────────
    const intent = await getPaymentIntent(body.intentId, session.userId);
    if (!intent) return fail("결제 정보를 찾을 수 없습니다.", 404);
    if (intent.status !== "prepared") return fail("이미 처리된 결제입니다.", 409);

    // ── [수정] 2. TON 블록체인 실제 입금 검증 ────────────────────────────
    const user = await findUserById(session.userId);
    if (!user?.walletAddress) return fail("지갑이 연결되어 있지 않습니다.", 400);

    const txHash = await verifyOnChainDeposit({
      fromWallet: user.walletAddress,
      toVault: env.stakeVaultAddress,
      expectedNano: toNanoTon(body.stakeAmountTon),
      challengeId: intent.challengeId,
      telegramId: session.telegramId,
      wakeTime: body.wakeTime,
    });

    if (!txHash) {
      return fail(
        "블록체인에서 입금을 확인할 수 없습니다. 트랜잭션이 반영되는 데 최대 30초가 소요됩니다. 잠시 후 다시 시도해주세요.",
        402
      );
    }

    // ── [수정] 3. 검증된 tx hash를 저장 후 스테이킹 처리 ─────────────────
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

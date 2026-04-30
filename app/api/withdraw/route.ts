import { ok, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/repositories/users";
import { getActiveChallengeForUser } from "@/lib/repositories/challenges";
import { env } from "@/lib/env";
import { toNanoTon, encodeBase64 } from "@/lib/ton";
import { beginCell } from "@ton/core";

/**
 * Claim 메시지 TL-B 인코딩
 * Tact 컴파일러가 생성하는 opcode는 빌드 후 확인 필요.
 * 확인 방법: npm run build:contracts 후 build/ 폴더의 .abi 파일에서 "Claim" opcode 확인
 *
 * 임시로 0x00000000 사용 — 반드시 실제 opcode로 교체해야 함!
 */
const CLAIM_OPCODE = 0x59A1C3E8; // ← TODO: 빌드 후 실제 opcode로 교체

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
    if (!user.walletAddress) return fail("지갑을 먼저 연결해주세요.", 400);

    const withdrawableTon = user.netProfitTon ?? 0;
    if (withdrawableTon <= 0) return fail("출금 가능한 잔액이 없습니다.", 400);

    // 현재 활성 챌린지의 roundId 조회
    const challenge = await getActiveChallengeForUser(session.userId);
    if (!challenge) return fail("활성 챌린지가 없습니다.", 400);

    const roundId = Number(challenge.id); // challenge.id가 roundId와 매핑됨

    return ok({
      to: env.stakeVaultAddress,
      // 가스비만 전송 — 컨트랙트가 원금 + 보상을 유저 지갑으로 돌려줌
      amountNano: toNanoTon(0.05).toString(),
      withdrawableTon,
      payload: buildClaimPayload(roundId),
      validUntil: Math.floor(Date.now() / 1000) + 300
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Withdraw failed.";
    return fail(message);
  }
}

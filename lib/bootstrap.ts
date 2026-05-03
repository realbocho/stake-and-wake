import { getFallbackBootstrap } from "@/lib/mock-data";
import { getSession } from "@/lib/session";
import { findUserById, getReferralBalance } from "@/lib/repositories/users";
import {
  getActiveChallengeForUser,
  getLeaderboard,
  getOrCreateTonightChallenge
} from "@/lib/repositories/challenges";
import { env } from "@/lib/env";

export async function loadBootstrap() {
  const base = getFallbackBootstrap();
  const session = await getSession();
  if (!session) return base;

  // [수정] try/catch 제거 — catch에서 fallback으로 빠지면 challenge.id가
  // "demo-challenge-..." 가짜 값이 되어 check-in 시 "Participation record not found"
  // 에러가 발생함. 에러를 숨기지 않고 클라이언트에 그대로 노출.
  const [user, challenge, leaderboard, referralBalanceTon] = await Promise.all([
    findUserById(session.userId),
    getActiveChallengeForUser(session.userId).then(
      (value) => value ?? getOrCreateTonightChallenge()
    ),
    getLeaderboard(),
    getReferralBalance(session.userId)
  ]);

  return {
    ...base,
    user,
    challenge,
    leaderboard,
    referralBalanceTon,
    dailyFeeTon: env.dailyFeeTon
  };
}

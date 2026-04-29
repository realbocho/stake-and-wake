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

  try {
    const [user, challenge, leaderboard, referralBalanceTon] = await Promise.all([
      findUserById(session.userId),
      getActiveChallengeForUser(session.userId).then((value) => value ?? getOrCreateTonightChallenge()),
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
  } catch {
    return base;
  }
}

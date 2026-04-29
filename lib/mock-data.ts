import type { ChallengeView, LeaderboardEntry, SessionUser } from "@/lib/types";
import { env } from "@/lib/env";

export function getFallbackChallenge(): ChallengeView {
  return {
    id: "demo-challenge-2026-04-29",
    title: "Morning Discipline Pool",
    status: "open",
    wakeTime: "05:30",
    randomCheckInFrom: "05:18",
    randomCheckInTo: "05:42",
    poolTon: 87.5
  };
}

export function getFallbackUser(): SessionUser {
  return {
    id: "demo-user",
    telegramId: "Preview only",
    displayName: "Telegram Preview",
    avatarUrl: null,
    walletAddress: null,
    successStreak: 9,
    netProfitTon: 12.4,
    nftTier: "Bronze",
    groupMemberCount: 10
  };
}

export function getFallbackLeaderboard(): LeaderboardEntry[] {
  return [
    {
      userId: "1",
      displayName: "Avery",
      successCount: 12,
      bestWakeTime: "04:41",
      netProfitTon: 21.6
    },
    {
      userId: "2",
      displayName: "Jordan",
      successCount: 11,
      bestWakeTime: "04:58",
      netProfitTon: 18.2
    },
    {
      userId: "3",
      displayName: "Riley",
      successCount: 10,
      bestWakeTime: "05:07",
      netProfitTon: 15.9
    }
  ];
}

export function getFallbackBootstrap() {
  return {
    user: null,
    challenge: getFallbackChallenge(),
    leaderboard: getFallbackLeaderboard(),
    referralBalanceTon: env.referralBonusTon,
    dailyFeeTon: env.dailyFeeTon,
    weeklyPerfectGroupBonusTon: 5,
    antiCheatNotes: [
      "One Telegram account can bind only one TON wallet at a time.",
      "A locally stored device fingerprint can be checked for repeated multi-account attempts.",
      "Sleep mode records visibility changes and heartbeat gaps before wake verification.",
      "Real screen-on and cross-app monitoring require a native wrapper, not pure TMA web runtime."
    ]
  };
}

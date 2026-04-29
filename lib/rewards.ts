import { env } from "@/lib/env";

export function calculatePoolPayout(input: {
  failedStakeTon: number;
  successCount: number;
}) {
  const distributablePool = input.failedStakeTon * (1 - env.platformFeeRate);
  const perWinnerTon =
    input.successCount > 0 ? distributablePool / input.successCount : 0;

  return {
    distributablePool,
    platformFeeTon: input.failedStakeTon * env.platformFeeRate,
    perWinnerTon
  };
}

export function calculateWeeklyPerfectGroupBonus(groupMemberCount: number) {
  return groupMemberCount >= 10 ? 5 : 0;
}

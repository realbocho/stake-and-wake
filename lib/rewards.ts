import { env } from "@/lib/env";

export function calculatePoolPayout(input: {
  failedStakeTon: number;
  totalSuccessStakeTon: number;  // [변경] successCount → totalSuccessStakeTon
}) {
  const distributablePool = input.failedStakeTon * (1 - env.platformFeeRate);

  return {
    distributablePool,
    platformFeeTon: input.failedStakeTon * env.platformFeeRate,
    // [변경] 개별 보상은 Claim 시점에 비율로 계산하므로 여기선 제거
    // perWinnerTon 대신 distributablePool을 그대로 씀
  };
}

// [NEW] 개별 보상 계산 (비례)
export function calculateWinnerReward(input: {
  distributablePool: number;
  myStakeTon: number;
  totalSuccessStakeTon: number;
}) {
  if (input.totalSuccessStakeTon === 0) return 0;
  return input.distributablePool * (input.myStakeTon / input.totalSuccessStakeTon);
}

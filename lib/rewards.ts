import { env } from "@/lib/env";

export function calculatePoolPayout(input: {
  failedStakeTon: number;
  totalSuccessStakeTon: number;
  /**
   * 운영자가 실패자 풀에 직접 주입한 TON.
   * 플랫폼 수수료 없이 100% 위너에게 분배된다.
   * (운영자가 자발적으로 주입하는 보조금이므로 수수료 공제 제외)
   */
  operatorInjectionTon?: number;
}) {
  const injection = input.operatorInjectionTon ?? 0;

  // 실패자 스테이크에서 플랫폼 수수료 공제
  const distributableFromFailed = input.failedStakeTon * (1 - env.platformFeeRate);
  const platformFeeTon = input.failedStakeTon * env.platformFeeRate;

  // 운영자 주입분은 수수료 없이 100% 분배
  const distributablePool = distributableFromFailed + injection;

  return {
    distributablePool,
    platformFeeTon,
    operatorInjectionTon: injection,
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

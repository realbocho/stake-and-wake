import { getFallbackBootstrap } from "@/lib/mock-data";
import { getSession } from "@/lib/session";
import { findUserById, getReferralBalance } from "@/lib/repositories/users";
import {
  getActiveChallengeForUser,
  getLeaderboard,
  getOrCreateTonightChallenge
} from "@/lib/repositories/challenges";
import { env } from "@/lib/env";
import { TonClient, Address } from "@ton/ton";

async function getPendingWithdrawTon(walletAddress: string | null | undefined): Promise<number> {
  if (!walletAddress) return 0;
  try {
    const client = new TonClient({
      endpoint: process.env.TON_NETWORK === "mainnet"
        ? "https://toncenter.com/api/v2/jsonRPC"
        : "https://testnet.toncenter.com/api/v2/jsonRPC",
      apiKey: process.env.TONCENTER_API_KEY,
    });
    const { TupleBuilder } = require("@ton/core");
    const tb = new TupleBuilder();
    tb.writeAddress(Address.parse(walletAddress));
    const result = await client.runMethod(
      Address.parse(env.stakeVaultAddress),
      "getPendingWithdraw",
      tb.build()
    );
    const nanotons = result.stack.readBigNumber();
    return Number(nanotons) / 1e9;
  } catch (e) {
    console.error("[getPendingWithdraw] error:", e instanceof Error ? e.message : e);
    return 0;
  }
}

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

  const pendingWithdrawTon = await getPendingWithdrawTon(user?.walletAddress);

  return {
    ...base,
    user,
    challenge,
    leaderboard,
    referralBalanceTon,
    pendingWithdrawTon,
    dailyFeeTon: env.dailyFeeTon
  };
}

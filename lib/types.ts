export type NftTier = "Bronze" | "Silver" | "Gold" | "Diamond";

export type SessionUser = {
  id: string;
  telegramId: string;
  displayName: string;
  avatarUrl: string | null;
  walletAddress: string | null;
  successStreak: number;
  netProfitTon: number;
  nftTier: NftTier;
  groupMemberCount: number;
  timezone: string | null; // e.g. "Asia/Seoul", "America/New_York"
};

export type ChallengeStatus =
  | "open"
  | "staked"
  | "sleep_locked"
  | "verification_ready"
  | "passed"
  | "failed"
  | "settled";

export type ChallengeView = {
  id: string;
  title: string;
  status: ChallengeStatus;
  wakeTime: string;
  randomCheckInFrom: string;
  randomCheckInTo: string;
  poolTon: number;
};

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  successCount: number;
  bestWakeTime: string;
  netProfitTon: number;
};

export type WalletBindingPayload = {
  ok: true;
  walletAddress: string;
};

export type PaymentIntentView = {
  id: string;
  amountTon: number;
  amountNano: string;
  to: string;
  payload: string;
  validUntil: number;
  challengeId: string;
};

export type GroupView = {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
};

import { z } from "zod";

const VALID_WAKE_TIMES = ["05:00", "05:30", "06:00", "06:30", "07:00"] as const;

export const telegramAuthSchema = z.object({
  initData: z.string().min(1),
  deviceId: z.string().min(8),
  inviteCode: z.string().min(3).max(64).optional()
});

export const bindWalletSchema = z.object({
  walletAddress: z.string().min(10).max(128)
});

export const stakeSchema = z.object({
  stakeAmountTon: z.number().min(0.5).max(1000),
  wakeTime: z.enum(VALID_WAKE_TIMES, {
    errorMap: () => ({ message: "Wake time must be between 5:00 AM and 7:00 AM (30-min intervals)." })
  }),
  // ── [수정] durationDays를 stake route에서도 받아서 처리
  durationDays: z.number().int().min(7, { message: "Challenge duration must be at least 7 days." }).max(30)
});

export const sleepSchema = z.object({
  deviceId: z.string().min(8)
});

export const activitySchema = z.object({
  hidden: z.boolean(),
  timestamp: z.string().datetime()
});

// ── [수정] checkInSchema: reactionMs와 response는 클라이언트가 보내도 서버에서 무시
export const checkInSchema = z.object({
  challengeId: z.string().uuid().or(z.string().min(8)),
  response: z.string().min(1).optional(),
  reactionMs: z.number().int().min(0).max(60000).optional()
});

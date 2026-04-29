import { z } from "zod";

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
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/)
});

export const sleepSchema = z.object({
  deviceId: z.string().min(8)
});

export const activitySchema = z.object({
  hidden: z.boolean(),
  timestamp: z.string().datetime()
});

export const checkInSchema = z.object({
  challengeId: z.string().uuid().or(z.string().min(8)),
  response: z.string().min(1),
  reactionMs: z.number().int().min(0).max(60000)
});

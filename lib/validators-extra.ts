import { z } from "zod";

// ── [수정] durationDays 추가
export const paymentPrepareSchema = z.object({
  stakeAmountTon: z.number().min(0.5).max(1000),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  walletAddress: z.string().min(10).max(128),
  durationDays: z.number().int().min(7).max(30)
});

// ── [수정] durationDays 추가
export const paymentConfirmSchema = z.object({
  intentId: z.string().uuid(),
  stakeAmountTon: z.number().min(0.5).max(1000),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  boc: z.string().min(20),
  durationDays: z.number().int().min(7).max(30)
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().min(3).max(64)
});

export const settleChallengeSchema = z.object({
  challengeDate: z.string().optional()
});

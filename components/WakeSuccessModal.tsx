"use client";

import { useEffect } from "react";

interface WakeSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  stakedAmount?: number;
  rewardTon?: number;
  targetTime?: string;
  checkedInAt?: string;
  streakDays?: number;
  onClaim?: () => void;       // 클레임 버튼 핸들러
  onForfeit?: () => void;     // 포기 버튼 핸들러
  claimPending?: boolean;
}

export default function WakeSuccessModal({
  isOpen,
  onClose,
  stakedAmount = 0,
  rewardTon = 0,
  targetTime = "6:00 AM",
  checkedInAt = "5:58 AM",
  streakDays = 1,
  onClaim,
  onForfeit,
  claimPending = false,
}: WakeSuccessModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const hasReward = rewardTon > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
      onClick={() => {
        if (hasReward && onClaim) {
          if (window.confirm("⚠️ Are you sure you want to leave?\n\nIf you close this without claiming, your reward will be permanently forfeited and added to the next round's prize pool. This cannot be undone.")) {
            onForfeit?.();
          }
        } else {
          onClose();
        }
      }}
    >
      <div
        className="relative mx-4 w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ background: "#0f1e14" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
          style={{
            background: "rgba(34, 197, 94, 0.15)",
            border: "2px solid rgba(34, 197, 94, 0.4)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="21" r="13" stroke="#22c55e" strokeWidth="2" />
            <path
              d="M13 21L18 26L27 16"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M8 11L13 15" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
            <path d="M32 11L27 15" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
            <path d="M20 8V10" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Title */}
        <h2
          className="mb-1 text-2xl font-bold"
          style={{ color: "#22c55e", letterSpacing: "-0.02em" }}
        >
          Wake-Up Verified!
        </h2>
        <p className="mb-4 text-sm" style={{ color: "#9ca3af" }}>
          You&apos;re up and ready — great discipline!
        </p>

        <div className="my-4 h-px w-full" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Details */}
        <div className="mb-4 space-y-3 text-left">
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <span className="text-sm" style={{ color: "#9ca3af" }}>Target Wake Time</span>
            <span className="text-sm font-semibold" style={{ color: "#f3f4f6" }}>{targetTime}</span>
          </div>

          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <span className="text-sm" style={{ color: "#9ca3af" }}>Checked In At</span>
            <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>{checkedInAt}</span>
          </div>

          {stakedAmount > 0 && (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <span className="text-sm" style={{ color: "#9ca3af" }}>Stake Protected</span>
              <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>{stakedAmount} TON</span>
            </div>
          )}

          {hasReward && (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(251,191,36,0.3)" }}
            >
              <span className="text-sm" style={{ color: "#9ca3af" }}>Your Reward</span>
              <span className="text-sm font-semibold" style={{ color: "#fbbf24" }}>+{rewardTon.toFixed(4)} TON</span>
            </div>
          )}

          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <span className="text-sm" style={{ color: "#9ca3af" }}>Current Streak</span>
            <span className="text-sm font-semibold" style={{ color: "#f3f4f6" }}>
              🔥 {streakDays} {streakDays === 1 ? "day" : "days"}
            </span>
          </div>
        </div>

        {/* 경고 문구 — 클레임 안 하면 다음 라운드로 넘어감 */}
        {hasReward && onClaim && (
          <div
            className="mb-4 rounded-xl px-4 py-3 text-left"
            style={{
              background: "rgba(251, 191, 36, 0.08)",
              border: "1px solid rgba(251,191,36,0.25)",
            }}
          >
            <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>
              ⚠️ <strong>Claim your reward now.</strong> If you skip, your{" "}
              <strong>{rewardTon.toFixed(4)} TON reward</strong> will be forfeited
              and added to the next round&apos;s prize pool. This cannot be undone.
            </p>
          </div>
        )}

        {/* Buttons */}
        {hasReward && onClaim ? (
          <div className="space-y-2">
            <button
              onClick={onClaim}
              disabled={claimPending}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-all duration-150 active:scale-95"
              style={{
                background: claimPending ? "rgba(34,197,94,0.1)" : "rgba(34, 197, 94, 0.85)",
                color: claimPending ? "#22c55e" : "#000",
                border: "1px solid rgba(34,197,94,0.5)",
                cursor: claimPending ? "not-allowed" : "pointer",
              }}
            >
              {claimPending ? "Waiting for wallet..." : "✅ Claim Reward Now"}
            </button>
            <button
              onClick={onForfeit}
              disabled={claimPending}
              className="w-full rounded-xl py-2 text-xs transition-all duration-150"
              style={{
                background: "transparent",
                color: "#6b7280",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: claimPending ? "not-allowed" : "pointer",
              }}
            >
              Skip — forfeit my reward to the next round
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-all duration-150 active:scale-95"
            style={{
              background: "rgba(34, 197, 94, 0.15)",
              color: "#22c55e",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            Awesome!
          </button>
        )}
      </div>
    </div>
  );
}

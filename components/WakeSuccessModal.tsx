"use client";

import { useEffect } from "react";

interface WakeSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  stakedAmount?: number;
  targetTime?: string;
  checkedInAt?: string;
  streakDays?: number;
}

export default function WakeSuccessModal({
  isOpen,
  onClose,
  stakedAmount = 0,
  targetTime = "6:00 AM",
  checkedInAt = "5:58 AM",
  streakDays = 1,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}
      onClick={onClose}
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
            {/* Alarm clock with checkmark */}
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

        {/* Divider */}
        <div className="my-4 h-px w-full" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Details */}
        <div className="mb-5 space-y-3 text-left">
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            <span className="text-sm" style={{ color: "#9ca3af" }}>
              Target Wake Time
            </span>
            <span className="text-sm font-semibold" style={{ color: "#f3f4f6" }}>
              {targetTime}
            </span>
          </div>

          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            <span className="text-sm" style={{ color: "#9ca3af" }}>
              Checked In At
            </span>
            <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>
              {checkedInAt}
            </span>
          </div>

          {stakedAmount > 0 && (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
            >
              <span className="text-sm" style={{ color: "#9ca3af" }}>
                Stake Protected
              </span>
              <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>
                {stakedAmount} TON
              </span>
            </div>
          )}

          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            <span className="text-sm" style={{ color: "#9ca3af" }}>
              Current Streak
            </span>
            <span className="text-sm font-semibold" style={{ color: "#f3f4f6" }}>
              🔥 {streakDays} {streakDays === 1 ? "day" : "days"}
            </span>
          </div>
        </div>

        {/* Message */}
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "#6b7280" }}>
          You checked in on time and your stake is safe.
          <br />
          Keep going — you&apos;re eligible for the reward pool!
        </p>

        {/* Button */}
        <button
          onClick={onClose}
          className="w-full rounded-xl py-3 text-sm font-semibold transition-all duration-150 active:scale-95"
          style={{
            background: "rgba(34, 197, 94, 0.15)",
            color: "#22c55e",
            border: "1px solid rgba(34,197,94,0.3)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(34, 197, 94, 0.25)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(34, 197, 94, 0.15)";
          }}
        >
          Awesome!
        </button>
      </div>
    </div>
  );
}

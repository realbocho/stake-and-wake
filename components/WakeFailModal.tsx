"use client";

import { useEffect } from "react";

interface WakeFailModalProps {
  isOpen: boolean;
  onClose: () => void;
  stakedAmount?: number;
  targetTime?: string;
}

export default function WakeFailModal({
  isOpen,
  onClose,
  stakedAmount = 0,
  targetTime = "6:00 AM",
}: WakeFailModalProps) {
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
        style={{ background: "#1a1a2e" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
          style={{
            background: "rgba(220, 38, 38, 0.15)",
            border: "2px solid rgba(220, 38, 38, 0.4)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="21" r="13" stroke="#ef4444" strokeWidth="2" />
            <path
              d="M14 15L26 27M26 15L14 27"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path d="M8 11L13 15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            <path d="M32 11L27 15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            <path d="M20 8V10" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Title */}
        <h2
          className="mb-1 text-2xl font-bold"
          style={{ color: "#ef4444", letterSpacing: "-0.02em" }}
        >
          Wake-Up Failed
        </h2>
        <p className="mb-4 text-sm" style={{ color: "#9ca3af" }}>
          You missed your wake-up window
        </p>

        {/* Divider */}
        <div className="my-4 h-px w-full" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Details */}
        <div className="mb-5 space-y-3 text-left">
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <span className="text-sm" style={{ color: "#9ca3af" }}>
              Target Wake Time
            </span>
            <span className="text-sm font-semibold" style={{ color: "#f3f4f6" }}>
              {targetTime}
            </span>
          </div>

          {stakedAmount > 0 && (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <span className="text-sm" style={{ color: "#9ca3af" }}>
                Stake Lost
              </span>
              <span className="text-sm font-semibold" style={{ color: "#ef4444" }}>
                -{stakedAmount} TON
              </span>
            </div>
          )}
        </div>

        {/* Message */}
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "#6b7280" }}>
          You didn&apos;t check in by {targetTime}.
          <br />
          Your stake will be distributed to the winners.
        </p>

        {/* Button */}
        <button
          onClick={onClose}
          className="w-full rounded-xl py-3 text-sm font-semibold transition-all duration-150 active:scale-95"
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(239, 68, 68, 0.25)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(239, 68, 68, 0.15)";
          }}
        >
          Got It
        </button>
      </div>
    </div>
  );
}

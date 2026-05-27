"use client";

import { TonConnectButton, useTonAddress } from "@tonconnect/ui-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTonConnectUI } from "@tonconnect/ui-react";
import type {
  ChallengeView,
  LeaderboardEntry,
  PaymentIntentView,
  SessionUser,
  WalletBindingPayload
} from "@/lib/types";
import { englishTime, formatTon } from "@/lib/utils";

type DashboardPayload = {
  user: SessionUser | null;
  challenge: ChallengeView;
  leaderboard: LeaderboardEntry[];
  referralBalanceTon: number;
  dailyFeeTon: number;
  weeklyPerfectGroupBonusTon: number;
  antiCheatNotes: string[];
};

type WithdrawIntent = {
  to: string;
  amountNano: string;
  withdrawableTon: number;
  payload: string;
  validUntil: number;
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "Request failed");
  }

  return (await response.json()) as T;
}

function getTelegramInitData() {
  if (typeof window === "undefined") return "";

  const telegram = (window as Window & {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }).Telegram?.WebApp;

  telegram?.ready?.();
  telegram?.expand?.();
  return telegram?.initData ?? "";
}

function getDeviceFingerprint() {
  if (typeof window === "undefined") return "";

  const key = "stake-wake-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

const WAKE_TIME_OPTIONS = [
  { value: "05:00", label: "5:00 AM" },
  { value: "05:30", label: "5:30 AM" },
  { value: "06:00", label: "6:00 AM" },
  { value: "06:30", label: "6:30 AM" },
  { value: "07:00", label: "7:00 AM" },
];

const DURATION_OPTIONS = [
  { value: 7,  label: "7 Days" },
  { value: 14, label: "14 Days" },
  { value: 21, label: "21 Days" },
  { value: 30, label: "30 Days" },
];

export function DashboardShell() {
  const [tonConnectUI] = useTonConnectUI();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [pending, startTransition] = useTransition();
  const [stakeAmount, setStakeAmount] = useState("3");
  const [wakeTime, setWakeTime] = useState("05:30");
  const [durationDays, setDurationDays] = useState(7);
  const [inviteCode, setInviteCode] = useState("");
  const [groupInviteCode, setGroupInviteCode] = useState("");
  const [popupMessage, setPopupMessage] = useState<string | null>(null);
  const walletAddress = useTonAddress();

  const authenticated = Boolean(data?.user);
  const canBindWallet =
    authenticated &&
    walletAddress &&
    data?.user?.walletAddress !== walletAddress;

  const canWithdraw =
    authenticated && (data?.user?.netProfitTon ?? 0) > 0;

  const refresh = useMemo(
    () => async () => {
      const payload = await getJson<DashboardPayload>("/api/bootstrap");
      setData(payload);
    },
    []
  );

  useEffect(() => {
    refresh().catch((cause: unknown) => {
      const message = cause instanceof Error ? cause.message : "Failed to load";
      setPopupMessage(message);
    });
  }, [refresh]);

  useEffect(() => {
    const initData = getTelegramInitData();
    if (!initData || authenticated) return;

    const timezone = getTimezone();

    startTransition(() => {
      getJson<{ ok: true; user: SessionUser }>("/api/auth/telegram", {
        method: "POST",
        body: JSON.stringify({
          initData,
          deviceId: getDeviceFingerprint(),
          inviteCode: inviteCode || undefined,
          timezone
        })
      })
        .then(refresh)
        .catch((cause: unknown) => {
          const message =
            cause instanceof Error ? cause.message : "Telegram login failed";
          setPopupMessage(message);
        });
    });
  }, [authenticated, inviteCode, refresh]);

  useEffect(() => {
    if (!authenticated) return;

    const interval = window.setInterval(() => {
      void fetch("/api/challenges/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hidden: false,
          timestamp: new Date().toISOString()
        })
      });
    }, 20000);

    return () => window.clearInterval(interval);
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !walletAddress) return;
    if (data?.user?.walletAddress === walletAddress) return;

    getJson<WalletBindingPayload>("/api/wallet/bind", {
      method: "POST",
      body: JSON.stringify({ walletAddress })
    })
      .then(refresh)
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "Wallet bind failed";
        setPopupMessage(message);
      });
  }, [walletAddress, authenticated, data?.user?.walletAddress, refresh]);

  const submitStake = () => {
    startTransition(() => {
      if (!walletAddress) {
        setPopupMessage("Connect your TON wallet before staking.");
        return Promise.resolve();
      }


      return getJson<PaymentIntentView>("/api/payments/prepare", {
        method: "POST",
        body: JSON.stringify({
          stakeAmountTon: Number(stakeAmount),
          wakeTime,
          durationDays,
          walletAddress
        })
      })
        .then(async (intent) => {
          setPopupMessage("Confirm the transaction in your wallet.");
          const result = await tonConnectUI.sendTransaction({
            validUntil: intent.validUntil,
            messages: [
              {
                address: intent.to,
                amount: intent.amountNano,
                payload: intent.payload
              }
            ]
          });

          await getJson("/api/payments/confirm", {
            method: "POST",
            body: JSON.stringify({
              intentId: intent.id,
              stakeAmountTon: Number(stakeAmount),
              wakeTime,
              durationDays,
              boc: result.boc
            })
          });

          setPopupMessage(`Challenge started! ${durationDays}-day commitment locked in.`);
          await refresh();
        })
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : "Stake failed";
          setPopupMessage(message);
        });
    });
  };

  const withdraw = () => {
    startTransition(() => {
      if (!walletAddress) {
        setPopupMessage("Please connect your wallet before withdrawing.");
        return Promise.resolve();
      }

      return getJson<WithdrawIntent>("/api/withdraw", { method: "POST" })
        .then(async (intent) => {
          setPopupMessage(`Withdrawing ${intent.withdrawableTon} TON... Please approve in your wallet.`);
          await tonConnectUI.sendTransaction({
            validUntil: intent.validUntil,
            messages: [
              {
                address: intent.to,
                amount: intent.amountNano,
                payload: intent.payload
              }
            ]
          });
          setPopupMessage("Withdrawal complete! Check your wallet.");
          await refresh();
        })
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : "Withdrawal failed";
          setPopupMessage(message);
        });
    });
  };

  const enableSleepMode = () => {
    startTransition(() => {
      getJson("/api/challenges/sleep", {
        method: "POST",
        body: JSON.stringify({ deviceId: getDeviceFingerprint() })
      })
        .then(() => {
          setPopupMessage("Sleep lock enabled! Good night. 🌙 See you in the morning.");
          return refresh();
        })
        .catch((cause: unknown) => {
          const message =
            cause instanceof Error ? cause.message : "Sleep mode failed";
          setPopupMessage(message);
        });
    });
  };

  const completeCheckIn = () => {
    // Guard: only allow check-in within the ±12 min wake window
    const now = new Date();
    const [wh, wm] = (data?.challenge.wakeTime ?? "00:00").split(":").map(Number);
    const windowStart = wh * 60 + wm - 12;
    const windowEnd   = wh * 60 + wm + 12;
    const nowMins     = now.getHours() * 60 + now.getMinutes();

    if (nowMins < windowStart || nowMins > windowEnd) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmt = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
      setPopupMessage("It's not check-in time right now. Please try again during your wake window.");
      return;
    }

    startTransition(() => {
      getJson("/api/challenges/check-in", {
        method: "POST",
        body: JSON.stringify({
          challengeId: data?.challenge.id,
          response: "42",
          reactionMs: 16000
        })
      })
        .then(refresh)
        .catch((cause: unknown) => {
          const message =
            cause instanceof Error ? cause.message : "Check-in failed";
          setPopupMessage(message);
        });
    });
  };

  const bindWallet = () => {
    if (!walletAddress) return;

    startTransition(() => {
      getJson<WalletBindingPayload>("/api/wallet/bind", {
        method: "POST",
        body: JSON.stringify({ walletAddress })
      })
        .then(refresh)
        .catch((cause: unknown) => {
          const message =
            cause instanceof Error ? cause.message : "Wallet bind failed";
          setPopupMessage(message);
        });
    });
  };

  const joinGroup = () => {
    startTransition(() => {
      getJson("/api/groups/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: groupInviteCode })
      })
        .then(() => {
          setPopupMessage("Group joined successfully.");
          return refresh();
        })
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : "Group join failed";
          setPopupMessage(message);
        });
    });
  };

  // Compute active pool display
  const activePool = data
    ? data.challenge.poolTon + data.challenge.operatorInjectionTon
    : null;

  return (
    <main className="page-shell">
      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-grid">
          <div className="stack">
            <span className="eyebrow">Telegram Mini App · TON Challenge</span>
            <h1 className="title">Stake your discipline. Wake before dawn.</h1>
            <p className="subtitle">
              Deposit TON, stay off your phone, and pass a live wake-up
              verification between 5:00 AM and 7:00 AM every day to split
              the losers&apos; pool at the end of your challenge period.
            </p>

            {!authenticated ? (
              <div className="alert">
                Open this inside Telegram so the server can verify your
                identity and create your account automatically.
              </div>
            ) : null}
          </div>

          {/* Wallet + clock panel */}
          <div className="panel dark stack">
            <div className="row space-between">
              <span className="label">Wake Window</span>
              <span className="badge">{data?.challenge.status ?? "loading"}</span>
            </div>
            <div className="big-clock mono">
              {data ? data.challenge.wakeTime : "--:--"}
            </div>
            {data?.user?.timezone ? (
              <p className="muted">Your timezone: {data.user.timezone}</p>
            ) : null}
            <div className="separator" />
            <TonConnectButton />
            <button
              className="button primary"
              onClick={bindWallet}
              disabled={!canBindWallet || pending}
            >
              Bind Connected Wallet
            </button>
            <p className="muted mono">
              {(data?.user?.walletAddress ?? walletAddress) ||
                "Wallet not connected"}
            </p>
          </div>
        </div>

        {/* KPI row */}
        <div className="stats-grid">
          <div className="panel kpi">
            <div className="label">My Net Profit</div>
            <div className="value mono">
              {data ? formatTon(data.user?.netProfitTon ?? 0) : "--"}
            </div>
            <div className="muted">
              Tied to your Telegram ID and TON wallet.
            </div>
          </div>

          <div className="panel kpi">
            <div className="label">Win Streak</div>
            <div className="value mono">
              {data?.user?.successStreak ?? 0} days
            </div>
            <div className="muted">
              Bronze → Silver → Gold → Diamond badge ladder.
            </div>
          </div>

          {/* ── ACTIVE POOL — redesigned copy ── */}
          <div className="panel kpi">
            <div className="label">Active Prize Pool 🏆</div>
            <div className="value mono">
              {activePool !== null ? formatTon(activePool) : "--"}
            </div>
            <div className="muted">
              Join now to claim a share — the more you stake, the bigger your
              cut of the prize pool!
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <section className="content-grid">

        {/* ── LEFT: Challenge Setup + ALL ACTION BUTTONS ── */}
        <div className="stack">
          <div className="panel stack">
            <div className="row space-between">
              <div>
                <div className="label">Challenge Setup</div>
                <div className="value">
                  {data?.challenge.title ?? "Morning Discipline Pool"}
                </div>
              </div>
              <span className="badge">
                {(() => {
                  const [h, m] = wakeTime.split(":").map(Number);
                  const total = h * 60 + m;
                  const pad = (n: number) => String(n).padStart(2, "0");
                  const fmt = (mins: number) =>
                    `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
                  return `ex. ${wakeTime} → ${fmt(total - 12)}~${fmt(total + 12)}`;
                })()}
              </span>
            </div>

            <div className="mission-grid">
              <label className="stack">
                <span className="label">Stake Amount (TON)</span>
                <input
                  className="input mono"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  inputMode="decimal"
                />
              </label>

              <label className="stack">
                <span className="label">Target Wake Time</span>
                <select
                  className="input mono"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                >
                  {WAKE_TIME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="stack">
                <span className="label">Challenge Duration</span>
                <select
                  className="input mono"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="alert info">
              You are committing to wake up at{" "}
              <strong>
                {WAKE_TIME_OPTIONS.find((o) => o.value === wakeTime)?.label}
              </strong>{" "}
              every day for <strong>{durationDays} days</strong>. Participants
              who miss a check-in forfeit their stake to the winners.
            </div>

            {/* ── ALL ACTION BUTTONS in one place ── */}
            <div className="separator" />
            <div className="label" style={{ marginBottom: "0.25rem" }}>
              Actions
            </div>

            {/* Step 1 */}
            <button
              className="button accent"
              style={{ width: "100%", justifyContent: "flex-start", gap: "0.6rem" }}
              onClick={submitStake}
              disabled={pending || !authenticated}
            >
              <span style={{ fontSize: "1.1rem" }}>💰</span>
              <span>
                <strong>Deposit &amp; Start</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>
                  Lock in your stake and begin the challenge
                </span>
              </span>
            </button>
            <p style={{ fontSize: "0.75rem", color: "var(--muted, #888)", margin: "-0.25rem 0 0.25rem 0.25rem" }}>
              ⚠️ You can only stake once per day. If you stake again, the previous stake is lost and only the latest one counts.
            </p>

            {/* Step 2 */}
            <button
              className="button primary"
              style={{ width: "100%", justifyContent: "flex-start", gap: "0.6rem" }}
              onClick={enableSleepMode}
              disabled={pending || !authenticated}
            >
              <span style={{ fontSize: "1.1rem" }}>🌙</span>
              <span>
                <strong>Prepare for Sleep</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>
                  Must tap this every night before you sleep — required!
                </span>
              </span>
            </button>

            {/* Step 3 */}
            <button
              className="button primary"
              style={{ width: "100%", justifyContent: "flex-start", gap: "0.6rem" }}
              onClick={completeCheckIn}
              disabled={pending || !authenticated}
            >
              <span style={{ fontSize: "1.1rem" }}>☀️</span>
              <span>
                <strong>Morning Check-In</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>
                  Must tap this immediately after waking up — your wake is only confirmed once you check in!
                </span>
              </span>
            </button>

            {/* Withdraw — only shown when there's profit */}
            {canWithdraw && (
              <>
                <div className="separator" />
                <button
                  className="button ghost"
                  style={{ width: "100%", justifyContent: "flex-start", gap: "0.6rem" }}
                  onClick={withdraw}
                  disabled={pending}
                >
                  <span style={{ fontSize: "1.1rem" }}>🏦</span>
                  <span>
                    <strong>Withdraw Winnings</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>
                      {formatTon(data?.user?.netProfitTon ?? 0)} available to
                      withdraw
                    </span>
                  </span>
                </button>
              </>
            )}

            {/* Invite Friends — coming soon */}
            <button
              className="button ghost"
              disabled
              title="Friend invite feature is under development"
              style={{
                width: "100%",
                justifyContent: "flex-start",
                gap: "0.6rem",
                opacity: 0.45,
                cursor: "not-allowed",
                borderStyle: "dashed",
                position: "relative",
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>🔗</span>
              <span>
                <strong>Invite Friends</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>
                  Earn referral bonuses when friends join
                </span>
              </span>
              <span
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "12px",
                  background: "var(--gold)",
                  color: "#18120b",
                  fontSize: "9px",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: "999px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Soon
              </span>
            </button>
          </div>
        </div>

        {/* ── RIGHT: Leaderboard + Identity + Group ── */}
        <div className="stack">
          {/* Group join — coming soon */}
          <div
            className="panel stack coming-soon-panel"
            style={{ position: "relative", overflow: "hidden" }}
          >
            <div className="coming-soon-overlay">
              <span className="coming-soon-badge">🚧 Under Development</span>
              <p className="coming-soon-text">Team join feature coming soon</p>
            </div>
            <div className="label" style={{ opacity: 0.4 }}>
              Join a Group
            </div>
            <input
              className="input mono"
              placeholder="Group invite code"
              value={groupInviteCode}
              onChange={() => {}}
              disabled
              style={{ opacity: 0.4 }}
            />
            <button
              className="button ghost"
              disabled
              style={{ opacity: 0.4, cursor: "not-allowed" }}
            >
              Join Group
            </button>
          </div>

          {/* Leaderboard */}
          <div className="panel stack">
            <div className="label">Leaderboard</div>
            <div className="list">
              {data?.leaderboard.map((entry, index) => (
                <div className="list-item" key={entry.userId}>
                  <div>
                    <div>
                      #{index + 1} {entry.displayName}
                    </div>
                    <div className="muted">
                      {entry.successCount} wins · best wake {entry.bestWakeTime}
                    </div>
                  </div>
                  <div className="mono">{formatTon(entry.netProfitTon)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Identity */}
          <div className="panel stack">
            <div className="label">Your Identity</div>
            <div className="list">
              <div className="list-item">
                <span>Telegram User</span>
                <span className="mono">
                  {data?.user?.telegramId ?? "Not authenticated"}
                </span>
              </div>
              <div className="list-item">
                <span>NFT Tier</span>
                <span>{data?.user?.nftTier ?? "Bronze"}</span>
              </div>
              <div className="list-item">
                <span>Group Size</span>
                <span className="mono">
                  {data?.user?.groupMemberCount ?? 0} members
                </span>
              </div>
              <div className="list-item">
                <span>Timezone</span>
                <span className="mono">
                  {data?.user?.timezone ?? "Not set"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── GUIDE ── */}
      <section
        className="content-grid"
        style={{ marginTop: "1.5rem" }}
      >
        <div className="panel stack" style={{ gridColumn: "1 / -1" }}>
          <div className="row space-between">
            <div className="label">Guide</div>
            <a
              className="button ghost"
              href="/guide"
              target="_blank"
              rel="noreferrer"
            >
              Open Full Guide
            </a>
          </div>
          <iframe
            title="Stake & Wake Guide"
            src="/guide"
            style={{
              width: "100%",
              minHeight: "560px",
              border: "none",
              borderRadius: "12px",
            }}
          />
        </div>
      </section>
      {/* ── TIME GUARD POPUP ── */}
      {popupMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1.5rem",
          }}
          onClick={() => setPopupMessage(null)}
        >
          <div
            style={{
              background: "#1e1e2e",
              border: "1px solid #444",
              borderRadius: "16px",
              padding: "2rem",
              maxWidth: "360px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
              color: "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
              {popupMessage?.includes("complete") || popupMessage?.includes("started") || popupMessage?.includes("joined") || popupMessage?.includes("Withdraw")
                ? "✅" : popupMessage?.includes("Good night")
                ? "🌙" : popupMessage?.includes("not available") || popupMessage?.includes("closed")
                ? "⏰" : "⚠️"}
            </div>
            <p style={{ margin: "0 0 1.5rem", lineHeight: 1.6, color: "#ffffff", fontSize: "0.95rem" }}>{popupMessage}</p>
            <button
              className="button accent"
              style={{ width: "100%" }}
              onClick={() => setPopupMessage(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

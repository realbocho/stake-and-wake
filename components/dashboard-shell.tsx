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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [stakeAmount, setStakeAmount] = useState("3");
  const [wakeTime, setWakeTime] = useState("05:30");
  const [durationDays, setDurationDays] = useState(7);
  const [inviteCode, setInviteCode] = useState("");
  const [groupInviteCode, setGroupInviteCode] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
      setError(message);
    });
  }, [refresh]);

  useEffect(() => {
    const initData = getTelegramInitData();
    if (!initData || authenticated) return;

    // 기기 타임존 자동 감지 — 첫 로그인 시에만 서버에 저장됨
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
          setError(message);
        });
    });
  }, [authenticated, inviteCode, refresh]);

  useEffect(() => {
    if (!authenticated) return;

    const interval = window.setInterval(() => {
      const hidden = document.visibilityState !== "visible";
      void fetch("/api/challenges/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hidden,
          timestamp: new Date().toISOString()
        })
      });
    }, 20000);

    return () => window.clearInterval(interval);
  }, [authenticated]);

  // Auto-bind wallet when connected
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
        setError(message);
      });
  }, [walletAddress, authenticated, data?.user?.walletAddress, refresh]);

  const submitStake = () => {
    startTransition(() => {
      if (!walletAddress) {
        setError("Connect your TON wallet before staking.");
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
          setStatusMessage("Confirm the stake transaction in your wallet.");
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

          setStatusMessage(`Challenge started! ${durationDays}-day commitment locked in.`);
          await refresh();
        })
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : "Stake failed";
          setError(message);
        });
    });
  };

  const withdraw = () => {
    startTransition(() => {
      if (!walletAddress) {
        setError("Please connect your wallet before withdrawing.");
        return Promise.resolve();
      }

      return getJson<WithdrawIntent>("/api/withdraw", { method: "POST" })
        .then(async (intent) => {
          setStatusMessage(`Withdrawing ${intent.withdrawableTon} TON... Please approve in your wallet.`);
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
          setStatusMessage("Withdrawal complete! Check your wallet.");
          await refresh();
        })
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : "Withdrawal failed";
          setError(message);
        });
    });
  };

  const enableSleepMode = () => {
    startTransition(() => {
      getJson("/api/challenges/sleep", {
        method: "POST",
        body: JSON.stringify({ deviceId: getDeviceFingerprint() })
      })
        .then(refresh)
        .catch((cause: unknown) => {
          const message =
            cause instanceof Error ? cause.message : "Sleep mode failed";
          setError(message);
        });
    });
  };

  const completeCheckIn = () => {
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
          setError(message);
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
          setError(message);
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
          setStatusMessage("Group joined successfully.");
          return refresh();
        })
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : "Group join failed";
          setError(message);
        });
    });
  };

  return (
    <main className="page-shell">
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
            <div className="row">
              <button className="button accent" onClick={submitStake} disabled={pending || !authenticated}>
                Join Challenge
              </button>
              <button className="button ghost" onClick={enableSleepMode} disabled={pending || !authenticated}>
                Enable Sleep Lock
              </button>
              <button className="button primary" onClick={withdraw} disabled={pending || !canWithdraw}>
                Withdraw {canWithdraw ? formatTon(data?.user?.netProfitTon ?? 0) : ""}
              </button>
            </div>
            {!authenticated ? (
              <div className="alert">
                Open this inside Telegram so the server can verify your initData
                and create your account automatically.
              </div>
            ) : null}
            {statusMessage ? <div className="alert success">{statusMessage}</div> : null}
            {error ? <div className="alert">{error}</div> : null}
          </div>

          <div className="panel dark stack">
            <div className="row space-between">
              <span className="label">Wake Window</span>
              <span className="badge">{data?.challenge.status ?? "loading"}</span>
            </div>
            <div className="big-clock mono">{data ? data.challenge.wakeTime : "--:--"}</div>
            <p className="muted">
              Daily fee {data ? formatTon(data.dailyFeeTon) : "--"}
            </p>
            {data?.user?.timezone ? (
              <p className="muted">Your timezone: {data.user.timezone}</p>
            ) : null}
            <div className="separator" />
            <TonConnectButton />
            <button className="button primary" onClick={bindWallet} disabled={!canBindWallet || pending}>
              Bind Connected Wallet
            </button>
            <p className="muted mono">
              {(data?.user?.walletAddress ?? walletAddress) || "Wallet not connected"}
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="panel kpi">
            <div className="label">Net Profit</div>
            <div className="value mono">
              {data ? formatTon(data.user?.netProfitTon ?? 0) : "--"}
            </div>
            <div className="muted">Account-bound to Telegram ID and TON wallet.</div>
          </div>
          <div className="panel kpi">
            <div className="label">Success Streak</div>
            <div className="value mono">{data?.user?.successStreak ?? 0} days</div>
            <div className="muted">Bronze, Silver, Gold, and Diamond badge ladder.</div>
          </div>
          <div className="panel kpi">
            <div className="label">Active Pool</div>
            <div className="value mono">{data ? formatTon(data.challenge.poolTon) : "--"}</div>
            <div className="muted">Failed stakes minus platform fee split among winners.</div>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="stack">
          <div className="panel stack">
            <div className="row space-between">
              <div>
                <div className="label">Challenge Setup</div>
                <div className="value">{data?.challenge.title ?? "Morning Discipline Pool"}</div>
              </div>
              <span className="badge">
                {data ? englishTime(data.challenge.randomCheckInFrom, data.challenge.randomCheckInTo) : "--"}
              </span>
            </div>

            <div className="mission-grid">
              <label className="stack">
                <span className="label">Stake Amount (TON)</span>
                <input
                  className="input mono"
                  value={stakeAmount}
                  onChange={(event) => setStakeAmount(event.target.value)}
                  inputMode="decimal"
                />
              </label>

              <label className="stack">
                <span className="label">Target Wake Time</span>
                <select
                  className="input mono"
                  value={wakeTime}
                  onChange={(event) => setWakeTime(event.target.value)}
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
                  onChange={(event) => setDurationDays(Number(event.target.value))}
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
              You are committing to wake up at <strong>{WAKE_TIME_OPTIONS.find(o => o.value === wakeTime)?.label}</strong> every
              day for <strong>{durationDays} days</strong>. Participants who fail will forfeit
              their stake to the winners at the end of the period.
            </div>

            <div className="row">
              <button className="button accent" onClick={submitStake} disabled={pending || !authenticated}>
                Pay and Start Challenge
              </button>
              <button className="button primary" onClick={completeCheckIn} disabled={pending || !authenticated}>
                Simulate Wake Check-In
              </button>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="panel stack">
            <div className="label">Join a Group</div>
            <input
              className="input mono"
              placeholder="Group invite code"
              value={groupInviteCode}
              onChange={(event) => setGroupInviteCode(event.target.value)}
            />
            <button className="button ghost" onClick={joinGroup} disabled={pending || !authenticated}>
              Join Group
            </button>
          </div>

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

          <div className="panel stack">
            <div className="label">Identity</div>
            <div className="list">
              <div className="list-item">
                <span>Telegram User</span>
                <span className="mono">{data?.user?.telegramId ?? "Not authenticated"}</span>
              </div>
              <div className="list-item">
                <span>NFT Tier</span>
                <span>{data?.user?.nftTier ?? "Bronze"}</span>
              </div>
              <div className="list-item">
                <span>Group Size</span>
                <span className="mono">{data?.user?.groupMemberCount ?? 0} members</span>
              </div>
              <div className="list-item">
                <span>Timezone</span>
                <span className="mono">{data?.user?.timezone ?? "Not set"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="content-grid" style={{ marginTop: "1.5rem" }}>
        <div className="panel stack" style={{ gridColumn: "1 / -1" }}>
          <div className="row space-between">
            <div className="label">Guide</div>
            <a className="button ghost" href="/guide" target="_blank" rel="noreferrer">
              Open Full Guide
            </a>
          </div>
          <iframe
            title="Stake & Wake Guide"
            src="/guide"
            style={{ width: "100%", minHeight: "560px", border: "none", borderRadius: "12px" }}
          />
        </div>
      </section>
    </main>
  );
}

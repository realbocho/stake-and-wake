"use client";

import { useState, useEffect } from "react";

type InjectionHistory = {
  id: string;
  challenge_date: string;
  amount_ton: number;
  source: string;
  note: string | null;
  created_at: string;
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [history, setHistory] = useState<InjectionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function fetchHistory(key: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/pool/history", {
        headers: { "x-admin-key": key },
      });
      const data = await res.json();
      if (res.ok) setHistory(data.history ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleAuth() {
    setAuthError("");
    const res = await fetch("/api/admin/health", {
      headers: { "x-admin-key": adminKey },
    });
    if (res.ok) {
      setAuthed(true);
      fetchHistory(adminKey);
    } else {
      setAuthError("어드민 키가 올바르지 않아요.");
    }
  }

  async function handleInject() {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setResult({ ok: false, message: "올바른 금액을 입력해주세요." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/pool/inject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ amountTon: amountNum, note: note || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: `${amountNum} TON 주입 완료!` });
        setAmount("");
        setNote("");
        fetchHistory(adminKey);
      } else {
        setResult({ ok: false, message: data.error ?? "주입 실패" });
      }
    } catch {
      setResult({ ok: false, message: "네트워크 오류" });
    } finally {
      setLoading(false);
    }
  }

  if (!authed) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Admin</h1>
          <p style={styles.muted}>어드민 키를 입력하세요</p>
          <input
            type="password"
            placeholder="ADMIN_API_KEY"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            style={styles.input}
          />
          {authError && <p style={styles.error}>{authError}</p>}
          <button onClick={handleAuth} style={styles.button}>
            로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, maxWidth: 560 }}>
        <h1 style={styles.title}>Pool Injection</h1>
        <p style={styles.muted}>오늘 챌린지 풀에 TON을 주입합니다</p>

        <label style={styles.label}>금액 (TON)</label>
        <input
          type="number"
          placeholder="예: 1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={styles.input}
          min="0"
          step="0.1"
        />

        <label style={styles.label}>메모 (선택)</label>
        <input
          type="text"
          placeholder="예: 오늘 운영자 주입"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={styles.input}
        />

        {result && (
          <p style={result.ok ? styles.success : styles.error}>{result.message}</p>
        )}

        <button onClick={handleInject} disabled={loading} style={styles.button}>
          {loading ? "주입 중..." : "주입하기"}
        </button>

        <hr style={styles.divider} />

        <h2 style={styles.subtitle}>주입 이력</h2>
        {historyLoading ? (
          <p style={styles.muted}>불러오는 중...</p>
        ) : history.length === 0 ? (
          <p style={styles.muted}>주입 이력이 없어요.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>날짜</th>
                <th style={styles.th}>금액</th>
                <th style={styles.th}>메모</th>
                <th style={styles.th}>소스</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td style={styles.td}>{h.challenge_date}</td>
                  <td style={styles.td}>{Number(h.amount_ton).toFixed(2)} TON</td>
                  <td style={styles.td}>{h.note ?? "-"}</td>
                  <td style={styles.td}>{h.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: "monospace",
  },
  card: {
    backgroundColor: "#111",
    border: "1px solid #222",
    borderRadius: 12,
    padding: 32,
    width: "100%",
    maxWidth: 400,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
  },
  muted: {
    color: "#666",
    fontSize: 13,
    marginBottom: 20,
  },
  label: {
    display: "block",
    color: "#888",
    fontSize: 12,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#fff",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
  },
  button: {
    marginTop: 20,
    width: "100%",
    backgroundColor: "#fff",
    color: "#000",
    border: "none",
    borderRadius: 8,
    padding: "12px 0",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  success: {
    color: "#4ade80",
    fontSize: 13,
    marginTop: 12,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginTop: 12,
  },
  divider: {
    border: "none",
    borderTop: "1px solid #222",
    margin: "28px 0",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  th: {
    color: "#666",
    textAlign: "left",
    paddingBottom: 8,
    borderBottom: "1px solid #222",
  },
  td: {
    color: "#ccc",
    padding: "8px 0",
    borderBottom: "1px solid #1a1a1a",
  },
};

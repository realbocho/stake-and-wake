export default function GuidePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="stack">
          <span className="eyebrow">How it works</span>
          <h1 className="title" style={{ fontSize: "clamp(36px, 6vw, 64px)" }}>
            User Guide
          </h1>
          <p className="subtitle">
            Stake TON, lock your phone at night, and check in within minutes of
            your wake time every morning. Miss a day and you forfeit your stake
            to the winners.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <div className="panel stack" style={{ marginBottom: 20 }}>
          <div className="label">Daily flow</div>
          <div className="list">
            <div className="list-item">
              <span className="mono" style={{ minWidth: 120, color: "var(--accent)" }}>Once at start</span>
              <span>Connect wallet → stake TON → start your challenge</span>
            </div>
            <div className="list-item">
              <span className="mono" style={{ minWidth: 120, color: "var(--accent)" }}>Every night</span>
              <span>Tap <strong>Enable Sleep Lock</strong> before going to bed</span>
            </div>
            <div className="list-item">
              <span className="mono" style={{ minWidth: 120, color: "var(--accent)" }}>Every morning</span>
              <span>Open the app within ±12 min of your wake time and tap <strong>Wake Check-In</strong></span>
            </div>
            <div className="list-item">
              <span className="mono" style={{ minWidth: 120, color: "var(--accent)" }}>After challenge</span>
              <span>Claim your reward if you succeeded every day</span>
            </div>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="stack">
          <div className="panel stack">
            <div className="label">Step 1 — Connect wallet &amp; stake</div>
            <p className="muted">
              Connect your TON wallet using the <strong>TON Connect</strong> button, then tap{" "}
              <strong>Bind Connected Wallet</strong> to link it to your account.
            </p>
            <p className="muted">
              Set your stake amount (minimum 0.5 TON), choose your target wake
              time (between 5:00 AM and 7:00 AM), and select a challenge duration
              of 7, 14, 21, or 30 days. Tap <strong>Pay and Start Challenge</strong> to
              confirm the transaction in your wallet.
            </p>
          </div>

          <div className="panel stack">
            <div className="label">Step 2 — Enable Sleep Lock every night</div>
            <p className="muted">
              Before going to sleep, tap <strong>Enable Sleep Lock</strong>. The button
              has no animation — check the badge in the top-right of the wake
              window panel. If it shows <strong>sleep_locked</strong>, you&apos;re set.
            </p>
            <p className="muted">
              Sleep Lock must be activated every night. Without it, the morning
              check-in will be blocked regardless of when you open the app.
            </p>
          </div>

          <div className="panel stack">
            <div className="label">Step 3 — Wake Check-In every morning</div>
            <p className="muted">
              Open the app within <strong>±12 minutes</strong> of your chosen wake time and
              tap <strong>Simulate Wake Check-In</strong>.
            </p>
            <p className="muted">
              For example, if your wake time is <strong>05:30</strong>, your check-in
              window is <strong>05:18 – 05:42</strong>. The window is calculated
              automatically based on your personal wake time setting.
            </p>
            <p className="muted">
              Miss the window and that day counts as a failure — your stake
              contribution goes to the winners&apos; pool.
            </p>
          </div>
        </div>

        <div className="stack">
          <div className="panel stack">
            <div className="label">Step 4 — Claim your reward</div>
            <p className="muted">
              At the end of each day, the pool from failed participants is split
              among everyone who successfully checked in. Your cumulative profit
              is shown under <strong>Net Profit</strong>.
            </p>
            <p className="muted">
              Referral credits from inviting friends are shown under{" "}
              <strong>Referral Credits</strong>. Tap <strong>Claim Credits</strong> to add
              them to your balance.
            </p>
          </div>

          <div className="panel stack">
            <div className="label">FAQ</div>

            <div className="label" style={{ marginTop: 8 }}>Sleep Lock does nothing when I tap it</div>
            <p className="muted">
              There&apos;s no animation. Check the badge in the wake window — if it
              says <strong>sleep_locked</strong>, it worked.
            </p>

            <div className="label" style={{ marginTop: 16 }}>Sleep Lock isn&apos;t responding at all</div>
            <p className="muted">
              You need to complete a stake first. Tap <strong>Pay and Start
              Challenge</strong> to join a challenge before Sleep Lock becomes
              available.
            </p>

            <div className="label" style={{ marginTop: 16 }}>Do I need to open the app inside Telegram?</div>
            <p className="muted">
              Yes. The app uses Telegram&apos;s login to verify your identity. Opening
              it in a regular browser will show a login prompt that cannot be
              completed outside of Telegram.
            </p>

            <div className="label" style={{ marginTop: 16 }}>What happens if I miss a day?</div>
            <p className="muted">
              That day is marked as failed. Your original stake is not immediately
              lost — the final distribution happens at the end of the challenge
              period, and only participants who missed days contribute to the
              winners&apos; pool.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

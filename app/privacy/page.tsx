export default function PrivacyPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="stack">
          <span className="eyebrow">Legal</span>
          <h1 className="title" style={{ fontSize: "clamp(36px, 6vw, 64px)" }}>
            Privacy Policy
          </h1>
          <p className="subtitle">
            This policy explains what Stake &amp; Wake stores in order to operate
            Telegram login, challenge participation, wallet linking, referrals, and
            challenge settlement.
          </p>
        </div>
      </section>

      <section className="content-grid" style={{ marginTop: 20 }}>
        <div className="panel stack">
          <div className="label">Data We Collect</div>
          <p className="muted">
            We may store your Telegram user identifier, display name, avatar URL,
            linked wallet address, challenge history, anti-cheat activity signals,
            referral balances, and group participation records.
          </p>

          <div className="label">Why We Use It</div>
          <p className="muted">
            This data is used to authenticate you, track challenge entries,
            calculate rewards, prevent abuse, send operational notifications, and
            maintain account records tied to your Telegram identity.
          </p>

          <div className="label">Wallet and Blockchain Data</div>
          <p className="muted">
            TON wallet addresses and on-chain transactions are public by nature.
            We only store the wallet address and related app-side challenge records
            required to operate the product.
          </p>
        </div>

        <div className="panel stack">
          <div className="label">Retention</div>
          <p className="muted">
            We retain operational and financial records as long as reasonably
            necessary for service operation, fraud prevention, dispute handling,
            and legal compliance.
          </p>

          <div className="label">Sharing</div>
          <p className="muted">
            We do not describe third-party sharing beyond required infrastructure
            in this template. Replace this section with your final production
            policy before launch.
          </p>

          <div className="label">Contact</div>
          <p className="muted">
            Replace this section with your privacy contact or support email before
            launch.
          </p>
        </div>
      </section>
    </main>
  );
}

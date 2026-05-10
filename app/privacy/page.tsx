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
            linked wallet address, device timezone, challenge history, anti-cheat
            activity signals, referral balances, and group participation records.
          </p>
          <div className="label">Why We Use It</div>
          <p className="muted">
            This data is used to authenticate you, track challenge entries,
            calculate rewards, determine your check-in time window, prevent abuse,
            send operational notifications, and maintain account records tied to
            your Telegram identity.
          </p>
          <div className="label">Wallet and Blockchain Data</div>
          <p className="muted">
            TON wallet addresses and on-chain transactions are public by nature.
            We only store the wallet address and related app-side challenge records
            required to operate the product.
          </p>
          <div className="label">Analytics</div>
          <p className="muted">
            We use Telegram Analytics SDK to collect anonymous, non-identifiable
            usage statistics such as app launch counts. This data cannot be used
            to identify individual users and is used solely to improve the service.
          </p>
        </div>
        <div className="panel stack">
          <div className="label">Retention</div>
          <p className="muted">
            We retain operational and financial records for up to one (1) year
            after your last activity, or as long as reasonably necessary for
            service operation, fraud prevention, dispute handling, and legal
            compliance.
          </p>
          <div className="label">Sharing</div>
          <p className="muted">
            We do not sell or share your personal data with third parties.
            Your data is used exclusively to operate Stake &amp; Wake and is not
            disclosed to any outside parties except as required by law.
          </p>
          <div className="label">Your Rights</div>
          <p className="muted">
            You may request access to, correction of, or deletion of your personal
            data at any time. Note that on-chain blockchain records cannot be
            modified or deleted by nature.
          </p>
          <div className="label">Governing Law</div>
          <p className="muted">
            This policy is governed by the laws of the Republic of Korea.
          </p>
          <div className="label">Contact</div>
          <p className="muted">
            For privacy-related inquiries, contact us via Telegram:{" "}
            <a href="https://t.me/stakeandwake_bot" style={{ color: "var(--gold)" }}>
              @stakeandwake_bot
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

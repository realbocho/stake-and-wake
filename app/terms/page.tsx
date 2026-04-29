export default function TermsPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="stack">
          <span className="eyebrow">Legal</span>
          <h1 className="title" style={{ fontSize: "clamp(36px, 6vw, 64px)" }}>
            Terms of Use
          </h1>
          <p className="subtitle">
            These terms govern access to Stake &amp; Wake, a Telegram Mini App that
            lets users join wake-up challenges, connect TON wallets, and participate
            in reward-based accountability pools.
          </p>
        </div>
      </section>

      <section className="content-grid" style={{ marginTop: 20 }}>
        <div className="panel stack">
          <div className="label">Eligibility</div>
          <p className="muted">
            You must use a valid Telegram account and a wallet you control. One
            Telegram account is intended to map to one wallet unless otherwise
            approved by the service.
          </p>

          <div className="label">Challenge Rules</div>
          <p className="muted">
            Stake submissions, sleep-lock participation, wake verification, and
            settlement are governed by the rules shown inside the app at the time
            you join a challenge. Missed verification windows or flagged abuse may
            result in failure for that round.
          </p>

          <div className="label">Blockchain Transactions</div>
          <p className="muted">
            TON transfers are final once confirmed on-chain. You are responsible
            for reviewing wallet prompts, network fees, and recipient addresses
            before approving any transaction.
          </p>
        </div>

        <div className="panel stack">
          <div className="label">Acceptable Use</div>
          <p className="muted">
            You may not abuse referrals, automate wake verification, impersonate
            others, exploit reward logic, or interfere with the service or smart
            contract operation.
          </p>

          <div className="label">Service Changes</div>
          <p className="muted">
            Rules, fees, challenge timing, reward rates, and anti-cheat policies
            may change as the product evolves. Continued use after changes means
            you accept the updated terms.
          </p>

          <div className="label">Contact</div>
          <p className="muted">
            Replace this section with your official support or operator contact
            before launch.
          </p>
        </div>
      </section>
    </main>
  );
}

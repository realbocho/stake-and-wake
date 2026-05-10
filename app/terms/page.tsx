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
            before approving any transaction. Stakes that fail the challenge are
            non-refundable and will be distributed to successful participants.
          </p>
        </div>
        <div className="panel stack">
          <div className="label">Acceptable Use</div>
          <p className="muted">
            You may not abuse referrals, automate wake verification, impersonate
            others, exploit reward logic, or interfere with the service or smart
            contract operation.
          </p>
          <div className="label">Disclaimer of Liability</div>
          <p className="muted">
            Stake &amp; Wake is not liable for any losses arising from blockchain
            network failures, smart contract bugs, Telegram platform outages, or
            user error including incorrect wallet addresses or missed check-ins.
            Use this service at your own risk.
          </p>
          <div className="label">Service Changes</div>
          <p className="muted">
            Rules, fees, challenge timing, reward rates, and anti-cheat policies
            may change as the product evolves. Continued use after changes means
            you accept the updated terms.
          </p>
          <div className="label">Governing Law</div>
          <p className="muted">
            These terms are governed by the laws of the Republic of Korea.
            Any disputes shall be subject to the jurisdiction of Korean courts.
          </p>
          <div className="label">Contact</div>
          <p className="muted">
            For questions or support, contact us via Telegram:{" "}
            <a href="https://t.me/stakeandwake_bot" style={{ color: "var(--gold)" }}>
              @stakeandwake_bot
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

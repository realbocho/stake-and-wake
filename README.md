# Stake & Wake

Production-oriented Telegram Mini App starter for a TON-based wake-up staking challenge.

## Stack

- Next.js 16 App Router
- React 19
- PostgreSQL via `postgres`
- Telegram Mini App auth through `initData`
- TON wallet connection with `@tonconnect/ui-react`

## Features implemented

- Telegram auto-login endpoint with server-side `initData` verification
- Session cookie issuance
- One-to-one wallet binding constraint
- Daily stake flow and sleep-lock flow
- Wake verification endpoint
- Referral credit claim flow
- Leaderboard and bootstrap dashboard payload
- SQL schema for users, daily challenges, activity logs, and group membership
- TON Connect stake payment preparation and confirmation flow
- Tact smart contract project for the staking vault
- Admin settlement endpoint and group join flow

## Important platform note

Pure Telegram Mini Apps run in a web runtime. They **cannot reliably detect real OS-level screen-on events or app usage across other apps**. This starter implements:

- Visibility change heartbeat logging
- Device fingerprint hashing
- Per-account wallet uniqueness

For true screen-on or cross-app monitoring, ship a native wrapper or move the anti-cheat trust model to external verifiers.

## Smart contract

The TON vault contract lives in [contracts/StakeWakeVault.tact](./contracts/StakeWakeVault.tact) and compiles with the official Tact compiler via [tact.config.json](./tact.config.json).

- `OpenRound` starts a new daily round
- `Stake` accepts user deposits
- `MarkParticipant` marks each participant as success or failure
- `FinalizeRound` calculates winner reward and platform fee
- `Claim` lets winners withdraw principal + reward
- `WithdrawFees` lets the owner collect accrued platform fees

## Run

1. Install dependencies:

```bash
npm install
```

2. Copy env values:

```bash
copy .env.example .env.local
```

3. Start PostgreSQL:

```bash
docker compose up -d
```

4. If you are not using Docker, create PostgreSQL schema manually:

```bash
psql %DATABASE_URL% -f db/schema.sql
```

5. Install smart contract compiler output:

```bash
npm run build:contracts
```

6. Start dev server:

```bash
npm run dev
```

## Required environment variables

- `TELEGRAM_BOT_TOKEN`: bot token used for `initData` verification and group notifications
- `SESSION_SECRET`: session JWT secret
- `DATABASE_URL`: PostgreSQL DSN
- `STAKE_VAULT_ADDRESS`: deployed TON vault contract address
- `ADMIN_API_KEY`: required for settlement endpoint
- `TELEGRAM_GROUP_CHAT_ID`: group where success messages are posted

## Admin settlement

Settle the daily pool after the wake-up window closes:

```bash
curl -X POST http://localhost:3000/api/admin/challenges/settle ^
  -H "Content-Type: application/json" ^
  -H "x-admin-key: YOUR_ADMIN_API_KEY" ^
  -d "{}"
```

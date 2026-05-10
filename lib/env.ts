function read(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const NULL_VAULT = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";

export const env = {
  databaseUrl: read("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/stake_and_wake"),
  telegramBotToken: read("TELEGRAM_BOT_TOKEN", "replace_me"),
  sessionSecret: read("SESSION_SECRET", "dev-session-secret"),
  appUrl: read("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  telegramGroupChatId: process.env.TELEGRAM_GROUP_CHAT_ID ?? "",
  stakeVaultAddress: read("STAKE_VAULT_ADDRESS", NULL_VAULT),
  adminApiKey: read("ADMIN_API_KEY", "dev-admin-key"),
  referralBonusTon: Number(process.env.NEXT_PUBLIC_REFERRAL_BONUS_TON ?? "0.25"),
  dailyFeeTon: Number(process.env.NEXT_PUBLIC_DAILY_FEE_TON ?? "0.05"),
  platformFeeRate: Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_RATE ?? "0.08")
};

// Warn loudly on startup if vault address is the null/zero address.
// In production this should be treated as a hard error.
if (env.stakeVaultAddress === NULL_VAULT || env.stakeVaultAddress.startsWith("EQAAAAAAAAA")) {
  console.error(
    "[CRITICAL] STAKE_VAULT_ADDRESS is a null/zero address. " +
    "Any TON sent to this address will be permanently lost. " +
    "Set STAKE_VAULT_ADDRESS in your environment variables before accepting real stakes."
  );
}

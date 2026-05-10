import { ok, fail } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { env } from "@/lib/env";
import { getSql } from "@/lib/db";

const NULL_VAULT_ADDRESS = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";

function checkVaultAddress(address: string) {
  if (address === NULL_VAULT_ADDRESS) {
    return { ok: false, reason: "STAKE_VAULT_ADDRESS is the null/zero address — TON sent here is lost forever." };
  }
  if (address.startsWith("EQAAAAAAAAA")) {
    return { ok: false, reason: "STAKE_VAULT_ADDRESS looks like a zero/test address." };
  }
  if (!address.startsWith("EQ") && !address.startsWith("UQ")) {
    return { ok: false, reason: "STAKE_VAULT_ADDRESS does not look like a valid TON address (expected EQ... or UQ...)." };
  }
  return { ok: true, reason: null };
}

// GET /api/admin/health
export async function GET(request: Request) {
  try {
    assertAdmin(request);

    const vaultCheck = checkVaultAddress(env.stakeVaultAddress);

    // DB connectivity check
    let dbOk = false;
    let dbError: string | null = null;
    try {
      const sql = getSql();
      await sql`select 1`;
      dbOk = true;
    } catch (e) {
      dbError = e instanceof Error ? e.message : "DB unreachable";
    }

    // Unverified payment count
    let unverifiedCount = 0;
    let pendingWithdrawalCount = 0;
    if (dbOk) {
      const sql = getSql();
      const [uv] = await sql<{ cnt: number }[]>`
        select count(*)::int as cnt from payment_intent where status in ('prepared', 'unverified')
      `;
      unverifiedCount = uv?.cnt ?? 0;

      const [pw] = await sql<{ cnt: number }[]>`
        select count(*)::int as cnt from withdrawal_log where status = 'pending'
      `;
      pendingWithdrawalCount = pw?.cnt ?? 0;
    }

    const healthy = vaultCheck.ok && dbOk;

    return ok({
      healthy,
      checkedAt: new Date().toISOString(),
      vault: {
        address: env.stakeVaultAddress,
        ...vaultCheck,
      },
      db: {
        ok: dbOk,
        error: dbError,
      },
      config: {
        platformFeeRate: env.platformFeeRate,
        dailyFeeTon: env.dailyFeeTon,
        referralBonusTon: env.referralBonusTon,
        network: process.env.TON_NETWORK ?? "testnet",
      },
      alerts: {
        unverifiedPayments: unverifiedCount,
        pendingWithdrawals: pendingWithdrawalCount,
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Health check failed";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

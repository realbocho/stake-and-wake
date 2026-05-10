import { ok, fail } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { getSql } from "@/lib/db";
import { verifyOnChainDeposit } from "@/lib/ton";
import { stakeForTonight } from "@/lib/repositories/challenges";
import { z } from "zod";

// GET /api/admin/payments/reverify
// Lists all payment_intents with unverified or stuck status for admin review.
export async function GET(request: Request) {
  try {
    assertAdmin(request);
    const sql = getSql();

    const rows = await sql<{
      id: string;
      user_id: string;
      challenge_id: string;
      amount_ton: number;
      wallet_address: string;
      status: string;
      tx_hash: string | null;
      reverify_attempts: number;
      submitted_at: string | null;
      created_at: string;
      display_name: string;
      telegram_id: string;
    }[]>`
      select p.id, p.user_id, p.challenge_id, p.amount_ton, p.wallet_address,
             p.status, p.tx_hash, p.reverify_attempts, p.submitted_at, p.created_at,
             u.display_name, u.telegram_id
      from payment_intent p
      join app_user u on u.id = p.user_id
      where p.status in ('prepared', 'unverified')
         or (p.status = 'confirmed' and p.tx_hash is null)
      order by p.created_at desc
      limit 50
    `;

    return ok({ count: rows.length, intents: rows });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Fetch failed";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

// POST /api/admin/payments/reverify
// Re-runs on-chain verification for a specific payment_intent or all unverified ones.
export async function POST(request: Request) {
  try {
    assertAdmin(request);
    const body = z.object({
      intentId: z.string().uuid().optional(), // omit to reverify all
      challengeVaultAddress: z.string().min(10),
    }).parse(await request.json());

    const sql = getSql();

    const rows = await sql<{
      id: string;
      user_id: string;
      challenge_id: string;
      amount_ton: number;
      wallet_address: string;
      status: string;
      payload_base64: string;
      reverify_attempts: number;
    }[]>`
      select p.id, p.user_id, p.challenge_id, p.amount_ton,
             p.wallet_address, p.status, p.payload_base64, p.reverify_attempts
      from payment_intent p
      where (${body.intentId ?? null}::uuid is null or p.id = ${body.intentId ?? null}::uuid)
        and p.status in ('prepared', 'unverified')
      order by p.created_at asc
      limit 20
    `;

    const results: { intentId: string; result: string }[] = [];

    for (const intent of rows) {
      // Increment attempt counter
      await sql`
        update payment_intent
        set reverify_attempts = reverify_attempts + 1,
            reverified_at = now()
        where id = ${intent.id}
      `;

      const txHash = await verifyOnChainDeposit({
        fromWallet: intent.wallet_address,
        toVault: body.challengeVaultAddress,
        expectedNano: BigInt(Math.round(Number(intent.amount_ton) * 1_000_000_000)),
        challengeId: intent.challenge_id,
        telegramId: "", // not used for re-verification matching
        wakeTime: "",
      });

      if (txHash && !txHash.startsWith("unverified")) {
        // Confirm intent and activate stake
        await sql.begin(async (tx) => {
          await tx`
            update payment_intent
            set status = 'confirmed',
                tx_hash = ${txHash},
                submitted_at = now()
            where id = ${intent.id}
          `;

          // Ensure participation record exists
          await stakeForTonight({
            userId: intent.user_id,
            stakeAmountTon: Number(intent.amount_ton),
            wakeTime: "05:30",
            durationDays: 7,
          });
        });

        results.push({ intentId: intent.id, result: `confirmed — txHash: ${txHash}` });
      } else {
        await sql`
          update payment_intent
          set status = 'unverified'
          where id = ${intent.id}
        `;
        results.push({ intentId: intent.id, result: "still unverified — no matching on-chain tx found" });
      }
    }

    return ok({ processed: results.length, results });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Reverify failed";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

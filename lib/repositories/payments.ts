import { randomUUID } from "crypto";
import { getSql } from "@/lib/db";

export async function createPaymentIntent(input: {
  userId: string;
  challengeId: string;
  amountTon: number;
  payload: string;
  walletAddress: string;
}) {
  const sql = getSql();
  const id = randomUUID();
  await sql`
    insert into payment_intent (
      id, user_id, challenge_id, amount_ton, payload_base64, wallet_address, status
    ) values (
      ${id}, ${input.userId}, ${input.challengeId}, ${input.amountTon},
      ${input.payload}, ${input.walletAddress}, 'prepared'
    )
  `;
  return id;
}

// ── [Fix] Fetch a single record by intentId + userId ──────────────────────────
export async function getPaymentIntent(intentId: string, userId: string) {
  const sql = getSql();
  const [row] = await sql<{
    id: string;
    challenge_id: string;
    amount_ton: number;
    wallet_address: string;
    status: string;
  }[]>`
    select id, challenge_id, amount_ton, wallet_address, status
    from payment_intent
    where id = ${intentId}
      and user_id = ${userId}
    limit 1
  `;
  if (!row) return null;
  return {
    id: row.id,           // ✅ 수정됨
    challengeId: row.challenge_id,
    amountTon: Number(row.amount_ton),
    walletAddress: row.wallet_address,
    status: row.status,
  };
}

// ── [Fix] Save verified hash to txHash column ─────────────────────────────────
export async function confirmPaymentIntent(input: {
  intentId: string;
  userId: string;
  boc: string;
  txHash: string;
}) {
  const sql = getSql();
  await sql`
    update payment_intent
    set status = 'confirmed',
        submitted_boc = ${input.boc},
        tx_hash = ${input.txHash},
        submitted_at = now()
    where id = ${input.intentId}
      and user_id = ${input.userId}
  `;
}

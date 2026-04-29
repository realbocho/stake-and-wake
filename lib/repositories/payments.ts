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

export async function confirmPaymentIntent(input: {
  intentId: string;
  userId: string;
  boc: string;
}) {
  const sql = getSql();
  await sql`
    update payment_intent
    set status = 'submitted',
        submitted_boc = ${input.boc},
        submitted_at = now()
    where id = ${input.intentId}
      and user_id = ${input.userId}
  `;
}

import { getSql } from "@/lib/db";

export type WithdrawalSource = "normal" | "admin_force";
export type WithdrawalStatus = "pending" | "sent" | "failed";

export async function createWithdrawalLog(input: {
  userId: string;
  walletAddress: string;
  amountTon: number;
  source: WithdrawalSource;
  note?: string;
}) {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    insert into withdrawal_log (user_id, wallet_address, amount_ton, source, note)
    values (${input.userId}, ${input.walletAddress}, ${input.amountTon}, ${input.source}, ${input.note ?? null})
    returning id
  `;
  return row.id;
}

export async function updateWithdrawalLog(input: {
  id: string;
  status: WithdrawalStatus;
  txHash?: string;
}) {
  const sql = getSql();
  await sql`
    update withdrawal_log
    set status = ${input.status},
        tx_hash = ${input.txHash ?? null},
        updated_at = now()
    where id = ${input.id}
  `;
}

export async function getWithdrawalLogs(filters?: { userId?: string; status?: WithdrawalStatus }) {
  const sql = getSql();
  const rows = await sql<{
    id: string;
    user_id: string;
    wallet_address: string;
    amount_ton: number;
    status: string;
    source: string;
    tx_hash: string | null;
    note: string | null;
    created_at: string;
  }[]>`
    select w.id, w.user_id, w.wallet_address, w.amount_ton,
           w.status, w.source, w.tx_hash, w.note, w.created_at,
           u.display_name, u.telegram_id
    from withdrawal_log w
    join app_user u on u.id = w.user_id
    where (${filters?.userId ?? null}::uuid is null or w.user_id = ${filters?.userId ?? null}::uuid)
      and (${filters?.status ?? null} is null or w.status = ${filters?.status ?? null})
    order by w.created_at desc
    limit 100
  `;
  return rows;
}

export async function getPendingWithdrawals() {
  const sql = getSql();
  return sql<{
    id: string;
    user_id: string;
    wallet_address: string;
    amount_ton: number;
    source: string;
    note: string | null;
    created_at: string;
  }[]>`
    select id, user_id, wallet_address, amount_ton, source, note, created_at
    from withdrawal_log
    where status = 'pending'
    order by created_at asc
  `;
}

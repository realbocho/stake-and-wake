import { ok, fail } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { getSql } from "@/lib/db";
import { createWithdrawalLog, updateWithdrawalLog, getWithdrawalLogs } from "@/lib/repositories/withdrawals";
import { z } from "zod";

const forceWithdrawSchema = z.object({
  userId: z.string().uuid(),
  note: z.string().max(256).optional(),
});

// POST /api/admin/force-withdraw
// Marks net_profit_ton as withdrawn and logs it as pending.
// You then manually send the TON from the vault and update the log with tx_hash via PATCH.
export async function POST(request: Request) {
  try {
    assertAdmin(request);
    const body = forceWithdrawSchema.parse(await request.json());
    const sql = getSql();

    const [user] = await sql<{
      id: string;
      display_name: string;
      wallet_address: string | null;
      net_profit_ton: number;
    }[]>`
      select id, display_name, wallet_address, net_profit_ton
      from app_user
      where id = ${body.userId}
      limit 1
    `;

    if (!user) return fail("User not found", 404);
    if (!user.wallet_address) return fail("User has no wallet address bound", 400);
    if (Number(user.net_profit_ton) <= 0) return fail("No balance to withdraw", 400);

    const amountTon = Number(user.net_profit_ton);

    // Deduct from DB first, log as pending — you send TON manually after
    await sql.begin(async (tx) => {
      await tx`
        update app_user
        set net_profit_ton = 0
        where id = ${body.userId}
      `;
    });

    const logId = await createWithdrawalLog({
      userId: body.userId,
      walletAddress: user.wallet_address,
      amountTon,
      source: "admin_force",
      note: body.note,
    });

    return ok({
      logId,
      userId: body.userId,
      displayName: user.display_name,
      walletAddress: user.wallet_address,
      amountTon,
      message: `Logged ${amountTon} TON withdrawal for ${user.display_name}. Send TON manually from vault, then PATCH /api/admin/force-withdraw with logId + txHash to mark as sent.`,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Force withdraw failed";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

// PATCH /api/admin/force-withdraw
// After manually sending TON, mark the log entry as sent with the tx hash.
export async function PATCH(request: Request) {
  try {
    assertAdmin(request);
    const body = z.object({
      logId: z.string().uuid(),
      txHash: z.string().min(10),
    }).parse(await request.json());

    await updateWithdrawalLog({
      id: body.logId,
      status: "sent",
      txHash: body.txHash,
    });

    return ok({ logId: body.logId, status: "sent", txHash: body.txHash });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Update failed";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

// GET /api/admin/force-withdraw?status=pending&userId=...
// List withdrawal logs for admin review.
export async function GET(request: Request) {
  try {
    assertAdmin(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as "pending" | "sent" | "failed" | null;
    const userId = url.searchParams.get("userId") ?? undefined;

    const logs = await getWithdrawalLogs({ status: status ?? undefined, userId });
    return ok({ logs });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Fetch failed";
    return fail(message, message === "Forbidden" ? 403 : 400);
  }
}

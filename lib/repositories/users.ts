import { randomUUID } from "crypto";
import { getSql } from "@/lib/db";
import { toTier } from "@/lib/utils";
import type { SessionUser } from "@/lib/types";

type UserRow = {
  id: string;
  telegram_id: string;
  display_name: string;
  avatar_url: string | null;
  wallet_address: string | null;
  success_streak: number;
  net_profit_ton: number;
  group_member_count: number;
  timezone: string | null;
};

function mapUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    walletAddress: row.wallet_address,
    successStreak: row.success_streak,
    netProfitTon: Number(row.net_profit_ton),
    nftTier: toTier(row.success_streak),
    groupMemberCount: row.group_member_count,
    timezone: row.timezone
  };
}

export async function findUserById(userId: string) {
  const sql = getSql();
  const [row] = await sql<UserRow[]>`
    select id, telegram_id, display_name, avatar_url, wallet_address,
           success_streak, net_profit_ton, group_member_count, timezone
    from app_user
    where id = ${userId}
    limit 1
  `;
  return row ? mapUser(row) : null;
}

export async function upsertTelegramUser(input: {
  telegramId: string;
  displayName: string;
  avatarUrl?: string;
  deviceIdHash: string;
  inviteCode?: string;
  timezone?: string;
}) {
  const sql = getSql();
  const [existing] = await sql<UserRow[]>`
    select id, telegram_id, display_name, avatar_url, wallet_address,
           success_streak, net_profit_ton, group_member_count, timezone
    from app_user
    where telegram_id = ${input.telegramId}
    limit 1
  `;

  if (existing) {
    // 기존 유저 — timezone은 이미 설정된 경우 변경하지 않음
    await sql`
      update app_user
      set display_name = ${input.displayName},
          avatar_url = ${input.avatarUrl ?? null},
          last_device_hash = ${input.deviceIdHash},
          last_login_at = now()
      where id = ${existing.id}
    `;
    return mapUser(existing);
  }

  // 신규 유저 — timezone 최초 저장
  const id = randomUUID();
  const myInviteCode = `SW-${input.telegramId}`;
  const timezone = input.timezone ?? null;

  await sql`
    insert into app_user (
      id, telegram_id, display_name, avatar_url, invite_code,
      referral_credit_ton, last_device_hash, success_streak,
      net_profit_ton, group_member_count, timezone
    ) values (
      ${id}, ${input.telegramId}, ${input.displayName}, ${input.avatarUrl ?? null},
      ${myInviteCode}, 0, ${input.deviceIdHash}, 0, 0, 1, ${timezone}
    )
  `;

  return {
    id,
    telegramId: input.telegramId,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl ?? null,
    walletAddress: null,
    successStreak: 0,
    netProfitTon: 0,
    nftTier: "Bronze",
    groupMemberCount: 1,
    timezone
  } satisfies SessionUser;
}

export async function bindWallet(userId: string, walletAddress: string) {
  const sql = getSql();

  const [collision] = await sql<{ id: string }[]>`
    select id from app_user
    where wallet_address = ${walletAddress}
      and id <> ${userId}
    limit 1
  `;

  if (collision) {
    throw new Error("This wallet is already bound to another Telegram account.");
  }

  await sql`
    update app_user
    set wallet_address = ${walletAddress}
    where id = ${userId}
  `;
}

export async function claimReferralBalance(userId: string) {
  const sql = getSql();
  const [row] = await sql<{ referral_credit_ton: number; net_profit_ton: number }[]>`
    update app_user
    set net_profit_ton = net_profit_ton + referral_credit_ton,
        referral_credit_ton = 0
    where id = ${userId}
      and referral_credit_ton > 0
    returning referral_credit_ton, net_profit_ton
  `;
  return row;
}

export async function getReferralBalance(userId: string) {
  const sql = getSql();
  const [row] = await sql<{ referral_credit_ton: number }[]>`
    select referral_credit_ton from app_user where id = ${userId} limit 1
  `;
  return Number(row?.referral_credit_ton ?? 0);
}

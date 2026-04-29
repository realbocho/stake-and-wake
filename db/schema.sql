create extension if not exists "pgcrypto";

create table if not exists app_user (
  id uuid primary key,
  telegram_id text not null unique,
  display_name text not null,
  avatar_url text,
  invite_code text not null unique,
  wallet_address text unique,
  referral_credit_ton numeric(18, 4) not null default 0,
  last_device_hash text,
  success_streak integer not null default 0,
  net_profit_ton numeric(18, 4) not null default 0,
  group_member_count integer not null default 1,
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists challenge (
  id uuid primary key,
  challenge_date date not null unique,
  title text not null,
  status text not null default 'open',
  default_wake_time text not null,
  default_random_from text not null,
  default_random_to text not null,
  min_stake_ton numeric(18, 4) not null,
  daily_fee_ton numeric(18, 4) not null,
  pool_ton numeric(18, 4) not null default 0,
  platform_fee_ton numeric(18, 4) not null default 0,
  per_winner_reward_ton numeric(18, 4) not null default 0,
  platform_fee_rate numeric(8, 4) not null,
  created_at timestamptz not null default now()
);

create table if not exists challenge_participation (
  id uuid primary key,
  challenge_id uuid not null references challenge(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  stake_amount_ton numeric(18, 4) not null,
  wake_time text not null,
  random_check_in_from text not null,
  random_check_in_to text not null,
  status text not null,
  anti_cheat_flags jsonb not null default '{}'::jsonb,
  device_id_hash text,
  reaction_ms integer,
  settled_reward_ton numeric(18, 4) not null default 0,
  sleep_locked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create table if not exists anti_cheat_event (
  id uuid primary key,
  user_id uuid not null references app_user(id) on delete cascade,
  hidden boolean not null,
  observed_at timestamptz not null
);

create table if not exists group_room (
  id text primary key,
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists group_membership (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  group_id text not null references group_room(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (user_id, group_id)
);

create table if not exists payment_intent (
  id uuid primary key,
  user_id uuid not null references app_user(id) on delete cascade,
  challenge_id uuid not null references challenge(id) on delete cascade,
  amount_ton numeric(18, 4) not null,
  wallet_address text not null,
  payload_base64 text not null,
  status text not null,
  submitted_boc text,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

insert into group_room (id, name, invite_code)
values ('founders-circle', 'Founders Circle', 'FOUNDERS10')
on conflict (id) do nothing;

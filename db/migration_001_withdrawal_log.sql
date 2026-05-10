-- Migration 001: withdrawal log table
-- Run this against your existing database before deploying the force-withdraw API.

create table if not exists withdrawal_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  wallet_address text not null,
  amount_ton numeric(18, 4) not null,
  -- 'pending' | 'sent' | 'failed'
  status text not null default 'pending',
  -- 'normal' | 'admin_force'
  source text not null default 'normal',
  tx_hash text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawal_log_user_id_idx on withdrawal_log (user_id);
create index if not exists withdrawal_log_status_idx on withdrawal_log (status);

-- Also add settled_at to payment_intent for reverify tracking
alter table payment_intent
  add column if not exists reverified_at timestamptz,
  add column if not exists reverify_attempts integer not null default 0;

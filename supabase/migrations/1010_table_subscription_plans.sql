-- ============================================================
-- Table: subscription_plans
-- ============================================================
-- Base subscription catalog used by organizations.


create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_name text not null,
  max_clinics integer not null check (max_clinics > 0),
  max_users integer not null check (max_users > 0),
  monthly_price numeric(12,2) not null default 0 check (monthly_price >= 0),
  yearly_price numeric(12,2) not null default 0 check (yearly_price >= 0),
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint subscription_plans_plan_name_key unique (plan_name)
);

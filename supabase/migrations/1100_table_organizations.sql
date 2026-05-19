-- ============================================================
-- Table: organizations
-- ============================================================
-- created_by FK is added in 102_table_users.sql after public.users exists.


create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  subscription_status public.subscription_status not null default 'trialing',
  subscription_plan_id uuid null references public.subscription_plans(id) on delete set null,
  default_currency_code varchar(3) null references public.currencies(code) on delete set null,
  trial_ends_at timestamptz null,
  subscription_starts_at timestamptz null,
  subscription_ends_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint organizations_subscription_dates_check check (
    subscription_ends_at is null
    or subscription_starts_at is null
    or subscription_ends_at >= subscription_starts_at
  )
);

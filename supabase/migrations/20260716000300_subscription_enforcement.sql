-- ============================================================
-- Subscription Enforcement: NO_SUBSCRIPTION system plan
-- ============================================================
-- Organizations previously started with subscription_plan_id = null,
-- deliberately decoupling onboarding from subscription activation. That
-- design is preserved, but "no plan yet" now points at a real system plan
-- row (NO_SUBSCRIPTION) instead of null, so every downstream consumer
-- (limits enforcement, the transact gate) can treat subscription_plan_id
-- as always-present. 'Trial' already exists as a seeded plan
-- (supabase/seeds/003_subscription_plans.sql) and is reused as-is as the
-- system TRIAL plan -- no new row needed for it.
--
-- max_clinics/max_users on NO_SUBSCRIPTION are set to the schema minimum
-- (both columns require > 0) purely to satisfy that constraint -- an org on
-- NO_SUBSCRIPTION never reaches a limits check because the transact gate
-- (canOrganizationTransact) blocks all creation before that point.
--
-- trial_ends_at is dropped: now that Trial is a normal plan row, the
-- existing subscription_starts_at/subscription_ends_at pair is sufficient
-- for every subscription type, including Trial.

insert into public.subscription_plans (plan_name, max_clinics, max_users, monthly_price, yearly_price, features)
values ('NO_SUBSCRIPTION', 1, 1, 0, 0, '{}'::jsonb)
on conflict (plan_name) do nothing;

-- Backfill: no production data exists yet, but this keeps the migration
-- correct in any environment that already has organization rows.
update public.organizations
set subscription_plan_id = (select id from public.subscription_plans where plan_name = 'NO_SUBSCRIPTION')
where subscription_plan_id is null;

alter table public.organizations alter column subscription_plan_id set not null;

alter table public.organizations drop constraint organizations_subscription_plan_id_fkey;
alter table public.organizations
  add constraint organizations_subscription_plan_id_fkey
  foreign key (subscription_plan_id) references public.subscription_plans(id) on delete restrict;

alter table public.organizations drop column trial_ends_at;

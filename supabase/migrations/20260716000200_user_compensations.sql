-- ============================================================
-- Commission Calculations: user_compensations
-- ============================================================
-- Replaces users.commission_type/commission_value with a time-versioned
-- compensation table. Reuses the existing commission_type enum as-is for
-- the generic `type` column -- the table name carries the business
-- context, per the approved design. No effective_to column: validity is
-- derived from the next row's effective_from, avoiding redundant state.
-- No production data exists yet, so the users columns are dropped outright
-- rather than migrated.

alter table public.users drop constraint users_commission_check;
alter table public.users drop column commission_type;
alter table public.users drop column commission_value;

create table public.user_compensations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  type public.commission_type not null default 'none',
  value numeric(12,2) not null default 0,
  effective_from date not null default current_date,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_compensations_organization_id_user_id_fkey
    foreign key (organization_id, user_id) references public.users(organization_id, id) on delete cascade,
  constraint user_compensations_organization_id_created_by_fkey
    foreign key (organization_id, created_by) references public.users(organization_id, id) on delete set null,
  constraint user_compensations_org_user_effective_from_key unique (organization_id, user_id, effective_from),
  constraint user_compensations_value_check check (
    (type = 'none' and value = 0)
    or (type = 'fixed' and value >= 0)
    or (type = 'percentage' and value between 0 and 100)
  )
);

create index user_compensations_organization_id_idx on public.user_compensations(organization_id);
create index user_compensations_user_id_effective_from_idx on public.user_compensations(user_id, effective_from desc);

create trigger set_user_compensations_updated_at
before update on public.user_compensations
for each row execute function public.set_updated_at();

alter table public.user_compensations enable row level security;

create policy "user_compensations_select_policy"
on "public"."user_compensations"
as permissive
for select
to authenticated
using (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR (
    organization_id = public.current_organization_id()
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
        and u.organization_id = user_compensations.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

create policy "user_compensations_insert_policy"
on "public"."user_compensations"
as permissive
for insert
to authenticated
with check (
  public.is_super_admin()
  OR (
    organization_id = public.current_organization_id()
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
        and u.organization_id = user_compensations.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

create policy "user_compensations_update_policy"
on "public"."user_compensations"
as permissive
for update
to authenticated
using (
  public.is_super_admin()
  OR (
    organization_id = public.current_organization_id()
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
        and u.organization_id = user_compensations.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

create policy "user_compensations_delete_policy"
on "public"."user_compensations"
as permissive
for delete
to authenticated
using (public.is_super_admin());

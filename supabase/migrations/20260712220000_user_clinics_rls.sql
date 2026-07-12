-- Drop old user_clinics policies
drop policy if exists "user_clinics_delete_policy" on "public"."user_clinics";
drop policy if exists "user_clinics_insert_policy" on "public"."user_clinics";
drop policy if exists "user_clinics_select_policy" on "public"."user_clinics";
drop policy if exists "user_clinics_update_policy" on "public"."user_clinics";

-- Create new select policy permitting users of the same organization
create policy "user_clinics_select_policy"
on "public"."user_clinics"
for select
to authenticated
using (
  public.is_super_admin() OR
  (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.organization_id = user_clinics.organization_id
    )
  )
);

-- Create new insert policy permitting ORG_OWNER and ORG_ADMIN of the same organization
create policy "user_clinics_insert_policy"
on "public"."user_clinics"
for insert
to authenticated
with check (
  public.is_super_admin() OR
  (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
      and u.organization_id = user_clinics.organization_id
      and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

-- Create new update policy permitting ORG_OWNER and ORG_ADMIN of the same organization
create policy "user_clinics_update_policy"
on "public"."user_clinics"
for update
to authenticated
using (
  public.is_super_admin() OR
  (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
      and u.organization_id = user_clinics.organization_id
      and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
)
with check (
  public.is_super_admin() OR
  (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
      and u.organization_id = user_clinics.organization_id
      and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

-- Create new delete policy permitting ORG_OWNER and ORG_ADMIN of the same organization
create policy "user_clinics_delete_policy"
on "public"."user_clinics"
for delete
to authenticated
using (
  public.is_super_admin() OR
  (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
      and u.organization_id = user_clinics.organization_id
      and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

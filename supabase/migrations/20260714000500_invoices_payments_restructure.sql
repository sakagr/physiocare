-- ============================================================
-- Invoice/Payment restructure
-- ============================================================
-- D9: payment_status belongs to the payment lifecycle, not the invoice.
-- invoices.payment_status is dropped entirely; "is this invoice paid" becomes
-- a service-computed check (does a completed payment row exist for this
-- invoice_id). payments gets its own new enum -- the old payment_status enum
-- ('unpaid'/'partially_paid'/...) was designed for invoice-level meaning and
-- doesn't fit a payment row that only exists once money has actually moved;
-- it is left in place (unused) rather than dropped, since nothing else
-- references it.
--
-- D9: one invoice can have only one payment in V1 -- enforced with a partial
-- unique index (not plain) so an administrative soft-delete-and-recreate
-- correction stays possible, matching the soft-delete-reusability convention
-- already used for clinics/user_clinics/packages.
--
-- Resolved clarification: invoices gets a nullable patient_package_id
-- (header-level only -- invoice_items stays free-text per D7) so D2's
-- patient-package delete guard ("no invoice exists for it") is queryable.

alter table public.invoices add column patient_package_id uuid null;
alter table public.invoices add constraint invoices_organization_id_patient_package_id_fkey
  foreign key (organization_id, patient_package_id) references public.patient_packages(organization_id, id) on delete set null;

alter table public.invoices drop column payment_status;

create type public.payment_transaction_status as enum (
  'completed',
  'refunded',
  'cancelled'
);

alter table public.payments add column payment_status public.payment_transaction_status not null default 'completed';

create unique index payments_active_invoice_key on public.payments (invoice_id) where (deleted_at is null);

-- ------------------------------------------------------------
-- invoices RLS: role-name fix + ORG_OWNER (select/update only -- insert/
-- delete are already org-scope-only or is_super_admin()-only)
-- ------------------------------------------------------------
drop policy if exists "invoices_select_policy" on "public"."invoices";
drop policy if exists "invoices_update_policy" on "public"."invoices";

create policy "invoices_select_policy"
on "public"."invoices"
as permissive
for select
to authenticated
using (
  public.is_super_admin()
  OR (
    organization_id = public.current_organization_id()
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
        and u.organization_id = invoices.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR (
    clinic_id in (
      select uc.clinic_id from public.user_clinics uc
      where uc.user_id = auth.uid() and uc.deleted_at is null
    )
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name = 'ORG_RECEPTIONIST'
    )
  )
  OR exists (
    select 1 from public.appointments a
    where a.id = invoices.appointment_id
      and a.physiotherapist_id = auth.uid()
  )
);

create policy "invoices_update_policy"
on "public"."invoices"
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
        and u.organization_id = invoices.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN', 'ORG_RECEPTIONIST')
    )
  )
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

-- ------------------------------------------------------------
-- invoice_items RLS: role-name fix + ORG_OWNER
-- ------------------------------------------------------------
drop policy if exists "invoice_items_select_policy" on "public"."invoice_items";
drop policy if exists "invoice_items_update_policy" on "public"."invoice_items";

create policy "invoice_items_select_policy"
on "public"."invoice_items"
as permissive
for select
to authenticated
using (
  public.is_super_admin()
  OR exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and (
        (
          i.organization_id = public.current_organization_id()
          and exists (
            select 1 from public.users u
            join public.roles r on u.role_id = r.id
            where u.id = auth.uid()
              and u.organization_id = i.organization_id
              and r.name in ('ORG_OWNER', 'ORG_ADMIN')
          )
        )
        OR (
          i.clinic_id in (
            select uc.clinic_id from public.user_clinics uc
            where uc.user_id = auth.uid() and uc.deleted_at is null
          )
          and exists (
            select 1 from public.users u
            join public.roles r on u.role_id = r.id
            where u.id = auth.uid() and r.name = 'ORG_RECEPTIONIST'
          )
        )
        OR exists (
          select 1 from public.appointments a
          where a.id = i.appointment_id
            and a.physiotherapist_id = auth.uid()
        )
      )
  )
);

create policy "invoice_items_update_policy"
on "public"."invoice_items"
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
        and u.organization_id = invoice_items.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN', 'ORG_RECEPTIONIST')
    )
  )
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

-- ------------------------------------------------------------
-- payments RLS: role-name fix + ORG_OWNER
-- ------------------------------------------------------------
drop policy if exists "payments_select_policy" on "public"."payments";
drop policy if exists "payments_update_policy" on "public"."payments";

create policy "payments_select_policy"
on "public"."payments"
as permissive
for select
to authenticated
using (
  public.is_super_admin()
  OR (
    organization_id = public.current_organization_id()
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
        and u.organization_id = payments.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR exists (
    select 1 from public.invoices i
    where i.id = payments.invoice_id
      and i.clinic_id in (
        select uc.clinic_id from public.user_clinics uc
        where uc.user_id = auth.uid() and uc.deleted_at is null
      )
      and exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.id = auth.uid() and r.name = 'ORG_RECEPTIONIST'
      )
  )
  OR exists (
    select 1 from public.invoices i
    join public.appointments a on a.id = i.appointment_id
    where i.id = payments.invoice_id
      and a.physiotherapist_id = auth.uid()
  )
);

create policy "payments_update_policy"
on "public"."payments"
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
        and u.organization_id = payments.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

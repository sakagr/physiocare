-- ============================================================
-- Invoice write atomicity (Billing Write Correctness)
-- ============================================================
-- Two invoice writes span multiple rows across two tables and must succeed or
-- fail as a single unit (see AGENTS.md "Database Functions for Atomic
-- Operations"): replacing an invoice's line item set, and creating an invoice
-- with its items.
--
-- Both are `security invoker`, not `definer`. definer is reserved for a
-- legitimate, service-authorized caller that a deliberately narrower table
-- policy would otherwise block -- the case consume_package_session exists for.
-- There is no such gap here: every role canManageInvoices admits is already
-- admitted by invoices_insert/update_policy and invoice_items_insert/update_policy.
-- invoker also keeps RLS applying to every statement inside the function, which
-- is what makes the session-client tests over these paths meaningful.
--
-- Neither function derives a total. Every amount is computed by the service
-- layer from the validated input and passed in, per the same section's rule
-- that business logic never moves into the function.

-- ------------------------------------------------------------
-- Replaces an invoice's live line item set and its header totals atomically.
--
-- The items are soft-deleted, not removed: invoice_items_delete_policy is
-- is_super_admin() only, and Soft Delete Strategy makes soft deletion the
-- default with hard deletes an exceptional administrative operation. A
-- client-issued DELETE here is filtered to zero rows by RLS and reports no
-- error, which is the defect this function exists to close.
-- ------------------------------------------------------------
create or replace function public.replace_invoice_items(
  p_organization_id uuid,
  p_invoice_id uuid,
  p_items jsonb,
  p_subtotal numeric,
  p_gst_amount numeric,
  p_discount_amount numeric,
  p_total_amount numeric,
  p_invoice_date date default null
) returns public.invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices
    where id = p_invoice_id
      and organization_id = p_organization_id
      and deleted_at is null
    for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  update public.invoice_items
  set deleted_at = now()
  where invoice_id = p_invoice_id
    and deleted_at is null;

  insert into public.invoice_items (organization_id, invoice_id, item_name, quantity, unit_price, gst_percent, total)
  select p_organization_id, p_invoice_id, item.item_name, item.quantity, item.unit_price, item.gst_percent, item.total
  from jsonb_to_recordset(p_items) as item(
    item_name text,
    quantity integer,
    unit_price numeric,
    gst_percent numeric,
    total numeric
  );

  update public.invoices
  set subtotal = p_subtotal,
      gst_amount = p_gst_amount,
      discount_amount = p_discount_amount,
      total_amount = p_total_amount,
      invoice_date = coalesce(p_invoice_date, invoice_date)
  where id = p_invoice_id
  returning * into v_invoice;

  return v_invoice;
end;
$$;

-- ------------------------------------------------------------
-- Creates an invoice together with its line items atomically.
--
-- This replaces a header insert followed by an item insert compensated by a
-- hard delete of the header. The compensation could never run --
-- invoices_delete_policy is is_super_admin() only, and a DELETE that RLS
-- filters to zero rows raises no error -- so a failed item write left a live
-- invoice that had permanently consumed an invoice number.
--
-- It deliberately does not catch unique_violation: the caller's retry loop
-- resolves an invoice_number collision against
-- invoices_organization_id_invoice_number_key, and depends on seeing 23505.
-- ------------------------------------------------------------
create or replace function public.create_invoice_with_items(
  p_organization_id uuid,
  p_invoice_number text,
  p_patient_id uuid,
  p_clinic_id uuid,
  p_subtotal numeric,
  p_gst_amount numeric,
  p_discount_amount numeric,
  p_total_amount numeric,
  p_items jsonb,
  p_appointment_id uuid default null,
  p_patient_package_id uuid default null,
  p_invoice_date date default null,
  p_created_by uuid default null
) returns public.invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice public.invoices;
begin
  insert into public.invoices (
    organization_id, invoice_number, patient_id, clinic_id, appointment_id,
    patient_package_id, invoice_date, subtotal, gst_amount, discount_amount,
    total_amount, created_by
  )
  values (
    p_organization_id, p_invoice_number, p_patient_id, p_clinic_id, p_appointment_id,
    p_patient_package_id, coalesce(p_invoice_date, current_date), p_subtotal, p_gst_amount,
    p_discount_amount, p_total_amount, p_created_by
  )
  returning * into v_invoice;

  insert into public.invoice_items (organization_id, invoice_id, item_name, quantity, unit_price, gst_percent, total)
  select p_organization_id, v_invoice.id, item.item_name, item.quantity, item.unit_price, item.gst_percent, item.total
  from jsonb_to_recordset(p_items) as item(
    item_name text,
    quantity integer,
    unit_price numeric,
    gst_percent numeric,
    total numeric
  );

  return v_invoice;
end;
$$;

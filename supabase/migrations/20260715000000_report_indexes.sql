-- ============================================================
-- Reporting indexes
-- ============================================================
-- Supports Phase 7 billing/physiotherapist report date-range queries.

create index invoices_organization_id_invoice_date_idx on public.invoices(organization_id, invoice_date);
create index payments_organization_id_paid_at_idx on public.payments(organization_id, paid_at);

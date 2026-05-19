-- ============================================================
-- Table: invoice_items
-- ============================================================
-- Depends on invoices.


create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  gst_percent numeric(5,2) not null default 0 check (gst_percent between 0 and 100),
  total numeric(12,2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint invoice_items_organization_id_invoice_id_fkey
    foreign key (organization_id, invoice_id) references public.invoices(organization_id, id) on delete cascade
);

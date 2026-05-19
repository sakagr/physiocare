-- ============================================================
-- Table: payments
-- ============================================================
-- Depends on invoices and users.


create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_mode public.payment_mode not null,
  transaction_reference text null,
  paid_at timestamptz not null default now(),
  received_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint payments_organization_id_invoice_id_fkey
    foreign key (organization_id, invoice_id) references public.invoices(organization_id, id) on delete cascade,
  constraint payments_organization_id_received_by_fkey
    foreign key (organization_id, received_by) references public.users(organization_id, id) on delete set null
);

-- ============================================================
-- Table: invoices
-- ============================================================
-- Depends on patients, clinics, appointments, and users.


create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null,
  patient_id uuid not null,
  clinic_id uuid not null,
  appointment_id uuid null,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  gst_amount numeric(12,2) not null default 0 check (gst_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  payment_status public.payment_status not null default 'unpaid',
  invoice_date date not null default current_date,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint invoices_organization_id_id_key unique (organization_id, id),
  constraint invoices_organization_id_invoice_number_key unique (organization_id, invoice_number),
  constraint invoices_organization_id_patient_id_fkey
    foreign key (organization_id, patient_id) references public.patients(organization_id, id) on delete restrict,
  constraint invoices_organization_id_clinic_id_fkey
    foreign key (organization_id, clinic_id) references public.clinics(organization_id, id) on delete restrict,
  constraint invoices_organization_id_appointment_id_fkey
    foreign key (organization_id, appointment_id) references public.appointments(organization_id, id) on delete set null,
  constraint invoices_organization_id_created_by_fkey
    foreign key (organization_id, created_by) references public.users(organization_id, id) on delete set null
);

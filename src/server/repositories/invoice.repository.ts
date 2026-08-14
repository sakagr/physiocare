import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { InvoiceItemPayload } from "./invoice-item.repository";

export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type InsertInvoice = Database["public"]["Tables"]["invoices"]["Insert"];
export type UpdateInvoice = Database["public"]["Tables"]["invoices"]["Update"];

/**
 * Atomically inserts an invoice together with its line items via the
 * create_invoice_with_items database function (see AGENTS.md "Database
 * Functions for Atomic Operations").
 */
export async function createInvoiceWithItems(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    invoiceNumber: string;
    patientId: string;
    clinicId: string;
    appointmentId?: string;
    patientPackageId?: string;
    invoiceDate?: string;
    subtotal: number;
    gstAmount: number;
    discountAmount: number;
    totalAmount: number;
    createdBy: string;
    items: InvoiceItemPayload[];
  }
): Promise<Invoice> {
  const { data, error } = await supabase
    .rpc("create_invoice_with_items", {
      p_organization_id: params.organizationId,
      p_invoice_number: params.invoiceNumber,
      p_patient_id: params.patientId,
      p_clinic_id: params.clinicId,
      p_appointment_id: params.appointmentId,
      p_patient_package_id: params.patientPackageId,
      p_invoice_date: params.invoiceDate,
      p_subtotal: params.subtotal,
      p_gst_amount: params.gstAmount,
      p_discount_amount: params.discountAmount,
      p_total_amount: params.totalAmount,
      p_created_by: params.createdBy,
      p_items: params.items as unknown as Json,
    })
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing invoice record.
 */
export async function updateInvoice(
  supabase: SupabaseClient<Database>,
  invoiceId: string,
  invoice: UpdateInvoice
): Promise<Invoice> {
  const { data, error } = await supabase
    .from("invoices")
    .update(invoice)
    .eq("id", invoiceId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds an active (non-deleted) invoice by ID.
 */
export async function findInvoiceById(
  supabase: SupabaseClient<Database>,
  invoiceId: string
): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds the highest existing invoice_number within an organization, including
 * soft-deleted invoices (numbers are immutable and must never be reused).
 */
export async function findLatestInvoiceNumberInOrg(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("organization_id", organizationId)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data?.invoice_number ?? null;
}

/**
 * Lists active invoices within an organization with pagination filters.
 */
export async function listInvoices(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    patientId?: string;
    clinicId?: string;
    clinicIds?: string[];
  }
): Promise<Invoice[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }

  if (filters.clinicId) {
    query = query.eq("clinic_id", filters.clinicId);
  } else if (filters.clinicIds) {
    query = query.in("clinic_id", filters.clinicIds);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists every active invoice within an organization whose invoice_date falls
 * within the given range, for report aggregation. Unlike listInvoices, this
 * is not paginated -- callers are expected to have already bounded the date
 * range (see MAX_REPORT_RANGE_DAYS) to keep the result set safe. Read-only:
 * exists solely to retrieve reporting data.
 */
export async function listInvoicesForReport(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    dateFrom: string;
    dateTo: string;
    clinicId?: string;
    clinicIds?: string[];
  }
): Promise<Invoice[]> {
  let query = supabase
    .from("invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .gte("invoice_date", filters.dateFrom)
    .lte("invoice_date", filters.dateTo);

  if (filters.clinicId) {
    query = query.eq("clinic_id", filters.clinicId);
  } else if (filters.clinicIds) {
    query = query.in("clinic_id", filters.clinicIds);
  }

  const { data, error } = await query.order("invoice_date", { ascending: true });

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists every active invoice linked to any of the given appointments, with
 * no invoice_date restriction -- used to attribute revenue to whichever
 * physiotherapist owns the appointment, exactly per the appointment_id ->
 * physiotherapist_id rule (see physiotherapist-report.service.ts), without
 * an N+1 query. Read-only: exists solely to retrieve reporting data.
 */
export async function listInvoicesByAppointmentIds(
  supabase: SupabaseClient<Database>,
  appointmentIds: string[]
): Promise<Invoice[]> {
  if (appointmentIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .in("appointment_id", appointmentIds)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Counts active invoices matching filter criteria within an organization.
 */
export async function countInvoices(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    patientId?: string;
    clinicId?: string;
    clinicIds?: string[];
  }
): Promise<number> {
  let query = supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }

  if (filters.clinicId) {
    query = query.eq("clinic_id", filters.clinicId);
  } else if (filters.clinicIds) {
    query = query.in("clinic_id", filters.clinicIds);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}

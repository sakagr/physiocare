import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type InsertPayment = Database["public"]["Tables"]["payments"]["Insert"];
export type UpdatePayment = Database["public"]["Tables"]["payments"]["Update"];

/**
 * Inserts a new payment record.
 */
export async function insertPayment(
  supabase: SupabaseClient<Database>,
  payment: InsertPayment
): Promise<Payment> {
  const { data, error } = await supabase
    .from("payments")
    .insert(payment)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing payment record (status transitions only -- amount,
 * invoice_id, and mode are never mutable after creation).
 */
export async function updatePayment(
  supabase: SupabaseClient<Database>,
  paymentId: string,
  payment: UpdatePayment
): Promise<Payment> {
  const { data, error } = await supabase
    .from("payments")
    .update(payment)
    .eq("id", paymentId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds an active (non-deleted) payment by ID.
 */
export async function findPaymentById(
  supabase: SupabaseClient<Database>,
  paymentId: string
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds the active payment recorded against an invoice, if any.
 */
export async function findPaymentByInvoiceId(
  supabase: SupabaseClient<Database>,
  invoiceId: string
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists the active payments recorded against an invoice.
 */
export async function listPaymentsByInvoice(
  supabase: SupabaseClient<Database>,
  invoiceId: string
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Checks whether an active payment already exists for an invoice.
 */
export async function existsPaymentForInvoice(
  supabase: SupabaseClient<Database>,
  invoiceId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return (count || 0) > 0;
}

/**
 * Lists every active payment within an organization whose paid_at falls
 * within the given range, for report aggregation (a "money moved during
 * this period" view -- independent of when the underlying invoice was
 * dated). Clinic scoping goes through the invoice, since payments carry no
 * clinic_id of their own. Not paginated; callers are expected to have
 * already bounded the date range. Read-only: exists solely to retrieve
 * reporting data.
 */
export async function listPaymentsForReport(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    dateFrom: string;
    dateTo: string;
    clinicId?: string;
    clinicIds?: string[];
  }
): Promise<(Payment & { invoices: { clinic_id: string } })[]> {
  let query = supabase
    .from("payments")
    .select("*, invoices!inner(clinic_id)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .gte("paid_at", filters.dateFrom)
    .lte("paid_at", filters.dateTo);

  if (filters.clinicId) {
    query = query.eq("invoices.clinic_id", filters.clinicId);
  } else if (filters.clinicIds) {
    query = query.in("invoices.clinic_id", filters.clinicIds);
  }

  const { data, error } = await query.order("paid_at", { ascending: true });

  if (error) {
    throw error;
  }
  return data as unknown as (Payment & { invoices: { clinic_id: string } })[];
}

/**
 * Lists every active payment recorded against the given invoices, with no
 * date restriction -- used to determine "does this invoice have a payment
 * at all" for a set of invoices without an N+1 query. Read-only: exists
 * solely to retrieve reporting data.
 */
export async function listPaymentsByInvoiceIds(
  supabase: SupabaseClient<Database>,
  invoiceIds: string[]
): Promise<Payment[]> {
  if (invoiceIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .in("invoice_id", invoiceIds)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists a patient's payments by joining through their invoices.
 */
export async function listPaymentsByPatient(
  supabase: SupabaseClient<Database>,
  patientId: string,
  filters: {
    page: number;
    limit: number;
  }
): Promise<Payment[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  const { data, error } = await supabase
    .from("payments")
    .select("*, invoices!inner(patient_id)")
    .eq("invoices.patient_id", patientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data;
}

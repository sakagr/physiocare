import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type InsertInvoice = Database["public"]["Tables"]["invoices"]["Insert"];
export type UpdateInvoice = Database["public"]["Tables"]["invoices"]["Update"];

/**
 * Inserts a new invoice record.
 */
export async function insertInvoice(
  supabase: SupabaseClient<Database>,
  invoice: InsertInvoice
): Promise<Invoice> {
  const { data, error } = await supabase
    .from("invoices")
    .insert(invoice)
    .select()
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
 * Deletes an invoice record. Used to compensate a failed invoice_items
 * insert immediately after invoice creation.
 */
export async function deleteInvoice(
  supabase: SupabaseClient<Database>,
  invoiceId: string
): Promise<void> {
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);

  if (error) {
    throw error;
  }
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

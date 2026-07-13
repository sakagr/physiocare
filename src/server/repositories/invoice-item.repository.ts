import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type InvoiceItem = Database["public"]["Tables"]["invoice_items"]["Row"];
export type InsertInvoiceItem = Database["public"]["Tables"]["invoice_items"]["Insert"];

/**
 * Bulk-inserts the line items belonging to an invoice.
 */
export async function insertInvoiceItems(
  supabase: SupabaseClient<Database>,
  items: InsertInvoiceItem[]
): Promise<InvoiceItem[]> {
  const { data, error } = await supabase
    .from("invoice_items")
    .insert(items)
    .select();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists the active line items belonging to an invoice.
 */
export async function listInvoiceItemsByInvoice(
  supabase: SupabaseClient<Database>,
  invoiceId: string
): Promise<InvoiceItem[]> {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Deletes every line item belonging to an invoice. Used when replacing the
 * full item set on update (pre-payment only), and to compensate a failed
 * invoice_items insert immediately after invoice creation.
 */
export async function deleteInvoiceItemsByInvoice(
  supabase: SupabaseClient<Database>,
  invoiceId: string
): Promise<void> {
  const { error } = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

  if (error) {
    throw error;
  }
}

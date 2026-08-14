import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { Invoice } from "./invoice.repository";

export type InvoiceItem = Database["public"]["Tables"]["invoice_items"]["Row"];
export type InsertInvoiceItem = Database["public"]["Tables"]["invoice_items"]["Insert"];

/**
 * The per-item payload the invoice write functions accept. organization_id and
 * invoice_id are function parameters, not per-item fields.
 */
export interface InvoiceItemPayload {
  item_name: string;
  quantity: number;
  unit_price: number;
  gst_percent: number;
  total: number;
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
 * Atomically replaces an invoice's live line item set and its header totals
 * via the replace_invoice_items database function (see AGENTS.md "Database
 * Functions for Atomic Operations"), returning the updated invoice.
 */
export async function replaceInvoiceItems(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    invoiceId: string;
    items: InvoiceItemPayload[];
    subtotal: number;
    gstAmount: number;
    discountAmount: number;
    totalAmount: number;
    invoiceDate?: string;
  }
): Promise<Invoice> {
  const { data, error } = await supabase
    .rpc("replace_invoice_items", {
      p_organization_id: params.organizationId,
      p_invoice_id: params.invoiceId,
      p_items: params.items as unknown as Json,
      p_subtotal: params.subtotal,
      p_gst_amount: params.gstAmount,
      p_discount_amount: params.discountAmount,
      p_total_amount: params.totalAmount,
      p_invoice_date: params.invoiceDate,
    })
    .single();

  if (error) {
    throw error;
  }
  return data;
}

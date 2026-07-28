import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Invoices domain (F2, M8/R6). Client-safe --
 * never imports from `src/server/**` or `src/types/database.ts`. Mirrors
 * `src/server/repositories/invoice.repository.ts` → `Invoice` (the
 * `invoices` table row) and `invoice-item.repository.ts` → `InvoiceItem`.
 */
export const invoiceSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  invoice_number: z.string(),
  patient_id: z.string(),
  clinic_id: z.string(),
  appointment_id: z.string().nullable(),
  patient_package_id: z.string().nullable(),
  invoice_date: z.string(),
  subtotal: z.number(),
  gst_amount: z.number(),
  discount_amount: z.number(),
  total_amount: z.number(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const invoiceItemSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  invoice_id: z.string(),
  item_name: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  gst_percent: z.number(),
  total: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/**
 * `InvoiceWithItems` (`invoice.service.ts`): what `createInvoice`,
 * `updateInvoice`, and `getInvoiceDetails` return -- totals are always
 * computed server-side from the items, never trusted from the client.
 */
export const invoiceWithItemsSchema = z.object({
  invoice: invoiceSchema,
  items: z.array(invoiceItemSchema),
});

/** GET /api/invoices -- headers only, no line items (fetch the detail for those). */
export const invoiceListResponseSchema = pagedResultSchema(invoiceSchema);

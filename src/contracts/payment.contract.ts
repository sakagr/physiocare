import { z } from "zod";

/**
 * Response contracts for the Payments domain (F2, M8/R6). Client-safe --
 * never imports from `src/server/**` or `src/types/database.ts`. Mirrors
 * `src/server/repositories/payment.repository.ts` → `Payment` (the
 * `payments` table row).
 */
export const paymentSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  invoice_id: z.string(),
  amount: z.number(),
  payment_mode: z.enum(["cash", "card", "upi", "bank_transfer", "cheque", "wallet", "other"]),
  transaction_reference: z.string().nullable(),
  paid_at: z.string(),
  received_by: z.string().nullable(),
  payment_status: z.enum(["completed", "refunded", "cancelled"]),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/**
 * GET /api/invoices/{id}/payments -- a bare array, not paginated. V1
 * supports at most one payment per invoice (`createPayment` rejects a
 * second), so this is never more than a single-element list.
 */
export const invoicePaymentsResponseSchema = z.array(paymentSchema);

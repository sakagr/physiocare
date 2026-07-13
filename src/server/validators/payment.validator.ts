import { z } from "zod";
import { paginationSchema } from "./shared.validator";

/**
 * Validation schema for recording a payment against an invoice.
 */
export const createPaymentSchema = z.object({
  invoiceId: z.string().uuid({ message: "Invalid invoice ID format." }),
  amount: z.coerce.number().positive({ message: "Amount must be a positive number." }),
  paymentMode: z.enum(["cash", "card", "upi", "bank_transfer", "cheque", "wallet", "other"]),
  transactionReference: z.string().trim().optional().or(z.literal("")),
  paidAt: z.string().datetime({ message: "Invalid payment timestamp." }).optional(),
});

/**
 * Validation schema for transitioning a payment's status.
 * Only completed -> refunded and completed -> cancelled are legal
 * transitions; the service layer enforces this, not just the enum shape.
 */
export const updatePaymentStatusSchema = z.object({
  status: z.enum(["completed", "refunded", "cancelled"]),
});

/**
 * Validation schema for the payment list query.
 */
export const paymentListQuerySchema = paginationSchema.extend({
  invoiceId: z.string().uuid({ message: "Invalid invoice ID format." }).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export function validateCreatePaymentInput(input: unknown): CreatePaymentInput {
  return createPaymentSchema.parse(input);
}

export function validateUpdatePaymentStatusInput(input: unknown): UpdatePaymentStatusInput {
  return updatePaymentStatusSchema.parse(input);
}

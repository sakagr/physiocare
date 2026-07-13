import { z } from "zod";
import { paginationSchema } from "./shared.validator";

const invoiceItemSchema = z.object({
  itemName: z
    .string()
    .min(1, { message: "Item name is required." })
    .max(200, { message: "Item name cannot exceed 200 characters." })
    .trim(),
  quantity: z.coerce
    .number()
    .int()
    .positive({ message: "Quantity must be a positive integer." }),
  unitPrice: z.coerce
    .number()
    .min(0, { message: "Unit price cannot be negative." }),
  gstPercent: z.coerce
    .number()
    .min(0, { message: "GST percent cannot be negative." })
    .max(100, { message: "GST percent cannot exceed 100." })
    .default(0),
});

/**
 * Validation schema for creating a new invoice.
 */
export const createInvoiceSchema = z.object({
  patientId: z.string().uuid({ message: "Invalid patient ID format." }),
  clinicId: z.string().uuid({ message: "Invalid clinic ID format." }),
  appointmentId: z.string().uuid({ message: "Invalid appointment ID format." }).optional(),
  patientPackageId: z.string().uuid({ message: "Invalid patient package ID format." }).optional(),
  invoiceDate: z.string().date({ message: "Invalid invoice date." }).optional(),
  discountAmount: z.coerce
    .number()
    .min(0, { message: "Discount amount cannot be negative." })
    .default(0),
  items: z.array(invoiceItemSchema).min(1, { message: "At least one invoice item is required." }),
});

/**
 * Validation schema for updating an existing invoice (all fields optional).
 * The service layer blocks this entirely once a payment exists.
 */
export const updateInvoiceSchema = createInvoiceSchema.partial();

/**
 * Validation schema for the invoice list query.
 */
export const invoiceListQuerySchema = paginationSchema.extend({
  patientId: z.string().uuid({ message: "Invalid patient ID format." }).optional(),
  clinicId: z.string().uuid({ message: "Invalid clinic ID format." }).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

export function validateCreateInvoiceInput(input: unknown): CreateInvoiceInput {
  return createInvoiceSchema.parse(input);
}

export function validateUpdateInvoiceInput(input: unknown): UpdateInvoiceInput {
  return updateInvoiceSchema.parse(input);
}

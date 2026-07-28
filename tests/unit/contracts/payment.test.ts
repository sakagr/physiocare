import { describe, expect, it } from "vitest";
import { invoicePaymentsResponseSchema, paymentSchema } from "@/contracts/payment.contract";

/**
 * Response contracts for the Payments domain (F2, M8/R6), mirroring
 * `src/server/repositories/payment.repository.ts` → `Payment` (the
 * `payments` table row). `listPaymentsForInvoice` returns a bare array --
 * V1 supports at most one payment per invoice, so it is never paginated.
 */
const paymentFixture = {
  id: "payment-1",
  organization_id: "org-1",
  invoice_id: "invoice-1",
  amount: 590,
  payment_mode: "card",
  transaction_reference: "TXN-123",
  paid_at: "2026-01-02T00:00:00Z",
  received_by: "user-1",
  payment_status: "completed",
  created_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  deleted_at: null,
};

describe("paymentSchema", () => {
  it("parses a payment row", () => {
    expect(paymentSchema.parse(paymentFixture)).toEqual(paymentFixture);
  });
});

describe("invoicePaymentsResponseSchema", () => {
  it("parses a bare array of payments (GET /api/invoices/{id}/payments)", () => {
    expect(invoicePaymentsResponseSchema.parse([paymentFixture])).toEqual([paymentFixture]);
  });
});

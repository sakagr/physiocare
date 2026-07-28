import { describe, expect, it } from "vitest";
import { invoiceListResponseSchema, invoiceSchema, invoiceWithItemsSchema } from "@/contracts/invoice.contract";

/**
 * Response contracts for the Invoices domain (F2, M8/R6), mirroring
 * `src/server/repositories/invoice.repository.ts` → `Invoice` (the
 * `invoices` table row) and `invoice.service.ts` → `InvoiceWithItems`.
 */
const invoiceFixture = {
  id: "invoice-1",
  organization_id: "org-1",
  invoice_number: "INV-000001",
  patient_id: "patient-1",
  clinic_id: "clinic-1",
  appointment_id: null,
  patient_package_id: null,
  invoice_date: "2026-01-01",
  subtotal: 500,
  gst_amount: 90,
  discount_amount: 0,
  total_amount: 590,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

const itemFixture = {
  id: "item-1",
  organization_id: "org-1",
  invoice_id: "invoice-1",
  item_name: "Consultation fee",
  quantity: 1,
  unit_price: 500,
  gst_percent: 18,
  total: 590,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("invoiceSchema", () => {
  it("parses an invoice row", () => {
    expect(invoiceSchema.parse(invoiceFixture)).toEqual(invoiceFixture);
  });
});

describe("invoiceWithItemsSchema", () => {
  it("parses an invoice with its line items (create, update, get)", () => {
    const fixture = { invoice: invoiceFixture, items: [itemFixture] };
    expect(invoiceWithItemsSchema.parse(fixture)).toEqual(fixture);
  });
});

describe("invoiceListResponseSchema", () => {
  it("parses the paginated invoice list (GET /api/invoices)", () => {
    const fixture = { items: [invoiceFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(invoiceListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});

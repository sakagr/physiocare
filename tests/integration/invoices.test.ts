import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createInvoice, updateInvoice, deleteInvoice, getInvoiceDetails } from "@/server/services/invoice.service";
import { createPayment } from "@/server/services/payment.service";
import { validClinicInput, validInvoiceInput, validPatientInput, validPaymentInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Invoice lifecycle", () => {
  const ctx = setupIntegrationContext("invoices");

  it("creates an invoice with computed totals, an immutable invoice number, and permits pre-payment edits", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-one`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-one`));
    const ownerClient = await ctx.signedInClient(owner.email);

    const { invoice, items } = await createInvoice(ownerClient, owner.id, validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }));
    expect(invoice.invoice_number).toMatch(/^INV-\d{6}$/);
    expect(invoice.subtotal).toBe(500);
    expect(invoice.gst_amount).toBe(90);
    expect(invoice.total_amount).toBe(590);
    expect(items).toHaveLength(1);

    const { invoice: updated } = await updateInvoice(ownerClient, owner.id, invoice.id, { discountAmount: 90 });
    expect(updated.total_amount).toBe(500);

    const second = await createInvoice(ownerClient, owner.id, validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }));
    const firstSequence = parseInt(invoice.invoice_number.slice(4), 10);
    const secondSequence = parseInt(second.invoice.invoice_number.slice(4), 10);
    expect(secondSequence).toBe(firstSequence + 1);
  });

  it("blocks editing once a payment exists but still allows cancellation", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-paid-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "paid-owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-paid`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-paid`));
    const ownerClient = await ctx.signedInClient(owner.email);
    const { invoice } = await createInvoice(ownerClient, owner.id, validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }));

    await createPayment(ownerClient, owner.id, validPaymentInput(invoice.id));

    await expect(updateInvoice(ownerClient, owner.id, invoice.id, { discountAmount: 10 })).rejects.toMatchObject({ code: ErrorCodes.INVOICE_ALREADY_FINALIZED });

    const cancelled = await deleteInvoice(ownerClient, owner.id, invoice.id);
    expect(cancelled.deleted_at).not.toBeNull();
    // canAccessInvoice resolves the invoice by ID to authorize, so a soft-deleted
    // (no-longer-findable) invoice surfaces as FORBIDDEN, not NOT_FOUND -- the same
    // shape as canAccessAppointment/canAccessConsultation/canAccessPrescription.
    await expect(getInvoiceDetails(ownerClient, owner.id, invoice.id)).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });
});

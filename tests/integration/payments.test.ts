import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ErrorCodes } from "@/server/errors";
import { createClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createInvoice } from "@/server/services/invoice.service";
import { createPayment, updatePaymentStatus } from "@/server/services/payment.service";
import { validClinicInput, validInvoiceInput, validPatientInput, validPaymentInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Payment lifecycle", () => {
  const ctx = setupIntegrationContext("payments");

  async function setupInvoice(suffix: string, ownerId: string, ownerClient: SupabaseClient<Database>) {
    const clinic = await createClinic(ctx.admin, ownerId, validClinicInput(`${ctx.runId}-${suffix}`));
    const patient = await createPatient(ctx.admin, ownerId, validPatientInput(`${ctx.runId}-${suffix}`));
    const { invoice } = await createInvoice(ownerClient, ownerId, validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }));
    return invoice;
  }

  it("records a single payment per invoice and rejects a second attempt", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "owner");
    const ownerClient = await ctx.signedInClient(owner.email);
    const invoice = await setupInvoice("one", owner.id, ownerClient);

    const payment = await createPayment(ownerClient, owner.id, validPaymentInput(invoice.id));
    expect(payment).toMatchObject({ invoice_id: invoice.id, amount: 590, payment_status: "completed" });

    await expect(createPayment(ownerClient, owner.id, validPaymentInput(invoice.id))).rejects.toMatchObject({ code: ErrorCodes.PAYMENT_ALREADY_EXISTS_FOR_INVOICE });
  });

  it("rejects a payment amount exceeding the invoice total", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-over-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "over-owner");
    const ownerClient = await ctx.signedInClient(owner.email);
    const invoice = await setupInvoice("over", owner.id, ownerClient);

    await expect(createPayment(ownerClient, owner.id, { ...validPaymentInput(invoice.id), amount: 999999 })).rejects.toMatchObject({ code: ErrorCodes.PAYMENT_EXCEEDS_INVOICE_TOTAL });
  });

  it("allows completed -> refunded but rejects reversing a refund", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-refund-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "refund-owner");
    const ownerClient = await ctx.signedInClient(owner.email);
    const invoice = await setupInvoice("refund", owner.id, ownerClient);
    const payment = await createPayment(ownerClient, owner.id, validPaymentInput(invoice.id));

    const refunded = await updatePaymentStatus(ownerClient, owner.id, payment.id, "refunded");
    expect(refunded.payment_status).toBe("refunded");

    await expect(updatePaymentStatus(ownerClient, owner.id, payment.id, "completed")).rejects.toMatchObject({ code: ErrorCodes.INVALID_PAYMENT_STATUS_TRANSITION });
  });
});

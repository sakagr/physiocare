import { expect, it } from "vitest";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createInvoice, updateInvoice, deleteInvoice } from "@/server/services/invoice.service";
import { listOrganizationAuditLogs } from "@/server/services/audit-log.service";
import { createPayment, updatePaymentStatus, listPaymentsForInvoice } from "@/server/services/payment.service";
import { createAppointment } from "@/server/services/appointment.service";
import { ErrorCodes } from "@/server/errors";
import { findInvoiceById } from "@/server/repositories/invoice.repository";
import { listInvoiceItemsByInvoice } from "@/server/repositories/invoice-item.repository";
import {
  validAppointmentInput,
  validClinicInput,
  validInvoiceInput,
  validPatientInput,
  validPaymentInput,
} from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

/**
 * Every assertion here drives a real signed-in session client, so RLS applies
 * exactly as it does in production. ctx.admin is used only to build fixtures
 * and to read state back out of band.
 */
describeIntegration("Billing writes through real sessions", () => {
  const ctx = setupIntegrationContext("billing-rls");

  async function setupBillingOrg(suffix: string) {
    const organization = await ctx.createOrganization(`${ctx.runId}-${suffix}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", `${suffix}-owner`);
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-${suffix}`));
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", `${suffix}-recep`);
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", `${suffix}-physio`);
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-${suffix}`));

    return { organization, owner, clinic, receptionist, physio, patient };
  }

  it("lets a receptionist create an invoice through their own session", async () => {
    const org = await setupBillingOrg("recep-invoice");
    const receptionClient = await ctx.signedInClient(org.receptionist.email);

    const { invoice, items } = await createInvoice(
      receptionClient,
      org.receptionist.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id })
    );

    expect(invoice.invoice_number).toMatch(/^INV-\d{6}$/);
    expect(invoice.total_amount).toBe(590);
    expect(items).toHaveLength(1);
  });

  it("lets a receptionist record a payment through their own session", async () => {
    const org = await setupBillingOrg("recep-payment");
    const receptionClient = await ctx.signedInClient(org.receptionist.email);

    const { invoice } = await createInvoice(
      receptionClient,
      org.receptionist.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id })
    );

    const payment = await createPayment(receptionClient, org.receptionist.id, validPaymentInput(invoice.id));

    expect(payment).toMatchObject({ invoice_id: invoice.id, amount: 590, payment_status: "completed" });
  });

  it("lets an owner refund a payment a receptionist recorded, each through their own session", async () => {
    const org = await setupBillingOrg("recep-refund");
    const receptionClient = await ctx.signedInClient(org.receptionist.email);
    const ownerClient = await ctx.signedInClient(org.owner.email);

    const { invoice } = await createInvoice(
      receptionClient,
      org.receptionist.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id })
    );
    const payment = await createPayment(receptionClient, org.receptionist.id, validPaymentInput(invoice.id));

    const refunded = await updatePaymentStatus(ownerClient, org.owner.id, payment.id, "refunded");

    expect(refunded.payment_status).toBe("refunded");
  });

  it("replaces an invoice's line items on edit rather than appending to them", async () => {
    const org = await setupBillingOrg("replace-items");
    const ownerClient = await ctx.signedInClient(org.owner.email);

    const { invoice } = await createInvoice(
      ownerClient,
      org.owner.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id })
    );

    const { invoice: updated, items } = await updateInvoice(ownerClient, org.owner.id, invoice.id, {
      items: [{ itemName: "Replaced", quantity: 2, unitPrice: 100, gstPercent: 0 }],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ item_name: "Replaced", quantity: 2, total: 200 });
    expect(updated.total_amount).toBe(items.reduce((sum, item) => sum + item.total, 0));
  });

  it("replaces line items on a receptionist's own session too", async () => {
    const org = await setupBillingOrg("recep-replace");
    const receptionClient = await ctx.signedInClient(org.receptionist.email);

    const { invoice } = await createInvoice(
      receptionClient,
      org.receptionist.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id })
    );

    const { invoice: updated, items } = await updateInvoice(receptionClient, org.receptionist.id, invoice.id, {
      items: [{ itemName: "Replaced", quantity: 2, unitPrice: 100, gstPercent: 0 }],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ item_name: "Replaced", total: 200 });
    expect(updated.total_amount).toBe(200);
  });

  it("keeps items and header consistent across repeated edits", async () => {
    const org = await setupBillingOrg("repeat-replace");
    const ownerClient = await ctx.signedInClient(org.owner.email);

    const { invoice } = await createInvoice(
      ownerClient,
      org.owner.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id })
    );

    for (const unitPrice of [100, 250, 375]) {
      const { invoice: updated, items } = await updateInvoice(ownerClient, org.owner.id, invoice.id, {
        items: [{ itemName: `Edit ${unitPrice}`, quantity: 1, unitPrice, gstPercent: 0 }],
      });

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ item_name: `Edit ${unitPrice}`, total: unitPrice });
      expect(updated.total_amount).toBe(items.reduce((sum, item) => sum + item.total, 0));
    }
  });

  it("leaves the original items and header untouched when replace_invoice_items fails part-way", async () => {
    const org = await setupBillingOrg("replace-atomic");
    const ownerClient = await ctx.signedInClient(org.owner.email);

    const { invoice } = await createInvoice(
      ownerClient,
      org.owner.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id })
    );

    // quantity 0 violates invoice_items' own check constraint, so the insert
    // half raises after the soft-delete half has already run.
    const { error } = await ownerClient.rpc("replace_invoice_items", {
      p_organization_id: org.organization.id,
      p_invoice_id: invoice.id,
      p_items: [{ item_name: "Broken", quantity: 0, unit_price: 100, gst_percent: 0, total: 0 }],
      p_subtotal: 0,
      p_gst_amount: 0,
      p_discount_amount: 0,
      p_total_amount: 0,
    });
    expect(error).not.toBeNull();

    const liveItems = await listInvoiceItemsByInvoice(ownerClient, invoice.id);
    expect(liveItems.map((item) => item.item_name)).toEqual(["Consultation Fee"]);

    const unchanged = await findInvoiceById(ownerClient, invoice.id);
    expect(unchanged?.total_amount).toBe(590);
  });

  it("leaves no invoice row behind when the item write fails during creation", async () => {
    const org = await setupBillingOrg("create-orphan");
    const ownerClient = await ctx.signedInClient(org.owner.email);

    // quantity 0 violates invoice_items' check constraint, failing the item
    // write after the header has been written.
    await expect(
      createInvoice(ownerClient, org.owner.id, {
        ...validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id }),
        items: [{ itemName: "Broken", quantity: 0, unitPrice: 100, gstPercent: 0 }],
      })
    ).rejects.toBeDefined();

    const { data: rows } = await ctx.admin
      .from("invoices")
      .select("id, invoice_number, deleted_at")
      .eq("organization_id", org.organization.id);
    expect(rows).toEqual([]);
  });

  it("issues distinct sequential invoice numbers across creates in one organization", async () => {
    const org = await setupBillingOrg("sequential");
    const ownerClient = await ctx.signedInClient(org.owner.email);

    const first = await createInvoice(
      ownerClient,
      org.owner.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id })
    );
    const second = await createInvoice(
      ownerClient,
      org.owner.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id })
    );

    const firstSequence = parseInt(first.invoice.invoice_number.slice(4), 10);
    const secondSequence = parseInt(second.invoice.invoice_number.slice(4), 10);
    expect(secondSequence).toBe(firstSequence + 1);
  });

  it("surfaces a unique violation raised inside create_invoice_with_items as 23505", async () => {
    const org = await setupBillingOrg("create-collision");
    const ownerClient = await ctx.signedInClient(org.owner.email);

    const args = {
      p_organization_id: org.organization.id,
      p_invoice_number: "INV-000001",
      p_patient_id: org.patient.id,
      p_clinic_id: org.clinic.id,
      p_subtotal: 100,
      p_gst_amount: 0,
      p_discount_amount: 0,
      p_total_amount: 100,
      p_items: [{ item_name: "Item", quantity: 1, unit_price: 100, gst_percent: 0, total: 100 }],
      p_created_by: org.owner.id,
    };

    const first = await ownerClient.rpc("create_invoice_with_items", args).single();
    expect(first.error).toBeNull();

    // The invoice-number retry loop matches on this code; if it stops arriving,
    // a collision becomes a hard failure instead of a retry.
    const second = await ownerClient.rpc("create_invoice_with_items", args).single();
    expect(second.error?.code).toBe("23505");
  });

  it("audits an invoice edit as update and a void as cancel", async () => {
    const org = await setupBillingOrg("audit-invoice");
    const ownerClient = await ctx.signedInClient(org.owner.email);

    const { invoice } = await createInvoice(
      ownerClient,
      org.owner.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id })
    );
    await updateInvoice(ownerClient, org.owner.id, invoice.id, { discountAmount: 90 });
    await deleteInvoice(ownerClient, org.owner.id, invoice.id);

    const logs = await listOrganizationAuditLogs(ownerClient, org.owner.id, { page: 1, limit: 50 });
    const entries = logs.items.filter((entry) => entry.entity_name === "invoices" && entry.entity_id === invoice.id);

    const edits = entries.filter((entry) => entry.action === "update");
    expect(edits).toHaveLength(1);
    expect(edits[0].old_data).not.toBeNull();
    expect(edits[0].new_data).not.toBeNull();

    const voids = entries.filter((entry) => entry.action === "cancel");
    expect(voids).toHaveLength(1);
    expect(voids[0].old_data).not.toBeNull();
  });

  it("audits payment transitions with the target status as the verb", async () => {
    const org = await setupBillingOrg("audit-payment");
    const ownerClient = await ctx.signedInClient(org.owner.email);

    const refundedPayment = await createPayment(
      ownerClient,
      org.owner.id,
      validPaymentInput(
        (await createInvoice(ownerClient, org.owner.id, validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id }))).invoice.id
      )
    );
    await updatePaymentStatus(ownerClient, org.owner.id, refundedPayment.id, "refunded");

    const cancelledPayment = await createPayment(
      ownerClient,
      org.owner.id,
      validPaymentInput(
        (await createInvoice(ownerClient, org.owner.id, validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id }))).invoice.id
      )
    );
    await updatePaymentStatus(ownerClient, org.owner.id, cancelledPayment.id, "cancelled");

    const logs = await listOrganizationAuditLogs(ownerClient, org.owner.id, { page: 1, limit: 50 });
    const actionsFor = (paymentId: string) =>
      logs.items
        .filter((entry) => entry.entity_name === "payments" && entry.entity_id === paymentId)
        .map((entry) => entry.action)
        .sort();

    expect(actionsFor(refundedPayment.id)).toEqual(["create", "refund"]);
    expect(actionsFor(cancelledPayment.id)).toEqual(["cancel", "create"]);
  });

  it("refuses an invoice's payments to a receptionist assigned elsewhere", async () => {
    const org = await setupBillingOrg("payments-scope");
    const otherClinic = await createClinic(ctx.admin, org.owner.id, validClinicInput(`${ctx.runId}-payments-other`));
    const ownerClient = await ctx.signedInClient(org.owner.email);

    const { invoice } = await createInvoice(
      ownerClient,
      org.owner.id,
      validInvoiceInput({ patientId: org.patient.id, clinicId: otherClinic.id })
    );
    await createPayment(ownerClient, org.owner.id, validPaymentInput(invoice.id));

    const receptionClient = await ctx.signedInClient(org.receptionist.email);

    await expect(listPaymentsForInvoice(receptionClient, org.receptionist.id, invoice.id)).rejects.toMatchObject({
      code: ErrorCodes.FORBIDDEN,
    });
  });

  it("serves an invoice's payments to the owner, its clinic's receptionist, and its appointment's physiotherapist", async () => {
    const org = await setupBillingOrg("payments-access");
    const ownerClient = await ctx.signedInClient(org.owner.email);
    const appointment = await createAppointment(
      ctx.admin,
      org.owner.id,
      validAppointmentInput({ patientId: org.patient.id, clinicId: org.clinic.id, physiotherapistId: org.physio.id })
    );

    const { invoice } = await createInvoice(ownerClient, org.owner.id, {
      ...validInvoiceInput({ patientId: org.patient.id, clinicId: org.clinic.id }),
      appointmentId: appointment.id,
    });
    const payment = await createPayment(ownerClient, org.owner.id, validPaymentInput(invoice.id));

    const receptionClient = await ctx.signedInClient(org.receptionist.email);
    const physioClient = await ctx.signedInClient(org.physio.email);

    for (const [client, callerId] of [
      [ownerClient, org.owner.id],
      [receptionClient, org.receptionist.id],
      [physioClient, org.physio.id],
    ] as const) {
      const payments = await listPaymentsForInvoice(client, callerId, invoice.id);
      expect(payments.map((row) => row.id)).toEqual([payment.id]);
    }
  });
});

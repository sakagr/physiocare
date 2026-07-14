import { expect, it } from "vitest";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createInvoice } from "@/server/services/invoice.service";
import { createPayment, updatePaymentStatus } from "@/server/services/payment.service";
import { getBillingReport } from "@/server/services/billing-report.service";
import { validClinicInput, validInvoiceInput, validPatientInput, validPaymentInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Billing report", () => {
  const ctx = setupIntegrationContext("billing-report");

  it("aggregates invoiced, collected, refunded, and outstanding totals from existing invoice/payment domain data", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-one`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-one`));

    // Paid invoice: fully collected.
    const paid = await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      invoiceDate: "2026-02-10",
    });
    await createPayment(ctx.admin, owner.id, { ...validPaymentInput(paid.invoice.id), paidAt: "2026-02-11T10:00:00.000Z" });

    // Refunded invoice: was paid, then refunded.
    const refunded = await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      invoiceDate: "2026-02-12",
    });
    const refundedPayment = await createPayment(ctx.admin, owner.id, {
      ...validPaymentInput(refunded.invoice.id),
      paidAt: "2026-02-13T10:00:00.000Z",
    });
    await updatePaymentStatus(ctx.admin, owner.id, refundedPayment.id, "refunded");

    // Unpaid invoice: outstanding.
    const unpaid = await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      invoiceDate: "2026-02-14",
    });

    // Out-of-range invoice: must not affect the totals below.
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      invoiceDate: "2026-03-15",
    });

    const report = await getBillingReport(ctx.admin, owner.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" });

    expect(report.summary.invoiceCount).toBe(3);
    expect(report.summary.totalInvoiced).toBe(590 * 3);
    expect(report.summary.totalOutstanding).toBe(590); // only the unpaid invoice
    expect(report.summary.paymentTotalsByStatus.completed).toBe(590); // only the still-completed payment
    expect(report.summary.paymentTotalsByStatus.refunded).toBe(590);
    expect(report.summary.paymentTotalsByStatus.cancelled).toBe(0);
    expect(report.summary.paymentCountByMode.cash).toBe(2);

    expect(report.rows).toHaveLength(3);
    const rowByInvoiceId = new Map(report.rows.map((r) => [r.invoice.id, r]));
    expect(rowByInvoiceId.get(paid.invoice.id)?.paymentStatus).toBe("completed");
    expect(rowByInvoiceId.get(refunded.invoice.id)?.paymentStatus).toBe("refunded");
    expect(rowByInvoiceId.get(unpaid.invoice.id)?.paymentStatus).toBeNull();

    expect(report.summary.clinicBreakdown).toHaveLength(1);
    expect(report.summary.clinicBreakdown[0]).toMatchObject({ clinicId: clinic.id, invoiceCount: 3, totalInvoiced: 590 * 3 });
  });

  it("scopes a receptionist to their assigned clinic and excludes other clinics", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-scope-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "scope-owner");
    const clinicOne = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-scope-one`));
    const clinicTwo = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-scope-two`));
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "scope-recep");
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinicOne.id);

    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-scope`));
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinicOne.id }),
      invoiceDate: "2026-02-10",
    });
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinicTwo.id }),
      invoiceDate: "2026-02-10",
    });

    const report = await getBillingReport(ctx.admin, receptionist.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" });
    expect(report.summary.invoiceCount).toBe(1);
    expect(report.summary.clinicBreakdown).toEqual([expect.objectContaining({ clinicId: clinicOne.id })]);

    const deniedClinicReport = await getBillingReport(ctx.admin, receptionist.id, {
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
      clinicId: clinicTwo.id,
    });
    expect(deniedClinicReport.summary.invoiceCount).toBe(0);
  });

  it("returns an empty report for a physiotherapist, matching the existing invoice-listing precedent", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-physio-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "physio-owner");
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "physio-report");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-physio`));
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-physio`));
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      invoiceDate: "2026-02-10",
    });

    const report = await getBillingReport(ctx.admin, physio.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" });
    expect(report.summary.invoiceCount).toBe(0);
    expect(report.rows).toEqual([]);
  });
});

import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import { createConsultation } from "@/server/services/consultation.service";
import { createInvoice } from "@/server/services/invoice.service";
import { getPhysiotherapistReport } from "@/server/services/physiotherapist-report.service";
import { validClinicInput, validPatientInput, validAppointmentInput, validConsultationInput, validInvoiceInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Physiotherapist report", () => {
  const ctx = setupIntegrationContext("physio-report");

  // Kept short: setupIntegrationContext builds usernames as `${runId}-${suffix}`
  // truncated to 50 chars, and runId alone is already ~32 chars -- longer
  // suffixes silently collide once truncated.
  async function setupScenario(suffix: string) {
    const organization = await ctx.createOrganization(`${ctx.runId}-${suffix}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", `${suffix}-o`);
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-${suffix}`));
    const physioA = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", `${suffix}-pa`);
    const physioB = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", `${suffix}-pb`);
    await assignUserToClinic(ctx.admin, owner.id, physioA.id, clinic.id);
    await assignUserToClinic(ctx.admin, owner.id, physioB.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-${suffix}`));
    return { organization, owner, clinic, physioA, physioB, patient };
  }

  it("attributes revenue only through appointment_id -> physiotherapist_id and excludes unlinked invoices", async () => {
    const { owner, clinic, physioA, physioB, patient } = await setupScenario("attr");

    const appointmentA = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physioA.id }),
      appointmentTime: "2026-02-10T09:00:00.000Z",
    });
    await createConsultation(ctx.admin, physioA.id, validConsultationInput(appointmentA.id));
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      appointmentId: appointmentA.id,
      invoiceDate: "2026-02-10",
    });

    const appointmentB = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physioB.id }),
      appointmentTime: "2026-02-15T09:00:00.000Z",
    });

    // Invoice with no appointment_id -- must never be attributed to anyone.
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      invoiceDate: "2026-02-16",
    });

    // Out-of-range appointment -- must not affect the totals below.
    await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physioA.id }),
      appointmentTime: "2026-03-20T09:00:00.000Z",
    });

    const reportA = await getPhysiotherapistReport(ctx.admin, owner.id, {
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
      physiotherapistId: physioA.id,
    });
    expect(reportA.summary.appointmentCount).toBe(1);
    expect(reportA.summary.consultationsCompleted).toBe(1);
    expect(reportA.summary.attributedRevenue).toBe(590);
    expect(reportA.rows).toHaveLength(1);
    expect(reportA.rows[0]).toMatchObject({ hasConsultation: true, attributedRevenue: 590 });

    const reportB = await getPhysiotherapistReport(ctx.admin, owner.id, {
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
      physiotherapistId: physioB.id,
    });
    expect(reportB.summary.appointmentCount).toBe(1);
    expect(reportB.summary.consultationsCompleted).toBe(0);
    expect(reportB.summary.attributedRevenue).toBe(0);

    const orgWide = await getPhysiotherapistReport(ctx.admin, owner.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" });
    expect(orgWide.summary.appointmentCount).toBe(2);
    expect(orgWide.summary.attributedRevenue).toBe(590); // the unlinked invoice never counts here either
    expect(orgWide.summary.physiotherapistBreakdown).toHaveLength(2);
  });

  it("lets a physiotherapist fetch only their own report and forbids requesting another's", async () => {
    const { owner, clinic, physioA, physioB, patient } = await setupScenario("self");
    const appointmentA = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physioA.id }),
      appointmentTime: "2026-02-10T09:00:00.000Z",
    });

    const ownReport = await getPhysiotherapistReport(ctx.admin, physioA.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" });
    expect(ownReport.summary.appointmentCount).toBe(1);
    expect(ownReport.rows[0].appointment.id).toBe(appointmentA.id);

    await expect(
      getPhysiotherapistReport(ctx.admin, physioA.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28", physiotherapistId: physioB.id })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  it("forbids a receptionist from accessing the physiotherapist report", async () => {
    const { organization, patient: _patient } = await setupScenario("recp");
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "recp-r");

    await expect(
      getPhysiotherapistReport(ctx.admin, receptionist.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });
});

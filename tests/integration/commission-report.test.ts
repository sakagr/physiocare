import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import { transitionAppointmentStatus } from "@/server/services/appointment-workflow.service";
import { createInvoice } from "@/server/services/invoice.service";
import { setUserCompensation, getCommissionReport } from "@/server/services/commission.service";
import { validClinicInput, validPatientInput, validAppointmentInput, validInvoiceInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Commission report", () => {
  const ctx = setupIntegrationContext("comm-report");

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

  async function completeAppointment(ownerId: string, appointmentId: string) {
    await transitionAppointmentStatus(ctx.admin, ownerId, appointmentId, { status: "confirmed" });
    await transitionAppointmentStatus(ctx.admin, ownerId, appointmentId, { status: "checked_in" });
    return transitionAppointmentStatus(ctx.admin, ownerId, appointmentId, { status: "completed" });
  }

  it("aggregates commission per physiotherapist and org-wide, only counting completed appointments", async () => {
    const { owner, clinic, physioA, physioB, patient } = await setupScenario("agg");
    await setUserCompensation(ctx.admin, owner.id, physioA.id, { type: "percentage", value: 10, effectiveFrom: "2026-01-01" });
    await setUserCompensation(ctx.admin, owner.id, physioB.id, { type: "fixed", value: 25, effectiveFrom: "2026-01-01" });

    const appointmentA = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physioA.id }),
      appointmentTime: "2026-02-10T09:00:00.000Z",
    });
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      appointmentId: appointmentA.id,
      invoiceDate: "2026-02-10",
    });
    await completeAppointment(owner.id, appointmentA.id);

    const appointmentB = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physioB.id }),
      appointmentTime: "2026-02-15T09:00:00.000Z",
    });
    await completeAppointment(owner.id, appointmentB.id);

    // Never transitioned past scheduled -- must not count toward either report.
    await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physioA.id }),
      appointmentTime: "2026-02-20T09:00:00.000Z",
    });

    const reportA = await getCommissionReport(ctx.admin, owner.id, {
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
      physiotherapistId: physioA.id,
    });
    expect(reportA.summary.totalCompletedAppointments).toBe(1);
    expect(reportA.summary.totalCommission).toBeCloseTo(59, 5); // 590 * 10%
    expect(reportA.summary.physiotherapistBreakdown).toHaveLength(1);

    const orgWide = await getCommissionReport(ctx.admin, owner.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" });
    expect(orgWide.summary.totalCompletedAppointments).toBe(2);
    expect(orgWide.summary.totalCommission).toBeCloseTo(59 + 25, 5);
    expect(orgWide.summary.physiotherapistBreakdown).toHaveLength(2);
  });

  it("lets a physiotherapist fetch only their own report and forbids requesting another's", async () => {
    const { owner, clinic, physioA, physioB, patient } = await setupScenario("self");
    await setUserCompensation(ctx.admin, owner.id, physioA.id, { type: "fixed", value: 25, effectiveFrom: "2026-01-01" });
    const appointmentA = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physioA.id }),
      appointmentTime: "2026-02-10T09:00:00.000Z",
    });
    await completeAppointment(owner.id, appointmentA.id);

    const ownReport = await getCommissionReport(ctx.admin, physioA.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" });
    expect(ownReport.summary.totalCompletedAppointments).toBe(1);
    expect(ownReport.summary.totalCommission).toBe(25);

    await expect(
      getCommissionReport(ctx.admin, physioA.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28", physiotherapistId: physioB.id })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  it("forbids a receptionist from accessing the commission report", async () => {
    const { organization } = await setupScenario("recp");
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "recp-r");

    await expect(
      getCommissionReport(ctx.admin, receptionist.id, { dateFrom: "2026-02-01", dateTo: "2026-02-28" })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });
});

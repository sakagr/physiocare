import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import { transitionAppointmentStatus } from "@/server/services/appointment-workflow.service";
import { createPackage } from "@/server/services/package.service";
import { createPatientPackage } from "@/server/services/patient-package.service";
import { createInvoice } from "@/server/services/invoice.service";
import { setUserCompensation, calculateCommission } from "@/server/services/commission.service";
import {
  validAppointmentInput,
  validClinicInput,
  validPatientInput,
  validPackageInput,
  validPatientPackageInput,
  validInvoiceInput,
} from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

const FAR_PAST = "2000-01-01";
const FAR_FUTURE = "2030-12-31";

describeIntegration("Commission calculations", () => {
  const ctx = setupIntegrationContext("commission");

  async function setup(suffix: string) {
    const organization = await ctx.createOrganization(`${ctx.runId}-${suffix}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", `${suffix}-owner`);
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-${suffix}`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", `${suffix}-physio`);
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-${suffix}`));
    return { organization, owner, clinic, physio, patient };
  }

  async function completeAppointment(ownerId: string, appointmentId: string, patientPackageId?: string) {
    await transitionAppointmentStatus(ctx.admin, ownerId, appointmentId, { status: "confirmed" });
    await transitionAppointmentStatus(ctx.admin, ownerId, appointmentId, { status: "checked_in" });
    return transitionAppointmentStatus(ctx.admin, ownerId, appointmentId, { status: "completed", patientPackageId });
  }

  it("sets a compensation record, enforces uniqueness per effective_from, and rejects non-admins", async () => {
    const { organization, owner, physio } = await setup("set");
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "set-reception");

    await expect(
      setUserCompensation(ctx.admin, receptionist.id, physio.id, { type: "percentage", value: 10 })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });

    const compensation = await setUserCompensation(ctx.admin, owner.id, physio.id, {
      type: "percentage",
      value: 10,
      effectiveFrom: "2026-01-01",
    });
    expect(compensation).toMatchObject({ type: "percentage", value: 10, effective_from: "2026-01-01" });

    await expect(
      setUserCompensation(ctx.admin, owner.id, physio.id, { type: "fixed", value: 100, effectiveFrom: "2026-01-01" })
    ).rejects.toThrow();
  });

  it("calculates percentage commission from the attributed invoice on a normal appointment", async () => {
    const { owner, clinic, physio, patient } = await setup("normal");
    await setUserCompensation(ctx.admin, owner.id, physio.id, { type: "percentage", value: 10, effectiveFrom: FAR_PAST });

    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      appointmentId: appointment.id,
    });
    await completeAppointment(owner.id, appointment.id);

    const result = await calculateCommission(ctx.admin, physio.organization_id!, physio.id, FAR_PAST, FAR_FUTURE);
    expect(result.completedAppointmentCount).toBe(1);
    expect(result.totalCommission).toBeCloseTo(59, 5); // 590 (500 + 18% gst) * 10%
  });

  it("calculates percentage commission from package_price / total_sessions on a package-linked appointment, ignoring any invoice for that appointment", async () => {
    const { owner, clinic, physio, patient } = await setup("pkg");
    await setUserCompensation(ctx.admin, owner.id, physio.id, { type: "percentage", value: 10, effectiveFrom: FAR_PAST });

    const pkg = await createPackage(ctx.admin, owner.id, {
      ...validPackageInput(`${ctx.runId}-pkg`),
      totalSessions: 10,
      packagePrice: 5000,
    });
    const patientPackage = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));

    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    // An unrelated invoice against the same appointment must be ignored -- package
    // linkage always wins for the commissionable amount.
    await createInvoice(ctx.admin, owner.id, {
      ...validInvoiceInput({ patientId: patient.id, clinicId: clinic.id }),
      appointmentId: appointment.id,
    });
    await completeAppointment(owner.id, appointment.id, patientPackage.id);

    const result = await calculateCommission(ctx.admin, physio.organization_id!, physio.id, FAR_PAST, FAR_FUTURE);
    expect(result.totalCommission).toBeCloseTo((5000 / 10) * 0.1, 5); // 50
  });

  it("calculates fixed commission per completed appointment regardless of invoice presence", async () => {
    const { owner, clinic, physio, patient } = await setup("fixed");
    await setUserCompensation(ctx.admin, owner.id, physio.id, { type: "fixed", value: 25, effectiveFrom: FAR_PAST });

    const appointmentOne = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeAppointment(owner.id, appointmentOne.id);
    const appointmentTwo = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeAppointment(owner.id, appointmentTwo.id);

    const result = await calculateCommission(ctx.admin, physio.organization_id!, physio.id, FAR_PAST, FAR_FUTURE);
    expect(result.completedAppointmentCount).toBe(2);
    expect(result.totalCommission).toBe(50);
  });

  it("applies a mid-range compensation rate change per appointment rather than one blended rate", async () => {
    const { owner, clinic, physio, patient } = await setup("rate-change");
    await setUserCompensation(ctx.admin, owner.id, physio.id, { type: "fixed", value: 10, effectiveFrom: "2020-01-01" });
    await setUserCompensation(ctx.admin, owner.id, physio.id, { type: "fixed", value: 20, effectiveFrom: "2024-06-01" });

    const earlyAppointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    const { error: earlyError } = await ctx.admin
      .from("appointments")
      .update({ appointment_time: "2022-01-01T10:00:00Z" })
      .eq("id", earlyAppointment.id);
    if (earlyError) throw earlyError;
    await completeAppointment(owner.id, earlyAppointment.id);

    const lateAppointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    const { error: lateError } = await ctx.admin
      .from("appointments")
      .update({ appointment_time: "2025-01-01T10:00:00Z" })
      .eq("id", lateAppointment.id);
    if (lateError) throw lateError;
    await completeAppointment(owner.id, lateAppointment.id);

    const result = await calculateCommission(ctx.admin, physio.organization_id!, physio.id, "2020-01-01", "2026-01-01");
    expect(result.totalCommission).toBe(30); // 10 (pre-change rate) + 20 (post-change rate)
  });

  it("excludes non-completed appointments and returns 0 commission when no compensation record exists", async () => {
    const { owner, clinic, physio, patient } = await setup("none");
    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "confirmed" });

    const result = await calculateCommission(ctx.admin, physio.organization_id!, physio.id, FAR_PAST, FAR_FUTURE);
    expect(result.completedAppointmentCount).toBe(0);
    expect(result.totalCommission).toBe(0);
  });
});

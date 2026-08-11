import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment } from "@/server/services/appointment.service";
import { transitionAppointmentStatus } from "@/server/services/appointment-workflow.service";
import { createPackage } from "@/server/services/package.service";
import {
  createPatientPackage,
  updatePatientPackage,
  getPatientPackageDetails,
  consumePackageSession,
  correctPackageSessionUsage,
} from "@/server/services/patient-package.service";
import {
  validAppointmentInput,
  validClinicInput,
  validPatientInput,
  validPackageInput,
  validPatientPackageInput,
} from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Appointment completion / package session consumption workflow", () => {
  const ctx = setupIntegrationContext("appt-wf");

  async function setup(suffix: string) {
    const organization = await ctx.createOrganization(`${ctx.runId}-${suffix}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", `${suffix}-owner`);
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-${suffix}`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", `${suffix}-physio`);
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-${suffix}`));
    return { organization, owner, clinic, physio, patient };
  }

  async function completeCheckIn(ownerId: string, appointmentId: string) {
    await transitionAppointmentStatus(ctx.admin, ownerId, appointmentId, { status: "confirmed" });
    await transitionAppointmentStatus(ctx.admin, ownerId, appointmentId, { status: "checked_in" });
  }

  it("consumes a package session on completion and reverses it if the appointment is later cancelled", async () => {
    const { owner, clinic, physio, patient } = await setup("consume");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-consume`));
    const patientPackage = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));
    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeCheckIn(owner.id, appointment.id);

    const completed = await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, {
      status: "completed",
      patientPackageId: patientPackage.id,
    });
    expect(completed.status).toBe("completed");

    const afterConsume = await getPatientPackageDetails(ctx.admin, owner.id, patientPackage.id);
    expect(afterConsume.used_sessions).toBe(1);
    expect(afterConsume.remaining_sessions).toBe(patientPackage.total_sessions - 1);

    const { data: usageRows, error } = await ctx.admin
      .from("package_session_usage")
      .select("*")
      .eq("appointment_id", appointment.id)
      .is("deleted_at", null);
    if (error) throw error;
    expect(usageRows).toHaveLength(1);
    expect(usageRows![0].patient_package_id).toBe(patientPackage.id);

    const cancelled = await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "cancelled" });
    expect(cancelled.status).toBe("cancelled");

    const afterReversal = await getPatientPackageDetails(ctx.admin, owner.id, patientPackage.id);
    expect(afterReversal.used_sessions).toBe(0);
    expect(afterReversal.remaining_sessions).toBe(patientPackage.total_sessions);

    const { data: usageAfterReversal, error: reversalError } = await ctx.admin
      .from("package_session_usage")
      .select("*")
      .eq("appointment_id", appointment.id)
      .is("deleted_at", null);
    if (reversalError) throw reversalError;
    expect(usageAfterReversal).toHaveLength(0);
  });

  it("auto-completes a package once its last session is consumed, and reversal reactivates it", async () => {
    const { owner, clinic, physio, patient } = await setup("exhaust");
    const pkg = await createPackage(ctx.admin, owner.id, { ...validPackageInput(`${ctx.runId}-exhaust`), totalSessions: 1 });
    const patientPackage = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));
    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeCheckIn(owner.id, appointment.id);
    await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "completed", patientPackageId: patientPackage.id });

    const exhausted = await getPatientPackageDetails(ctx.admin, owner.id, patientPackage.id);
    expect(exhausted.status).toBe("completed");
    expect(exhausted.remaining_sessions).toBe(0);

    await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "cancelled" });

    const reactivated = await getPatientPackageDetails(ctx.admin, owner.id, patientPackage.id);
    expect(reactivated.status).toBe("active");
    expect(reactivated.remaining_sessions).toBe(1);
  });

  it("rejects consuming an exhausted package and leaves the appointment status untouched", async () => {
    const { owner, clinic, physio, patient } = await setup("blocked");
    const pkg = await createPackage(ctx.admin, owner.id, { ...validPackageInput(`${ctx.runId}-blocked`), totalSessions: 1 });
    const patientPackage = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));

    const firstAppointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeCheckIn(owner.id, firstAppointment.id);
    await transitionAppointmentStatus(ctx.admin, owner.id, firstAppointment.id, { status: "completed", patientPackageId: patientPackage.id });

    const secondAppointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeCheckIn(owner.id, secondAppointment.id);

    await expect(
      transitionAppointmentStatus(ctx.admin, owner.id, secondAppointment.id, { status: "completed", patientPackageId: patientPackage.id })
    ).rejects.toMatchObject({ code: ErrorCodes.PACKAGE_SESSIONS_EXHAUSTED });

    const { data: stillCheckedIn, error } = await ctx.admin.from("appointments").select("status").eq("id", secondAppointment.id).single();
    if (error) throw error;
    expect(stillCheckedIn!.status).toBe("checked_in");
  });

  it("rejects a duplicate session recording for the same appointment", async () => {
    const { owner, clinic, physio, patient } = await setup("dup");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-dup`));
    const patientPackage = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));
    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeCheckIn(owner.id, appointment.id);
    await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "completed", patientPackageId: patientPackage.id });

    await expect(
      consumePackageSession(ctx.admin, patientPackage.organization_id, patientPackage.id, appointment.id)
    ).rejects.toMatchObject({ code: ErrorCodes.PACKAGE_SESSION_ALREADY_RECORDED });
  });

  it("rejects consuming from an expired package and persists the expired status", async () => {
    const { owner, clinic, physio, patient } = await setup("expired");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-expired`));
    const patientPackage = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));

    const { error } = await ctx.admin
      .from("patient_packages")
      .update({ purchased_on: "2000-01-01", expiry_date: "2000-01-31" })
      .eq("id", patientPackage.id);
    if (error) throw error;

    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeCheckIn(owner.id, appointment.id);

    await expect(
      transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "completed", patientPackageId: patientPackage.id })
    ).rejects.toMatchObject({ code: ErrorCodes.PACKAGE_EXPIRED });

    const expired = await getPatientPackageDetails(ctx.admin, owner.id, patientPackage.id);
    expect(expired.status).toBe("expired");
  });

  it("rejects consuming a cancelled package and leaves the appointment status untouched", async () => {
    const { owner, clinic, physio, patient } = await setup("cancelled");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-cancelled`));
    const patientPackage = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));
    await updatePatientPackage(ctx.admin, owner.id, patientPackage.id, { status: "cancelled" });

    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeCheckIn(owner.id, appointment.id);

    await expect(
      transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "completed", patientPackageId: patientPackage.id })
    ).rejects.toMatchObject({ code: ErrorCodes.PACKAGE_CANCELLED });

    const { data: stillCheckedIn, error } = await ctx.admin.from("appointments").select("status").eq("id", appointment.id).single();
    if (error) throw error;
    expect(stillCheckedIn!.status).toBe("checked_in");
  });

  it("allows an admin correction and blocks it for a receptionist", async () => {
    const { organization, owner, clinic, physio, patient } = await setup("correct");
    const wrongPkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-correct-wrong`));
    const rightPkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-correct-right`));
    const wrongAssignment = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: wrongPkg.id }));
    const rightAssignment = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: rightPkg.id }));
    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeCheckIn(owner.id, appointment.id);
    await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "completed", patientPackageId: wrongAssignment.id });

    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "correct-reception");
    await expect(correctPackageSessionUsage(ctx.admin, receptionist.id, appointment.id)).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });

    await correctPackageSessionUsage(ctx.admin, owner.id, appointment.id);

    const wrongAfterCorrection = await getPatientPackageDetails(ctx.admin, owner.id, wrongAssignment.id);
    expect(wrongAfterCorrection.used_sessions).toBe(0);
    expect(wrongAfterCorrection.remaining_sessions).toBe(wrongAssignment.total_sessions);

    const usage = await consumePackageSession(ctx.admin, rightAssignment.organization_id, rightAssignment.id, appointment.id);
    expect(usage.patient_package_id).toBe(rightAssignment.id);

    await expect(correctPackageSessionUsage(ctx.admin, owner.id, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({
      code: ErrorCodes.NOT_FOUND,
    });
  });

  it("lets the treating physiotherapist consume a package session through their own RLS-scoped session, not just the admin client", async () => {
    const { owner, clinic, physio, patient } = await setup("rls");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-rls`));
    const patientPackage = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));
    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    await completeCheckIn(owner.id, appointment.id);

    const physioClient = await ctx.signedInClient(physio.email);
    const completed = await transitionAppointmentStatus(physioClient, physio.id, appointment.id, {
      status: "completed",
      patientPackageId: patientPackage.id,
    });
    expect(completed.status).toBe("completed");

    const afterConsume = await getPatientPackageDetails(ctx.admin, owner.id, patientPackage.id);
    expect(afterConsume.used_sessions).toBe(1);
  });
});

import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic, deactivateClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import {
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  getAppointmentDetails,
  listOrganizationAppointments,
} from "@/server/services/appointment.service";
import { validAppointmentInput, validClinicInput, validPatientInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Appointment lifecycle", () => {
  const ctx = setupIntegrationContext("appointments");

  async function setupOrgWithClinic(suffix: string) {
    const organization = await ctx.createOrganization(`${ctx.runId}-${suffix}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", `${suffix}-owner`);
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-${suffix}`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", `${suffix}-physio`);
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-${suffix}`));
    return { organization, owner, clinic, physio, patient };
  }

  it("creates, updates, changes status, and soft-deletes an appointment", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("lifecycle");

    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    expect(appointment.status).toBe("scheduled");

    const rescheduled = await updateAppointment(ctx.admin, owner.id, appointment.id, { notes: "Rescheduled" });
    expect(rescheduled.notes).toBe("Rescheduled");

    const confirmed = await updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "confirmed" });
    expect(confirmed.status).toBe("confirmed");

    await deleteAppointment(ctx.admin, owner.id, appointment.id);
    await expect(getAppointmentDetails(ctx.admin, owner.id, appointment.id)).rejects.toMatchObject({ code: ErrorCodes.NOT_FOUND });
  });

  it("rejects a cross-org physiotherapist, a wrong-role target, an unassigned physiotherapist, and an inactive clinic", async () => {
    const { organization, owner, clinic, patient } = await setupOrgWithClinic("validation");

    const otherOrg = await ctx.createOrganization(`${ctx.runId}-validation-cross-org`);
    const crossOrgPhysio = await ctx.createUser(otherOrg.id, "ORG_PHYSIOTHERAPIST", "validation-cross-physio");
    await expect(
      createAppointment(ctx.admin, owner.id, validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: crossOrgPhysio.id }))
    ).rejects.toMatchObject({ code: ErrorCodes.NOT_FOUND });

    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "validation-reception");
    await expect(
      createAppointment(ctx.admin, owner.id, validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: receptionist.id }))
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });

    const unassignedPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "validation-unassigned-physio");
    await expect(
      createAppointment(ctx.admin, owner.id, validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: unassignedPhysio.id }))
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });

    const assignedPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "validation-assigned-physio");
    await assignUserToClinic(ctx.admin, owner.id, assignedPhysio.id, clinic.id);
    await deactivateClinic(ctx.admin, owner.id, clinic.id);
    await expect(
      createAppointment(ctx.admin, owner.id, validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: assignedPhysio.id }))
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  it("scopes appointment listing by caller role", async () => {
    const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("scope");
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "scope-reception");
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);

    const otherClinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-scope-other`));
    const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "scope-other-physio");
    await assignUserToClinic(ctx.admin, owner.id, otherPhysio.id, otherClinic.id);

    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    const otherAppointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: otherClinic.id, physiotherapistId: otherPhysio.id })
    );

    const ownerView = await listOrganizationAppointments(ctx.admin, owner.id, { page: 1, limit: 50 });
    expect(ownerView.items.map((a) => a.id)).toEqual(expect.arrayContaining([appointment.id, otherAppointment.id]));

    const receptionistView = await listOrganizationAppointments(ctx.admin, receptionist.id, { page: 1, limit: 50 });
    expect(receptionistView.items.map((a) => a.id)).toContain(appointment.id);
    expect(receptionistView.items.map((a) => a.id)).not.toContain(otherAppointment.id);

    const physioView = await listOrganizationAppointments(ctx.admin, physio.id, { page: 1, limit: 50 });
    expect(physioView.items.map((a) => a.id)).toEqual([appointment.id]);
  });

  it("enforces legal status transitions and records a status log entry for each accepted transition", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("status");

    const appointment = await createAppointment(
      ctx.admin,
      owner.id,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );

    await expect(
      updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "completed" })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_APPOINTMENT_STATUS_TRANSITION });

    const confirmed = await updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "confirmed" });
    expect(confirmed.status).toBe("confirmed");

    const checkedIn = await updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "checked_in" });
    expect(checkedIn.status).toBe("checked_in");

    const completed = await updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "completed" });
    expect(completed.status).toBe("completed");

    await expect(
      updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "scheduled" })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_APPOINTMENT_STATUS_TRANSITION });

    const cancelled = await updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "cancelled" });
    expect(cancelled.status).toBe("cancelled");

    await expect(
      updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "confirmed" })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_APPOINTMENT_STATUS_TRANSITION });

    const { data: logs, error } = await ctx.admin
      .from("appointment_status_logs")
      .select("*")
      .eq("appointment_id", appointment.id)
      .order("changed_at", { ascending: true });
    if (error) throw error;

    expect(logs.map((log) => [log.old_status, log.new_status])).toEqual([
      ["scheduled", "confirmed"],
      ["confirmed", "checked_in"],
      ["checked_in", "completed"],
      ["completed", "cancelled"],
    ]);
    expect(logs.every((log) => log.changed_by === owner.id)).toBe(true);
  });
});

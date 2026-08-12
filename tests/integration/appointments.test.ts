import { describe, expect, it } from "vitest";
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
  cancelAppointmentAsSystem,
} from "@/server/services/appointment.service";
import { listActiveAppointmentsForPhysiotherapistInRange } from "@/server/repositories/appointment.repository";
import { recordCheckIn } from "@/server/services/attendance.service";
import { validAppointmentInput, validAttendanceInput, validClinicInput, validPatientInput } from "../helpers/factories";
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

  describe("availability blocking (task 4)", () => {
    const AVAILABILITY_DATE = "2027-03-15";

    it("refuses booking when the physiotherapist is absent that date (T-4.1)", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("avail-absent");
      await recordCheckIn(ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "absent",
        attendanceDate: AVAILABILITY_DATE,
      });

      await expect(
        createAppointment(ctx.admin, owner.id, {
          ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
          appointmentTime: `${AVAILABILITY_DATE}T10:00:00.000Z`,
        })
      ).rejects.toMatchObject({ code: ErrorCodes.PHYSIOTHERAPIST_UNAVAILABLE });
    });

    it("refuses booking when the physiotherapist is on leave that date (T-4.2)", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("avail-leave");
      await recordCheckIn(ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "leave",
        attendanceDate: AVAILABILITY_DATE,
      });

      await expect(
        createAppointment(ctx.admin, owner.id, {
          ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
          appointmentTime: `${AVAILABILITY_DATE}T10:00:00.000Z`,
        })
      ).rejects.toMatchObject({ code: ErrorCodes.PHYSIOTHERAPIST_UNAVAILABLE });
    });

    it("refuses booking inside a half_day unavailable window and accepts outside it (T-4.3)", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("avail-half-day");
      await recordCheckIn(ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "half_day",
        attendanceDate: AVAILABILITY_DATE,
        unavailableFrom: "09:00",
        unavailableTo: "13:00",
      });

      await expect(
        createAppointment(ctx.admin, owner.id, {
          ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
          appointmentTime: `${AVAILABILITY_DATE}T10:00:00.000Z`,
        })
      ).rejects.toMatchObject({ code: ErrorCodes.PHYSIOTHERAPIST_UNAVAILABLE });

      const outsideWindow = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: `${AVAILABILITY_DATE}T14:00:00.000Z`,
      });
      expect(outsideWindow.status).toBe("scheduled");
    });

    it("does not block booking when the physiotherapist is present that date (T-4.4)", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("avail-present");
      await recordCheckIn(ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "present",
        attendanceDate: AVAILABILITY_DATE,
      });

      const appointment = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: `${AVAILABILITY_DATE}T10:00:00.000Z`,
      });
      expect(appointment.status).toBe("scheduled");
    });

    it("does not block booking when no attendance row exists for the date (T-4.5)", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("avail-no-record");

      const appointment = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: `${AVAILABILITY_DATE}T10:00:00.000Z`,
      });
      expect(appointment.status).toBe("scheduled");
    });

    it("does not block booking against a soft-deleted attendance row (T-4.6)", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("avail-del");
      const attendance = await recordCheckIn(ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "absent",
        attendanceDate: AVAILABILITY_DATE,
      });
      const { error } = await ctx.admin
        .from("user_attendance")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", attendance.id);
      if (error) throw error;

      const appointment = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: `${AVAILABILITY_DATE}T10:00:00.000Z`,
      });
      expect(appointment.status).toBe("scheduled");
    });
  });

  describe("availability re-check on reschedule (task 5, D-J)", () => {
    const AVAILABILITY_DATE = "2027-03-16";

    it("refuses rescheduling into an unavailable window (T-5.1)", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("resch-into");
      const appointment = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: `${AVAILABILITY_DATE}T14:00:00.000Z`,
      });
      await recordCheckIn(ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "half_day",
        attendanceDate: AVAILABILITY_DATE,
        unavailableFrom: "09:00",
        unavailableTo: "13:00",
      });

      await expect(
        updateAppointment(ctx.admin, owner.id, appointment.id, { appointmentTime: `${AVAILABILITY_DATE}T10:00:00.000Z` })
      ).rejects.toMatchObject({ code: ErrorCodes.PHYSIOTHERAPIST_UNAVAILABLE });
    });

    it("accepts rescheduling out of an unavailable window (T-5.2)", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("resch-outof");
      await recordCheckIn(ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "half_day",
        attendanceDate: AVAILABILITY_DATE,
        unavailableFrom: "09:00",
        unavailableTo: "13:00",
      });
      // Created outside the window (bookings are checked at create time too).
      const appointment = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: `${AVAILABILITY_DATE}T14:00:00.000Z`,
      });

      const rescheduled = await updateAppointment(ctx.admin, owner.id, appointment.id, {
        appointmentTime: `${AVAILABILITY_DATE}T15:00:00.000Z`,
      });
      expect(new Date(rescheduled.appointment_time).toISOString()).toBe(`${AVAILABILITY_DATE}T15:00:00.000Z`);
    });

    it("leaves a reschedule with no attendance row unaffected (T-5.3)", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("resch-none");
      const appointment = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: `${AVAILABILITY_DATE}T10:00:00.000Z`,
      });

      const rescheduled = await updateAppointment(ctx.admin, owner.id, appointment.id, {
        appointmentTime: `${AVAILABILITY_DATE}T16:00:00.000Z`,
      });
      expect(new Date(rescheduled.appointment_time).toISOString()).toBe(`${AVAILABILITY_DATE}T16:00:00.000Z`);
    });

    it("re-checks nothing when the update omits appointmentTime", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("resch-notime");
      const appointment = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: `${AVAILABILITY_DATE}T10:00:00.000Z`,
      });
      await recordCheckIn(ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "absent",
        attendanceDate: AVAILABILITY_DATE,
      });

      const updated = await updateAppointment(ctx.admin, owner.id, appointment.id, { notes: "Just a note change" });
      expect(updated.notes).toBe("Just a note change");
    });
  });

  describe("system cancel path (task 6, D-I)", () => {
    it("cancels a scheduled appointment and logs the triggering user (T-6.1)", async () => {
      const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("sys-cancel");
      const appointment = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );

      const cancelled = await cancelAppointmentAsSystem(ctx.admin, organization.id, appointment.id, owner.id);
      expect(cancelled.status).toBe("cancelled");

      const { data: logs, error } = await ctx.admin
        .from("appointment_status_logs")
        .select("*")
        .eq("appointment_id", appointment.id);
      if (error) throw error;
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ old_status: "scheduled", new_status: "cancelled", changed_by: owner.id });
    });

    it("refuses checked_in and completed appointments (T-6.2)", async () => {
      const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("sys-cancel-bad");
      const checkedInAppt = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );
      await updateAppointmentStatus(ctx.admin, owner.id, checkedInAppt.id, { status: "confirmed" });
      await updateAppointmentStatus(ctx.admin, owner.id, checkedInAppt.id, { status: "checked_in" });
      await expect(
        cancelAppointmentAsSystem(ctx.admin, organization.id, checkedInAppt.id, owner.id)
      ).rejects.toMatchObject({ code: ErrorCodes.INVALID_APPOINTMENT_STATUS_TRANSITION });

      const completedAppt = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );
      await updateAppointmentStatus(ctx.admin, owner.id, completedAppt.id, { status: "confirmed" });
      await updateAppointmentStatus(ctx.admin, owner.id, completedAppt.id, { status: "checked_in" });
      await updateAppointmentStatus(ctx.admin, owner.id, completedAppt.id, { status: "completed" });
      await expect(
        cancelAppointmentAsSystem(ctx.admin, organization.id, completedAppt.id, owner.id)
      ).rejects.toMatchObject({ code: ErrorCodes.INVALID_APPOINTMENT_STATUS_TRANSITION });
    });

    it("refuses an appointment belonging to a different organization (T-6.3)", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("sys-cancel-scope");
      const otherOrg = await setupOrgWithClinic("sys-cancel-other");
      const appointment = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );

      await expect(
        cancelAppointmentAsSystem(ctx.admin, otherOrg.organization.id, appointment.id, otherOrg.owner.id)
      ).rejects.toThrow();
    });

    it("lists only live appointments in range for the physiotherapist (T-6.4)", async () => {
      const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("sys-cancel-list");
      const inRange = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: "2027-04-01T10:00:00.000Z",
      });
      const outOfRange = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: "2027-04-05T10:00:00.000Z",
      });
      const softDeleted = await createAppointment(ctx.admin, owner.id, {
        ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
        appointmentTime: "2027-04-01T14:00:00.000Z",
      });
      await deleteAppointment(ctx.admin, owner.id, softDeleted.id);

      const results = await listActiveAppointmentsForPhysiotherapistInRange(
        ctx.admin,
        organization.id,
        physio.id,
        "2027-04-01T00:00:00.000Z",
        "2027-04-01T23:59:59.999Z"
      );

      expect(results.map((a) => a.id)).toEqual([inRange.id]);
      expect(results.map((a) => a.id)).not.toContain(outOfRange.id);
      expect(results.map((a) => a.id)).not.toContain(softDeleted.id);
    });
  });

  describe("availability block through a real signed-in session (task 10, T-10.3)", () => {
    it("lets a receptionist see the blocking attendance row through her own RLS-scoped session", async () => {
      const AVAILABILITY_DATE = "2027-06-01";
      const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("rls-block");
      const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "rls-block-recep");
      await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);
      await recordCheckIn(ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "absent",
        attendanceDate: AVAILABILITY_DATE,
      });

      const receptionistClient = await ctx.signedInClient(receptionist.email);
      // The false-negative case: if user_attendance_select_policy did not
      // admit her, the block would silently not fire and this would resolve
      // instead of rejecting.
      await expect(
        createAppointment(receptionistClient, receptionist.id, {
          ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
          appointmentTime: `${AVAILABILITY_DATE}T10:00:00.000Z`,
        })
      ).rejects.toMatchObject({ code: ErrorCodes.PHYSIOTHERAPIST_UNAVAILABLE });
    });
  });
});

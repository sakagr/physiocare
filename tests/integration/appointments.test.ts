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
import { canAccessAppointment } from "@/server/services/authorization.service";
import { transitionAppointmentStatus } from "@/server/services/appointment-workflow.service";
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

  describe("display projection through a real signed-in session (F6 task 2, D1)", () => {
    /**
     * D1(a) chose an embedded projection over a database view, and made this
     * test a hard requirement of that choice rather than a nice-to-have.
     *
     * The reason is ADR-0011's: a joined select whose RLS policies disagree
     * *filters* rather than errors. A wrong policy on `patients`, `users` or
     * `clinics` produces a null embed and a blank column in the UI -- no
     * exception, nothing in a log, and nothing the admin client would ever
     * reveal, since it bypasses RLS entirely. Only a real session proves it.
     *
     * The physiotherapist case is the load-bearing one: `patients_select_policy`
     * admits a physiotherapist only for patients they have an appointment with,
     * and the appointment in hand is exactly that appointment. The policy and
     * the query agree only because of that, and nothing else in this suite
     * covers the conjunction.
     */
    async function setupProjectionFixture() {
      const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("proj");
      const admin = await ctx.createUser(organization.id, "ORG_ADMIN", "proj-admin");
      const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "proj-recep");
      await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);

      const appointment = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );

      return { owner, admin, receptionist, physio, clinic, patient, appointment };
    }

    it("embeds patient, physiotherapist and clinic for every role that can see the appointment", async () => {
      const fixture = await setupProjectionFixture();
      // `patient_code` is asserted alongside the names: it is what the row and
      // the patient picker agree on when two patients share a name.
      const expected = {
        patient: {
          id: fixture.patient.id,
          full_name: fixture.patient.full_name,
          patient_code: fixture.patient.patient_code,
        },
        physiotherapist: { id: fixture.physio.id, full_name: fixture.physio.full_name },
        clinic: { id: fixture.clinic.id, clinic_name: fixture.clinic.clinic_name },
      };

      for (const caller of [fixture.owner, fixture.admin, fixture.physio, fixture.receptionist]) {
        const client = await ctx.signedInClient(caller.email);

        const listed = await listOrganizationAppointments(client, caller.id, { page: 1, limit: 50 });
        const row = listed.items.find((item) => item.id === fixture.appointment.id);
        expect(row, `${caller.id} could not see the appointment at all`).toBeDefined();
        expect(row).toMatchObject(expected);

        const detail = await getAppointmentDetails(client, caller.id, fixture.appointment.id);
        expect(detail).toMatchObject(expected);
      }
    });
  });

  describe("audit coverage (F6 task 7, D6/D15)", () => {
    async function auditLogsFor(entityId: string) {
      const { data, error } = await ctx.admin
        .from("audit_logs")
        .select("*")
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }

    it("records create, update, each status transition, and delete against the appointment", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("audit-appt");

      const appointment = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );
      await updateAppointment(ctx.admin, owner.id, appointment.id, { notes: "Moved room" });
      await updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "confirmed" });
      await updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "checked_in" });
      await deleteAppointment(ctx.admin, owner.id, appointment.id);

      const logs = await auditLogsFor(appointment.id);
      // A status transition emits the *target status* as a domain verb rather
      // than a generic `update`, so an auditor filtering one entity can tell a
      // lifecycle change from a field edit without diffing snapshots
      // (AGENTS.md → Audit Logging; D15).
      expect(logs.map((log) => log.action)).toEqual(["create", "update", "confirm", "check_in", "delete"]);
      expect(logs.every((log) => log.entity_name === "appointments")).toBe(true);
      expect(logs.every((log) => log.user_id === owner.id)).toBe(true);

      const [created, updated] = logs;
      expect(created.new_data).toMatchObject({ id: appointment.id, status: "scheduled" });
      expect(updated.old_data).toMatchObject({ notes: null });
      expect(updated.new_data).toMatchObject({ notes: "Moved room" });
    });

    it("distinguishes an availability auto-cancel from a person cancelling", async () => {
      const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("audit-auto");

      const manual = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );
      await updateAppointmentStatus(ctx.admin, owner.id, manual.id, { status: "cancelled" });

      const automatic = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );
      await cancelAppointmentAsSystem(ctx.admin, organization.id, automatic.id, owner.id);

      // "Was this visit cancelled by a person or by the availability
      // workflow?" is the first question anyone asks of a cancelled
      // appointment, and `changed_by` deliberately does not answer it -- the
      // status log records the user who marked the absence either way.
      expect((await auditLogsFor(manual.id)).map((log) => log.action)).toEqual(["create", "cancel"]);
      expect((await auditLogsFor(automatic.id)).map((log) => log.action)).toEqual(["create", "auto_cancel"]);
    });

    it("does not double-write when a transition runs through the workflow service", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("audit-wf");

      const appointment = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );
      await transitionAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "confirmed" });

      // `transitionAppointmentStatus` delegates to `updateAppointmentStatus`,
      // which is where the entry is written. It must not add one of its own.
      expect((await auditLogsFor(appointment.id)).map((log) => log.action)).toEqual(["create", "confirm"]);
    });
  });

  describe("per-item permission hints (F6 task 4, D13)", () => {
    it("publishes the transitions legal from each row's current status", async () => {
      const { owner, clinic, physio, patient } = await setupOrgWithClinic("hint-legal");

      const scheduled = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );
      const checkedIn = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );
      await updateAppointmentStatus(ctx.admin, owner.id, checkedIn.id, { status: "confirmed" });
      await updateAppointmentStatus(ctx.admin, owner.id, checkedIn.id, { status: "checked_in" });

      const detail = await getAppointmentDetails(ctx.admin, owner.id, scheduled.id);
      expect(detail.allowedTransitions).toEqual(["confirmed", "checked_in", "cancelled", "no_show"]);

      const checkedInDetail = await getAppointmentDetails(ctx.admin, owner.id, checkedIn.id);
      expect(checkedInDetail.allowedTransitions).toEqual(["completed", "cancelled"]);
    });

    it("publishes an empty transition set for a terminal row, for every role", async () => {
      const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("hint-term");
      const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "hint-term-recep");
      await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);

      const appointment = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );
      await updateAppointmentStatus(ctx.admin, owner.id, appointment.id, { status: "no_show" });

      for (const caller of [owner, physio, receptionist]) {
        const detail = await getAppointmentDetails(ctx.admin, caller.id, appointment.id);
        expect(detail.allowedTransitions, `caller ${caller.id}`).toEqual([]);
      }
    });

    it("hints consultation authoring for the appointment's own physiotherapist and the management tier", async () => {
      const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("hint-consult");
      const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "hint-cons-other");
      await assignUserToClinic(ctx.admin, owner.id, otherPhysio.id, clinic.id);
      const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "hint-cons-recep");
      await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);

      const appointment = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );

      // The hint genuinely varies within one caller's visible rows -- unlike
      // the access conjunct of `allowedTransitions`, which cannot (D13's
      // amendment). A receptionist sees this appointment and may not author
      // on it; an Owner sees appointments for physiotherapists other than
      // themselves and may.
      expect((await getAppointmentDetails(ctx.admin, owner.id, appointment.id)).canManageConsultation).toBe(true);
      expect((await getAppointmentDetails(ctx.admin, physio.id, appointment.id)).canManageConsultation).toBe(true);
      expect((await getAppointmentDetails(ctx.admin, receptionist.id, appointment.id)).canManageConsultation).toBe(false);

      // A second physiotherapist never reaches a hint at all: the detail read
      // refuses them outright, which is the stronger boundary.
      await expect(getAppointmentDetails(ctx.admin, otherPhysio.id, appointment.id)).rejects.toMatchObject({
        code: ErrorCodes.FORBIDDEN,
      });
    });

    /**
     * The invariant the access half of `allowedTransitions` guards (D13's
     * amendment). That conjunct cannot return `[]` today, because
     * `listOrganizationAppointments` and `canAccessAppointment` partition the
     * organization identically. It is retained because that agreement is not
     * stable: F5 widened Reception from clinic-scoped to organization-wide for
     * patients and patient records -- same role, same shape -- when the
     * narrower scoping made Flow 4 impossible for its own primary actor.
     *
     * Asserted in one direction only: **list ⊆ accessible**. The converse is a
     * completeness question rather than an over-permission one, and pinning it
     * would freeze scoping choices that are free to change.
     */
    it("never lists a row the caller may not act on, for any role", async () => {
      const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("hint-inv");
      const admin = await ctx.createUser(organization.id, "ORG_ADMIN", "hint-inv-admin");
      const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "hint-inv-recep");
      await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);

      // A second physiotherapist at a clinic the receptionist is NOT assigned
      // to: their appointment must appear in neither the physio's page nor
      // the receptionist's, and both pages must still be non-empty.
      const otherClinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-hint-inv-2`));
      const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "hint-inv-physio2");
      await assignUserToClinic(ctx.admin, owner.id, otherPhysio.id, otherClinic.id);

      const own = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
      );
      const foreign = await createAppointment(
        ctx.admin,
        owner.id,
        validAppointmentInput({ patientId: patient.id, clinicId: otherClinic.id, physiotherapistId: otherPhysio.id })
      );

      for (const caller of [owner, admin, physio, receptionist]) {
        const listed = await listOrganizationAppointments(ctx.admin, caller.id, { page: 1, limit: 100 });
        expect(listed.items.length, `${caller.id} has an empty page, so the invariant is vacuous`).toBeGreaterThan(0);

        for (const row of listed.items) {
          const accessible = await canAccessAppointment(ctx.admin, caller.id, row.id);
          expect(accessible, `${caller.id} was listed appointment ${row.id} but cannot act on it`).toBe(true);
        }
      }

      const physioPage = await listOrganizationAppointments(ctx.admin, physio.id, { page: 1, limit: 100 });
      expect(physioPage.items.map((a) => a.id)).toEqual([own.id]);

      const receptionPage = await listOrganizationAppointments(ctx.admin, receptionist.id, { page: 1, limit: 100 });
      expect(receptionPage.items.map((a) => a.id)).toContain(own.id);
      expect(receptionPage.items.map((a) => a.id)).not.toContain(foreign.id);
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

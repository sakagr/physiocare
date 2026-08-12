import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createAppointment, updateAppointmentStatus } from "@/server/services/appointment.service";
import { transitionAppointmentStatus } from "@/server/services/appointment-workflow.service";
import { createPackage } from "@/server/services/package.service";
import { createPatientPackage, getPatientPackageDetails } from "@/server/services/patient-package.service";
import { recordAttendance, updateAttendance } from "@/server/services/attendance-workflow.service";
import {
  validAppointmentInput,
  validAttendanceInput,
  validClinicInput,
  validPackageInput,
  validPatientInput,
  validPatientPackageInput,
} from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Attendance workflow: availability auto-cancel", () => {
  const ctx = setupIntegrationContext("attendance-wf");
  const DATE = "2027-05-01";

  async function setupOrgWithClinic(suffix: string) {
    const organization = await ctx.createOrganization(`${ctx.runId}-${suffix}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", `${suffix}-owner`);
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-${suffix}`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", `${suffix}-physio`);
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, owner.id, validPatientInput(`${ctx.runId}-${suffix}`));
    return { organization, owner, clinic, physio, patient };
  }

  it("cancels scheduled and confirmed appointments when marking absent, returning their ids (T-8.1)", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("mark-absent");
    const scheduled = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });
    const confirmed = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T11:00:00.000Z`,
    });
    await updateAppointmentStatus(ctx.admin, owner.id, confirmed.id, { status: "confirmed" });

    const result = await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "absent",
      attendanceDate: DATE,
    });

    expect(result.cancelledAppointmentIds.slice().sort()).toEqual([scheduled.id, confirmed.id].slice().sort());
    expect(result.attendance.status).toBe("absent");
  });

  it("skips and reports a checked_in appointment (T-8.2)", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("skip-checked-in");
    const checkedIn = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });
    await updateAppointmentStatus(ctx.admin, owner.id, checkedIn.id, { status: "confirmed" });
    await updateAppointmentStatus(ctx.admin, owner.id, checkedIn.id, { status: "checked_in" });

    const result = await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "absent",
      attendanceDate: DATE,
    });

    expect(result.cancelledAppointmentIds).toEqual([]);
    expect(result.skippedCheckedInAppointmentIds).toEqual([checkedIn.id]);

    const { data: stillCheckedIn, error } = await ctx.admin.from("appointments").select("status").eq("id", checkedIn.id).single();
    if (error) throw error;
    expect(stillCheckedIn!.status).toBe("checked_in");
  });

  it("leaves a completed appointment untouched and reverses no package session (T-8.3)", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("skip-completed");
    const pkg = await createPackage(ctx.admin, owner.id, validPackageInput(`${ctx.runId}-skip-completed`));
    const patientPackage = await createPatientPackage(ctx.admin, owner.id, validPatientPackageInput({ patientId: patient.id, packageId: pkg.id }));
    const completedAppt = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });
    await transitionAppointmentStatus(ctx.admin, owner.id, completedAppt.id, { status: "confirmed" });
    await transitionAppointmentStatus(ctx.admin, owner.id, completedAppt.id, { status: "checked_in" });
    await transitionAppointmentStatus(ctx.admin, owner.id, completedAppt.id, { status: "completed", patientPackageId: patientPackage.id });

    const result = await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "absent",
      attendanceDate: DATE,
    });

    expect(result.cancelledAppointmentIds).toEqual([]);
    const { data: stillCompleted, error } = await ctx.admin.from("appointments").select("status").eq("id", completedAppt.id).single();
    if (error) throw error;
    expect(stillCompleted!.status).toBe("completed");

    const afterMark = await getPatientPackageDetails(ctx.admin, owner.id, patientPackage.id);
    expect(afterMark.used_sessions).toBe(1);
  });

  it("writes one pending patient notification per cancelled appointment (T-8.4)", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("notify");
    const appointment = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });

    const result = await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "absent",
      attendanceDate: DATE,
    });
    expect(result.cancelledAppointmentIds).toEqual([appointment.id]);
    expect(result.failedNotificationAppointmentIds).toEqual([]);

    const { data: notifications, error } = await ctx.admin
      .from("notifications")
      .select("*")
      .eq("appointment_id", appointment.id);
    if (error) throw error;
    expect(notifications).toHaveLength(1);
    expect(notifications![0]).toMatchObject({ patient_id: patient.id, appointment_id: appointment.id, status: "pending", sent_at: null });
  });

  it("cancels only appointments inside a half_day window (T-8.5)", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("half-day");
    const inside = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });
    const outside = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T15:00:00.000Z`,
    });

    const result = await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "half_day",
      attendanceDate: DATE,
      unavailableFrom: "09:00",
      unavailableTo: "13:00",
    });

    expect(result.cancelledAppointmentIds).toEqual([inside.id]);
    const { data: outsideRow, error } = await ctx.admin.from("appointments").select("status").eq("id", outside.id).single();
    if (error) throw error;
    expect(outsideRow!.status).toBe("scheduled");
  });

  it("cancels on present -> absent correction, and restores nothing on absent -> present (T-8.6, D-H)", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("correction");
    const appointment = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });

    const recorded = await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "present",
      attendanceDate: DATE,
    });
    expect(recorded.cancelledAppointmentIds).toEqual([]);

    const corrected = await updateAttendance(ctx.admin, ctx.admin, owner.id, recorded.attendance.id, { status: "absent" });
    expect(corrected.cancelledAppointmentIds).toEqual([appointment.id]);

    const restored = await updateAttendance(ctx.admin, ctx.admin, owner.id, recorded.attendance.id, { status: "present" });
    expect(restored.cancelledAppointmentIds).toEqual([]);

    const { data: appointmentRow, error } = await ctx.admin.from("appointments").select("status").eq("id", appointment.id).single();
    if (error) throw error;
    expect(appointmentRow!.status).toBe("cancelled");
  });

  it("leaves another physiotherapist's same-date appointments untouched (T-8.7)", async () => {
    const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("other-physio");
    const otherPhysio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "other-physio-peer");
    await assignUserToClinic(ctx.admin, owner.id, otherPhysio.id, clinic.id);
    const ownAppointment = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });
    const peerAppointment = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: otherPhysio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });

    const result = await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "absent",
      attendanceDate: DATE,
    });

    expect(result.cancelledAppointmentIds).toEqual([ownAppointment.id]);
    const { data: peerRow, error } = await ctx.admin.from("appointments").select("status").eq("id", peerAppointment.id).single();
    if (error) throw error;
    expect(peerRow!.status).toBe("scheduled");
  });

  it("rejects a duplicate marking with nothing cancelled (T-8.8)", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("dup-mark");
    const appointment = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });
    await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "present",
      attendanceDate: DATE,
    });

    await expect(
      recordAttendance(ctx.admin, ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "absent",
        attendanceDate: DATE,
      })
    ).rejects.toMatchObject({ code: ErrorCodes.ATTENDANCE_ALREADY_RECORDED });

    const { data: appointmentRow, error } = await ctx.admin.from("appointments").select("status").eq("id", appointment.id).single();
    if (error) throw error;
    expect(appointmentRow!.status).toBe("scheduled");
  });

  it("cancels every eligible appointment even at a clinic the recording receptionist cannot access (T-8.9, D-I)", async () => {
    const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("recep-cancel");
    const otherClinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-recep-cancel-other`));
    await assignUserToClinic(ctx.admin, owner.id, physio.id, otherClinic.id);
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "recep-cancel-recep");
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);
    // Receptionist is NOT assigned to otherClinic.

    const atOwnClinic = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });
    const atOtherClinic = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: otherClinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T11:00:00.000Z`,
    });

    const result = await recordAttendance(ctx.admin, ctx.admin, receptionist.id, {
      ...validAttendanceInput({ clinicId: clinic.id, userId: physio.id }),
      status: "absent",
      attendanceDate: DATE,
    });

    expect(result.cancelledAppointmentIds.slice().sort()).toEqual([atOwnClinic.id, atOtherClinic.id].slice().sort());
    expect(result.failedCancellationIds).toEqual([]);
    expect(result.failedNotificationAppointmentIds).toEqual([]);

    const { data: notifications, error } = await ctx.admin
      .from("notifications")
      .select("appointment_id")
      .in("appointment_id", [atOwnClinic.id, atOtherClinic.id]);
    if (error) throw error;
    expect(notifications).toHaveLength(2);
  });

  it("cancels eligible appointments across both clinics a physiotherapist works, not just the one on the attendance row (T-8.12, D-N)", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("two-clinic");
    const secondClinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-two-clinic-second`));
    await assignUserToClinic(ctx.admin, owner.id, physio.id, secondClinic.id);

    const atFirst = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });
    const atSecond = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: secondClinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T13:00:00.000Z`,
    });

    // Attendance is recorded against the first clinic only.
    const result = await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "absent",
      attendanceDate: DATE,
    });

    expect(result.cancelledAppointmentIds.slice().sort()).toEqual([atFirst.id, atSecond.id].slice().sort());
  });

  it("writes one audit entry per marking, carrying the domain verb and the row snapshot (T-8.10)", async () => {
    const { owner, clinic, physio } = await setupOrgWithClinic("audit");

    const recorded = await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "absent",
      attendanceDate: DATE,
    });

    const { data: recordLogs, error: recordError } = await ctx.admin
      .from("audit_logs")
      .select("*")
      .eq("entity_id", recorded.attendance.id);
    if (recordError) throw recordError;
    expect(recordLogs).toHaveLength(1);
    expect(recordLogs![0]).toMatchObject({ entity_name: "user_attendance", action: "mark_unavailable", user_id: physio.id });
    expect((recordLogs![0].new_data as { status: string }).status).toBe("absent");

    const corrected = await updateAttendance(ctx.admin, ctx.admin, owner.id, recorded.attendance.id, { status: "present" });
    expect(corrected.attendance.status).toBe("present");

    const { data: updateLogs, error: updateError } = await ctx.admin
      .from("audit_logs")
      .select("*")
      .eq("entity_id", recorded.attendance.id)
      .order("created_at", { ascending: true });
    if (updateError) throw updateError;
    expect(updateLogs).toHaveLength(2);
    expect(updateLogs![1]).toMatchObject({ entity_name: "user_attendance", action: "correct", user_id: owner.id });
    expect((updateLogs![1].old_data as { status: string }).status).toBe("absent");
    expect((updateLogs![1].new_data as { status: string }).status).toBe("present");
  });

  it("rejects a marking for a lapsed organization and leaves every appointment untouched (T-9.2)", async () => {
    const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("lapsed");
    const appointment = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });

    const { error } = await ctx.admin
      .from("organizations")
      .update({ subscription_status: "inactive" })
      .eq("id", organization.id);
    if (error) throw error;

    await expect(
      recordAttendance(ctx.admin, ctx.admin, physio.id, {
        ...validAttendanceInput({ clinicId: clinic.id }),
        status: "absent",
        attendanceDate: DATE,
      })
    ).rejects.toMatchObject({ code: ErrorCodes.SUBSCRIPTION_REQUIRED });

    const { data: appointmentRow, error: readError } = await ctx.admin
      .from("appointments")
      .select("status")
      .eq("id", appointment.id)
      .single();
    if (readError) throw readError;
    expect(appointmentRow!.status).toBe("scheduled");
  });

  it("refuses letting a physiotherapist update their own attendance record (T-8.13, D-M)", async () => {
    const { clinic, physio } = await setupOrgWithClinic("self-update");
    const recorded = await recordAttendance(ctx.admin, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "present",
      attendanceDate: DATE,
    });

    await expect(
      updateAttendance(ctx.admin, ctx.admin, physio.id, recorded.attendance.id, { status: "absent" })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  it("records and notifies through the physiotherapist's own RLS-scoped session, not just the admin client (T-10.1, T-10.2)", async () => {
    const { owner, clinic, physio, patient } = await setupOrgWithClinic("rls-self");
    const appointment = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });

    const physioClient = await ctx.signedInClient(physio.email);
    // supabase = the physio's real session; adminClient stays ctx.admin for
    // the appointment listing/cancel, which D-I requires regardless of who
    // is recording -- this test isolates the two writes that D-I says do
    // NOT need admin authority: the attendance insert and the notification
    // insert both run on the session client.
    const result = await recordAttendance(physioClient, ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "absent",
      attendanceDate: DATE,
    });

    expect(result.attendance.user_id).toBe(physio.id);
    expect(result.cancelledAppointmentIds).toEqual([appointment.id]);
    expect(result.failedNotificationAppointmentIds).toEqual([]);

    const { data: notifications, error } = await ctx.admin
      .from("notifications")
      .select("*")
      .eq("appointment_id", appointment.id);
    if (error) throw error;
    expect(notifications).toHaveLength(1);
    expect(notifications![0]).toMatchObject({ patient_id: patient.id, status: "pending" });
  });

  it("cancels across clinics through a real signed-in receptionist session, admin authority only where RLS requires it (T-10.4, D-I)", async () => {
    const { organization, owner, clinic, physio, patient } = await setupOrgWithClinic("rls-recep");
    const otherClinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-rls-recep-other`));
    await assignUserToClinic(ctx.admin, owner.id, physio.id, otherClinic.id);
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "rls-recep-recep");
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);
    // Receptionist is NOT assigned to otherClinic.

    const atOwnClinic = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T10:00:00.000Z`,
    });
    const atOtherClinic = await createAppointment(ctx.admin, owner.id, {
      ...validAppointmentInput({ patientId: patient.id, clinicId: otherClinic.id, physiotherapistId: physio.id }),
      appointmentTime: `${DATE}T11:00:00.000Z`,
    });

    const receptionistClient = await ctx.signedInClient(receptionist.email);
    const result = await recordAttendance(receptionistClient, ctx.admin, receptionist.id, {
      ...validAttendanceInput({ clinicId: clinic.id, userId: physio.id }),
      status: "absent",
      attendanceDate: DATE,
    });

    expect(result.cancelledAppointmentIds.slice().sort()).toEqual([atOwnClinic.id, atOtherClinic.id].slice().sort());
    expect(result.failedCancellationIds).toEqual([]);
    expect(result.failedNotificationAppointmentIds).toEqual([]);
  });
});

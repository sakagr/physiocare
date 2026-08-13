import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { recordCheckIn, recordCheckOut, getAttendanceDetails, listOrganizationAttendance, updateAttendanceRecord } from "@/server/services/attendance.service";
import { insertAttendance } from "@/server/repositories/attendance.repository";
import { validAttendanceInput, validClinicInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Attendance lifecycle", () => {
  const ctx = setupIntegrationContext("attendance");

  it("self-records a present check-in and allows checking out", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-one`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "physio");
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);

    const attendance = await recordCheckIn(ctx.admin, physio.id, validAttendanceInput({ clinicId: clinic.id }));
    expect(attendance.check_in_time).not.toBeNull();
    expect(attendance.user_id).toBe(physio.id);

    const checkedOut = await recordCheckOut(ctx.admin, physio.id, attendance.id);
    expect(checkedOut.check_out_time).not.toBeNull();

    await expect(recordCheckIn(ctx.admin, physio.id, validAttendanceInput({ clinicId: clinic.id }))).rejects.toMatchObject({ code: ErrorCodes.ATTENDANCE_ALREADY_RECORDED });
  });

  it("records absent status with no check-in time and rejects checking it out", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-absent-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "absent-owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-absent`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "absent-physio");
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);

    const attendance = await recordCheckIn(ctx.admin, physio.id, { ...validAttendanceInput({ clinicId: clinic.id }), status: "absent" });
    expect(attendance.check_in_time).toBeNull();

    await expect(recordCheckOut(ctx.admin, physio.id, attendance.id)).rejects.toMatchObject({ code: ErrorCodes.ATTENDANCE_CHECK_IN_REQUIRED });
  });

  it("allows a receptionist to record attendance for an assigned-clinic user and scopes visibility accordingly", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-scope-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "scope-owner");
    const clinicOne = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-scope-one`));
    const clinicTwo = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-scope-two`));
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "scope-recep");
    const physioOne = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "scope-physio-one");
    const physioTwo = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "scope-physio-two");
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinicOne.id);
    await assignUserToClinic(ctx.admin, owner.id, physioOne.id, clinicOne.id);
    await assignUserToClinic(ctx.admin, owner.id, physioTwo.id, clinicTwo.id);

    const attendanceOne = await recordCheckIn(ctx.admin, receptionist.id, validAttendanceInput({ clinicId: clinicOne.id, userId: physioOne.id }));
    expect(attendanceOne.user_id).toBe(physioOne.id);

    // Receptionist cannot record attendance for a user at an inaccessible clinic.
    await expect(
      recordCheckIn(ctx.admin, receptionist.id, validAttendanceInput({ clinicId: clinicTwo.id, userId: physioTwo.id }))
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });

    // Owner records physioTwo's attendance directly (owners bypass the clinic-assignment check).
    const attendanceTwo = await recordCheckIn(ctx.admin, owner.id, validAttendanceInput({ clinicId: clinicTwo.id, userId: physioTwo.id }));

    const receptionistView = await listOrganizationAttendance(ctx.admin, receptionist.id, { page: 1, limit: 10 });
    expect(receptionistView.items.map((a) => a.id)).toContain(attendanceOne.id);
    expect(receptionistView.items.map((a) => a.id)).not.toContain(attendanceTwo.id);

    const physioTwoView = await listOrganizationAttendance(ctx.admin, physioTwo.id, { page: 1, limit: 10 });
    expect(physioTwoView.items.map((a) => a.id)).toEqual([attendanceTwo.id]);

    await expect(getAttendanceDetails(ctx.admin, physioTwo.id, attendanceOne.id)).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  it("narrows self-recording to management and physiotherapist roles, excluding reception (D-A1)", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-self-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "self-owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-self`));
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "self-recep");
    const peerReceptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "self-peer-recep");
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "self-physio");
    await assignUserToClinic(ctx.admin, owner.id, receptionist.id, clinic.id);
    await assignUserToClinic(ctx.admin, owner.id, peerReceptionist.id, clinic.id);
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);

    // T-1.4: a receptionist's own check-in is refused.
    await expect(
      recordCheckIn(ctx.admin, receptionist.id, validAttendanceInput({ clinicId: clinic.id }))
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });

    // T-1.5: a receptionist records a peer receptionist at a shared clinic -- accepted.
    const peerAttendance = await recordCheckIn(
      ctx.admin,
      receptionist.id,
      validAttendanceInput({ clinicId: clinic.id, userId: peerReceptionist.id })
    );
    expect(peerAttendance.user_id).toBe(peerReceptionist.id);

    // T-1.6: an Owner records the receptionist's attendance -- accepted.
    const ownerRecorded = await recordCheckIn(
      ctx.admin,
      owner.id,
      validAttendanceInput({ clinicId: clinic.id, userId: receptionist.id })
    );
    expect(ownerRecorded.user_id).toBe(receptionist.id);

    // T-1.7: a physiotherapist's own check-in -- accepted.
    const physioSelf = await recordCheckIn(ctx.admin, physio.id, validAttendanceInput({ clinicId: clinic.id }));
    expect(physioSelf.user_id).toBe(physio.id);
  });

  it("persists and reads back a half-day unavailable window, and nulls it on correction away from half_day (T-2.3)", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-window-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "window-owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-window`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "window-physio");
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);

    const attendance = await recordCheckIn(ctx.admin, physio.id, {
      ...validAttendanceInput({ clinicId: clinic.id }),
      status: "half_day",
      unavailableFrom: "09:00",
      unavailableTo: "13:00",
    });
    expect(attendance.unavailable_from).toBe("09:00:00");
    expect(attendance.unavailable_to).toBe("13:00:00");

    const readBack = await getAttendanceDetails(ctx.admin, physio.id, attendance.id);
    expect(readBack.unavailable_from).toBe("09:00:00");
    expect(readBack.unavailable_to).toBe("13:00:00");

    // A correction away from half_day nulls the window -- no orphan the CHECK would reject.
    const corrected = await updateAttendanceRecord(ctx.admin, owner.id, attendance.id, { status: "present" });
    expect(corrected.unavailable_from).toBeNull();
    expect(corrected.unavailable_to).toBeNull();
  });

  it("rejects a half_day row with a null window at the database CHECK constraint (T-2.4)", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-check-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "check-owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-check`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "check-physio");
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);

    await expect(
      insertAttendance(ctx.admin, {
        organization_id: organization.id,
        user_id: physio.id,
        clinic_id: clinic.id,
        attendance_date: "2026-01-15",
        check_in_time: new Date().toISOString(),
        status: "half_day",
      })
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("records a check_out audit entry (F6 task 7, D6)", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-audit-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "audit-owner");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-audit`));
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "audit-physio");
    await assignUserToClinic(ctx.admin, owner.id, physio.id, clinic.id);

    const attendance = await recordCheckIn(ctx.admin, physio.id, validAttendanceInput({ clinicId: clinic.id }));
    await recordCheckOut(ctx.admin, physio.id, attendance.id);

    const { data: logs, error } = await ctx.admin
      .from("audit_logs")
      .select("*")
      .eq("entity_id", attendance.id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    // Recording and correcting attendance are already audited by the
    // availability phase, from attendance-workflow.service.ts. `recordCheckOut`
    // sits outside that workflow -- a check-out never changes `status`, so it
    // can never affect availability -- and was the one attendance path with no
    // entry. Calling recordCheckIn directly here (not through the workflow)
    // isolates the check-out entry.
    expect(logs!.map((log) => log.action)).toEqual(["check_out"]);
    expect(logs![0]).toMatchObject({ entity_name: "user_attendance", user_id: physio.id });
    expect(logs![0].old_data).toMatchObject({ check_out_time: null });
    expect((logs![0].new_data as { check_out_time: string | null }).check_out_time).not.toBeNull();
  });
});

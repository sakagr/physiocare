import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { recordCheckIn, recordCheckOut, getAttendanceDetails, listOrganizationAttendance } from "@/server/services/attendance.service";
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
});

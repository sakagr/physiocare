import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createOrganizationUser, updateUserProfile, changeUserRole, deactivateUser, activateUser, resetUserPassword } from "@/server/services/organization.service";
import { getAssignableRoles } from "@/server/services/authorization.service";
import { listOrganizationUsers, getUserDetails } from "@/server/services/user.service";
import { validOrganizationUserInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("User lifecycle", () => {
  const ctx = setupIntegrationContext("users");

  it("creates users, updates profiles and roles, and synchronizes activation state", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-user-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "user-owner");
    const input = validOrganizationUserInput(`${ctx.runId}-employee`);
    input.username = `${ctx.runId}-employee`.slice(0, 50);
    input.email = `${ctx.runId}-employee@example.test`;

    const created = await createOrganizationUser(ctx.admin, ctx.admin, owner.id, input);
    ctx.trackUser(created.userId);
    expect(created.initialPassword).toHaveLength(16);
    await expect(createOrganizationUser(ctx.admin, ctx.admin, owner.id, input)).rejects.toMatchObject({ code: ErrorCodes.USERNAME_ALREADY_EXISTS });
    await expect(createOrganizationUser(ctx.admin, ctx.admin, owner.id, { ...input, username: `${ctx.runId}-employee-two`.slice(0, 50) }))
      .rejects.toMatchObject({ code: ErrorCodes.EMAIL_ALREADY_EXISTS });
    expect((await updateUserProfile(ctx.admin, owner.id, created.userId, { fullName: "Updated Employee", phone: "9123456789" })).full_name).toBe("Updated Employee");
    expect((await changeUserRole(ctx.admin, owner.id, created.userId, "ORG_RECEPTIONIST")).role_id).toBe(await ctx.roleId("ORG_RECEPTIONIST"));
    expect((await deactivateUser(ctx.admin, ctx.admin, owner.id, created.userId)).is_active).toBe(false);
    expect((await activateUser(ctx.admin, ctx.admin, owner.id, created.userId)).is_active).toBe(true);
  });

  it("computes per-row canManage hints and caller-derived assignableRoles on the list and detail responses (ADR-0010)", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-hints-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "hints-owner");
    const admin = await ctx.createUser(organization.id, "ORG_ADMIN", "hints-admin");
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "hints-physio");

    // Admin may manage the physiotherapist, but not the Owner or another Admin.
    const asAdmin = await listOrganizationUsers(ctx.admin, admin.id, { page: 1, limit: 50 });
    expect(asAdmin.assignableRoles).toEqual(
      expect.arrayContaining([{ name: "ORG_PHYSIOTHERAPIST", display_name: "Physiotherapist" }])
    );
    expect(asAdmin.items.find((row) => row.id === physio.id)?.canManage).toBe(true);
    expect(asAdmin.items.find((row) => row.id === owner.id)?.canManage).toBe(false);
    expect(asAdmin.items.find((row) => row.id === admin.id)?.canManage).toBe(false);

    const physioDetailByAdmin = await getUserDetails(ctx.admin, admin.id, physio.id);
    expect(physioDetailByAdmin.canManage).toBe(true);
    const ownerDetailByAdmin = await getUserDetails(ctx.admin, admin.id, owner.id);
    expect(ownerDetailByAdmin.canManage).toBe(false);

    // Owner may manage everyone, including other Admins.
    const asOwner = await listOrganizationUsers(ctx.admin, owner.id, { page: 1, limit: 50 });
    expect(asOwner.items.find((row) => row.id === admin.id)?.canManage).toBe(true);
  });

  it("resolves caller-derived assignable roles per the role hierarchy (FL3)", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-roles-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "roles-owner");
    const admin = await ctx.createUser(organization.id, "ORG_ADMIN", "roles-admin");
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "roles-physio");

    expect(await getAssignableRoles(ctx.admin, owner.id)).toEqual(
      expect.arrayContaining(["ORG_OWNER", "ORG_ADMIN", "ORG_PHYSIOTHERAPIST", "ORG_RECEPTIONIST"])
    );
    expect(await getAssignableRoles(ctx.admin, admin.id)).toEqual(
      expect.arrayContaining(["ORG_PHYSIOTHERAPIST", "ORG_RECEPTIONIST"])
    );
    expect(await getAssignableRoles(ctx.admin, admin.id)).not.toEqual(expect.arrayContaining(["ORG_OWNER", "ORG_ADMIN"]));
    expect(await getAssignableRoles(ctx.admin, physio.id)).toEqual([]);
  });

  it("resets a user's password to a working credential, invalidating the old one (admin-mediated recovery, Hole B)", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-reset-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "reset-owner");
    const employee = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "reset-employee");
    const receptionist = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "reset-reception");

    await expect(resetUserPassword(ctx.admin, ctx.admin, receptionist.id, employee.id)).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });

    const result = await resetUserPassword(ctx.admin, ctx.admin, owner.id, employee.id);
    expect(result).toMatchObject({ userId: employee.id, username: employee.username });
    expect(result.initialPassword).toHaveLength(16);

    await expect(ctx.signedInClient(employee.email, result.initialPassword)).resolves.toBeDefined();
    await expect(ctx.signedInClient(employee.email)).rejects.toThrow();
  });
});

import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { createOrganizationUser, updateUserProfile, changeUserRole, deactivateUser, activateUser } from "@/server/services/organization.service";
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
    expect((await changeUserRole(ctx.admin, owner.id, created.userId, "ORG_ACCOUNTANT")).role_id).toBe(await ctx.roleId("ORG_ACCOUNTANT"));
    expect((await deactivateUser(ctx.admin, ctx.admin, owner.id, created.userId)).is_active).toBe(false);
    expect((await activateUser(ctx.admin, ctx.admin, owner.id, created.userId)).is_active).toBe(true);
  });
});

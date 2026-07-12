import { expect, it } from "vitest";
import { offboardUser } from "@/server/services/organization.service";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("External system consistency", () => {
  const ctx = setupIntegrationContext("compensation");

  it("off-boarding revokes Auth access while preserving the profile for audit history", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-offboard-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "offboard-owner");
    const employee = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "offboard-employee");

    const offboarded = await offboardUser(ctx.admin, ctx.admin, owner.id, employee.id);
    expect(offboarded.is_active).toBe(false);
    expect(offboarded.deleted_at).not.toBeNull();

    // The application profile must remain in public.users for audit/history.
    const { data: profile, error: profileError } = await ctx.admin.from("users").select("*").eq("id", employee.id).maybeSingle();
    if (profileError) throw profileError;
    expect(profile).not.toBeNull();
    expect(profile?.deleted_at).not.toBeNull();

    // The Auth identity must be retained (banned, not deleted) so history stays intact.
    const { data: authUser, error: authError } = await ctx.admin.auth.admin.getUserById(employee.id);
    if (authError) throw authError;
    expect(authUser.user).not.toBeNull();

    // Off-boarded users can no longer authenticate.
    await expect(ctx.signedInClient(employee.email)).rejects.toThrow();
  });

  it("prevents the Auth identity from being hard-deleted while its application profile still exists", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-restrict-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "restrict-owner");
    const employee = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "restrict-employee");

    await offboardUser(ctx.admin, ctx.admin, owner.id, employee.id);

    // Even a direct Auth deletion attempt must be rejected by the database
    // foreign key (ON DELETE RESTRICT) as long as the profile row exists.
    const { error } = await ctx.admin.auth.admin.deleteUser(employee.id);
    expect(error).not.toBeNull();
  });
});

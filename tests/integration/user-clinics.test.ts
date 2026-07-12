import { expect, it } from "vitest";
import { createClinic, deleteClinic, assignUserToClinic, removeUserFromClinic } from "@/server/services/organization.service";
import { findAssignmentsByClinic } from "@/server/repositories/user-clinic.repository";
import { validClinicInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("User-clinic assignments", () => {
  const ctx = setupIntegrationContext("user-clinics");

  it("soft-deletes clinic assignments, reactivates them, and cascades clinic deletion", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-assignment-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "assignment-owner");
    const employee = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "assignment-employee");
    const clinic = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-assignment`));

    const first = await assignUserToClinic(ctx.admin, owner.id, employee.id, clinic.id);
    expect(first.deleted_at).toBeNull();
    expect((await removeUserFromClinic(ctx.admin, owner.id, employee.id, clinic.id)).deleted_at).not.toBeNull();
    expect((await assignUserToClinic(ctx.admin, owner.id, employee.id, clinic.id)).id).toBe(first.id);
    await deleteClinic(ctx.admin, owner.id, clinic.id);
    expect(await findAssignmentsByClinic(ctx.admin, organization.id, clinic.id)).toEqual([]);
  });
});

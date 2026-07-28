import { expect, it } from "vitest";
import { getCurrentUser } from "@/server/services/me.service";
import {
  assignUserToClinic,
  createClinic,
  deactivateClinic,
} from "@/server/services/organization.service";
import type { Capability } from "@/types/contracts/me";
import { validClinicInput } from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Current-user contract (GET /api/users/me)", () => {
  const ctx = setupIntegrationContext("me");

  it("returns full management capabilities and org context for an owner", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-owner-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "owner");

    const me = await getCurrentUser(ctx.admin, owner.id);

    expect(me.id).toBe(owner.id);
    expect(me.group).toBe("org");
    expect(me.role).toEqual({ name: "ORG_OWNER", displayName: "Owner" });
    expect(me.organization).toEqual({ id: organization.id, name: organization.organization_name });
    expect(me.capabilities).toEqual(
      expect.arrayContaining<Capability>([
        "patients:view",
        "appointments:oversee",
        "attendance:oversee",
        "invoices:access",
        "packages:view",
        "reports:view",
        "users:manage",
        "clinics:manage",
        "settings:manage",
        "subscription:manage",
        "auditLogs:view",
      ])
    );
  });

  it("grants an admin management access but not subscription management", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-admin-org`);
    const admin = await ctx.createUser(organization.id, "ORG_ADMIN", "admin");

    const me = await getCurrentUser(ctx.admin, admin.id);

    expect(me.group).toBe("org");
    expect(me.capabilities).toEqual(
      expect.arrayContaining<Capability>([
        "users:manage",
        "clinics:manage",
        "settings:manage",
        "auditLogs:view",
        "appointments:oversee",
        "attendance:oversee",
        "invoices:access",
        "reports:view",
      ])
    );
    expect(me.capabilities).not.toContain("subscription:manage");
  });

  it("limits a physiotherapist to patients, packages, and reports", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-physio-org`);
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "physio");

    const me = await getCurrentUser(ctx.admin, physio.id);

    expect(me.group).toBe("org");
    expect(me.role.displayName).toBe("Physiotherapist");
    expect([...me.capabilities].sort()).toEqual(
      (["packages:view", "patients:view", "reports:view"] as Capability[]).sort()
    );
  });

  it("limits a receptionist to patients, packages, and invoices", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-reception-org`);
    const reception = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "reception");

    const me = await getCurrentUser(ctx.admin, reception.id);

    expect(me.group).toBe("org");
    expect([...me.capabilities].sort()).toEqual(
      (["invoices:access", "packages:view", "patients:view"] as Capability[]).sort()
    );
    expect(me.capabilities).not.toContain("reports:view");
  });

  it("grants a super admin the platform API explorer capability and no org capabilities", async () => {
    const superAdmin = await ctx.createUser(null, "SUPER_ADMIN", "super");

    const me = await getCurrentUser(ctx.admin, superAdmin.id);

    expect(me.group).toBe("platform");
    expect(me.organization).toBeNull();
    expect(me.capabilities).toEqual<Capability[]>(["platformApi:explore"]);
    expect(me.clinics).toEqual([]);
  });

  /**
   * These platform operational roles have no UI in V1 (UX.md) and the
   * namespace guard only checks group, so they still reach `/platform/admin`
   * alongside SUPER_ADMIN. The API Explorer's own SUPER_ADMIN-only gate is
   * what keeps them out -- this pins that none of them are granted
   * `platformApi:explore`, the regression this restructure exists to close.
   */
  it.each(["PLATFORM_SUPPORT", "PLATFORM_SALES", "PLATFORM_BILLING"] as const)(
    "grants %s no capabilities",
    async (role) => {
      const platformUser = await ctx.createUser(null, role, role.toLowerCase());

      const me = await getCurrentUser(ctx.admin, platformUser.id);

      expect(me.group).toBe("platform");
      expect(me.capabilities).toEqual([]);
    }
  );

  /**
   * The tests above all call `getCurrentUser` with `ctx.admin` -- the
   * service-role client, which bypasses RLS entirely. That left a blind
   * spot: `users_select_policy` denied a platform role (other than
   * SUPER_ADMIN) permission to read its own row, because `organization_id`
   * (row) and `current_organization_id()` (caller) are both NULL and
   * `NULL = NULL` is not TRUE in SQL -- so `GET /api/users/me` 404'd for
   * every real PLATFORM_SUPPORT/SALES/BILLING session. This exercises a real
   * signed-in, RLS-scoped session (`ctx.signedInClient`) instead of the admin
   * client, the only way to catch that class of gap.
   */
  it.each(["SUPER_ADMIN", "PLATFORM_SUPPORT", "PLATFORM_SALES", "PLATFORM_BILLING"] as const)(
    "lets %s read its own profile through a real RLS-scoped session, not just the admin client",
    async (role) => {
      const platformUser = await ctx.createUser(null, role, `rls-${role.toLowerCase()}`);
      const session = await ctx.signedInClient(platformUser.email);

      const me = await getCurrentUser(session, platformUser.id);

      expect(me.id).toBe(platformUser.id);
      expect(me.group).toBe("platform");
    }
  );

  /**
   * The clinic switcher in the shell's user menu lists the clinics a user may
   * work in: every active organization clinic for the management tier, and
   * only assigned clinics for everyone else.
   */
  it("returns every active organization clinic for a manager", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-clinics-owner-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "clinics-owner");
    const north = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-north`));
    const south = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-south`));
    // Inactive clinics are not places a user can work today.
    const closed = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-closed`));
    await deactivateClinic(ctx.admin, owner.id, closed.id);

    const me = await getCurrentUser(ctx.admin, owner.id);

    expect(me.clinics.map((clinic) => clinic.id).sort()).toEqual([north.id, south.id].sort());
    expect(me.clinics.map((clinic) => clinic.name)).toEqual(
      expect.arrayContaining([north.clinic_name, south.clinic_name])
    );
  });

  it("returns only assigned clinics for a physiotherapist", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-clinics-physio-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "clinics-physio-owner");
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "clinics-physio");
    const assigned = await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-assigned`));
    await createClinic(ctx.admin, owner.id, validClinicInput(`${ctx.runId}-unassigned`));
    await assignUserToClinic(ctx.admin, owner.id, physio.id, assigned.id);

    const me = await getCurrentUser(ctx.admin, physio.id);

    expect(me.clinics).toEqual([{ id: assigned.id, name: assigned.clinic_name }]);
  });
});

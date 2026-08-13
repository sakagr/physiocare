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
        "appointments:manage",
        "attendance:oversee",
        "attendance:record",
        "attendance:manage",
        "invoices:access",
        "packages:view",
        "reports:view",
        "users:manage",
        "clinics:manage",
        "settings:manage",
        "organization:manage",
        "subscription:manage",
        "auditLogs:view",
      ])
    );
  });

  it("grants an admin management access but not subscription or organization-profile management", async () => {
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
        "appointments:manage",
        "attendance:oversee",
        "attendance:record",
        "attendance:manage",
        "invoices:access",
        "reports:view",
      ])
    );
    expect(me.capabilities).not.toContain("subscription:manage");
    expect(me.capabilities).not.toContain("organization:manage");
  });

  it("limits a physiotherapist to patients, packages, reports, and recording their own attendance", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-physio-org`);
    const physio = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "physio");

    const me = await getCurrentUser(ctx.admin, physio.id);

    expect(me.group).toBe("org");
    expect(me.role.displayName).toBe("Physiotherapist");
    // `attendance:record` (F6) is what gives a physiotherapist Flow 14 at all:
    // marking themselves unavailable is the flow's whole point, and before it
    // they held no attendance token of any kind.
    expect([...me.capabilities].sort()).toEqual(
      (["attendance:record", "packages:view", "patients:view", "reports:view"] as Capability[]).sort()
    );
    // The two attendance capabilities cross rather than nest (D11): a
    // physiotherapist records their own and never another's.
    expect(me.capabilities).not.toContain("attendance:manage");
    expect(me.capabilities).not.toContain("appointments:manage");
  });

  it("gives a receptionist the front-desk manage tokens but not the catalogue or record-delete ones", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-reception-org`);
    const reception = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "reception");

    const me = await getCurrentUser(ctx.admin, reception.id);

    expect(me.group).toBe("org");
    // Reception may manage patients and their package assignments (both
    // ORG_FRONT_DESK_ROLES) but not the catalogue, and may not delete a
    // patient record -- the deliberate asymmetry against uploading one.
    expect([...me.capabilities].sort()).toEqual(
      ([
        "appointments:manage",
        "attendance:manage",
        "invoices:access",
        "packages:view",
        "patientPackages:manage",
        "patients:manage",
        "patients:view",
      ] as Capability[]).sort()
    );
    expect(me.capabilities).not.toContain("reports:view");
    expect(me.capabilities).not.toContain("packages:manage");
    expect(me.capabilities).not.toContain("patientRecords:delete");
    // The other half of the crossing (D11): reception records attendance for
    // other staff and never their own. `UX.md`'s Screen Inventory said
    // otherwise and contradicted Flow 14; Flow 14 was the correct side.
    expect(me.capabilities).not.toContain("attendance:record");
    expect(me.capabilities).not.toContain("attendance:oversee");
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
   * The test above calls `getCurrentUser` with `ctx.admin` -- the
   * service-role client, which bypasses RLS entirely. That left a blind
   * spot: `users_select_policy` used to deny a platform role permission to
   * read its own row, because `organization_id` (row) and
   * `current_organization_id()` (caller) are both NULL and `NULL = NULL` is
   * not TRUE in SQL -- so `GET /api/users/me` 404'd for every real platform
   * session other than SUPER_ADMIN. `SUPER_ADMIN` itself was always covered
   * by the policy's `is_super_admin()` branch regardless of this gap; the
   * fix at `20260728000000_users_select_self_read.sql` added the
   * `id = auth.uid()` clause for the (now-removed) other platform roles.
   * This exercises a real signed-in, RLS-scoped session
   * (`ctx.signedInClient`) instead of the admin client, the only way to
   * catch that class of gap.
   */
  it("lets SUPER_ADMIN read its own profile through a real RLS-scoped session, not just the admin client", async () => {
    const superAdmin = await ctx.createUser(null, "SUPER_ADMIN", "rls-super-admin");
    const session = await ctx.signedInClient(superAdmin.email);

    const me = await getCurrentUser(session, superAdmin.id);

    expect(me.id).toBe(superAdmin.id);
    expect(me.group).toBe("platform");
  });

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

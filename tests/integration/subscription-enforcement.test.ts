import { expect, it } from "vitest";
import { ErrorCodes } from "@/server/errors";
import { bootstrapOrganization, createClinic, assignUserToClinic } from "@/server/services/organization.service";
import { createPatient } from "@/server/services/patient.service";
import { createPatientRecord } from "@/server/services/patient-record.service";
import { createPatientPackage, consumePackageSession } from "@/server/services/patient-package.service";
import { createInvoice } from "@/server/services/invoice.service";
import { createPayment } from "@/server/services/payment.service";
import { createAppointment, listOrganizationAppointments } from "@/server/services/appointment.service";
import { selectSubscriptionPlan, activateOrganizationSubscription } from "@/server/services/subscription.service";
import {
  validOrganizationInput,
  validClinicInput,
  validPatientInput,
  validAppointmentInput,
  validPatientPackageInput,
  validInvoiceInput,
  validPaymentInput,
} from "../helpers/factories";
import { describeIntegration, setupIntegrationContext } from "../helpers/integration-context";

describeIntegration("Subscription enforcement", () => {
  const ctx = setupIntegrationContext("sub-enforce");

  // Kept short: setupIntegrationContext builds usernames as `${runId}-${suffix}`
  // truncated to 50 chars, and runId alone is already ~32 chars.
  async function bootstrapInactiveOrg(suffix: string) {
    const input = validOrganizationInput(ctx.runId.slice(-6));
    input.organizationName = `${input.organizationName} ${ctx.runId}-${suffix}`;
    input.adminEmail = `${ctx.runId}-${suffix}@example.test`;
    input.adminUsername = `${ctx.runId}-${suffix}-o`.slice(0, 50);

    const result = await bootstrapOrganization(ctx.admin, ctx.admin, input);
    ctx.trackOrganization(result.organizationId);
    ctx.trackUser(result.adminUserId);

    return { ...result, adminEmail: input.adminEmail };
  }

  it("blocks a write path until a plan is selected, and unblocks it once trialing", async () => {
    const { organizationId, adminUserId } = await bootstrapInactiveOrg("gate");

    await expect(createClinic(ctx.admin, adminUserId, validClinicInput(`${ctx.runId}-gate`))).rejects.toMatchObject({
      code: ErrorCodes.SUBSCRIPTION_REQUIRED,
    });

    // Read paths remain accessible even while the org cannot transact.
    const emptyList = await listOrganizationAppointments(ctx.admin, adminUserId, { page: 1, limit: 50 });
    expect(emptyList.items).toEqual([]);

    const trialed = await selectSubscriptionPlan(ctx.admin, adminUserId, organizationId, "Trial");
    expect(trialed.subscription_status).toBe("trialing");

    const clinic = await createClinic(ctx.admin, adminUserId, validClinicInput(`${ctx.runId}-gate-2`));
    const physio = await ctx.createUser(organizationId, "ORG_PHYSIOTHERAPIST", "gate-physio");
    await assignUserToClinic(ctx.admin, adminUserId, physio.id, clinic.id);
    const patient = await createPatient(ctx.admin, adminUserId, validPatientInput(`${ctx.runId}-gate`));

    const appointment = await createAppointment(
      ctx.admin,
      adminUserId,
      validAppointmentInput({ patientId: patient.id, clinicId: clinic.id, physiotherapistId: physio.id })
    );
    expect(appointment.status).toBe("scheduled");
  });

  it("blocks every remaining transactional write path while the organization cannot transact", async () => {
    const { organizationId, adminUserId } = await bootstrapInactiveOrg("gate-rest");

    // The referenced records deliberately do not exist. Every one of these gates
    // runs before its function looks up any resource, so a non-existent id still
    // reaches the gate -- which means this test also pins that ordering. If a gate
    // is ever moved below its resource lookup, these assertions start failing with
    // NOT_FOUND. That is the gate regressing, not the fixtures going stale: fix the
    // service, do not give this test real records.
    const fake = () => crypto.randomUUID();

    await expect(
      createAppointment(ctx.admin, adminUserId, validAppointmentInput({ patientId: fake(), clinicId: fake(), physiotherapistId: fake() }))
    ).rejects.toMatchObject({ code: ErrorCodes.SUBSCRIPTION_REQUIRED });

    await expect(
      createPatientPackage(ctx.admin, adminUserId, validPatientPackageInput({ patientId: fake(), packageId: fake() }))
    ).rejects.toMatchObject({ code: ErrorCodes.SUBSCRIPTION_REQUIRED });

    await expect(consumePackageSession(ctx.admin, organizationId, fake(), fake())).rejects.toMatchObject({
      code: ErrorCodes.SUBSCRIPTION_REQUIRED,
    });

    await expect(createPayment(ctx.admin, adminUserId, validPaymentInput(fake()))).rejects.toMatchObject({
      code: ErrorCodes.SUBSCRIPTION_REQUIRED,
    });

    await expect(
      createInvoice(ctx.admin, adminUserId, validInvoiceInput({ patientId: fake(), clinicId: fake() }))
    ).rejects.toMatchObject({ code: ErrorCodes.SUBSCRIPTION_REQUIRED });
  });

  it("blocks createPatient until a plan is selected, and blocks createPatientRecord once the plan lapses", async () => {
    const { organizationId, adminUserId } = await bootstrapInactiveOrg("gate-patient");

    await expect(createPatient(ctx.admin, adminUserId, validPatientInput(`${ctx.runId}-gate-patient`))).rejects.toMatchObject({
      code: ErrorCodes.SUBSCRIPTION_REQUIRED,
    });

    // Take the org through the real path -- select Trial, create the patient the
    // way the product does -- then lapse the subscription underneath it. This is
    // the actual scenario the record gate exists for: an organization that already
    // has patients on file and stops paying.
    await selectSubscriptionPlan(ctx.admin, adminUserId, organizationId, "Trial");
    const patient = await createPatient(ctx.admin, adminUserId, validPatientInput(`${ctx.runId}-gate-patient`));

    const { error: lapseError } = await ctx.admin
      .from("organizations")
      .update({ subscription_status: "inactive" })
      .eq("id", organizationId);
    if (lapseError) throw lapseError;

    await expect(
      createPatientRecord(ctx.admin, ctx.admin, adminUserId, patient.id, {
        recordType: "xray",
        title: "Lapsed upload",
        fileBuffer: Buffer.from("%PDF-1.4 test content"),
        fileName: "lapsed.pdf",
        mimeType: "application/pdf",
      })
    ).rejects.toMatchObject({ code: ErrorCodes.SUBSCRIPTION_REQUIRED });
  });

  it("leaves subscription_status at inactive when a paid plan is selected, pending platform activation", async () => {
    const { organizationId, adminUserId } = await bootstrapInactiveOrg("paid");

    const { data: paidPlan, error: planError } = await ctx.admin
      .from("subscription_plans")
      .insert({ plan_name: `Pro ${ctx.runId}`, max_clinics: 5, max_users: 20, monthly_price: 999, yearly_price: 9999 })
      .select()
      .single();
    if (planError) throw planError;

    const selected = await selectSubscriptionPlan(ctx.admin, adminUserId, organizationId, paidPlan.plan_name);
    expect(selected.subscription_plan_id).toBe(paidPlan.id);
    expect(selected.subscription_status).toBe("inactive");

    await expect(createClinic(ctx.admin, adminUserId, validClinicInput(`${ctx.runId}-paid`))).rejects.toMatchObject({
      code: ErrorCodes.SUBSCRIPTION_REQUIRED,
    });

    await expect(activateOrganizationSubscription(ctx.admin, adminUserId, organizationId, "monthly")).rejects.toMatchObject({
      code: ErrorCodes.FORBIDDEN,
    });

    const superAdmin = await ctx.createUser(null, "SUPER_ADMIN", "paid-super");
    const activated = await activateOrganizationSubscription(ctx.admin, superAdmin.id, organizationId, "monthly");
    expect(activated.subscription_status).toBe("active");
    expect(activated.subscription_starts_at).not.toBeNull();
    expect(activated.subscription_ends_at).not.toBeNull();

    const clinic = await createClinic(ctx.admin, adminUserId, validClinicInput(`${ctx.runId}-paid-2`));
    expect(clinic.clinic_name).toContain("paid-2");
  });

  it("rejects activation attempts before any plan has been selected", async () => {
    const { organizationId } = await bootstrapInactiveOrg("noplan");
    const superAdmin = await ctx.createUser(null, "SUPER_ADMIN", "noplan-super");

    await expect(activateOrganizationSubscription(ctx.admin, superAdmin.id, organizationId, "monthly")).rejects.toMatchObject({
      code: ErrorCodes.SUBSCRIPTION_PLAN_NOT_FOUND,
    });
  });

  it("enforces the organizations_update_policy RLS fix: only ORG_OWNER (not ORG_ADMIN) can update their own organization row directly", async () => {
    // Uses ctx.createOrganization/ctx.createUser (direct Auth user creation with a
    // known password) rather than bootstrapInactiveOrg -- the real bootstrap flow
    // invites the owner (AGENTS.md User Onboarding), who sets their own password
    // during onboarding and so has no password this test can sign in with.
    const organization = await ctx.createOrganization(`${ctx.runId}-rls-org`);
    const owner = await ctx.createUser(organization.id, "ORG_OWNER", "rls-owner");
    const orgAdmin = await ctx.createUser(organization.id, "ORG_ADMIN", "rls-admin");

    const adminClient = await ctx.signedInClient(orgAdmin.email);
    await adminClient.from("organizations").update({ subscription_status: "trialing" }).eq("id", organization.id);

    const { data: afterAdminAttempt, error: afterAdminAttemptError } = await ctx.admin
      .from("organizations")
      .select("subscription_status")
      .eq("id", organization.id)
      .single();
    if (afterAdminAttemptError) throw afterAdminAttemptError;
    expect(afterAdminAttempt.subscription_status).toBe("active"); // RLS silently blocked the ORG_ADMIN's update (fixture default, unchanged)

    const ownerClient = await ctx.signedInClient(owner.email);
    const { error: ownerUpdateError } = await ownerClient.from("organizations").update({ status: "draft" }).eq("id", organization.id);
    expect(ownerUpdateError).toBeNull();

    const { data: afterOwnerAttempt, error: afterOwnerAttemptError } = await ctx.admin
      .from("organizations")
      .select("status")
      .eq("id", organization.id)
      .single();
    if (afterOwnerAttemptError) throw afterOwnerAttemptError;
    expect(afterOwnerAttempt.status).toBe("draft");
  });
});

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import WebSocket from "ws";
// Relative imports only (not the `@/` alias): Playwright's own transform
// does not resolve tsconfig `paths`, unlike the Vitest lane's
// vite-tsconfig-paths plugin. Verified clean of any *value* (non-type-only)
// `@/` import across this module's whole dependency chain, so a relative
// import resolves it without further configuration.
import {
  selectSubscriptionPlan,
  activateOrganizationSubscription,
} from "../../src/server/services/subscription.service";
import { createPatient } from "../../src/server/services/patient.service";
import { createPackage } from "../../src/server/services/package.service";
import { createPatientPackage } from "../../src/server/services/patient-package.service";

loadEnv({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });

const PASSWORD = "E2eTestPass1!";
const SEED_FILE = path.resolve(__dirname, ".seed.json");

export interface SeededUser {
  id: string;
  email: string;
  username: string;
  password: string;
}

export interface SeedData {
  runId: string;
  createdAuthUserIds: string[];
  createdOrganizationIds: string[];
  main: {
    organizationId: string;
    owner: SeededUser;
    admin: SeededUser;
    physio: SeededUser;
    /** Assigned to no clinic and given no appointment: the F5 Q3 fixture. */
    receptionist: SeededUser;
    clinicId: string;
    clinicName: string;
    patientId: string;
    patientCode: string;
    packageId: string;
    packageName: string;
    assignedPackageId: string;
  };
  saturated: {
    organizationId: string;
    owner: SeededUser;
  };
  unsubscribed: {
    organizationId: string;
    owner: SeededUser;
  };
  /**
   * An organization that was subscribed and then lapsed. Kept separate from
   * `unsubscribed` -- which the F4 settings spec deliberately *subscribes*
   * mid-run -- so the write-enforcement scenario can never depend on a state
   * another spec removes. Same reasoning as `saturated`.
   */
  lapsed: {
    organizationId: string;
    owner: SeededUser;
    /** Created while the org was still subscribed. */
    patientId: string;
  };
}

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("E2E setup requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });
}

async function roleId(db: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await db.from("roles").select("id").eq("name", name).single();
  if (error) throw error;
  return data.id;
}

async function noSubscriptionPlanId(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.from("subscription_plans").select("id").eq("plan_name", "NO_SUBSCRIPTION").single();
  if (error) throw error;
  return data.id;
}

/** Mirrors a real bootstrap outcome (`status: active`, `subscription_status: inactive`, `NO_SUBSCRIPTION`) without the email-invite round-trip. */
async function createOrganization(db: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await db
    .from("organizations")
    .insert({
      organization_name: name,
      status: "active",
      subscription_plan_id: await noSubscriptionPlanId(db),
      subscription_status: "inactive",
    })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

/** Direct auth + profile creation with a known password -- same shortcut `tests/helpers/integration-context.ts` uses for the Vitest integration lane. */
async function createUser(
  db: SupabaseClient,
  organizationId: string | null,
  role: string,
  email: string,
  username: string,
  fullName: string
): Promise<SeededUser> {
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (authError) throw authError;

  const { error } = await db
    .from("users")
    .insert({
      id: authData.user.id,
      organization_id: organizationId,
      role_id: await roleId(db, role),
      full_name: fullName,
      email,
      username: username.slice(0, 50),
    });
  if (error) throw error;

  return { id: authData.user.id, email, username, password: PASSWORD };
}

async function createClinic(db: SupabaseClient, organizationId: string, name: string): Promise<string> {
  const { data, error } = await db
    .from("clinics")
    .insert({ organization_id: organizationId, clinic_name: name, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

export default async function globalSetup(): Promise<void> {
  const db = adminClient();
  const runId = `e2e-${Date.now()}`;
  const createdAuthUserIds: string[] = [];
  const createdOrganizationIds: string[] = [];

  async function user(
    organizationId: string | null,
    role: string,
    suffix: string,
    fullName: string
  ): Promise<SeededUser> {
    const seeded = await createUser(
      db,
      organizationId,
      role,
      `${runId}-${suffix}@example.test`,
      `${runId}-${suffix}`,
      fullName
    );
    createdAuthUserIds.push(seeded.id);
    return seeded;
  }

  // A platform caller for the subscription select+activate calls below --
  // `canActivateSubscription` is SUPER_ADMIN-only (never self-service), so
  // the Owner cannot do this step itself. SUPER_ADMIN satisfies both
  // `canManageSubscription` and `canActivateSubscription`.
  const superAdmin = await user(null, "SUPER_ADMIN", "super", "E2E Super Admin");

  // --- Main org: everything except the saturated-limit scenario ---
  const mainOrgId = await createOrganization(db, `${runId}-main`);
  createdOrganizationIds.push(mainOrgId);
  const owner = await user(mainOrgId, "ORG_OWNER", "owner", "E2E Owner");
  const admin = await user(mainOrgId, "ORG_ADMIN", "admin", "E2E Admin");
  const physio = await user(mainOrgId, "ORG_PHYSIOTHERAPIST", "physio", "E2E Physio");

  // The real select -> activate path, as a platform caller, exercising the
  // actual service functions rather than raw inserts (both take
  // organizationId explicitly, so a platform-role caller can act on an
  // organization it does not itself belong to).
  await selectSubscriptionPlan(db as never, superAdmin.id, mainOrgId, "Trial");
  await activateOrganizationSubscription(db as never, superAdmin.id, mainOrgId, "monthly");

  // Deliberately assigned to no clinic: the F5 records-visibility fixture
  // must prove Reception can see records for a patient with no appointment.
  const receptionist = await user(mainOrgId, "ORG_RECEPTIONIST", "reception", "E2E Reception");

  const clinicName = `${runId} North Clinic`;
  const clinicId = await createClinic(db, mainOrgId, clinicName);

  // Built through the real services so the workspace, the catalogue, and the
  // assignment tab all have a target that does not depend on another test
  // having created one first.
  const mainPatient = await createPatient(db as never, owner.id, {
    fullName: "E2E Seeded Patient",
    gender: "female",
    phone: "9000000001",
  });
  const mainPackage = await createPackage(db as never, owner.id, {
    packageName: `${runId} Seeded Package`,
    totalSessions: 10,
    packagePrice: 5000,
    validityDays: 90,
  });
  const mainAssignment = await createPatientPackage(db as never, owner.id, {
    patientId: mainPatient.id,
    packageId: mainPackage.id,
  });

  // --- Saturated org: the subscription/limit-enforcement scenario only,
  // kept separate so its exhausted-limit state can never race with the
  // main org's tests creating/removing users or clinics. ---
  const saturatedOrgId = await createOrganization(db, `${runId}-saturated`);
  createdOrganizationIds.push(saturatedOrgId);
  const saturatedOwner = await user(saturatedOrgId, "ORG_OWNER", "sat-owner", "E2E Saturated Owner");
  await selectSubscriptionPlan(db as never, superAdmin.id, saturatedOrgId, "Trial");
  await activateOrganizationSubscription(db as never, superAdmin.id, saturatedOrgId, "monthly");

  // Trial: max_users = 5, max_clinics = 1. The owner is already 1 user; four
  // more saturates it. One clinic saturates max_clinics on its own.
  for (let i = 0; i < 4; i++) {
    await user(saturatedOrgId, "ORG_PHYSIOTHERAPIST", `sat-user-${i}`, `E2E Saturated User ${i}`);
  }
  await createClinic(db, saturatedOrgId, `${runId} Saturated Clinic`);

  // --- Unsubscribed org: no plan selected (bootstrap-default NO_SUBSCRIPTION
  // / inactive), for the plan-selection E2E test -- the main and saturated
  // orgs are both already select+activate'd above and so never show the
  // "choose a plan" catalog state. ---
  const unsubscribedOrgId = await createOrganization(db, `${runId}-unsubscribed`);
  createdOrganizationIds.push(unsubscribedOrgId);
  const unsubscribedOwner = await user(unsubscribedOrgId, "ORG_OWNER", "unsub-owner", "E2E Unsubscribed Owner");

  // --- Lapsed org: subscribed, populated, then lapsed back, for the F5
  // write-enforcement spec. It needs a real patient to attempt an edit and a
  // delete against, and every F5 write is gated -- including the create that
  // would otherwise make one. ---
  const lapsedOrgId = await createOrganization(db, `${runId}-lapsed`);
  createdOrganizationIds.push(lapsedOrgId);
  const lapsedOwner = await user(lapsedOrgId, "ORG_OWNER", "lapsed-owner", "E2E Lapsed Owner");
  await selectSubscriptionPlan(db as never, superAdmin.id, lapsedOrgId, "Trial");
  const lapsedPatient = await createPatient(db as never, lapsedOwner.id, {
    fullName: "E2E Lapsed Org Patient",
    phone: "9000000002",
  });
  const { error: lapseError } = await db
    .from("organizations")
    .update({ subscription_plan_id: await noSubscriptionPlanId(db), subscription_status: "inactive" })
    .eq("id", lapsedOrgId);
  if (lapseError) throw lapseError;

  const seed: SeedData = {
    runId,
    createdAuthUserIds,
    createdOrganizationIds,
    main: {
      organizationId: mainOrgId,
      owner,
      admin,
      physio,
      receptionist,
      clinicId,
      clinicName,
      patientId: mainPatient.id,
      patientCode: mainPatient.patient_code,
      packageId: mainPackage.id,
      packageName: mainPackage.package_name,
      assignedPackageId: mainAssignment.id,
    },
    saturated: { organizationId: saturatedOrgId, owner: saturatedOwner },
    unsubscribed: { organizationId: unsubscribedOrgId, owner: unsubscribedOwner },
    lapsed: { organizationId: lapsedOrgId, owner: lapsedOwner, patientId: lapsedPatient.id },
  };

  writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
}

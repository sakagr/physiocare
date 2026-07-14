import { afterAll, beforeAll, describe } from "vitest";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { Database } from "@/types/database";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const integrationEnabled = process.env.RUN_SUPABASE_INTEGRATION === "1";
export const describeIntegration = integrationEnabled ? describe : describe.skip;
export const password = "TestPassword1!";

type Organization = Database["public"]["Tables"]["organizations"]["Row"];
type User = Database["public"]["Tables"]["users"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

export interface IntegrationContext {
  admin: SupabaseClient<Database>;
  runId: string;
  /** Registers an Auth user ID for teardown after the suite finishes. */
  trackUser(userId: string): void;
  /** Registers an organization ID for teardown after the suite finishes. */
  trackOrganization(organizationId: string): void;
  roleId(name: AppRole): Promise<string>;
  createOrganization(name: string): Promise<Organization>;
  createUser(organizationId: string | null, role: AppRole, suffix: string): Promise<User & { email: string }>;
  signedInClient(email: string): Promise<SupabaseClient<Database>>;
}

function requireIntegrationEnvironment() {
  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error("Integration tests require NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY.");
  }
}

function createSupabaseClient(key: string): SupabaseClient<Database> {
  return createClient<Database>(url!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  }) as unknown as SupabaseClient<Database>;
}

/**
 * Registers beforeAll/afterAll hooks that provision an admin Supabase client
 * against the local integration stack and tear down every organization and
 * Auth user created during the suite. Each call gets its own runId so
 * suites running against the same database never collide.
 */
export function setupIntegrationContext(suffix: string): IntegrationContext {
  const runId = `test-${Date.now()}-${suffix}`;
  const createdAuthUserIds: string[] = [];
  const createdOrganizationIds: string[] = [];
  const context = { runId } as IntegrationContext;

  beforeAll(() => {
    requireIntegrationEnvironment();
    context.admin = createSupabaseClient(serviceRoleKey!);
  });

  afterAll(async () => {
    for (const organizationId of createdOrganizationIds) {
      await context.admin.from("organizations").delete().eq("id", organizationId);
    }
    for (const userId of createdAuthUserIds) {
      await context.admin.auth.admin.deleteUser(userId);
    }
  });

  context.trackUser = (userId) => createdAuthUserIds.push(userId);
  context.trackOrganization = (organizationId) => createdOrganizationIds.push(organizationId);

  context.roleId = async (name) => {
    const { data, error } = await context.admin.from("roles").select("id").eq("name", name).single();
    if (error) throw error;
    return data.id;
  };

  context.createOrganization = async (name) => {
    // subscription_plan_id is not-null and every other module's tests need
    // to freely create clinics/users without hitting a plan ceiling, so
    // fixture organizations get a dedicated, generously-limited plan rather
    // than the real NO_SUBSCRIPTION system plan (max_clinics/max_users = 1,
    // see 20260716000300_subscription_enforcement.sql) -- organization-limits.test.ts
    // and subscription-enforcement.test.ts cover NO_SUBSCRIPTION/limit
    // behavior directly with their own purpose-built plans. subscription_status
    // is "active" here (not the real bootstrap default of "inactive") purely
    // so canOrganizationTransact() doesn't block every other module's tests.
    // Concurrent test files may race to create this fixture plan -- upsert
    // on the unique plan_name so a losing concurrent insert doesn't error.
    const { error: upsertError } = await context.admin
      .from("subscription_plans")
      .upsert(
        { plan_name: "Integration Test Fixture Plan", max_clinics: 1000, max_users: 1000, monthly_price: 0, yearly_price: 0 },
        { onConflict: "plan_name", ignoreDuplicates: true }
      );
    if (upsertError) throw upsertError;

    const { data: plan, error: planError } = await context.admin
      .from("subscription_plans")
      .select("id")
      .eq("plan_name", "Integration Test Fixture Plan")
      .single();
    if (planError) throw planError;

    const { data, error } = await context.admin
      .from("organizations")
      .insert({
        organization_name: name,
        status: "active",
        subscription_plan_id: plan.id,
        subscription_status: "active",
      })
      .select()
      .single();
    if (error) throw error;
    context.trackOrganization(data.id);
    return data;
  };

  context.createUser = async (organizationId, role, suffix) => {
    const email = `${runId}-${suffix}@example.test`;
    const { data: authData, error: authError } = await context.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) throw authError;
    context.trackUser(authData.user.id);

    const { data, error } = await context.admin
      .from("users")
      .insert({
        id: authData.user.id,
        organization_id: organizationId,
        role_id: await context.roleId(role),
        full_name: `Test ${suffix}`,
        email,
        username: `${runId}-${suffix}`.slice(0, 50),
      })
      .select()
      .single();
    if (error) throw error;
    return { ...data, email };
  };

  context.signedInClient = async (email) => {
    const client = createSupabaseClient(publishableKey!);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return client;
  };

  return context;
}

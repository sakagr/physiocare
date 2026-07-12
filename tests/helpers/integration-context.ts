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
    const { data, error } = await context.admin
      .from("organizations")
      .insert({ organization_name: name, status: "active" })
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

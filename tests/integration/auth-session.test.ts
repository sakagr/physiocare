import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import WebSocket from "ws";
import {
  authenticate,
  changePassword,
  endSession,
  requestPasswordReset,
  setPassword,
} from "@/server/services/session.service";
import { getCurrentUser } from "@/server/services/me.service";
import { resolveLanding } from "@/lib/auth/landing";
import { AppError, ErrorCodes } from "@/server/errors";
import type { Database } from "@/types/database";
import { describeIntegration, password, setupIntegrationContext } from "../helpers/integration-context";

/**
 * Sign-in resolves a username to an authentication identity and only then
 * authenticates (AGENTS.md → Login Flow). These tests drive the application
 * service the route handler calls, with a throwaway client standing in for
 * the cookie-writing one a real request carries.
 */
function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket as never },
    }
  ) as unknown as SupabaseClient<Database>;
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((error: AppError) => expect(error.code).toBe(code));
}

describeIntegration("Authentication & session", () => {
  const ctx = setupIntegrationContext("auth-session");

  it("signs a user in by username, never by email", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-signin-org`);
    const user = await ctx.createUser(organization.id, "ORG_ADMIN", "signin");
    const client = anonClient();

    await authenticate(ctx.admin, client, { username: user.username, password });

    const { data } = await client.auth.getUser();
    expect(data.user?.id).toBe(user.id);
  });

  it("refuses an unknown username without reaching the auth provider", async () => {
    await expectAppError(
      authenticate(ctx.admin, anonClient(), {
        username: `${ctx.runId}-nobody`,
        password,
      }),
      ErrorCodes.INVALID_CREDENTIALS
    );
  });

  it("refuses a wrong password with the same answer as an unknown user", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-wrongpw-org`);
    const user = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "wrongpw");

    await expectAppError(
      authenticate(ctx.admin, anonClient(), {
        username: user.username,
        password: "NotTheRightOne1!",
      }),
      ErrorCodes.INVALID_CREDENTIALS
    );
  });

  it("leaves no session behind when the profile is deactivated", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-inactive-org`);
    const user = await ctx.createUser(organization.id, "ORG_PHYSIOTHERAPIST", "inactive");
    await ctx.admin.from("users").update({ is_active: false }).eq("id", user.id);
    const client = anonClient();

    await expectAppError(
      authenticate(ctx.admin, client, { username: user.username, password }),
      ErrorCodes.ACCOUNT_INACTIVE
    );

    // The credentials were valid, so Supabase issued a session. It must not
    // survive the profile check.
    const { data } = await client.auth.getSession();
    expect(data.session).toBeNull();
  });

  it("refuses an off-boarded user", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-offboarded-org`);
    const user = await ctx.createUser(organization.id, "ORG_RECEPTIONIST", "offboarded");
    await ctx.admin
      .from("users")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", user.id);

    await expectAppError(
      authenticate(ctx.admin, anonClient(), { username: user.username, password }),
      ErrorCodes.ACCOUNT_INACTIVE
    );
  });

  it("lands each role in its own namespace", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-landing-org`);

    const cases = [
      ["ORG_OWNER", "owner-landing", "/app"],
      ["ORG_ADMIN", "admin-landing", "/app"],
      ["ORG_PHYSIOTHERAPIST", "physio-landing", "/app"],
      ["ORG_RECEPTIONIST", "reception-landing", "/app"],
    ] as const;

    for (const [role, suffix, home] of cases) {
      const user = await ctx.createUser(organization.id, role, suffix);
      const client = anonClient();

      await authenticate(ctx.admin, client, { username: user.username, password });

      expect(resolveLanding(await getCurrentUser(ctx.admin, user.id))).toBe(home);
    }

    const superAdmin = await ctx.createUser(null, "SUPER_ADMIN", "sa-landing");
    const client = anonClient();
    await authenticate(ctx.admin, client, {
      username: superAdmin.username,
      password,
    });

    expect(resolveLanding(await getCurrentUser(ctx.admin, superAdmin.id))).toBe(
      "/platform/admin"
    );
  });

  it("ends a session without complaining when there is none", async () => {
    await expect(endSession(anonClient())).resolves.toBeUndefined();
  });

  it("answers a reset request the same way whoever it is for", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-reset-org`);
    const active = await ctx.createUser(organization.id, "ORG_OWNER", "reset-active");
    const inactive = await ctx.createUser(organization.id, "ORG_ADMIN", "reset-inactive");
    await ctx.admin.from("users").update({ is_active: false }).eq("id", inactive.id);

    // Known, inactive, and entirely unknown identifiers are indistinguishable
    // to the caller: the workflow never reports what it found.
    await expect(
      requestPasswordReset(ctx.admin, anonClient(), { username: active.username })
    ).resolves.toBeUndefined();
    await expect(
      requestPasswordReset(ctx.admin, anonClient(), { username: inactive.username })
    ).resolves.toBeUndefined();
    await expect(
      requestPasswordReset(ctx.admin, anonClient(), {
        username: `${ctx.runId}-no-such-user`,
      })
    ).resolves.toBeUndefined();
  });

  it("sets a new password on a live session and retires the old one", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-setpw-org`);
    const user = await ctx.createUser(organization.id, "ORG_ADMIN", "setpw");
    const client = anonClient();
    await authenticate(ctx.admin, client, { username: user.username, password });

    await setPassword(client, { newPassword: "BrandNewPass1!" });

    await expectAppError(
      authenticate(ctx.admin, anonClient(), { username: user.username, password }),
      ErrorCodes.INVALID_CREDENTIALS
    );
    await expect(
      authenticate(ctx.admin, anonClient(), {
        username: user.username,
        password: "BrandNewPass1!",
      })
    ).resolves.toBeUndefined();
  });

  it("changes a password for a user who proves they know the current one", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-changepw-org`);
    const user = await ctx.createUser(organization.id, "ORG_OWNER", "changepw");
    const client = anonClient();
    await authenticate(ctx.admin, client, { username: user.username, password });

    await changePassword(client, user.email, {
      currentPassword: password,
      newPassword: "ChangedPass1!",
    });

    // Verifying the current password must not have disturbed the session the
    // caller is holding.
    const { data } = await client.auth.getUser();
    expect(data.user?.id).toBe(user.id);

    await expect(
      authenticate(ctx.admin, anonClient(), {
        username: user.username,
        password: "ChangedPass1!",
      })
    ).resolves.toBeUndefined();
  });

  it("leaves the password alone when the current one is wrong", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-badcurrent-org`);
    const user = await ctx.createUser(organization.id, "ORG_ADMIN", "badcurrent");
    const client = anonClient();
    await authenticate(ctx.admin, client, { username: user.username, password });

    await expectAppError(
      changePassword(client, user.email, {
        currentPassword: "NotMyPassword1!",
        newPassword: "ChangedPass1!",
      }),
      ErrorCodes.INVALID_CURRENT_PASSWORD
    );

    // The original password still works, so nothing was changed on the way.
    await expect(
      authenticate(ctx.admin, anonClient(), { username: user.username, password })
    ).resolves.toBeUndefined();
  });

  it("refuses a new password identical to the current one", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-samepw-org`);
    const user = await ctx.createUser(organization.id, "ORG_ADMIN", "samepw");
    const client = anonClient();
    await authenticate(ctx.admin, client, { username: user.username, password });

    await expect(
      changePassword(client, user.email, {
        currentPassword: password,
        newPassword: password,
      })
    ).rejects.toThrow();
  });

  it("refuses a new password that breaks the policy", async () => {
    const organization = await ctx.createOrganization(`${ctx.runId}-weakpw-org`);
    const user = await ctx.createUser(organization.id, "ORG_ADMIN", "weakpw");
    const client = anonClient();
    await authenticate(ctx.admin, client, { username: user.username, password });

    await expect(setPassword(client, { newPassword: "weak" })).rejects.toThrow();
  });
});

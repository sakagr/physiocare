import { describe, expect, it } from "vitest";
import {
  guardNamespace,
  resolveLanding,
  LOGIN_PATH,
  ORG_HOME_PATH,
  PLATFORM_HOME_PATH,
} from "@/lib/auth/landing";
import { currentUserFixtures } from "../helpers/current-user";

/**
 * The landing resolver and namespace guard are pure functions over a
 * `CurrentUser`, so the whole redirect matrix is provable here — no Supabase,
 * no cookies, no rendering. The route-group layouts are the only place that
 * turns these answers into a `redirect()` (UX.md → Landing resolution).
 */
describe("resolveLanding", () => {
  it("sends an unauthenticated visitor to sign in", () => {
    expect(resolveLanding(null)).toBe(LOGIN_PATH);
  });

  it("sends a platform user to the platform console", () => {
    expect(resolveLanding(currentUserFixtures.superAdmin())).toBe(
      PLATFORM_HOME_PATH
    );
  });

  it("sends every organization role to the dashboard", () => {
    // The dashboard is role-aware, so it is the single org landing target.
    for (const fixture of [
      currentUserFixtures.owner(),
      currentUserFixtures.admin(),
      currentUserFixtures.physiotherapist(),
      currentUserFixtures.receptionist(),
    ]) {
      expect(resolveLanding(fixture)).toBe(ORG_HOME_PATH);
    }
  });
});

describe("guardNamespace", () => {
  it("admits a user to their own namespace", () => {
    expect(guardNamespace("org", currentUserFixtures.owner())).toBeNull();
    expect(
      guardNamespace("platform", currentUserFixtures.superAdmin())
    ).toBeNull();
  });

  it("bounces an organization user out of the platform namespace", () => {
    expect(guardNamespace("platform", currentUserFixtures.owner())).toBe(
      ORG_HOME_PATH
    );
  });

  it("bounces a platform user out of the organization namespace", () => {
    expect(guardNamespace("org", currentUserFixtures.superAdmin())).toBe(
      PLATFORM_HOME_PATH
    );
  });

  it("sends an unauthenticated visitor to sign in from either namespace", () => {
    expect(guardNamespace("org", null)).toBe(LOGIN_PATH);
    expect(guardNamespace("platform", null)).toBe(LOGIN_PATH);
  });
});

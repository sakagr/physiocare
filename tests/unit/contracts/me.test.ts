import { describe, expect, it } from "vitest";
import { CAPABILITIES, currentUserSchema } from "@/contracts/me.contract";
import type { CurrentUser } from "@/types/contracts/me";

/**
 * The current-user response contract (`GET /api/users/me`). This is the
 * single source ADR-0003 named as the seam F2 replaces: `CAPABILITIES` and
 * `currentUserSchema` live here, and `src/types/contracts/me.ts` re-exports
 * their inferred types rather than hand-authoring a parallel shape
 * (F2, ADR-0008) -- so no consumer of that module changes.
 */
describe("currentUserSchema", () => {
  it("parses an organization user fixture", () => {
    const fixture: CurrentUser = {
      id: "user-1",
      username: "owner",
      email: "owner@example.test",
      fullName: "Owner Owner",
      phone: null,
      role: { name: "ORG_OWNER", displayName: "Owner" },
      group: "org",
      organization: { id: "org-1", name: "Test Org" },
      capabilities: ["patients:view", "users:manage"],
      clinics: [{ id: "clinic-1", name: "North" }],
    };

    expect(currentUserSchema.parse(fixture)).toEqual(fixture);
  });

  it("parses a platform user fixture with a null organization and empty clinics", () => {
    const fixture: CurrentUser = {
      id: "user-2",
      username: "super",
      email: "super@example.test",
      fullName: "Sam Super",
      phone: null,
      role: { name: "SUPER_ADMIN", displayName: "Super Admin" },
      group: "platform",
      organization: null,
      capabilities: ["platformApi:explore"],
      clinics: [],
    };

    expect(currentUserSchema.parse(fixture)).toEqual(fixture);
  });

  it("allows a null phone", () => {
    const fixture: CurrentUser = {
      id: "user-3",
      username: "reception",
      email: "reception@example.test",
      fullName: "Raj Reception",
      phone: "+1-555-0100",
      role: { name: "ORG_RECEPTIONIST", displayName: "Receptionist" },
      group: "org",
      organization: { id: "org-1", name: "Test Org" },
      capabilities: [],
      clinics: [],
    };

    expect(currentUserSchema.parse(fixture)).toEqual(fixture);
  });

  it("rejects a capability token outside the contract vocabulary", () => {
    const fixture = {
      id: "user-4",
      username: "x",
      email: "x@example.test",
      fullName: "X",
      phone: null,
      role: { name: "ORG_OWNER", displayName: "Owner" },
      group: "org",
      organization: null,
      capabilities: ["not:a:real:token"],
      clinics: [],
    };

    expect(() => currentUserSchema.parse(fixture)).toThrow();
  });

  it("rejects a group outside platform/org", () => {
    const fixture = {
      id: "user-5",
      username: "x",
      email: "x@example.test",
      fullName: "X",
      phone: null,
      role: { name: "ORG_OWNER", displayName: "Owner" },
      group: "admin",
      organization: null,
      capabilities: [],
      clinics: [],
    };

    expect(() => currentUserSchema.parse(fixture)).toThrow();
  });
});

describe("CAPABILITIES", () => {
  it("includes the platform API explorer token", () => {
    expect(CAPABILITIES).toContain("platformApi:explore");
  });
});

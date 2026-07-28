import { describe, expect, it } from "vitest";
import {
  clinicUsersResponseSchema,
  createOrganizationUserResultSchema,
  userCompensationSchema,
  userListResponseSchema,
  userSchema,
  userWithRoleSchema,
} from "@/contracts/user.contract";

/**
 * Response contracts for the Users domain (F2, M8/R2). Fixtures mirror
 * `src/server/repositories/user.repository.ts` → `User`/`Role` (the
 * `users`/`roles` table rows) and the service-level result types they
 * compose into.
 */
const userFixture = {
  id: "user-1",
  organization_id: "org-1",
  full_name: "Ada Admin",
  email: "ada@example.test",
  username: "ada",
  phone: null,
  role_id: "role-1",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

const roleFixture = {
  id: "role-1",
  name: "ORG_ADMIN",
  display_name: "Administrator",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("userSchema", () => {
  it("parses a user row", () => {
    expect(userSchema.parse(userFixture)).toEqual(userFixture);
  });
});

describe("userWithRoleSchema", () => {
  it("parses a user with its embedded role (GET /api/users/{id}, activate, deactivate, change-role)", () => {
    const fixture = { ...userFixture, role: roleFixture };
    expect(userWithRoleSchema.parse(fixture)).toEqual(fixture);
  });
});

describe("userListResponseSchema", () => {
  it("parses the paginated user-with-role list (GET /api/users)", () => {
    const fixture = { items: [{ ...userFixture, role: roleFixture }], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(userListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});

describe("clinicUsersResponseSchema", () => {
  it("parses a bare array of users (GET /api/clinics/{id}/users)", () => {
    expect(clinicUsersResponseSchema.parse([userFixture])).toEqual([userFixture]);
  });
});

describe("createOrganizationUserResultSchema", () => {
  it("parses the reveal-once initial password result (POST /api/users)", () => {
    const fixture = { userId: "user-2", username: "new.user", initialPassword: "Xk9!mPz2" };
    expect(createOrganizationUserResultSchema.parse(fixture)).toEqual(fixture);
  });

  it("allows initialPassword to be absent", () => {
    const fixture = { userId: "user-2", username: "new.user" };
    expect(createOrganizationUserResultSchema.parse(fixture)).toEqual(fixture);
  });
});

describe("userCompensationSchema", () => {
  it("parses a compensation record (POST /api/users/{id}/compensation)", () => {
    const fixture = {
      id: "comp-1",
      organization_id: "org-1",
      user_id: "user-1",
      type: "percentage",
      value: 20,
      effective_from: "2026-01-01",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      created_by: "user-owner",
    };
    expect(userCompensationSchema.parse(fixture)).toEqual(fixture);
  });
});

import { describe, expect, it } from "vitest";
import { generateInitialPassword } from "@/server/services/auth.service";
import { canManageRole } from "@/server/services/authorization.service";

describe("generateInitialPassword", () => {
  it("generates 16-character passwords meeting every policy requirement", () => {
    const passwords = Array.from({ length: 20 }, () => generateInitialPassword());

    for (const password of passwords) {
      expect(password).toHaveLength(16);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/);
    }
    expect(new Set(passwords).size).toBeGreaterThan(1);
  });
});

describe("role hierarchy", () => {
  it("allows an owner to manage all organization roles", () => {
    for (const role of ["ORG_OWNER", "ORG_ADMIN", "ORG_PHYSIOTHERAPIST", "ORG_RECEPTIONIST", "ORG_ACCOUNTANT"] as const) {
      expect(canManageRole("ORG_OWNER", role)).toBe(true);
    }
  });

  it("allows an administrator to manage employee roles only", () => {
    expect(canManageRole("ORG_ADMIN", "ORG_PHYSIOTHERAPIST")).toBe(true);
    expect(canManageRole("ORG_ADMIN", "ORG_RECEPTIONIST")).toBe(true);
    expect(canManageRole("ORG_ADMIN", "ORG_ACCOUNTANT")).toBe(true);
    expect(canManageRole("ORG_ADMIN", "ORG_OWNER")).toBe(false);
    expect(canManageRole("ORG_ADMIN", "ORG_ADMIN")).toBe(false);
  });

  it("prevents employees and platform support roles from managing organization users", () => {
    for (const caller of ["ORG_PHYSIOTHERAPIST", "ORG_RECEPTIONIST", "ORG_ACCOUNTANT", "PLATFORM_SUPPORT", "PLATFORM_SALES", "PLATFORM_BILLING"] as const) {
      expect(canManageRole(caller, "ORG_PHYSIOTHERAPIST")).toBe(false);
    }
  });
});

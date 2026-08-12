import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUserById: vi.fn(),
  findRoleById: vi.fn(),
}));

vi.mock("@/server/repositories/user.repository", () => ({
  findUserById: mocks.findUserById,
  findRoleById: mocks.findRoleById,
}));

import {
  canRecordOwnAttendance,
  canManageAttendance,
  canManagePatients,
  canManageAppointments,
  canManagePatientPackages,
  canManageInvoices,
  canManagePayments,
} from "@/server/services/authorization.service";

type Predicate = (supabase: never, callerUserId: string) => Promise<boolean>;

function mockCallerRole(role: string | null) {
  if (role === null) {
    mocks.findUserById.mockResolvedValue(null);
    return;
  }
  mocks.findUserById.mockResolvedValue({ id: "caller-1", role_id: "role-1", organization_id: "org-1" });
  mocks.findRoleById.mockResolvedValue({ id: "role-1", name: role });
}

describe("canRecordOwnAttendance", () => {
  it.each([
    ["ORG_OWNER", true],
    ["ORG_ADMIN", true],
    ["SUPER_ADMIN", true],
    ["ORG_PHYSIOTHERAPIST", true],
    ["ORG_RECEPTIONIST", false],
  ] as const)("role=%s -> %s", async (role, expected) => {
    mockCallerRole(role);
    expect(await canRecordOwnAttendance({} as never, "caller-1")).toBe(expected);
  });

  it("returns false for an unknown user", async () => {
    mockCallerRole(null);
    expect(await canRecordOwnAttendance({} as never, "missing")).toBe(false);
  });
});

/**
 * `ORG_FRONT_DESK_ROLES` is a private module constant read by six predicates
 * across five domains (AGENTS.md -> Project Decisions, D-A1). It cannot be
 * imported directly, so its membership is pinned through its consumers:
 * `canManageAttendance` here (T-1.2), the remaining five in the next block
 * (T-1.3) -- together proving the refactor changed no predicate's behaviour.
 */
const FRONT_DESK_EXPECTATIONS = [
  ["ORG_OWNER", true],
  ["ORG_ADMIN", true],
  ["ORG_RECEPTIONIST", true],
  ["SUPER_ADMIN", true],
  ["ORG_PHYSIOTHERAPIST", false],
] as const;

async function expectFrontDeskMembership(predicate: Predicate) {
  for (const [role, expected] of FRONT_DESK_EXPECTATIONS) {
    mockCallerRole(role);
    expect(await predicate({} as never, "caller-1")).toBe(expected);
  }
}

describe("ORG_FRONT_DESK_ROLES membership (via canManageAttendance)", () => {
  it("admits exactly Owner, Admin, Receptionist and SUPER_ADMIN", async () => {
    await expectFrontDeskMembership(canManageAttendance);
  });
});

describe("ORG_FRONT_DESK_ROLES consumers unaffected by the refactor", () => {
  it.each([
    ["canManagePatients", canManagePatients],
    ["canManageAppointments", canManageAppointments],
    ["canManagePatientPackages", canManagePatientPackages],
    ["canManageInvoices", canManageInvoices],
    ["canManagePayments", canManagePayments],
  ] as const)("%s admits exactly Owner, Admin, Receptionist and SUPER_ADMIN", async (_name, predicate) => {
    await expectFrontDeskMembership(predicate as Predicate);
  });
});

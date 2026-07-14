import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  createAuthUser: vi.fn(),
  findUserById: vi.fn(),
  updateUser: vi.fn(),
  canManageTargetUser: vi.fn(),
  canOrganizationTransact: vi.fn(),
  canCreateUserWithinLimit: vi.fn(),
  setUserDisabled: vi.fn(),
  setUserEnabled: vi.fn(),
  ensureUsernameAvailable: vi.fn(),
  ensureEmailAvailable: vi.fn(),
  createOrganizationUserProfile: vi.fn(),
}));

vi.mock("@/server/services/auth.service", () => ({
  deleteUser: mocks.deleteUser,
  createAuthUser: mocks.createAuthUser,
  generateInitialPassword: vi.fn(() => "Abcdefgh1!234567"),
  setUserDisabled: mocks.setUserDisabled,
  setUserEnabled: mocks.setUserEnabled,
  inviteUser: vi.fn(),
}));
vi.mock("@/server/services/user.service", () => ({
  ensureUsernameAvailable: mocks.ensureUsernameAvailable,
  ensureEmailAvailable: mocks.ensureEmailAvailable,
  createOrganizationUserProfile: mocks.createOrganizationUserProfile,
  createOrganizationOwner: vi.fn(),
}));
vi.mock("@/server/repositories/user.repository", () => ({
  findUserById: mocks.findUserById,
  updateUser: mocks.updateUser,
  findRoleByName: vi.fn(),
}));
vi.mock("@/server/services/authorization.service", () => ({
  canManageTargetUser: mocks.canManageTargetUser,
  canUpdateUserRole: vi.fn(),
  canManageClinics: vi.fn(),
  canAssignUserToClinic: vi.fn(),
  canOrganizationTransact: mocks.canOrganizationTransact,
  canCreateUserWithinLimit: mocks.canCreateUserWithinLimit,
}));
vi.mock("@/server/repositories/organization.repository", () => ({
  findOrganizationByName: vi.fn(),
  insertOrganization: vi.fn(),
  updateOrganizationCreatedBy: vi.fn(),
  updateOrganizationStatus: vi.fn(),
}));
vi.mock("@/server/repositories/clinic.repository", () => ({
  findClinicByNameInOrg: vi.fn(),
  findClinicById: vi.fn(),
}));
vi.mock("@/server/services/clinic.service", () => ({ createClinicInternal: vi.fn(), updateClinicInternal: vi.fn() }));
vi.mock("@/server/services/user-clinic.service", () => ({ upsertAssignmentInternal: vi.fn(), deleteAssignmentInternal: vi.fn() }));

import { activateUser, createOrganizationUser, deactivateUser, offboardUser } from "@/server/services/organization.service";
import { validOrganizationUserInput } from "../helpers/factories";

const supabase = {} as never;
const adminClient = {} as never;

function createSupabaseWithUserClinicsChain() {
  const chain = {
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return { from: vi.fn(() => chain) } as never;
}

describe("organization command compensation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUserById.mockResolvedValue({ id: "target-user", organization_id: "org-id" });
    mocks.canManageTargetUser.mockResolvedValue(true);
    mocks.canOrganizationTransact.mockResolvedValue(true);
    mocks.canCreateUserWithinLimit.mockResolvedValue(true);
    mocks.createAuthUser.mockResolvedValue({ id: "auth-user" });
  });

  it("removes an Auth user when application profile creation fails", async () => {
    mocks.createOrganizationUserProfile.mockRejectedValue(new Error("database unavailable"));

    await expect(createOrganizationUser(supabase, adminClient, "creator-id", validOrganizationUserInput())).rejects.toThrow("database unavailable");

    expect(mocks.deleteUser).toHaveBeenCalledWith(adminClient, "auth-user");
  });

  it("disables Auth again when activation cannot be persisted", async () => {
    mocks.updateUser.mockRejectedValue(new Error("database unavailable"));

    await expect(activateUser(supabase, adminClient, "caller-id", "target-user")).rejects.toThrow("database unavailable");

    expect(mocks.setUserEnabled).toHaveBeenCalledWith(adminClient, "target-user");
    expect(mocks.setUserDisabled).toHaveBeenCalledWith(adminClient, "target-user");
  });

  it("re-enables Auth when deactivation cannot be persisted", async () => {
    mocks.updateUser.mockRejectedValue(new Error("database unavailable"));

    await expect(deactivateUser(supabase, adminClient, "caller-id", "target-user")).rejects.toThrow("database unavailable");

    expect(mocks.setUserDisabled).toHaveBeenCalledWith(adminClient, "target-user");
    expect(mocks.setUserEnabled).toHaveBeenCalledWith(adminClient, "target-user");
  });

  it("off-boards a user by disabling Auth and soft-deleting the profile, without deleting the Auth identity", async () => {
    const offboardedUser = { id: "target-user", organization_id: "org-id", is_active: false, deleted_at: "2026-07-13T00:00:00.000Z" };
    mocks.updateUser.mockResolvedValue(offboardedUser);
    const offboardSupabase = createSupabaseWithUserClinicsChain();

    const result = await offboardUser(offboardSupabase, adminClient, "caller-id", "target-user");

    expect(result).toBe(offboardedUser);
    expect(mocks.setUserDisabled).toHaveBeenCalledWith(adminClient, "target-user");
    expect(mocks.updateUser).toHaveBeenCalledWith(offboardSupabase, "target-user", expect.objectContaining({ is_active: false, deleted_at: expect.any(String) }));
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.setUserEnabled).not.toHaveBeenCalled();
  });

  it("re-enables Auth when the off-boarding soft-delete cannot be persisted", async () => {
    mocks.updateUser.mockRejectedValue(new Error("database unavailable"));

    await expect(offboardUser(createSupabaseWithUserClinicsChain(), adminClient, "caller-id", "target-user")).rejects.toThrow("database unavailable");

    expect(mocks.setUserDisabled).toHaveBeenCalledWith(adminClient, "target-user");
    expect(mocks.setUserEnabled).toHaveBeenCalledWith(adminClient, "target-user");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});

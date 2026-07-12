import { describe, expect, it } from "vitest";
import { validClinicInput, validOrganizationInput, validOrganizationUserInput } from "../helpers/factories";
import { validateCreateClinicInput, validateUpdateClinicInput } from "@/server/validators/clinic.validator";
import { validateCreateOrganizationInput } from "@/server/validators/organization.validator";
import { getPaginationBounds, sharedListQuerySchema } from "@/server/validators/shared.validator";
import { validateAssignUserClinicInput } from "@/server/validators/user-clinic.validator";
import {
  validateChangeUserRoleInput,
  validateCreateOrganizationUserInput,
  validateUpdateUserProfileInput,
} from "@/server/validators/user.validator";

describe("organization validator", () => {
  it("normalizes the administrator email and username", () => {
    const input = validateCreateOrganizationInput({
      ...validOrganizationInput(),
      adminEmail: "OWNER@EXAMPLE.TEST",
      adminUsername: "Owner.Admin",
    });

    expect(input).toMatchObject({ adminEmail: "owner@example.test", adminUsername: "owner.admin" });
  });

  it("rejects missing, malformed, and undersized organization input", () => {
    expect(() => validateCreateOrganizationInput({})).toThrow();
    expect(() => validateCreateOrganizationInput({ ...validOrganizationInput(), adminEmail: "not-an-email" })).toThrow();
    expect(() => validateCreateOrganizationInput({ ...validOrganizationInput(), organizationName: "x" })).toThrow();
  });
});

describe("user validators", () => {
  it("normalizes valid organization user input", () => {
    expect(validateCreateOrganizationUserInput({
      ...validOrganizationUserInput(),
      username: "Physio.User",
      email: "PHYSIO@EXAMPLE.TEST",
    })).toMatchObject({ username: "physio.user", email: "physio@example.test" });
  });

  it("rejects platform roles, malformed usernames, and invalid role changes", () => {
    expect(() => validateCreateOrganizationUserInput({ ...validOrganizationUserInput(), role: "SUPER_ADMIN" })).toThrow();
    expect(() => validateCreateOrganizationUserInput({ ...validOrganizationUserInput(), username: "not valid" })).toThrow();
    expect(() => validateChangeUserRoleInput({ role: "PLATFORM_SUPPORT" })).toThrow();
  });

  it("accepts only valid editable profile fields", () => {
    expect(validateUpdateUserProfileInput({ fullName: " Updated Name ", phone: " " })).toEqual({ fullName: "Updated Name", phone: "" });
    expect(() => validateUpdateUserProfileInput({ fullName: "x" })).toThrow();
  });
});

describe("clinic and assignment validators", () => {
  it("normalizes valid clinic input and permits partial updates", () => {
    expect(validateCreateClinicInput({ ...validClinicInput(), email: " CLINIC@EXAMPLE.TEST " }).email).toBe("clinic@example.test");
    expect(validateUpdateClinicInput({ city: " Pune " })).toEqual({ city: "Pune" });
  });

  it("rejects invalid clinic data and assignment UUIDs", () => {
    expect(() => validateCreateClinicInput({ ...validClinicInput(), clinicName: "x" })).toThrow();
    expect(() => validateCreateClinicInput({ ...validClinicInput(), email: "bad" })).toThrow();
    expect(() => validateAssignUserClinicInput({ userId: "invalid", clinicId: "invalid" })).toThrow();
  });
});

describe("list query validation", () => {
  it("applies pagination defaults and accepts supported filters", () => {
    expect(sharedListQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
    expect(sharedListQuerySchema.parse({ page: "2", limit: "25", isActive: "false", search: "physio" }))
      .toEqual({ page: 2, limit: 25, isActive: false, search: "physio" });
  });

  it("rejects invalid pagination values and calculates query bounds", () => {
    expect(() => sharedListQuerySchema.parse({ page: "0" })).toThrow();
    expect(() => sharedListQuerySchema.parse({ limit: "101" })).toThrow();
    expect(getPaginationBounds(3, 20)).toEqual({ from: 40, to: 59 });
  });
});

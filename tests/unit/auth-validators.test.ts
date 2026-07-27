import { describe, expect, it } from "vitest";
import {
  validateChangePasswordInput,
  validateLoginInput,
  validateRequestPasswordResetInput,
  validateSetPasswordInput,
} from "@/server/validators/auth.validator";

describe("validateLoginInput", () => {
  it("normalizes the username the way the identity model stores it", () => {
    const input = validateLoginInput({
      username: "  Dr.Menon  ",
      password: "whatever",
    });

    expect(input.username).toBe("dr.menon");
  });

  it("rejects a missing identifier or password", () => {
    expect(() => validateLoginInput({ username: "", password: "x" })).toThrow();
    expect(() => validateLoginInput({ username: "someone", password: "" })).toThrow();
    expect(() => validateLoginInput({})).toThrow();
  });

  it("does not impose the password policy on sign-in", () => {
    // Organization users are created with a system-generated password and are
    // not required to change it, and the policy may evolve. Enforcing it here
    // would lock out valid accounts and leak the policy to anyone probing.
    expect(() =>
      validateLoginInput({ username: "someone", password: "short" })
    ).not.toThrow();
  });
});

describe("validateRequestPasswordResetInput", () => {
  it("takes the username, the application's login identifier", () => {
    const input = validateRequestPasswordResetInput({ username: "Owner_01" });

    expect(input.username).toBe("owner_01");
  });

  it("rejects an empty identifier", () => {
    expect(() => validateRequestPasswordResetInput({ username: "  " })).toThrow();
  });
});

describe("validateSetPasswordInput", () => {
  it("enforces every user-defined password requirement", () => {
    const rejected = [
      "Short1!",          // under 8 characters
      "alllowercase1!",   // no uppercase
      "ALLUPPERCASE1!",   // no lowercase
      "NoDigitsHere!",    // no number
      "NoSpecials123",    // no special character
    ];

    for (const newPassword of rejected) {
      expect(() => validateSetPasswordInput({ newPassword })).toThrow();
    }

    expect(validateSetPasswordInput({ newPassword: "ValidPass1!" }).newPassword).toBe(
      "ValidPass1!"
    );
  });
});

describe("validateChangePasswordInput", () => {
  it("requires the current password alongside the new one", () => {
    expect(() =>
      validateChangePasswordInput({ currentPassword: "", newPassword: "ValidPass1!" })
    ).toThrow();
  });

  it("refuses a new password identical to the current one", () => {
    expect(() =>
      validateChangePasswordInput({
        currentPassword: "ValidPass1!",
        newPassword: "ValidPass1!",
      })
    ).toThrow();
  });

  it("accepts a policy-compliant change", () => {
    const input = validateChangePasswordInput({
      currentPassword: "OldPass1!",
      newPassword: "NewPass1!",
    });

    expect(input).toEqual({ currentPassword: "OldPass1!", newPassword: "NewPass1!" });
  });
});

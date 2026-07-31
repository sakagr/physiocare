import { describe, expect, it, vi } from "vitest";
import { applyFieldErrors } from "@/lib/api/apply-field-errors";
import { ApiError } from "@/lib/api/api-error";

/**
 * Generalizes the single hand-written field-error `if` that predates F3
 * (`change-password-dialog.tsx`) across two shapes: a form-specific
 * AppError code -> field mapping, and a 400's generic Zod `details` issues.
 */
describe("applyFieldErrors", () => {
  it("maps a known code onto its caller-supplied field", () => {
    const setError = vi.fn();
    const error = new ApiError("This email is already in use.", 409, "EMAIL_ALREADY_EXISTS");

    const applied = applyFieldErrors(error, setError, { EMAIL_ALREADY_EXISTS: "email" });

    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledWith("email", { message: "This email is already in use." });
  });

  it("maps every Zod issue in details onto its field", () => {
    const setError = vi.fn();
    const error = new ApiError("Invalid request payload", 400, undefined, [
      { path: ["username"], message: "Username is required" },
      { path: ["phone"], message: "Invalid phone number" },
    ]);

    const applied = applyFieldErrors(error, setError);

    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledWith("username", { message: "Username is required" });
    expect(setError).toHaveBeenCalledWith("phone", { message: "Invalid phone number" });
  });

  it("prefers the code map over details when both are present", () => {
    const setError = vi.fn();
    const error = new ApiError("Username taken", 409, "USERNAME_ALREADY_EXISTS", [
      { path: ["username"], message: "Should not be used" },
    ]);

    applyFieldErrors(error, setError, { USERNAME_ALREADY_EXISTS: "username" });

    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith("username", { message: "Username taken" });
  });

  it("returns false and sets nothing for a code with no mapping and no details", () => {
    const setError = vi.fn();
    const error = new ApiError("Forbidden", 403, "FORBIDDEN");

    expect(applyFieldErrors(error, setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("returns false for a non-ApiError", () => {
    const setError = vi.fn();

    expect(applyFieldErrors(new Error("boom"), setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});

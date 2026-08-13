import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/api-error";
import { ERROR_BEHAVIORS } from "@/lib/api/error-codes";
import { RESYNC_ERROR_CODES, isResyncError, resyncOnConflict } from "@/features/appointments";

/**
 * `UX.md`'s *blocking message + resync* treatment is two halves. The message
 * half already exists in `ERROR_BEHAVIORS`; the resync half is this
 * per-call-site invalidation. `ERROR_BEHAVIORS` is deliberately not touched.
 */
function apiError(code: string) {
  return new ApiError("conflict", 409, code);
}

describe("resync on conflict", () => {
  it("recognises every code UX.md assigns to blocking message + resync", () => {
    expect(RESYNC_ERROR_CODES).toEqual([
      "INVALID_APPOINTMENT_STATUS_TRANSITION",
      "PACKAGE_SESSIONS_EXHAUSTED",
      "PACKAGE_EXPIRED",
      "PACKAGE_CANCELLED",
      "PACKAGE_SESSION_ALREADY_RECORDED",
      "CONSULTATION_ALREADY_EXISTS",
      "ATTENDANCE_ALREADY_RECORDED",
      "ATTENDANCE_CHECK_IN_REQUIRED",
      "PHYSIOTHERAPIST_UNAVAILABLE",
    ]);
  });

  it("leaves each of those codes on its existing toast behaviour", () => {
    // The resync half is additive. If this fails, someone has changed
    // ERROR_BEHAVIORS, which F6 is explicitly not meant to do -- the message
    // and its treatment stay in the one place they already live.
    for (const code of RESYNC_ERROR_CODES) {
      expect(ERROR_BEHAVIORS[code].behavior).toBe("toast");
      expect(ERROR_BEHAVIORS[code].message.length).toBeGreaterThan(0);
    }
  });

  it("invalidates the given queries for a conflict code", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    resyncOnConflict(queryClient, apiError("INVALID_APPOINTMENT_STATUS_TRANSITION"), [
      ["appointments"],
      ["patients", "detail", "p1"],
    ]);

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["appointments"] });
  });

  it("leaves unrelated failures alone", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    // A dependency-blocked code: the record in view has not moved, so there
    // is nothing to resync. A subscription failure is the limit-enforcement
    // treatment, not this one. A network error is not an ApiError at all.
    resyncOnConflict(queryClient, apiError("PATIENT_HAS_DEPENDENT_RECORDS"), [["appointments"]]);
    resyncOnConflict(queryClient, apiError("SUBSCRIPTION_REQUIRED"), [["appointments"]]);
    resyncOnConflict(queryClient, new Error("offline"), [["appointments"]]);

    expect(invalidate).not.toHaveBeenCalled();
    expect(isResyncError(new Error("offline"))).toBe(false);
  });
});

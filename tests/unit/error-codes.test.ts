import { describe, expect, it } from "vitest";
import { ApiError, TransportErrorCodes } from "@/lib/api/api-error";
import { ERROR_BEHAVIORS, resolveErrorBehavior } from "@/lib/api/error-codes";
import { ErrorCodes } from "@/server/errors";

describe("error-code behavior map", () => {
  it("covers every backend error code", () => {
    for (const code of Object.values(ErrorCodes)) {
      expect(ERROR_BEHAVIORS[code]).toBeDefined();
      expect(ERROR_BEHAVIORS[code].message).not.toMatch(/^[A-Z_]+$/); // never a raw code
    }
  });

  it("maps a known application code to its configured behavior", () => {
    const behavior = resolveErrorBehavior(
      new ApiError("This username is already taken.", 409, ErrorCodes.USERNAME_ALREADY_EXISTS)
    );
    expect(behavior.behavior).toBe("inline");
  });

  it("routes FORBIDDEN to the forbidden treatment", () => {
    const behavior = resolveErrorBehavior(new ApiError("Forbidden", 403, ErrorCodes.FORBIDDEN));
    expect(behavior.behavior).toBe("forbidden");
  });

  it("routes an expired session to a login redirect", () => {
    const behavior = resolveErrorBehavior(
      new ApiError("Unauthorized", 401, TransportErrorCodes.UNAUTHENTICATED)
    );
    expect(behavior.behavior).toBe("redirectLogin");
  });

  it("routes a codeless 401 to a login redirect", () => {
    expect(resolveErrorBehavior(new ApiError("Unauthorized", 401)).behavior).toBe(
      "redirectLogin"
    );
  });

  it("presents a failed sign-in inline rather than as an expired session", () => {
    // A bad password is also a 401. Consulting the code map first is what stops
    // it presenting as "your session expired" (AGENTS.md → Error Handling).
    const behavior = resolveErrorBehavior(
      new ApiError("Wrong credentials", 401, ErrorCodes.INVALID_CREDENTIALS)
    );
    expect(behavior.behavior).toBe("inline");
  });

  it("presents an expired password-setup link inline", () => {
    const behavior = resolveErrorBehavior(
      new ApiError("Expired", 401, ErrorCodes.PASSWORD_SETUP_SESSION_INVALID)
    );
    expect(behavior.behavior).toBe("inline");
  });

  it("maps a wrong current password onto the form rather than to sign-in", () => {
    const behavior = resolveErrorBehavior(
      new ApiError("Wrong password", 400, ErrorCodes.INVALID_CURRENT_PASSWORD)
    );
    expect(behavior.behavior).toBe("inline");
  });

  it("presents an inactive account inline on the sign-in form", () => {
    const behavior = resolveErrorBehavior(
      new ApiError("Inactive", 403, ErrorCodes.ACCOUNT_INACTIVE)
    );
    expect(behavior.behavior).toBe("inline");
  });

  it("routes a network failure to a retry toast", () => {
    const behavior = resolveErrorBehavior(
      new ApiError("Network request failed", 0, TransportErrorCodes.NETWORK)
    );
    expect(behavior.behavior).toBe("toast");
  });

  it("treats an uncoded 400 as inline validation", () => {
    const behavior = resolveErrorBehavior(new ApiError("Invalid request payload", 400));
    expect(behavior.behavior).toBe("inline");
  });
});

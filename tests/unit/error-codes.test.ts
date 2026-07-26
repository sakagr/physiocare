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

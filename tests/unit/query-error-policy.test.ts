import { describe, expect, it } from "vitest";
import { ApiError, TransportErrorCodes } from "@/lib/api/api-error";
import {
  buildLoginRedirect,
  resolveQueryErrorAction,
  shouldRetryQuery,
} from "@/lib/query/error-policy";

/**
 * The cross-cutting half of the error model: what TanStack Query's
 * cache-level handler does with a failure, and which failures are worth
 * retrying. Kept pure so it is testable without a router, a QueryClient, or
 * a notification system (AGENTS.md → Error Handling and Types).
 */
describe("shouldRetryQuery", () => {
  it("never retries a client error — the answer will not change", () => {
    const forbidden = new ApiError("Forbidden", 403, "FORBIDDEN");
    const notFound = new ApiError("Missing", 404, "NOT_FOUND");
    const invalid = new ApiError("Invalid", 400, null);

    expect(shouldRetryQuery(0, forbidden)).toBe(false);
    expect(shouldRetryQuery(0, notFound)).toBe(false);
    expect(shouldRetryQuery(0, invalid)).toBe(false);
  });

  it("never retries an expired session", () => {
    const unauthenticated = new ApiError(
      "Unauthenticated",
      401,
      TransportErrorCodes.UNAUTHENTICATED
    );

    expect(shouldRetryQuery(0, unauthenticated)).toBe(false);
  });

  it("retries a transient network failure up to twice", () => {
    const network = new ApiError(
      "Network request failed",
      0,
      TransportErrorCodes.NETWORK
    );

    expect(shouldRetryQuery(0, network)).toBe(true);
    expect(shouldRetryQuery(1, network)).toBe(true);
    expect(shouldRetryQuery(2, network)).toBe(false);
  });

  it("retries a server error", () => {
    const serverError = new ApiError("Boom", 500, null);

    expect(shouldRetryQuery(0, serverError)).toBe(true);
  });
});

describe("resolveQueryErrorAction", () => {
  it("sends an expired session to the login page", () => {
    const action = resolveQueryErrorAction(
      new ApiError("Unauthenticated", 401, TransportErrorCodes.UNAUTHENTICATED)
    );

    expect(action.type).toBe("redirectLogin");
    expect(action.message).toBe("Your session has expired. Please sign in again.");
  });

  it("toasts a network failure with a human message", () => {
    const action = resolveQueryErrorAction(
      new ApiError("Network request failed", 0, TransportErrorCodes.NETWORK)
    );

    expect(action.type).toBe("toast");
    expect(action.message).toContain("couldn't reach the server");
  });

  it("stays silent for errors a screen handles itself", () => {
    // Forbidden renders a forbidden treatment in place; a validation error
    // maps onto form fields. Neither should also fire a global toast.
    expect(resolveQueryErrorAction(new ApiError("No", 403, "FORBIDDEN")).type).toBe("none");
    expect(resolveQueryErrorAction(new ApiError("Bad", 400, null)).type).toBe("none");
  });

  it("presents a failed sign-in on the form rather than bouncing to it", () => {
    // A wrong password is also a 401. Treating it as an expired session would
    // send the user to the page they are already on, with the wrong reason.
    const action = resolveQueryErrorAction(
      new ApiError("Wrong credentials", 401, "INVALID_CREDENTIALS")
    );

    expect(action.type).toBe("none");
  });

  it("toasts an unexpected non-ApiError failure", () => {
    const action = resolveQueryErrorAction(new Error("kaboom"));

    expect(action.type).toBe("toast");
    expect(action.message).toBe("Something went wrong. Please try again.");
  });
});

describe("buildLoginRedirect", () => {
  it("preserves where the user was so they can resume after re-auth", () => {
    expect(buildLoginRedirect("/app/invoices?page=2")).toBe(
      "/login?reason=expired&next=%2Fapp%2Finvoices%3Fpage%3D2"
    );
  });

  it("says why the user is back at the front door", () => {
    expect(buildLoginRedirect("/app")).toContain("reason=expired");
  });

  it("never sends the user to another site", () => {
    expect(buildLoginRedirect("//evil.example.com")).toBe("/login?reason=expired");
    expect(buildLoginRedirect("https://evil.example.com")).toBe(
      "/login?reason=expired"
    );
  });

  it("does not loop the login page back to itself", () => {
    expect(buildLoginRedirect("/login")).toBe("/login?reason=expired");
    expect(buildLoginRedirect("/login?next=%2Fapp")).toBe("/login?reason=expired");
  });
});

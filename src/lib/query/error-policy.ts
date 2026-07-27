import { ApiError } from "@/lib/api/api-error";
import { resolveErrorBehavior } from "@/lib/api/error-codes";

/**
 * The cross-cutting error policy for server state. TanStack Query's
 * cache-level handler owns the failures no single screen should have to
 * repeat — an expired session and a dead connection — while everything
 * field-attributable or capability-related is left to the screen that asked
 * for the data (AGENTS.md → Error Handling and Types).
 *
 * Both functions are pure so they can be tested without a QueryClient, a
 * router, or a notification system.
 */

export type QueryErrorAction =
  /** Session is gone; leave for the login page. */
  | { type: "redirectLogin"; message: string }
  /** Transient and non-field-attributable; surface as a toast. */
  | { type: "toast"; message: string }
  /** The screen presents this itself (forbidden view, inline field errors). */
  | { type: "none"; message: string };

const MAX_RETRIES = 2;

const LOGIN_PATH = "/login";

/**
 * Where an expired session sends the user: the front door, carrying why they
 * are there and the path to resume once they sign in again (UX.md → Error →
 * default behavior). Off-site and self-referential targets are dropped rather
 * than followed.
 */
export function buildLoginRedirect(currentPath: string): string {
  const resumable =
    currentPath.startsWith("/") &&
    !currentPath.startsWith("//") &&
    currentPath !== LOGIN_PATH &&
    !currentPath.startsWith(`${LOGIN_PATH}?`);

  return resumable
    ? `${LOGIN_PATH}?reason=expired&next=${encodeURIComponent(currentPath)}`
    : `${LOGIN_PATH}?reason=expired`;
}

/**
 * Retries only failures that could plausibly succeed on a second attempt. A
 * 4xx is a decision, not a hiccup: retrying it just delays the error the user
 * needs to see (and, for 403, hammers the authorization path).
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown
): boolean {
  if (error instanceof ApiError) {
    const isClientError = error.status >= 400 && error.status < 500;
    if (isClientError) {
      return false;
    }
  }

  return failureCount < MAX_RETRIES;
}

/**
 * Decides what the cache-level handler should do with a failure, reusing the
 * Increment-1 code→behavior map so the copy stays in one place.
 */
export function resolveQueryErrorAction(error: unknown): QueryErrorAction {
  if (!(error instanceof ApiError)) {
    return { type: "toast", message: "Something went wrong. Please try again." };
  }

  const { behavior, message } = resolveErrorBehavior(error);

  switch (behavior) {
    case "redirectLogin":
      return { type: "redirectLogin", message };
    case "toast":
      return { type: "toast", message };
    // `forbidden` renders in place and `inline` maps onto form fields; a
    // global toast on top of either would be noise.
    case "forbidden":
    case "inline":
      return { type: "none", message };
  }
}

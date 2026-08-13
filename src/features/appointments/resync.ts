import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/api-error";
import type { ErrorCode } from "@/lib/api/error-codes";

/**
 * The *resync* half of `UX.md`'s **blocking message + resync** treatment.
 *
 * That treatment is two things: explain in context why the action cannot
 * proceed, then refetch so the now-stale UI reflects current state. The first
 * half already exists -- every code below maps to `toast` with a written
 * message in `ERROR_BEHAVIORS`, which this **does not touch**. The second half
 * has no representation there and needs none: it is a per-call-site
 * invalidation, the same layering ADR-0012 uses for
 * `meta.suppressToastForCodes`.
 *
 * F6 is the first phase to raise a batch of these, so the set and the
 * invalidation live here once rather than being re-derived at nine call
 * sites.
 *
 * What unites the codes is *the record being acted on has itself moved* --
 * a status already advanced, a session already recorded, an attendance row
 * already written. Contrast the dependency-blocked codes
 * (`PATIENT_HAS_DEPENDENT_RECORDS` and friends), where the record in view is
 * unchanged and accurate so there is nothing to resync, and
 * `SUBSCRIPTION_REQUIRED`, which is the limit-enforcement treatment instead.
 */
export const RESYNC_ERROR_CODES: readonly ErrorCode[] = [
  "INVALID_APPOINTMENT_STATUS_TRANSITION",
  "PACKAGE_SESSIONS_EXHAUSTED",
  "PACKAGE_EXPIRED",
  "PACKAGE_CANCELLED",
  "PACKAGE_SESSION_ALREADY_RECORDED",
  "CONSULTATION_ALREADY_EXISTS",
  "ATTENDANCE_ALREADY_RECORDED",
  "ATTENDANCE_CHECK_IN_REQUIRED",
  "PHYSIOTHERAPIST_UNAVAILABLE",
];

export function isResyncError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    Boolean(error.code) &&
    RESYNC_ERROR_CODES.includes(error.code as ErrorCode)
  );
}

/**
 * Invalidates the affected queries when a mutation fails with a code that
 * means the underlying record moved. Never retries the write -- `UX.md` is
 * explicit that a rejected write is never silently retried; the user retries
 * against the refreshed state themselves.
 */
export function resyncOnConflict(
  queryClient: QueryClient,
  error: unknown,
  queryKeys: readonly unknown[][]
): void {
  if (!isResyncError(error)) return;
  for (const queryKey of queryKeys) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

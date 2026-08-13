import type { ErrorCode } from "@/server/errors";

/**
 * Re-exported so client features can name a code without importing from
 * `@/server` themselves. The type is erased at build time; this module is
 * already the one place the client-side code vocabulary is anchored.
 */
export type { ErrorCode };
import { ApiError, TransportErrorCodes } from "./api-error";

/**
 * How an error is surfaced to the user by default. Screens may override the
 * behavior or message per case, but this is the single mapping every code
 * falls back to (AGENTS.md → "Error Handling and Types").
 *
 * - `toast` — transient, non-field errors and conflicts.
 * - `inline` — field-attributable; mapped back onto the form field(s).
 * - `redirectLogin` — the session is gone; send the user to sign in.
 * - `forbidden` — the user lacks capability; show the forbidden treatment.
 */
export type ErrorBehavior = "toast" | "inline" | "redirectLogin" | "forbidden";

export interface ErrorBehaviorEntry {
  behavior: ErrorBehavior;
  /** Plain, human message — never a raw code. One facet, overridable. */
  message: string;
}

/**
 * Default behavior and copy per backend error code. Typed as a total
 * `Record<ErrorCode, …>` so adding a code to the backend `ErrorCodes` fails
 * this file at compile time until the client decides how to present it.
 */
export const ERROR_BEHAVIORS: Record<ErrorCode, ErrorBehaviorEntry> = {
  FORBIDDEN: {
    behavior: "forbidden",
    message: "You don't have permission to do that.",
  },
  NOT_FOUND: {
    behavior: "toast",
    message: "We couldn't find what you were looking for.",
  },
  ORGANIZATION_NAME_ALREADY_EXISTS: {
    behavior: "inline",
    message: "An organization with this name already exists.",
  },
  EMAIL_ALREADY_EXISTS: {
    behavior: "inline",
    message: "This email is already in use.",
  },
  USERNAME_ALREADY_EXISTS: {
    behavior: "inline",
    message: "This username is already taken.",
  },
  PATIENT_HAS_DEPENDENT_RECORDS: {
    behavior: "toast",
    message: "This patient has related records and can't be removed.",
  },
  CONSULTATION_ALREADY_EXISTS: {
    behavior: "toast",
    message: "A consultation already exists for this appointment.",
  },
  PACKAGE_NAME_ALREADY_EXISTS: {
    behavior: "inline",
    message: "A package with this name already exists.",
  },
  PACKAGE_HAS_ACTIVE_ASSIGNMENTS: {
    behavior: "toast",
    message: "This package is assigned to patients and can't be deactivated.",
  },
  PATIENT_PACKAGE_HAS_REFERENCES: {
    behavior: "toast",
    message: "This package assignment is in use and can't be removed.",
  },
  INVOICE_ALREADY_FINALIZED: {
    behavior: "toast",
    message: "This invoice is finalized and can no longer be edited.",
  },
  PAYMENT_ALREADY_EXISTS_FOR_INVOICE: {
    behavior: "toast",
    message: "A payment has already been recorded for this invoice.",
  },
  PAYMENT_EXCEEDS_INVOICE_TOTAL: {
    behavior: "inline",
    message: "The payment amount can't be more than the invoice total.",
  },
  INVALID_PAYMENT_STATUS_TRANSITION: {
    behavior: "toast",
    message: "That payment status change isn't allowed.",
  },
  ATTENDANCE_ALREADY_RECORDED: {
    behavior: "toast",
    message: "Attendance has already been recorded for this date.",
  },
  ATTENDANCE_CHECK_IN_REQUIRED: {
    behavior: "toast",
    message: "A check-in is required before this can be done.",
  },
  PHYSIOTHERAPIST_UNAVAILABLE: {
    behavior: "toast",
    message: "This physiotherapist isn't available at that time.",
  },
  REPORT_ROW_LIMIT_EXCEEDED: {
    behavior: "toast",
    message: "This report is too large — narrow the filters and try again.",
  },
  INVALID_APPOINTMENT_STATUS_TRANSITION: {
    behavior: "toast",
    message: "That appointment status change isn't allowed.",
  },
  PACKAGE_SESSION_ALREADY_RECORDED: {
    behavior: "toast",
    message: "A session was already recorded for this appointment.",
  },
  PACKAGE_SESSIONS_EXHAUSTED: {
    behavior: "toast",
    message: "This package has no sessions remaining.",
  },
  PACKAGE_EXPIRED: {
    behavior: "toast",
    message: "This package has expired.",
  },
  PACKAGE_CANCELLED: {
    behavior: "toast",
    message: "This package was cancelled and can't be used for a new session.",
  },
  ORGANIZATION_LIMIT_EXCEEDED: {
    behavior: "toast",
    message: "You've reached your plan's limit.",
  },
  SUBSCRIPTION_REQUIRED: {
    behavior: "toast",
    message: "An active subscription is required to do that.",
  },
  SUBSCRIPTION_PLAN_NOT_FOUND: {
    behavior: "toast",
    message: "We couldn't find that subscription plan.",
  },
  INVALID_SUBSCRIPTION_TRANSITION: {
    behavior: "toast",
    message: "That subscription change isn't allowed.",
  },
  TARGET_USER_IS_SELF: {
    behavior: "toast",
    message: "You can't do that to your own account.",
  },
  INVALID_CREDENTIALS: {
    behavior: "inline",
    message: "We couldn't sign you in. Check your username and password.",
  },
  ACCOUNT_INACTIVE: {
    behavior: "inline",
    message: "This account is no longer active. Contact your administrator.",
  },
  INVALID_CURRENT_PASSWORD: {
    behavior: "inline",
    message: "That current password isn't right.",
  },
  PASSWORD_SETUP_SESSION_INVALID: {
    behavior: "inline",
    message: "This link has expired. Request a new one to set your password.",
  },
};

/** Fallback when a code is unknown or absent (transport-only failures). */
const FALLBACK: ErrorBehaviorEntry = {
  behavior: "toast",
  message: "Something went wrong. Please try again.",
};

const NETWORK_ENTRY: ErrorBehaviorEntry = {
  behavior: "toast",
  message: "We couldn't reach the server. Check your connection and retry.",
};

const UNAUTHENTICATED_ENTRY: ErrorBehaviorEntry = {
  behavior: "redirectLogin",
  message: "Your session has expired. Please sign in again.",
};

/**
 * Resolves the default presentation for a thrown `ApiError`, folding in the
 * cross-cutting transport cases (network, expired session, validation) that
 * sit outside the backend `ErrorCodes`. The returned `message` is a default
 * the caller may override.
 */
export function resolveErrorBehavior(error: ApiError): ErrorBehaviorEntry {
  if (error.isNetworkError || error.code === TransportErrorCodes.NETWORK) {
    return NETWORK_ENTRY;
  }
  // The code map is consulted *before* the bare-401 shortcut. A failed sign-in
  // and an expired password-setup link are both 401s that carry a code, and
  // presenting either as "your session expired" would be actively misleading.
  // Only a codeless 401 means the session itself is gone.
  if (error.code && error.code in ERROR_BEHAVIORS) {
    return ERROR_BEHAVIORS[error.code as ErrorCode];
  }
  if (
    error.status === 401 ||
    error.code === TransportErrorCodes.UNAUTHENTICATED
  ) {
    return UNAUTHENTICATED_ENTRY;
  }
  // Transport-level validation errors carry field details but no app code.
  if (error.status === 400) {
    return {
      behavior: "inline",
      message: error.message || "Please correct the highlighted fields.",
    };
  }
  return { ...FALLBACK, message: error.message || FALLBACK.message };
}

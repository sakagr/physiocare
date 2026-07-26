/**
 * The typed error every API call throws on failure. The isomorphic client is
 * the single place that constructs this from the `{ error, code, details }`
 * response envelope; nothing downstream hand-parses responses.
 */
export class ApiError extends Error {
  /** Backend error code (from `ErrorCodes`), or a transport marker. */
  readonly code: string | null;
  /** HTTP status; `0` for a network/transport failure with no response. */
  readonly status: number;
  /** Validation issue payload for 400 responses, mapped to fields upstream. */
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    // Restore prototype chain (transpilation target below ES2015).
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** True when the failure never reached the server (offline, DNS, abort). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/** Transport-level code markers, distinct from backend `ErrorCodes`. */
export const TransportErrorCodes = {
  NETWORK: "NETWORK",
  UNAUTHENTICATED: "UNAUTHENTICATED",
} as const;

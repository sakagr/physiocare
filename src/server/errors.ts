export const ErrorCodes = {
  ORGANIZATION_NAME_ALREADY_EXISTS: "ORGANIZATION_NAME_ALREADY_EXISTS",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  USERNAME_ALREADY_EXISTS: "USERNAME_ALREADY_EXISTS",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Custom application error with structured error codes.
 */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.code = code;
    this.name = "AppError";
    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

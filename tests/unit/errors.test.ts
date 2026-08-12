import { describe, expect, it } from "vitest";
import { ErrorCodes, ERROR_CODE_STATUS } from "@/server/errors";

describe("ERROR_CODE_STATUS", () => {
  it("maps every declared error code to an HTTP status", () => {
    for (const code of Object.values(ErrorCodes)) {
      expect(ERROR_CODE_STATUS[code]).toBeDefined();
    }
  });

  it("maps FORBIDDEN to 403", () => {
    expect(ERROR_CODE_STATUS[ErrorCodes.FORBIDDEN]).toBe(403);
  });

  it("maps NOT_FOUND to 404", () => {
    expect(ERROR_CODE_STATUS[ErrorCodes.NOT_FOUND]).toBe(404);
  });

  // T-3.1
  it("maps PHYSIOTHERAPIST_UNAVAILABLE to 409", () => {
    expect(ERROR_CODE_STATUS[ErrorCodes.PHYSIOTHERAPIST_UNAVAILABLE]).toBe(409);
  });

  it("maps every conflict-style code to 409", () => {
    const conflictCodes = [
      ErrorCodes.ORGANIZATION_NAME_ALREADY_EXISTS,
      ErrorCodes.EMAIL_ALREADY_EXISTS,
      ErrorCodes.USERNAME_ALREADY_EXISTS,
      ErrorCodes.PATIENT_HAS_DEPENDENT_RECORDS,
      ErrorCodes.CONSULTATION_ALREADY_EXISTS,
      ErrorCodes.PACKAGE_NAME_ALREADY_EXISTS,
      ErrorCodes.PACKAGE_HAS_ACTIVE_ASSIGNMENTS,
      ErrorCodes.PATIENT_PACKAGE_HAS_REFERENCES,
      ErrorCodes.INVOICE_ALREADY_FINALIZED,
      ErrorCodes.PAYMENT_ALREADY_EXISTS_FOR_INVOICE,
      ErrorCodes.PAYMENT_EXCEEDS_INVOICE_TOTAL,
      ErrorCodes.INVALID_PAYMENT_STATUS_TRANSITION,
      ErrorCodes.ATTENDANCE_ALREADY_RECORDED,
      ErrorCodes.ATTENDANCE_CHECK_IN_REQUIRED,
    ];
    for (const code of conflictCodes) {
      expect(ERROR_CODE_STATUS[code]).toBe(409);
    }
  });
});

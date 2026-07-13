import { describe, expect, it } from "vitest";
import {
  validAppointmentInput,
  validClinicInput,
  validConsultationInput,
  validOrganizationInput,
  validOrganizationUserInput,
  validAttendanceInput,
  validInvoiceInput,
  validPackageInput,
  validPatientInput,
  validNotificationInput,
  validPaymentInput,
  validPrescriptionInput,
} from "../helpers/factories";
import { validateCreateClinicInput, validateUpdateClinicInput } from "@/server/validators/clinic.validator";
import { validateCreateOrganizationInput } from "@/server/validators/organization.validator";
import { getPaginationBounds, sharedListQuerySchema } from "@/server/validators/shared.validator";
import { validateAssignUserClinicInput } from "@/server/validators/user-clinic.validator";
import {
  validateChangeUserRoleInput,
  validateCreateOrganizationUserInput,
  validateUpdateUserProfileInput,
} from "@/server/validators/user.validator";
import { validateCreatePatientInput, validateUpdatePatientInput } from "@/server/validators/patient.validator";
import { validateCreatePatientRecordInput } from "@/server/validators/patient-record.validator";
import {
  validateCreateAppointmentInput,
  validateUpdateAppointmentInput,
  validateUpdateAppointmentStatusInput,
} from "@/server/validators/appointment.validator";
import { validateCreateConsultationInput, validateUpdateConsultationInput } from "@/server/validators/consultation.validator";
import { validateCreatePrescriptionInput, validateUpdatePrescriptionInput } from "@/server/validators/prescription.validator";
import { validateCreatePackageInput, validateUpdatePackageInput } from "@/server/validators/package.validator";
import { validateCreatePatientPackageInput, validateUpdatePatientPackageInput } from "@/server/validators/patient-package.validator";
import { validateCreateInvoiceInput, validateUpdateInvoiceInput } from "@/server/validators/invoice.validator";
import { validateCreatePaymentInput, validateUpdatePaymentStatusInput } from "@/server/validators/payment.validator";
import { validateCreateAttendanceInput, validateUpdateAttendanceInput } from "@/server/validators/attendance.validator";
import { validateCreateNotificationInput } from "@/server/validators/notification.validator";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("organization validator", () => {
  it("normalizes the administrator email and username", () => {
    const input = validateCreateOrganizationInput({
      ...validOrganizationInput(),
      adminEmail: "OWNER@EXAMPLE.TEST",
      adminUsername: "Owner.Admin",
    });

    expect(input).toMatchObject({ adminEmail: "owner@example.test", adminUsername: "owner.admin" });
  });

  it("rejects missing, malformed, and undersized organization input", () => {
    expect(() => validateCreateOrganizationInput({})).toThrow();
    expect(() => validateCreateOrganizationInput({ ...validOrganizationInput(), adminEmail: "not-an-email" })).toThrow();
    expect(() => validateCreateOrganizationInput({ ...validOrganizationInput(), organizationName: "x" })).toThrow();
  });
});

describe("user validators", () => {
  it("normalizes valid organization user input", () => {
    expect(validateCreateOrganizationUserInput({
      ...validOrganizationUserInput(),
      username: "Physio.User",
      email: "PHYSIO@EXAMPLE.TEST",
    })).toMatchObject({ username: "physio.user", email: "physio@example.test" });
  });

  it("rejects platform roles, malformed usernames, and invalid role changes", () => {
    expect(() => validateCreateOrganizationUserInput({ ...validOrganizationUserInput(), role: "SUPER_ADMIN" })).toThrow();
    expect(() => validateCreateOrganizationUserInput({ ...validOrganizationUserInput(), username: "not valid" })).toThrow();
    expect(() => validateChangeUserRoleInput({ role: "PLATFORM_SUPPORT" })).toThrow();
  });

  it("accepts only valid editable profile fields", () => {
    expect(validateUpdateUserProfileInput({ fullName: " Updated Name ", phone: " " })).toEqual({ fullName: "Updated Name", phone: "" });
    expect(() => validateUpdateUserProfileInput({ fullName: "x" })).toThrow();
  });
});

describe("clinic and assignment validators", () => {
  it("normalizes valid clinic input and permits partial updates", () => {
    expect(validateCreateClinicInput({ ...validClinicInput(), email: " CLINIC@EXAMPLE.TEST " }).email).toBe("clinic@example.test");
    expect(validateUpdateClinicInput({ city: " Pune " })).toEqual({ city: "Pune" });
  });

  it("rejects invalid clinic data and assignment UUIDs", () => {
    expect(() => validateCreateClinicInput({ ...validClinicInput(), clinicName: "x" })).toThrow();
    expect(() => validateCreateClinicInput({ ...validClinicInput(), email: "bad" })).toThrow();
    expect(() => validateAssignUserClinicInput({ userId: "invalid", clinicId: "invalid" })).toThrow();
  });
});

describe("patient validators", () => {
  it("normalizes valid patient input and permits partial updates", () => {
    expect(validateCreatePatientInput({ ...validPatientInput(), email: " PATIENT@EXAMPLE.TEST " }).email).toBe("patient@example.test");
    expect(validateUpdatePatientInput({ phone: " 9998887776 " })).toEqual({ phone: "9998887776" });
  });

  it("rejects invalid patient data", () => {
    expect(() => validateCreatePatientInput({ ...validPatientInput(), fullName: "x" })).toThrow();
    expect(() => validateCreatePatientInput({ ...validPatientInput(), gender: "unknown" })).toThrow();
    expect(() => validateCreatePatientInput({ ...validPatientInput(), dob: "2999-01-01" })).toThrow();
    expect(() => validateCreatePatientInput({ ...validPatientInput(), email: "bad" })).toThrow();
  });
});

describe("patient record validator", () => {
  it("accepts valid record metadata", () => {
    expect(validateCreatePatientRecordInput({ recordType: "xray", title: "Knee X-Ray" })).toMatchObject({
      recordType: "xray",
      title: "Knee X-Ray",
    });
  });

  it("rejects missing required fields", () => {
    expect(() => validateCreatePatientRecordInput({ recordType: "xray" })).toThrow();
    expect(() => validateCreatePatientRecordInput({ title: "Knee X-Ray" })).toThrow();
  });
});

describe("appointment validators", () => {
  it("accepts valid appointment input and status updates", () => {
    const input = validAppointmentInput({ patientId: uuid, clinicId: uuid, physiotherapistId: uuid });
    expect(validateCreateAppointmentInput(input)).toMatchObject({ patientId: uuid, clinicId: uuid, physiotherapistId: uuid });
    expect(validateUpdateAppointmentInput({ notes: "Rescheduled" })).toEqual({ notes: "Rescheduled" });
    expect(validateUpdateAppointmentStatusInput({ status: "completed" })).toEqual({ status: "completed" });
  });

  it("rejects invalid appointment data", () => {
    expect(() => validateCreateAppointmentInput({ ...validAppointmentInput({ patientId: uuid, clinicId: uuid, physiotherapistId: uuid }), patientId: "not-a-uuid" })).toThrow();
    expect(() => validateCreateAppointmentInput({ ...validAppointmentInput({ patientId: uuid, clinicId: uuid, physiotherapistId: uuid }), appointmentType: "bogus" })).toThrow();
    expect(() => validateUpdateAppointmentStatusInput({ status: "bogus" })).toThrow();
  });
});

describe("consultation validator", () => {
  it("accepts valid consultation input", () => {
    expect(validateCreateConsultationInput(validConsultationInput(uuid))).toMatchObject({ appointmentId: uuid, painScale: 5 });
    expect(validateUpdateConsultationInput({ diagnosisNotes: "Updated" })).toEqual({ diagnosisNotes: "Updated" });
  });

  it("rejects out-of-range pain scale and missing appointment id", () => {
    expect(() => validateCreateConsultationInput({ ...validConsultationInput(uuid), painScale: 11 })).toThrow();
    expect(() => validateCreateConsultationInput({ ...validConsultationInput(uuid), appointmentId: "not-a-uuid" })).toThrow();
  });
});

describe("prescription validator", () => {
  it("accepts valid prescription input", () => {
    expect(validateCreatePrescriptionInput(validPrescriptionInput(uuid))).toMatchObject({ consultationId: uuid });
    expect(validateUpdatePrescriptionInput({ advice: "Updated advice" })).toEqual({ advice: "Updated advice" });
  });

  it("rejects missing consultation id", () => {
    expect(() => validateCreatePrescriptionInput({ ...validPrescriptionInput(uuid), consultationId: "not-a-uuid" })).toThrow();
  });
});

describe("package validator", () => {
  it("accepts valid package input and permits partial updates", () => {
    expect(validateCreatePackageInput(validPackageInput())).toMatchObject({ packageName: "Test Package 001", totalSessions: 10 });
    expect(validateUpdatePackageInput({ packagePrice: 4500 })).toEqual({ packagePrice: 4500 });
  });

  it("rejects invalid package data", () => {
    expect(() => validateCreatePackageInput({ ...validPackageInput(), packageName: "x" })).toThrow();
    expect(() => validateCreatePackageInput({ ...validPackageInput(), totalSessions: 0 })).toThrow();
    expect(() => validateCreatePackageInput({ ...validPackageInput(), packagePrice: -1 })).toThrow();
    expect(() => validateCreatePackageInput({ ...validPackageInput(), validityDays: 0 })).toThrow();
  });
});

describe("patient package validator", () => {
  it("accepts valid assignment input and permits narrow partial updates", () => {
    expect(validateCreatePatientPackageInput({ patientId: uuid, packageId: uuid })).toMatchObject({ patientId: uuid, packageId: uuid });
    expect(validateUpdatePatientPackageInput({ status: "cancelled" })).toEqual({ status: "cancelled" });
  });

  it("rejects invalid assignment data and disallows session-count edits", () => {
    expect(() => validateCreatePatientPackageInput({ patientId: "not-a-uuid", packageId: uuid })).toThrow();
    expect(() => validateUpdatePatientPackageInput({ status: "active" })).toThrow();
    expect(validateUpdatePatientPackageInput({ totalSessions: 5 })).toEqual({});
  });
});

describe("invoice validator", () => {
  it("accepts valid invoice input with at least one item", () => {
    const input = validInvoiceInput({ patientId: uuid, clinicId: uuid });
    expect(validateCreateInvoiceInput(input)).toMatchObject({ patientId: uuid, clinicId: uuid, discountAmount: 0 });
    expect(validateUpdateInvoiceInput({ discountAmount: 50 })).toEqual({ discountAmount: 50 });
  });

  it("rejects invoices with no items and invalid item fields", () => {
    expect(() => validateCreateInvoiceInput({ ...validInvoiceInput({ patientId: uuid, clinicId: uuid }), items: [] })).toThrow();
    expect(() => validateCreateInvoiceInput({
      ...validInvoiceInput({ patientId: uuid, clinicId: uuid }),
      items: [{ itemName: "", quantity: 1, unitPrice: 10 }],
    })).toThrow();
  });
});

describe("payment validator", () => {
  it("accepts valid payment input and status transitions", () => {
    expect(validateCreatePaymentInput(validPaymentInput(uuid))).toMatchObject({ invoiceId: uuid, amount: 590 });
    expect(validateUpdatePaymentStatusInput({ status: "refunded" })).toEqual({ status: "refunded" });
  });

  it("rejects non-positive amounts and unsupported statuses", () => {
    expect(() => validateCreatePaymentInput({ ...validPaymentInput(uuid), amount: 0 })).toThrow();
    expect(() => validateUpdatePaymentStatusInput({ status: "unpaid" })).toThrow();
  });
});

describe("attendance validator", () => {
  it("accepts valid check-in input defaulting to present status", () => {
    expect(validateCreateAttendanceInput(validAttendanceInput({ clinicId: uuid }))).toMatchObject({ clinicId: uuid, status: "present" });
    expect(validateCreateAttendanceInput({ clinicId: uuid })).toMatchObject({ status: "present" });
  });

  it("rejects invalid clinic IDs and statuses", () => {
    expect(() => validateCreateAttendanceInput({ clinicId: "not-a-uuid" })).toThrow();
    expect(() => validateCreateAttendanceInput({ clinicId: uuid, status: "bogus" })).toThrow();
    expect(validateUpdateAttendanceInput({ status: "absent" })).toEqual({ status: "absent" });
  });
});

describe("notification validator", () => {
  it("accepts a valid user-recipient notification", () => {
    expect(validateCreateNotificationInput(validNotificationInput({ userId: uuid }))).toMatchObject({ recipientType: "user", userId: uuid });
  });

  it("rejects mismatched recipient XOR and missing message", () => {
    expect(() => validateCreateNotificationInput({ ...validNotificationInput({ userId: uuid }), patientId: uuid })).toThrow();
    expect(() => validateCreateNotificationInput({ ...validNotificationInput({ userId: uuid }), recipientType: "patient" })).toThrow();
    expect(() => validateCreateNotificationInput({ ...validNotificationInput({ userId: uuid }), message: "" })).toThrow();
  });
});

describe("list query validation", () => {
  it("applies pagination defaults and accepts supported filters", () => {
    expect(sharedListQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
    expect(sharedListQuerySchema.parse({ page: "2", limit: "25", isActive: "false", search: "physio" }))
      .toEqual({ page: 2, limit: 25, isActive: false, search: "physio" });
  });

  it("rejects invalid pagination values and calculates query bounds", () => {
    expect(() => sharedListQuerySchema.parse({ page: "0" })).toThrow();
    expect(() => sharedListQuerySchema.parse({ limit: "101" })).toThrow();
    expect(getPaginationBounds(3, 20)).toEqual({ from: 40, to: 59 });
  });
});

import { z } from "zod";
import type { OperationEntry } from "./types";

import {
  createConsultationSchema,
  consultationListQuerySchema,
  updateConsultationSchema,
} from "@/server/validators/consultation.validator";
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
} from "@/server/validators/prescription.validator";
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
  appointmentListQuerySchema,
} from "@/server/validators/appointment.validator";
import {
  createAttendanceSchema,
  updateAttendanceSchema,
  attendanceListQuerySchema,
} from "@/server/validators/attendance.validator";
import { auditLogListQuerySchema } from "@/server/validators/audit-log.validator";
import {
  loginSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
  changePasswordSchema,
} from "@/server/validators/auth.validator";
import {
  createClinicSchema,
  updateClinicSchema,
} from "@/server/validators/clinic.validator";
import { paginationSchema, sharedListQuerySchema } from "@/server/validators/shared.validator";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceListQuerySchema,
} from "@/server/validators/invoice.validator";
import { createPaymentSchema } from "@/server/validators/payment.validator";
import {
  createNotificationSchema,
  notificationListQuerySchema,
} from "@/server/validators/notification.validator";
import {
  activateSubscriptionSchema,
  selectSubscriptionPlanSchema,
} from "@/server/validators/subscription.validator";
import { createOrganizationSchema, updateOrganizationProfileSchema } from "@/server/validators/organization.validator";
import {
  createPackageSchema,
  updatePackageSchema,
} from "@/server/validators/package.validator";
import {
  createPatientPackageSchema,
  updatePatientPackageSchema,
  patientPackageListQuerySchema,
} from "@/server/validators/patient-package.validator";
import { createPatientRecordSchema } from "@/server/validators/patient-record.validator";
import {
  createPatientSchema,
  updatePatientSchema,
  patientListQuerySchema,
} from "@/server/validators/patient.validator";
import { updatePaymentStatusSchema } from "@/server/validators/payment.validator";
import {
  billingReportQuerySchema,
  commissionReportQuerySchema,
  physiotherapistReportQuerySchema,
} from "@/server/validators/report.validator";
import { assignUserClinicSchema } from "@/server/validators/user-clinic.validator";
import {
  createOrganizationUserSchema,
  updateUserProfileSchema,
  changeUserRoleSchema,
} from "@/server/validators/user.validator";
import { setUserCompensationSchema } from "@/server/validators/compensation.validator";

import { clinicListResponseSchema, clinicSchema, userClinicsResponseSchema } from "@/contracts/clinic.contract";
import {
  clinicUsersResponseSchema,
  createOrganizationUserResultSchema,
  userCompensationSchema,
  userCompensationHistorySchema,
  userDetailResponseSchema,
  userListResponseSchema,
  userSchema,
  resetUserPasswordResultSchema,
} from "@/contracts/user.contract";
import { userClinicSchema } from "@/contracts/user-clinic.contract";
import { currentUserSchema } from "@/contracts/me.contract";
import { patientListResponseSchema, patientSchema } from "@/contracts/patient.contract";
import {
  patientRecordListResponseSchema,
  patientRecordSchema,
  patientRecordWithDownloadUrlSchema,
} from "@/contracts/patient-record.contract";
import {
  patientPackageListResponseSchema,
  patientPackageSchema,
  packageSessionUsageListResponseSchema,
} from "@/contracts/patient-package.contract";
import { packageListResponseSchema, packageSchema } from "@/contracts/package.contract";
import {
  appointmentListResponseSchema,
  appointmentReadSchema,
  appointmentSchema,
} from "@/contracts/appointment.contract";
import { consultationListResponseSchema, consultationSchema } from "@/contracts/consultation.contract";
import { attendanceListResponseSchema, attendanceSchema, recordAttendanceResultSchema } from "@/contracts/attendance.contract";
import { prescriptionListResponseSchema, prescriptionSchema } from "@/contracts/prescription.contract";
import { invoiceListResponseSchema, invoiceWithItemsSchema, invoiceSchema } from "@/contracts/invoice.contract";
import { invoicePaymentsResponseSchema, paymentSchema } from "@/contracts/payment.contract";
import {
  billingReportSchema,
  commissionReportSchema,
  physiotherapistReportSchema,
} from "@/contracts/report.contract";
import { bootstrapOrganizationResultSchema, organizationDetailSchema, organizationSchema } from "@/contracts/organization.contract";
import { notificationListResponseSchema, notificationSchema } from "@/contracts/notification.contract";
import { auditLogListResponseSchema } from "@/contracts/audit-log.contract";
import { subscriptionPlanListResponseSchema } from "@/contracts/subscription.contract";

/** A UUID path parameter, the overwhelming majority of this API's `{id}`s. */
function idParam(name: string, description: string): { name: string; description: string; required: true; schema: z.ZodType } {
  return { name, description, required: true, schema: z.string().uuid() };
}

const XLSX_PDF_CONTENT_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
];

/** Every `/api/auth/*` operation can act on the caller's own session (decision #8). */
const SESSION_WARNING =
  "Running this operation replaces or ends your own Super Admin session immediately.";

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------
const appointments: OperationEntry[] = [
  {
    method: "GET",
    path: "/api/appointments/{id}/consultation",
    tag: "Appointments",
    summary: "Get the consultation for an appointment, or null if not recorded yet",
    auth: "session",
    pathParams: [idParam("id", "Appointment ID")],
    responses: [
      {
        status: 200,
        description: "The appointment's consultation, or null when the visit has not been recorded",
        schema: consultationSchema.nullable(),
      },
    ],
  },
  {
    method: "POST",
    path: "/api/appointments/{id}/consultation",
    tag: "Appointments",
    summary: "Create the consultation for an appointment",
    auth: "session",
    pathParams: [idParam("id", "Appointment ID")],
    requestBody: { contentType: "application/json", schema: createConsultationSchema.omit({ appointmentId: true }) },
    responses: [{ status: 201, description: "Consultation created", schema: consultationSchema }],
  },
  {
    method: "DELETE",
    path: "/api/appointments/{id}/package-session",
    tag: "Appointments",
    summary: "Correct (undo) a package session consumed by this appointment",
    auth: "session",
    pathParams: [idParam("id", "Appointment ID")],
    responses: [{ status: 204, description: "Package session usage corrected" }],
  },
  {
    method: "GET",
    path: "/api/appointments/{id}",
    tag: "Appointments",
    summary: "Get appointment details",
    auth: "session",
    pathParams: [idParam("id", "Appointment ID")],
    responses: [{ status: 200, description: "Appointment detail", schema: appointmentReadSchema }],
  },
  {
    method: "PATCH",
    path: "/api/appointments/{id}",
    tag: "Appointments",
    summary: "Update appointment scheduling details",
    auth: "session",
    pathParams: [idParam("id", "Appointment ID")],
    requestBody: { contentType: "application/json", schema: updateAppointmentSchema },
    responses: [{ status: 200, description: "Appointment updated", schema: appointmentSchema }],
  },
  {
    method: "DELETE",
    path: "/api/appointments/{id}",
    tag: "Appointments",
    summary: "Cancel (hard-scope delete) an appointment",
    auth: "session",
    pathParams: [idParam("id", "Appointment ID")],
    responses: [{ status: 200, description: "Appointment deleted", schema: appointmentSchema }],
  },
  {
    method: "PATCH",
    path: "/api/appointments/{id}/status",
    tag: "Appointments",
    summary: "Transition an appointment's status",
    auth: "session",
    pathParams: [idParam("id", "Appointment ID")],
    requestBody: { contentType: "application/json", schema: updateAppointmentStatusSchema },
    responses: [{ status: 200, description: "Appointment status updated", schema: appointmentSchema }],
  },
  {
    method: "POST",
    path: "/api/appointments",
    tag: "Appointments",
    summary: "Create an appointment",
    auth: "session",
    requestBody: { contentType: "application/json", schema: createAppointmentSchema },
    responses: [{ status: 201, description: "Appointment created", schema: appointmentSchema }],
  },
  {
    method: "GET",
    path: "/api/appointments",
    tag: "Appointments",
    summary: "List appointments",
    auth: "session",
    query: appointmentListQuerySchema,
    responses: [{ status: 200, description: "Paginated appointment list", schema: appointmentListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
const attendance: OperationEntry[] = [
  {
    method: "PATCH",
    path: "/api/attendance/{id}/checkout",
    tag: "Attendance",
    summary: "Record a check-out",
    auth: "session",
    pathParams: [idParam("id", "Attendance record ID")],
    responses: [{ status: 200, description: "Attendance record checked out", schema: attendanceSchema }],
  },
  {
    method: "GET",
    path: "/api/attendance/{id}",
    tag: "Attendance",
    summary: "Get attendance record details",
    auth: "session",
    pathParams: [idParam("id", "Attendance record ID")],
    responses: [{ status: 200, description: "Attendance record detail", schema: attendanceSchema }],
  },
  {
    method: "PATCH",
    path: "/api/attendance/{id}",
    tag: "Attendance",
    summary: "Correct an attendance record",
    auth: "session",
    pathParams: [idParam("id", "Attendance record ID")],
    requestBody: { contentType: "application/json", schema: updateAttendanceSchema },
    responses: [{ status: 200, description: "Attendance record updated, with its availability effect", schema: recordAttendanceResultSchema }],
  },
  {
    method: "POST",
    path: "/api/attendance",
    tag: "Attendance",
    summary: "Record a check-in",
    auth: "session",
    requestBody: { contentType: "application/json", schema: createAttendanceSchema },
    responses: [{ status: 201, description: "Attendance record created, with its availability effect", schema: recordAttendanceResultSchema }],
  },
  {
    method: "GET",
    path: "/api/attendance",
    tag: "Attendance",
    summary: "List attendance records",
    auth: "session",
    query: attendanceListQuerySchema,
    responses: [{ status: 200, description: "Paginated attendance list", schema: attendanceListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------
const auditLogs: OperationEntry[] = [
  {
    method: "GET",
    path: "/api/audit-logs",
    tag: "Audit Logs",
    summary: "List the organization's audit trail",
    auth: "session",
    query: auditLogListQuerySchema,
    responses: [{ status: 200, description: "Paginated audit log list", schema: auditLogListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const auth: OperationEntry[] = [
  {
    method: "POST",
    path: "/api/auth/change-password",
    tag: "Auth",
    summary: "Change the caller's password",
    description: "Requires the current password, unlike set-password (ADR-0007).",
    auth: "session",
    warning: SESSION_WARNING,
    requestBody: { contentType: "application/json", schema: changePasswordSchema },
    responses: [{ status: 204, description: "Password changed" }],
  },
  {
    method: "POST",
    path: "/api/auth/login",
    tag: "Auth",
    summary: "Sign in with a username and password",
    description: "Public by necessity -- this is the route that creates the session everything else requires.",
    auth: "public",
    warning: SESSION_WARNING,
    requestBody: { contentType: "application/json", schema: loginSchema },
    responses: [{ status: 204, description: "Signed in; session cookies set on the response" }],
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    tag: "Auth",
    summary: "End the caller's session",
    description: "Public and idempotent -- signing out is always safe, including when the session has already expired.",
    auth: "public",
    warning: SESSION_WARNING,
    responses: [{ status: 204, description: "Signed out; session cookies cleared" }],
  },
  {
    method: "POST",
    path: "/api/auth/request-password-reset",
    tag: "Auth",
    summary: "Request a password-recovery link",
    description: "Answers 204 whatever it finds -- an unknown username and a delivered email are indistinguishable.",
    auth: "public",
    warning: SESSION_WARNING,
    requestBody: { contentType: "application/json", schema: requestPasswordResetSchema },
    responses: [{ status: 204, description: "Recovery email sent if the account exists" }],
  },
  {
    method: "POST",
    path: "/api/auth/set-password",
    tag: "Auth",
    summary: "Set a password on a recovery or invitation session",
    description: "Requires the password-setup ticket cookie alongside a valid session (ADR-0007).",
    auth: "session",
    warning: SESSION_WARNING,
    requestBody: { contentType: "application/json", schema: setPasswordSchema },
    responses: [{ status: 204, description: "Password set" }],
  },
];

// ---------------------------------------------------------------------------
// Clinics
// ---------------------------------------------------------------------------
const clinics: OperationEntry[] = [
  {
    method: "POST",
    path: "/api/clinics/{id}/activate",
    tag: "Clinics",
    summary: "Activate a clinic",
    auth: "session",
    pathParams: [idParam("id", "Clinic ID")],
    responses: [{ status: 200, description: "Clinic activated", schema: clinicSchema }],
  },
  {
    method: "POST",
    path: "/api/clinics/{id}/deactivate",
    tag: "Clinics",
    summary: "Deactivate a clinic",
    auth: "session",
    pathParams: [idParam("id", "Clinic ID")],
    responses: [{ status: 200, description: "Clinic deactivated", schema: clinicSchema }],
  },
  {
    method: "GET",
    path: "/api/clinics/{id}",
    tag: "Clinics",
    summary: "Get clinic details",
    auth: "session",
    pathParams: [idParam("id", "Clinic ID")],
    responses: [{ status: 200, description: "Clinic detail", schema: clinicSchema }],
  },
  {
    method: "PATCH",
    path: "/api/clinics/{id}",
    tag: "Clinics",
    summary: "Update a clinic",
    auth: "session",
    pathParams: [idParam("id", "Clinic ID")],
    requestBody: { contentType: "application/json", schema: updateClinicSchema },
    responses: [{ status: 200, description: "Clinic updated", schema: clinicSchema }],
  },
  {
    method: "DELETE",
    path: "/api/clinics/{id}",
    tag: "Clinics",
    summary: "Delete a clinic",
    auth: "session",
    pathParams: [idParam("id", "Clinic ID")],
    responses: [{ status: 200, description: "Clinic deleted", schema: clinicSchema }],
  },
  {
    method: "GET",
    path: "/api/clinics/{id}/users",
    tag: "Clinics",
    summary: "List users assigned to a clinic",
    auth: "session",
    pathParams: [idParam("id", "Clinic ID")],
    responses: [{ status: 200, description: "Assigned user list", schema: clinicUsersResponseSchema }],
  },
  {
    method: "POST",
    path: "/api/clinics",
    tag: "Clinics",
    summary: "Create a clinic",
    auth: "session",
    requestBody: { contentType: "application/json", schema: createClinicSchema },
    responses: [{ status: 201, description: "Clinic created", schema: clinicSchema }],
  },
  {
    method: "GET",
    path: "/api/clinics",
    tag: "Clinics",
    summary: "List clinics",
    auth: "session",
    query: sharedListQuerySchema,
    responses: [{ status: 200, description: "Paginated clinic list", schema: clinicListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Consultations
// ---------------------------------------------------------------------------
const consultations: OperationEntry[] = [
  {
    method: "POST",
    path: "/api/consultations/{id}/prescriptions",
    tag: "Consultations",
    summary: "Create a prescription for a consultation",
    auth: "session",
    pathParams: [idParam("id", "Consultation ID")],
    requestBody: { contentType: "application/json", schema: createPrescriptionSchema.omit({ consultationId: true }) },
    responses: [{ status: 201, description: "Prescription created", schema: prescriptionSchema }],
  },
  {
    method: "GET",
    path: "/api/consultations/{id}/prescriptions",
    tag: "Consultations",
    summary: "List prescriptions for a consultation",
    auth: "session",
    pathParams: [idParam("id", "Consultation ID")],
    query: paginationSchema,
    responses: [{ status: 200, description: "Paginated prescription list", schema: prescriptionListResponseSchema }],
  },
  {
    method: "GET",
    path: "/api/consultations/{id}",
    tag: "Consultations",
    summary: "Get consultation details",
    auth: "session",
    pathParams: [idParam("id", "Consultation ID")],
    responses: [{ status: 200, description: "Consultation detail", schema: consultationSchema }],
  },
  {
    method: "PATCH",
    path: "/api/consultations/{id}",
    tag: "Consultations",
    summary: "Update a consultation",
    auth: "session",
    pathParams: [idParam("id", "Consultation ID")],
    requestBody: { contentType: "application/json", schema: updateConsultationSchema },
    responses: [{ status: 200, description: "Consultation updated", schema: consultationSchema }],
  },
  {
    method: "GET",
    path: "/api/consultations",
    tag: "Consultations",
    summary: "List consultations",
    auth: "session",
    query: consultationListQuerySchema,
    responses: [{ status: 200, description: "Paginated consultation list", schema: consultationListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
const invoices: OperationEntry[] = [
  {
    method: "POST",
    path: "/api/invoices/{id}/payments",
    tag: "Invoices",
    summary: "Record a payment against an invoice",
    auth: "session",
    pathParams: [idParam("id", "Invoice ID")],
    requestBody: { contentType: "application/json", schema: createPaymentSchema.omit({ invoiceId: true }) },
    responses: [{ status: 201, description: "Payment recorded", schema: paymentSchema }],
  },
  {
    method: "GET",
    path: "/api/invoices/{id}/payments",
    tag: "Invoices",
    summary: "List payments for an invoice",
    auth: "session",
    pathParams: [idParam("id", "Invoice ID")],
    responses: [{ status: 200, description: "Payment list", schema: invoicePaymentsResponseSchema }],
  },
  {
    method: "GET",
    path: "/api/invoices/{id}",
    tag: "Invoices",
    summary: "Get invoice details",
    auth: "session",
    pathParams: [idParam("id", "Invoice ID")],
    responses: [{ status: 200, description: "Invoice detail", schema: invoiceWithItemsSchema }],
  },
  {
    method: "PATCH",
    path: "/api/invoices/{id}",
    tag: "Invoices",
    summary: "Update an invoice",
    description: "Blocked entirely by the service layer once a payment exists against the invoice.",
    auth: "session",
    pathParams: [idParam("id", "Invoice ID")],
    requestBody: { contentType: "application/json", schema: updateInvoiceSchema },
    responses: [{ status: 200, description: "Invoice updated", schema: invoiceWithItemsSchema }],
  },
  {
    method: "DELETE",
    path: "/api/invoices/{id}",
    tag: "Invoices",
    summary: "Delete an invoice",
    auth: "session",
    pathParams: [idParam("id", "Invoice ID")],
    responses: [{ status: 200, description: "Invoice deleted", schema: invoiceSchema }],
  },
  {
    method: "POST",
    path: "/api/invoices",
    tag: "Invoices",
    summary: "Create an invoice",
    auth: "session",
    requestBody: { contentType: "application/json", schema: createInvoiceSchema },
    responses: [{ status: 201, description: "Invoice created", schema: invoiceWithItemsSchema }],
  },
  {
    method: "GET",
    path: "/api/invoices",
    tag: "Invoices",
    summary: "List invoices",
    auth: "session",
    query: invoiceListQuerySchema,
    responses: [{ status: 200, description: "Paginated invoice list", schema: invoiceListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
const notifications: OperationEntry[] = [
  {
    method: "GET",
    path: "/api/notifications/{id}",
    tag: "Notifications",
    summary: "Get notification details",
    auth: "session",
    pathParams: [idParam("id", "Notification ID")],
    responses: [{ status: 200, description: "Notification detail", schema: notificationSchema }],
  },
  {
    method: "POST",
    path: "/api/notifications",
    tag: "Notifications",
    summary: "Create a notification",
    auth: "session",
    requestBody: { contentType: "application/json", schema: createNotificationSchema },
    responses: [{ status: 201, description: "Notification created", schema: notificationSchema }],
  },
  {
    method: "GET",
    path: "/api/notifications",
    tag: "Notifications",
    summary: "List notifications",
    auth: "session",
    query: notificationListQuerySchema,
    responses: [{ status: 200, description: "Paginated notification list", schema: notificationListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------
const organizations: OperationEntry[] = [
  {
    method: "GET",
    path: "/api/organizations/{id}",
    tag: "Organizations",
    summary: "Get an organization's profile and subscription detail",
    description: "Any caller who may open Organization Settings (ORG_OWNER/ORG_ADMIN/SUPER_ADMIN). `subscription` is null unless the caller may also manage the subscription (ORG_OWNER/SUPER_ADMIN) -- projected per caller rather than a second endpoint.",
    auth: "session",
    pathParams: [idParam("id", "Organization ID")],
    responses: [{ status: 200, description: "Organization detail", schema: organizationDetailSchema }],
  },
  {
    method: "PATCH",
    path: "/api/organizations/{id}",
    tag: "Organizations",
    summary: "Update an organization's profile",
    description: "ORG_OWNER (own organization) or SUPER_ADMIN only. Scoped to organization_name and default_currency_code -- subscription fields go through the dedicated subscription endpoints below.",
    auth: "session",
    pathParams: [idParam("id", "Organization ID")],
    requestBody: { contentType: "application/json", schema: updateOrganizationProfileSchema },
    responses: [{ status: 200, description: "Organization profile updated", schema: organizationSchema }],
  },
  {
    method: "POST",
    path: "/api/organizations/{id}/subscription/activate",
    tag: "Organizations",
    summary: "Activate an organization's subscription",
    description: "SUPER_ADMIN only -- never self-service.",
    auth: "session",
    pathParams: [idParam("id", "Organization ID")],
    requestBody: { contentType: "application/json", schema: activateSubscriptionSchema },
    responses: [{ status: 200, description: "Subscription activated", schema: organizationSchema }],
  },
  {
    method: "POST",
    path: "/api/organizations/{id}/subscription/renew",
    tag: "Organizations",
    summary: "Renew an organization's subscription",
    auth: "session",
    pathParams: [idParam("id", "Organization ID")],
    requestBody: { contentType: "application/json", schema: activateSubscriptionSchema },
    responses: [{ status: 200, description: "Subscription renewed", schema: organizationSchema }],
  },
  {
    method: "POST",
    path: "/api/organizations/{id}/subscription/select",
    tag: "Organizations",
    summary: "Select a subscription plan for an organization",
    auth: "session",
    pathParams: [idParam("id", "Organization ID")],
    requestBody: { contentType: "application/json", schema: selectSubscriptionPlanSchema },
    responses: [{ status: 200, description: "Subscription plan selected", schema: organizationSchema }],
  },
  {
    method: "POST",
    path: "/api/organizations/bootstrap",
    tag: "Organizations",
    summary: "Bootstrap a new organization and its administrator",
    description: "SUPER_ADMIN only -- the one operation gated by withCapability at the route level (FL2).",
    auth: "session",
    capability: "canBootstrapOrganization",
    requestBody: { contentType: "application/json", schema: createOrganizationSchema },
    responses: [{ status: 201, description: "Organization and administrator created", schema: bootstrapOrganizationResultSchema }],
  },
];

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------
const packages: OperationEntry[] = [
  {
    method: "POST",
    path: "/api/packages/{id}/activate",
    tag: "Packages",
    summary: "Activate a package",
    auth: "session",
    pathParams: [idParam("id", "Package ID")],
    responses: [{ status: 200, description: "Package activated", schema: packageSchema }],
  },
  {
    method: "POST",
    path: "/api/packages/{id}/deactivate",
    tag: "Packages",
    summary: "Deactivate a package",
    auth: "session",
    pathParams: [idParam("id", "Package ID")],
    responses: [{ status: 200, description: "Package deactivated", schema: packageSchema }],
  },
  {
    method: "GET",
    path: "/api/packages/{id}",
    tag: "Packages",
    summary: "Get package details",
    auth: "session",
    pathParams: [idParam("id", "Package ID")],
    responses: [{ status: 200, description: "Package detail", schema: packageSchema }],
  },
  {
    method: "PATCH",
    path: "/api/packages/{id}",
    tag: "Packages",
    summary: "Update a package",
    auth: "session",
    pathParams: [idParam("id", "Package ID")],
    requestBody: { contentType: "application/json", schema: updatePackageSchema },
    responses: [{ status: 200, description: "Package updated", schema: packageSchema }],
  },
  {
    method: "DELETE",
    path: "/api/packages/{id}",
    tag: "Packages",
    summary: "Delete a package",
    auth: "session",
    pathParams: [idParam("id", "Package ID")],
    responses: [{ status: 200, description: "Package deleted", schema: packageSchema }],
  },
  {
    method: "POST",
    path: "/api/packages",
    tag: "Packages",
    summary: "Create a package",
    auth: "session",
    requestBody: { contentType: "application/json", schema: createPackageSchema },
    responses: [{ status: 201, description: "Package created", schema: packageSchema }],
  },
  {
    method: "GET",
    path: "/api/packages",
    tag: "Packages",
    summary: "List packages",
    auth: "session",
    query: sharedListQuerySchema,
    responses: [{ status: 200, description: "Paginated package list", schema: packageListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Patient Packages
// ---------------------------------------------------------------------------
const patientPackages: OperationEntry[] = [
  {
    method: "GET",
    path: "/api/patient-packages/{id}",
    tag: "Patient Packages",
    summary: "Get a patient package assignment's details",
    auth: "session",
    pathParams: [idParam("id", "Patient package ID")],
    responses: [{ status: 200, description: "Patient package detail", schema: patientPackageSchema }],
  },
  {
    method: "PATCH",
    path: "/api/patient-packages/{id}",
    tag: "Patient Packages",
    summary: "Update a patient package assignment",
    description: "Session counts and the package price/session snapshot are never client-writable.",
    auth: "session",
    pathParams: [idParam("id", "Patient package ID")],
    requestBody: { contentType: "application/json", schema: updatePatientPackageSchema },
    responses: [{ status: 200, description: "Patient package updated", schema: patientPackageSchema }],
  },
  {
    method: "DELETE",
    path: "/api/patient-packages/{id}",
    tag: "Patient Packages",
    summary: "Delete a patient package assignment",
    auth: "session",
    pathParams: [idParam("id", "Patient package ID")],
    responses: [{ status: 200, description: "Patient package deleted", schema: patientPackageSchema }],
  },
  {
    method: "GET",
    path: "/api/patient-packages/{id}/usage",
    tag: "Patient Packages",
    summary: "List session usage for a patient package assignment",
    auth: "session",
    pathParams: [idParam("id", "Patient package ID")],
    query: paginationSchema,
    responses: [{ status: 200, description: "Paginated session usage list", schema: packageSessionUsageListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------
const patients: OperationEntry[] = [
  {
    method: "POST",
    path: "/api/patients/{id}/packages",
    tag: "Patients",
    summary: "Assign a package to a patient",
    auth: "session",
    pathParams: [idParam("id", "Patient ID")],
    requestBody: { contentType: "application/json", schema: createPatientPackageSchema.omit({ patientId: true }) },
    responses: [{ status: 201, description: "Package assigned", schema: patientPackageSchema }],
  },
  {
    method: "GET",
    path: "/api/patients/{id}/packages",
    tag: "Patients",
    summary: "List a patient's package assignments",
    auth: "session",
    pathParams: [idParam("id", "Patient ID")],
    query: patientPackageListQuerySchema.omit({ patientId: true }),
    responses: [{ status: 200, description: "Paginated patient package list", schema: patientPackageListResponseSchema }],
  },
  {
    method: "GET",
    path: "/api/patients/{id}/records/{recordId}",
    tag: "Patients",
    summary: "Get a patient record's details",
    auth: "session",
    pathParams: [idParam("id", "Patient ID"), idParam("recordId", "Patient record ID")],
    responses: [{ status: 200, description: "Patient record detail, with a signed download URL", schema: patientRecordWithDownloadUrlSchema }],
  },
  {
    method: "DELETE",
    path: "/api/patients/{id}/records/{recordId}",
    tag: "Patients",
    summary: "Delete a patient record",
    description: "Soft-deletes the row and removes the Storage object. ORG_OWNER/ORG_ADMIN only; not reversible.",
    auth: "session",
    pathParams: [idParam("id", "Patient ID"), idParam("recordId", "Patient record ID")],
    responses: [{ status: 200, description: "Patient record deleted", schema: patientRecordSchema }],
  },
  {
    method: "POST",
    path: "/api/patients/{id}/records",
    tag: "Patients",
    summary: "Upload a patient record",
    description: "Multipart: file presence, size, and MIME type are validated in the route, not the validator (FL4).",
    auth: "session",
    pathParams: [idParam("id", "Patient ID")],
    requestBody: {
      contentType: "multipart/form-data",
      schema: createPatientRecordSchema,
      fileField: {
        name: "file",
        description: "The record file.",
        maxSizeBytes: 20 * 1024 * 1024,
        allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      },
    },
    extraErrors: [
      { status: 400, description: "Invalid multipart payload" },
      { status: 400, description: "A file is required" },
      { status: 400, description: "The uploaded file is empty" },
      { status: 400, description: "File exceeds the maximum allowed size of 20MiB" },
      { status: 400, description: "Unsupported file type" },
    ],
    responses: [{ status: 201, description: "Patient record created", schema: patientRecordSchema }],
  },
  {
    method: "GET",
    path: "/api/patients/{id}/records",
    tag: "Patients",
    summary: "List a patient's uploaded records",
    auth: "session",
    pathParams: [idParam("id", "Patient ID")],
    query: sharedListQuerySchema,
    responses: [{ status: 200, description: "Paginated patient record list", schema: patientRecordListResponseSchema }],
  },
  {
    method: "GET",
    path: "/api/patients/{id}",
    tag: "Patients",
    summary: "Get patient details",
    auth: "session",
    pathParams: [idParam("id", "Patient ID")],
    responses: [{ status: 200, description: "Patient detail", schema: patientSchema }],
  },
  {
    method: "PATCH",
    path: "/api/patients/{id}",
    tag: "Patients",
    summary: "Update a patient",
    auth: "session",
    pathParams: [idParam("id", "Patient ID")],
    requestBody: { contentType: "application/json", schema: updatePatientSchema },
    responses: [{ status: 200, description: "Patient updated", schema: patientSchema }],
  },
  {
    method: "DELETE",
    path: "/api/patients/{id}",
    tag: "Patients",
    summary: "Delete a patient",
    auth: "session",
    pathParams: [idParam("id", "Patient ID")],
    responses: [{ status: 200, description: "Patient deleted", schema: patientSchema }],
  },
  {
    method: "POST",
    path: "/api/patients",
    tag: "Patients",
    summary: "Create a patient",
    auth: "session",
    requestBody: { contentType: "application/json", schema: createPatientSchema },
    responses: [{ status: 201, description: "Patient created", schema: patientSchema }],
  },
  {
    method: "GET",
    path: "/api/patients",
    tag: "Patients",
    summary: "List patients",
    auth: "session",
    query: patientListQuerySchema,
    responses: [{ status: 200, description: "Paginated patient list", schema: patientListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
const payments: OperationEntry[] = [
  {
    method: "GET",
    path: "/api/payments/{id}",
    tag: "Payments",
    summary: "Get payment details",
    auth: "session",
    pathParams: [idParam("id", "Payment ID")],
    responses: [{ status: 200, description: "Payment detail", schema: paymentSchema }],
  },
  {
    method: "PATCH",
    path: "/api/payments/{id}/status",
    tag: "Payments",
    summary: "Transition a payment's status",
    description: "Only completed -> refunded and completed -> cancelled are legal; enforced by the service layer.",
    auth: "session",
    pathParams: [idParam("id", "Payment ID")],
    requestBody: { contentType: "application/json", schema: updatePaymentStatusSchema },
    responses: [{ status: 200, description: "Payment status updated", schema: paymentSchema }],
  },
];

// ---------------------------------------------------------------------------
// Prescriptions
// ---------------------------------------------------------------------------
const prescriptions: OperationEntry[] = [
  {
    method: "GET",
    path: "/api/prescriptions/{id}",
    tag: "Prescriptions",
    summary: "Get prescription details",
    auth: "session",
    pathParams: [idParam("id", "Prescription ID")],
    responses: [{ status: 200, description: "Prescription detail", schema: prescriptionSchema }],
  },
  {
    method: "PATCH",
    path: "/api/prescriptions/{id}",
    tag: "Prescriptions",
    summary: "Update a prescription",
    auth: "session",
    pathParams: [idParam("id", "Prescription ID")],
    requestBody: { contentType: "application/json", schema: updatePrescriptionSchema },
    responses: [{ status: 200, description: "Prescription updated", schema: prescriptionSchema }],
  },
];

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
const reports: OperationEntry[] = [
  {
    method: "GET",
    path: "/api/reports/billing/export",
    tag: "Reports",
    summary: "Export the billing report as a file",
    description: "Same data as GET /api/reports/billing -- the export never filters or aggregates independently.",
    auth: "session",
    query: billingReportQuerySchema.extend({ format: z.enum(["xlsx", "pdf"]) }),
    responses: [{ status: 200, description: "Billing report file", binary: { contentTypes: XLSX_PDF_CONTENT_TYPES } }],
  },
  {
    method: "GET",
    path: "/api/reports/billing",
    tag: "Reports",
    summary: "Get the billing report",
    auth: "session",
    query: billingReportQuerySchema,
    responses: [{ status: 200, description: "Billing report", schema: billingReportSchema }],
  },
  {
    method: "GET",
    path: "/api/reports/commission/export",
    tag: "Reports",
    summary: "Export the commission report as a file",
    auth: "session",
    query: commissionReportQuerySchema.extend({ format: z.enum(["xlsx", "pdf"]) }),
    responses: [{ status: 200, description: "Commission report file", binary: { contentTypes: XLSX_PDF_CONTENT_TYPES } }],
  },
  {
    method: "GET",
    path: "/api/reports/commission",
    tag: "Reports",
    summary: "Get the commission report",
    auth: "session",
    query: commissionReportQuerySchema,
    responses: [{ status: 200, description: "Commission report", schema: commissionReportSchema }],
  },
  {
    method: "GET",
    path: "/api/reports/physiotherapists/export",
    tag: "Reports",
    summary: "Export the physiotherapist report as a file",
    auth: "session",
    query: physiotherapistReportQuerySchema.extend({ format: z.enum(["xlsx", "pdf"]) }),
    responses: [{ status: 200, description: "Physiotherapist report file", binary: { contentTypes: XLSX_PDF_CONTENT_TYPES } }],
  },
  {
    method: "GET",
    path: "/api/reports/physiotherapists",
    tag: "Reports",
    summary: "Get the physiotherapist report",
    auth: "session",
    query: physiotherapistReportQuerySchema,
    responses: [{ status: 200, description: "Physiotherapist report", schema: physiotherapistReportSchema }],
  },
];

// ---------------------------------------------------------------------------
// Subscription Plans
// ---------------------------------------------------------------------------
const subscriptionPlans: OperationEntry[] = [
  {
    method: "GET",
    path: "/api/subscription-plans",
    tag: "Subscription Plans",
    summary: "List the self-service subscription plan catalog",
    description: "ORG_OWNER or SUPER_ADMIN only -- excludes the internal NO_SUBSCRIPTION marker plan.",
    auth: "session",
    responses: [{ status: 200, description: "Subscription plan catalog", schema: subscriptionPlanListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// User Clinics
// ---------------------------------------------------------------------------
const userClinics: OperationEntry[] = [
  {
    method: "POST",
    path: "/api/user-clinics",
    tag: "User Clinics",
    summary: "Assign a user to a clinic",
    auth: "session",
    requestBody: { contentType: "application/json", schema: assignUserClinicSchema },
    responses: [{ status: 201, description: "Assignment created", schema: userClinicSchema }],
  },
  {
    method: "DELETE",
    path: "/api/user-clinics",
    tag: "User Clinics",
    summary: "Remove a user's clinic assignment",
    description: "Validated by hand in the route -- no reusable schema exists for this pair of query params (FL5).",
    auth: "session",
    query: [
      { name: "userId", description: "User ID", required: true, schema: z.string().uuid() },
      { name: "clinicId", description: "Clinic ID", required: true, schema: z.string().uuid() },
    ],
    extraErrors: [{ status: 400, description: "Missing userId or clinicId parameter" }],
    responses: [{ status: 200, description: "Assignment removed", schema: userClinicSchema }],
  },
];

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const users: OperationEntry[] = [
  {
    method: "POST",
    path: "/api/users/{id}/activate",
    tag: "Users",
    summary: "Reactivate a user",
    auth: "session",
    pathParams: [idParam("id", "User ID")],
    responses: [{ status: 200, description: "User activated", schema: userSchema }],
  },
  {
    method: "POST",
    path: "/api/users/{id}/change-role",
    tag: "Users",
    summary: "Change a user's role",
    auth: "session",
    pathParams: [idParam("id", "User ID")],
    requestBody: { contentType: "application/json", schema: changeUserRoleSchema },
    responses: [{ status: 200, description: "Role changed", schema: userSchema }],
  },
  {
    method: "GET",
    path: "/api/users/{id}/clinics",
    tag: "Users",
    summary: "List a user's clinic assignments",
    auth: "session",
    pathParams: [idParam("id", "User ID")],
    responses: [{ status: 200, description: "Clinic assignment list", schema: userClinicsResponseSchema }],
  },
  {
    method: "GET",
    path: "/api/users/{id}/compensation",
    tag: "Users",
    summary: "Get a user's compensation history",
    description: "Owner-only (ADR-0011) -- returns the full history, newest-first (D2).",
    auth: "session",
    pathParams: [idParam("id", "User ID")],
    responses: [{ status: 200, description: "Compensation history", schema: userCompensationHistorySchema }],
  },
  {
    method: "POST",
    path: "/api/users/{id}/compensation",
    tag: "Users",
    summary: "Set a user's compensation record",
    auth: "session",
    pathParams: [idParam("id", "User ID")],
    requestBody: { contentType: "application/json", schema: setUserCompensationSchema },
    responses: [{ status: 201, description: "Compensation record set", schema: userCompensationSchema }],
  },
  {
    method: "POST",
    path: "/api/users/{id}/reset-password",
    tag: "Users",
    summary: "Reset a user's password (admin-mediated)",
    description: "The reveal-once initial password, regenerated. The only recovery path for roles with a placeholder email (Hole B).",
    auth: "session",
    pathParams: [idParam("id", "User ID")],
    responses: [{ status: 200, description: "Password reset", schema: resetUserPasswordResultSchema }],
  },
  {
    method: "POST",
    path: "/api/users/{id}/deactivate",
    tag: "Users",
    summary: "Deactivate a user",
    auth: "session",
    pathParams: [idParam("id", "User ID")],
    responses: [{ status: 200, description: "User deactivated", schema: userSchema }],
  },
  {
    method: "GET",
    path: "/api/users/{id}",
    tag: "Users",
    summary: "Get user details",
    description: "Carries a server-computed `canManage` hint (ADR-0010).",
    auth: "session",
    pathParams: [idParam("id", "User ID")],
    responses: [{ status: 200, description: "User detail", schema: userDetailResponseSchema }],
  },
  {
    method: "PATCH",
    path: "/api/users/{id}",
    tag: "Users",
    summary: "Update a user's profile",
    auth: "session",
    pathParams: [idParam("id", "User ID")],
    requestBody: { contentType: "application/json", schema: updateUserProfileSchema },
    responses: [{ status: 200, description: "Profile updated", schema: userSchema }],
  },
  {
    method: "DELETE",
    path: "/api/users/{id}",
    tag: "Users",
    summary: "Off-board a user",
    auth: "session",
    pathParams: [idParam("id", "User ID")],
    responses: [{ status: 200, description: "User off-boarded", schema: userSchema }],
  },
  {
    method: "GET",
    path: "/api/users/me",
    tag: "Users",
    summary: "Get the caller's own identity, role, and capabilities",
    description: "The current-user contract (ADR-0003) -- the seam F2's response contract layer replaces.",
    auth: "session",
    responses: [{ status: 200, description: "Current-user contract", schema: currentUserSchema }],
  },
  {
    method: "POST",
    path: "/api/users",
    tag: "Users",
    summary: "Create an organization user",
    description: "Authorization depends on the validated target role, so it is checked in the handler body, not withCapability.",
    auth: "session",
    requestBody: { contentType: "application/json", schema: createOrganizationUserSchema },
    responses: [{ status: 201, description: "User created", schema: createOrganizationUserResultSchema }],
  },
  {
    method: "GET",
    path: "/api/users",
    tag: "Users",
    summary: "List organization users",
    auth: "session",
    query: sharedListQuerySchema.extend({ role: z.string().optional() }),
    responses: [{ status: 200, description: "Paginated user list", schema: userListResponseSchema }],
  },
];

// ---------------------------------------------------------------------------
// Platform (the API explorer's own spec endpoint, F2/ADR-0009)
// ---------------------------------------------------------------------------
const platform: OperationEntry[] = [
  {
    method: "GET",
    path: "/api/platform/openapi",
    tag: "Platform",
    summary: "Get the platform API's OpenAPI document",
    description: "SUPER_ADMIN only, and hard-disabled in production regardless of role.",
    auth: "session",
    capability: "canExplorePlatformApi",
    responses: [
      { status: 200, description: "The OpenAPI 3.1 document" },
      { status: 404, description: "Not found -- the explorer is disabled in this environment." },
    ],
  },
];

export const registry: OperationEntry[] = [
  ...appointments,
  ...attendance,
  ...auditLogs,
  ...auth,
  ...clinics,
  ...consultations,
  ...invoices,
  ...notifications,
  ...organizations,
  ...packages,
  ...patientPackages,
  ...patients,
  ...payments,
  ...prescriptions,
  ...platform,
  ...reports,
  ...subscriptionPlans,
  ...userClinics,
  ...users,
];

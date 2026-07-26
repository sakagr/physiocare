import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import * as bootstrapRoute from "@/app/api/organizations/bootstrap/route";
import * as usersRoute from "@/app/api/users/route";
import * as meRoute from "@/app/api/users/me/route";
import * as userRoute from "@/app/api/users/[id]/route";
import * as activateUserRoute from "@/app/api/users/[id]/activate/route";
import * as deactivateUserRoute from "@/app/api/users/[id]/deactivate/route";
import * as changeRoleRoute from "@/app/api/users/[id]/change-role/route";
import * as userClinicsRoute from "@/app/api/users/[id]/clinics/route";
import * as clinicsRoute from "@/app/api/clinics/route";
import * as clinicRoute from "@/app/api/clinics/[id]/route";
import * as activateClinicRoute from "@/app/api/clinics/[id]/activate/route";
import * as deactivateClinicRoute from "@/app/api/clinics/[id]/deactivate/route";
import * as clinicUsersRoute from "@/app/api/clinics/[id]/users/route";
import * as assignmentsRoute from "@/app/api/user-clinics/route";
import * as patientsRoute from "@/app/api/patients/route";
import * as patientRoute from "@/app/api/patients/[id]/route";
import * as appointmentsRoute from "@/app/api/appointments/route";
import * as appointmentRoute from "@/app/api/appointments/[id]/route";
import * as appointmentStatusRoute from "@/app/api/appointments/[id]/status/route";
import * as patientRecordsRoute from "@/app/api/patients/[id]/records/route";
import * as patientRecordRoute from "@/app/api/patients/[id]/records/[recordId]/route";
import * as consultationCreateRoute from "@/app/api/appointments/[id]/consultation/route";
import * as consultationsRoute from "@/app/api/consultations/route";
import * as consultationRoute from "@/app/api/consultations/[id]/route";
import * as prescriptionCreateRoute from "@/app/api/consultations/[id]/prescriptions/route";
import * as prescriptionRoute from "@/app/api/prescriptions/[id]/route";
import * as packagesRoute from "@/app/api/packages/route";
import * as packageRoute from "@/app/api/packages/[id]/route";
import * as activatePackageRoute from "@/app/api/packages/[id]/activate/route";
import * as deactivatePackageRoute from "@/app/api/packages/[id]/deactivate/route";
import * as patientPackagesCreateRoute from "@/app/api/patients/[id]/packages/route";
import * as patientPackageRoute from "@/app/api/patient-packages/[id]/route";
import * as patientPackageUsageRoute from "@/app/api/patient-packages/[id]/usage/route";
import * as invoicesRoute from "@/app/api/invoices/route";
import * as invoiceRoute from "@/app/api/invoices/[id]/route";
import * as invoicePaymentsRoute from "@/app/api/invoices/[id]/payments/route";
import * as paymentRoute from "@/app/api/payments/[id]/route";
import * as paymentStatusRoute from "@/app/api/payments/[id]/status/route";
import * as attendanceRoute from "@/app/api/attendance/route";
import * as attendanceDetailRoute from "@/app/api/attendance/[id]/route";
import * as attendanceCheckoutRoute from "@/app/api/attendance/[id]/checkout/route";
import * as notificationsRoute from "@/app/api/notifications/route";
import * as notificationRoute from "@/app/api/notifications/[id]/route";
import * as auditLogsRoute from "@/app/api/audit-logs/route";
import * as billingReportRoute from "@/app/api/reports/billing/route";
import * as physiotherapistReportRoute from "@/app/api/reports/physiotherapists/route";
import * as billingReportExportRoute from "@/app/api/reports/billing/export/route";
import * as physiotherapistReportExportRoute from "@/app/api/reports/physiotherapists/export/route";

const request = (method = "GET", body?: unknown) => new NextRequest("http://localhost/api/test", {
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
  headers: body === undefined ? undefined : { "content-type": "application/json" },
});

const context = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) };
const recordContext = {
  params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001", recordId: "00000000-0000-4000-8000-000000000002" }),
};
const multipartRequest = () => new NextRequest("http://localhost/api/test", { method: "POST", body: new FormData() });

describe("public API authentication", () => {
  const protectedEndpoints = [
    ["organization bootstrap", () => bootstrapRoute.POST(request("POST", {}))],
    ["users create", () => usersRoute.POST(request("POST", {}))],
    ["users list", () => usersRoute.GET(request())],
    ["current user", () => meRoute.GET(request())],
    ["user detail", () => userRoute.GET(request(), context)],
    ["user profile update", () => userRoute.PATCH(request("PATCH", {}), context)],
    ["user offboard", () => userRoute.DELETE(request("DELETE"), context)],
    ["user activation", () => activateUserRoute.POST(request("POST"), context)],
    ["user deactivation", () => deactivateUserRoute.POST(request("POST"), context)],
    ["user role change", () => changeRoleRoute.POST(request("POST", {}), context)],
    ["user clinics", () => userClinicsRoute.GET(request(), context)],
    ["clinics create", () => clinicsRoute.POST(request("POST", {}))],
    ["clinics list", () => clinicsRoute.GET(request())],
    ["clinic detail", () => clinicRoute.GET(request(), context)],
    ["clinic update", () => clinicRoute.PATCH(request("PATCH", {}), context)],
    ["clinic delete", () => clinicRoute.DELETE(request("DELETE"), context)],
    ["clinic activation", () => activateClinicRoute.POST(request("POST"), context)],
    ["clinic deactivation", () => deactivateClinicRoute.POST(request("POST"), context)],
    ["clinic users", () => clinicUsersRoute.GET(request(), context)],
    ["clinic assignment", () => assignmentsRoute.POST(request("POST", {}))],
    ["clinic assignment removal", () => assignmentsRoute.DELETE(request("DELETE", {}))],
    ["patients create", () => patientsRoute.POST(request("POST", {}))],
    ["patients list", () => patientsRoute.GET(request())],
    ["patient detail", () => patientRoute.GET(request(), context)],
    ["patient update", () => patientRoute.PATCH(request("PATCH", {}), context)],
    ["patient delete", () => patientRoute.DELETE(request("DELETE"), context)],
    ["appointments create", () => appointmentsRoute.POST(request("POST", {}))],
    ["appointments list", () => appointmentsRoute.GET(request())],
    ["appointment detail", () => appointmentRoute.GET(request(), context)],
    ["appointment update", () => appointmentRoute.PATCH(request("PATCH", {}), context)],
    ["appointment delete", () => appointmentRoute.DELETE(request("DELETE"), context)],
    ["appointment status update", () => appointmentStatusRoute.PATCH(request("PATCH", {}), context)],
    ["patient records upload", () => patientRecordsRoute.POST(multipartRequest(), context)],
    ["patient records list", () => patientRecordsRoute.GET(request(), context)],
    ["patient record detail", () => patientRecordRoute.GET(request(), recordContext)],
    ["consultation create", () => consultationCreateRoute.POST(request("POST", {}), context)],
    ["consultations list", () => consultationsRoute.GET(request())],
    ["consultation detail", () => consultationRoute.GET(request(), context)],
    ["consultation update", () => consultationRoute.PATCH(request("PATCH", {}), context)],
    ["prescription create", () => prescriptionCreateRoute.POST(request("POST", {}), context)],
    ["prescriptions list", () => prescriptionCreateRoute.GET(request(), context)],
    ["prescription detail", () => prescriptionRoute.GET(request(), context)],
    ["prescription update", () => prescriptionRoute.PATCH(request("PATCH", {}), context)],
    ["packages create", () => packagesRoute.POST(request("POST", {}))],
    ["packages list", () => packagesRoute.GET(request())],
    ["package detail", () => packageRoute.GET(request(), context)],
    ["package update", () => packageRoute.PATCH(request("PATCH", {}), context)],
    ["package delete", () => packageRoute.DELETE(request("DELETE"), context)],
    ["package activation", () => activatePackageRoute.POST(request("POST"), context)],
    ["package deactivation", () => deactivatePackageRoute.POST(request("POST"), context)],
    ["patient package create", () => patientPackagesCreateRoute.POST(request("POST", {}), context)],
    ["patient packages list", () => patientPackagesCreateRoute.GET(request(), context)],
    ["patient package detail", () => patientPackageRoute.GET(request(), context)],
    ["patient package update", () => patientPackageRoute.PATCH(request("PATCH", {}), context)],
    ["patient package delete", () => patientPackageRoute.DELETE(request("DELETE"), context)],
    ["patient package usage", () => patientPackageUsageRoute.GET(request(), context)],
    ["invoices create", () => invoicesRoute.POST(request("POST", {}))],
    ["invoices list", () => invoicesRoute.GET(request())],
    ["invoice detail", () => invoiceRoute.GET(request(), context)],
    ["invoice update", () => invoiceRoute.PATCH(request("PATCH", {}), context)],
    ["invoice delete", () => invoiceRoute.DELETE(request("DELETE"), context)],
    ["invoice payment create", () => invoicePaymentsRoute.POST(request("POST", {}), context)],
    ["invoice payments list", () => invoicePaymentsRoute.GET(request(), context)],
    ["payment detail", () => paymentRoute.GET(request(), context)],
    ["payment status update", () => paymentStatusRoute.PATCH(request("PATCH", {}), context)],
    ["attendance check-in", () => attendanceRoute.POST(request("POST", {}))],
    ["attendance list", () => attendanceRoute.GET(request())],
    ["attendance detail", () => attendanceDetailRoute.GET(request(), context)],
    ["attendance update", () => attendanceDetailRoute.PATCH(request("PATCH", {}), context)],
    ["attendance checkout", () => attendanceCheckoutRoute.PATCH(request("PATCH"), context)],
    ["notification create", () => notificationsRoute.POST(request("POST", {}))],
    ["notifications list", () => notificationsRoute.GET(request())],
    ["notification detail", () => notificationRoute.GET(request(), context)],
    ["audit logs list", () => auditLogsRoute.GET(request())],
    ["billing report", () => billingReportRoute.GET(request())],
    ["physiotherapist report", () => physiotherapistReportRoute.GET(request())],
    ["billing report export", () => billingReportExportRoute.GET(request())],
    ["physiotherapist report export", () => physiotherapistReportExportRoute.GET(request())],
  ] as const;

  it.each(protectedEndpoints)("returns 401 for unauthenticated %s requests", async (_name, invoke) => {
    const response = await invoke();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});

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

const request = (method = "GET", body?: unknown) => new NextRequest("http://localhost/api/test", {
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
  headers: body === undefined ? undefined : { "content-type": "application/json" },
});

const context = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) };

describe("public API authentication", () => {
  const protectedEndpoints = [
    ["organization bootstrap", () => bootstrapRoute.POST(request("POST", {}))],
    ["users create", () => usersRoute.POST(request("POST", {}))],
    ["users list", () => usersRoute.GET(request())],
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
  ] as const;

  it.each(protectedEndpoints)("returns 401 for unauthenticated %s requests", async (_name, invoke) => {
    const response = await invoke();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});

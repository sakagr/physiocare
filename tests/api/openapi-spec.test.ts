import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, isApiExplorerEnabledMock, canExplorePlatformApiMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  isApiExplorerEnabledMock: vi.fn(),
  canExplorePlatformApiMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: getUserMock } })),
}));
vi.mock("@/lib/env", () => ({ isApiExplorerEnabled: isApiExplorerEnabledMock }));
vi.mock("@/server/services/authorization.service", () => ({
  canExplorePlatformApi: canExplorePlatformApiMock,
}));

import { GET } from "@/app/api/platform/openapi/route";

const request = () => new NextRequest("http://localhost/api/platform/openapi");

/**
 * `GET /api/platform/openapi` (F2, ADR-0009): the spec endpoint itself is
 * env-gated and SUPER_ADMIN-only, same as the explorer page. Env is checked
 * *before* authentication -- a spec enumerates the whole attack surface, so
 * a disabled environment must 404 rather than reveal the route exists via a
 * 401/403.
 */
describe("GET /api/platform/openapi", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    isApiExplorerEnabledMock.mockReset();
    canExplorePlatformApiMock.mockReset();
  });

  it("404s when the explorer is disabled, without ever consulting the session", async () => {
    isApiExplorerEnabledMock.mockReturnValue(false);

    const response = await GET(request());

    expect(response.status).toBe(404);
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("401s when the explorer is enabled but there is no session", async () => {
    isApiExplorerEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  it("403s for an authenticated caller without the capability (the PLATFORM_SUPPORT regression case)", async () => {
    isApiExplorerEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    canExplorePlatformApiMock.mockResolvedValue(false);

    const response = await GET(request());

    expect(response.status).toBe(403);
  });

  it("200s with the OpenAPI document for a caller with the capability", async () => {
    isApiExplorerEnabledMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-super" } }, error: null });
    canExplorePlatformApiMock.mockResolvedValue(true);

    const response = await GET(request());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.openapi).toMatch(/^3\.1\./);
    expect(body.paths["/api/platform/openapi"]).toBeDefined();
  });
});

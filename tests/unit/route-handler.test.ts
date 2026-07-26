import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { AppError, ErrorCodes } from "@/server/errors";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));

import { createRouteHandler, mapErrorToResponse, withCapability } from "@/lib/api/route-handler";

const request = () => new NextRequest("http://localhost/api/test");

describe("mapErrorToResponse", () => {
  it("maps SyntaxError to 400 Invalid JSON payload", async () => {
    const response = mapErrorToResponse(new SyntaxError("Unexpected token"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON payload" });
  });

  it("maps ZodError to 400 with issue details", async () => {
    const zodError = z.object({ name: z.string() }).safeParse({}).error as ZodError;
    const response = mapErrorToResponse(zodError);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request payload");
    expect(body.details).toBeDefined();
  });

  it("maps AppError to its configured HTTP status", async () => {
    const response = mapErrorToResponse(new AppError("Forbidden: nope", ErrorCodes.FORBIDDEN));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden: nope", code: "FORBIDDEN" });
  });

  it("maps NOT_FOUND AppError to 404", async () => {
    const response = mapErrorToResponse(new AppError("Missing", ErrorCodes.NOT_FOUND));
    expect(response.status).toBe(404);
  });

  it("maps a conflict AppError to 409", async () => {
    const response = mapErrorToResponse(new AppError("Duplicate", ErrorCodes.EMAIL_ALREADY_EXISTS));
    expect(response.status).toBe(409);
  });

  it("maps unknown errors to 500 Internal Server Error", async () => {
    const response = mapErrorToResponse(new Error("boom"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal Server Error" });
  });
});

describe("createRouteHandler", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const handler = vi.fn();
    const route = createRouteHandler(handler);

    const response = await route(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when auth.getUser() errors", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error("session expired") });
    const handler = vi.fn();
    const route = createRouteHandler(handler);

    const response = await route(request());

    expect(response.status).toBe(401);
  });

  it("invokes the handler with supabase, user, and resolved params when authenticated", async () => {
    const user = { id: "user-1" };
    getUserMock.mockResolvedValue({ data: { user }, error: null });
    const handler = vi.fn(async (_req, ctx) => {
      expect(ctx.user).toBe(user);
      expect(ctx.supabase).toBeDefined();
      expect(ctx.params).toEqual({ id: "entity-1" });
      return NextResponse.json({ ok: true }, { status: 200 });
    });
    const route = createRouteHandler<{ id: string }>(handler);

    const response = await route(request(), { params: Promise.resolve({ id: "entity-1" }) });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("invokes the handler with empty params when no route context is supplied", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const handler = vi.fn(async (_req, ctx) => {
      expect(ctx.params).toEqual({});
      return NextResponse.json({ ok: true }, { status: 200 });
    });
    const route = createRouteHandler(handler);

    await route(request());

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("maps errors thrown by the handler through mapErrorToResponse", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const handler = vi.fn(async () => {
      throw new AppError("Forbidden: nope", ErrorCodes.FORBIDDEN);
    });
    const route = createRouteHandler(handler);

    const response = await route(request());

    expect(response.status).toBe(403);
  });
});

describe("withCapability", () => {
  it("calls the handler when the capability check passes", async () => {
    const capability = vi.fn(async () => true);
    const handler = vi.fn(async () => NextResponse.json({ ok: true }, { status: 200 }));
    const guarded = withCapability(capability, handler);

    const supabase = {} as never;
    const response = await guarded(request(), { supabase, user: { id: "user-1" } as never, params: {} });

    expect(capability).toHaveBeenCalledWith(supabase, "user-1");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("throws a FORBIDDEN AppError without calling the handler when the capability check fails", async () => {
    const capability = vi.fn(async () => false);
    const handler = vi.fn();
    const guarded = withCapability(capability, handler);

    await expect(
      guarded(request(), { supabase: {} as never, user: { id: "user-1" } as never, params: {} })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
    expect(handler).not.toHaveBeenCalled();
  });
});

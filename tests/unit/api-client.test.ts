import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, api } from "@/lib/api/client";
import { ApiError, TransportErrorCodes } from "@/lib/api/api-error";

/**
 * These tests exercise the browser path of the isomorphic client, so a
 * `window` global is stubbed to make `isServer()` return false (no
 * `next/headers`, relative URLs).
 */
function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("isomorphic API client (browser path)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {} as unknown as Window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the parsed body on a 2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ id: "u1" })));

    await expect(apiFetch<{ id: string }>("/api/users/me")).resolves.toEqual({ id: "u1" });
  });

  it("sends JSON and a relative URL for a POST via the verb helper", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => jsonResponse({ ok: true }, { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.post("/api/patients", { fullName: "Jane" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/patients");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ fullName: "Jane" }));
  });

  it("throws a typed ApiError carrying code and details on a 4xx envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { error: "This email is already in use.", code: "EMAIL_ALREADY_EXISTS" },
          { status: 409 }
        )
      )
    );

    const error = (await apiFetch("/api/users").catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(error.message).toBe("This email is already in use.");
  });

  it("preserves validation details on a 400 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { error: "Invalid request payload", details: [{ path: ["email"], message: "Invalid" }] },
          { status: 400 }
        )
      )
    );

    const error = (await apiFetch("/api/users").catch((e) => e)) as ApiError;
    expect(error.status).toBe(400);
    expect(error.details).toEqual([{ path: ["email"], message: "Invalid" }]);
  });

  it("marks a 401 as an unauthenticated transport error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "Unauthorized" }, { status: 401 }))
    );

    const error = (await apiFetch("/api/users/me").catch((e) => e)) as ApiError;
    expect(error.status).toBe(401);
    expect(error.code).toBe(TransportErrorCodes.UNAUTHENTICATED);
  });

  it("wraps a fetch/transport rejection as a network ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    const error = (await apiFetch("/api/users/me").catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.isNetworkError).toBe(true);
    expect(error.code).toBe(TransportErrorCodes.NETWORK);
  });

  it("returns undefined for an empty (204) body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 }))
    );

    await expect(apiFetch("/api/patients/x")).resolves.toBeUndefined();
  });
});

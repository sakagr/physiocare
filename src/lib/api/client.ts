import { ApiError, TransportErrorCodes } from "./api-error";

/**
 * The isomorphic API client. It reaches the app's own `/api` routes
 * identically on the server and in the browser -- the single HTTP contract
 * for both reads and writes (AGENTS.md → "Backend Communication").
 *
 * On the server it resolves an absolute origin and forwards the request's
 * session cookie via `next/headers`, so a Server Component prefetch is
 * authenticated exactly like a browser call. It is also the single place
 * that parses the `{ error, code, details }` envelope and throws a typed
 * `ApiError`; nothing downstream hand-parses responses.
 */

/** Evaluated per call so tests can simulate either environment. */
const isServer = () => typeof window === "undefined";

/** Envelope shape returned by every route on failure. */
interface ErrorEnvelope {
  error?: string;
  code?: string;
  details?: unknown;
}

/**
 * Resolves the absolute origin for server-side calls from the incoming
 * request headers. In the browser, relative URLs are used, so this is only
 * consulted on the server.
 */
async function resolveServerOrigin(): Promise<string> {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") || host?.startsWith("127.0.0.1")
      ? "http"
      : "https");
  if (!host) {
    throw new ApiError(
      "Unable to resolve request origin on the server",
      0,
      TransportErrorCodes.NETWORK
    );
  }
  return `${proto}://${host}`;
}

/**
 * Builds the request URL. Server calls become absolute and carry the session
 * cookie; browser calls stay relative.
 */
async function buildRequest(
  path: string,
  init: RequestInit
): Promise<{ url: string; init: RequestInit }> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (!isServer()) {
    return { url: path, init: { ...init, headers } };
  }

  const { headers: nextHeaders } = await import("next/headers");
  const incoming = await nextHeaders();
  const cookie = incoming.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const origin = await resolveServerOrigin();
  const url = new URL(path, origin).toString();
  return { url, init: { ...init, headers, cache: init.cache ?? "no-store" } };
}

/** Parses a response body as JSON, tolerating an empty body. */
async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Performs a request against `/api` and returns the parsed JSON body typed as
 * `T`. Throws `ApiError` on any non-2xx response or transport failure.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const request = await buildRequest(path, init);

  let response: Response;
  try {
    response = await fetch(request.url, request.init);
  } catch (cause) {
    throw new ApiError(
      "Network request failed",
      0,
      TransportErrorCodes.NETWORK,
      cause
    );
  }

  const body = await parseBody(response);

  if (!response.ok) {
    const envelope = (body ?? {}) as ErrorEnvelope;
    const code =
      response.status === 401
        ? envelope.code ?? TransportErrorCodes.UNAUTHENTICATED
        : envelope.code ?? null;
    const message =
      envelope.error ?? response.statusText ?? "Request failed";
    throw new ApiError(message, response.status, code, envelope.details);
  }

  return body as T;
}

/** Convenience helpers for the common verbs. All return the parsed body. */
export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "POST",
      headers: { "Content-Type": "application/json", ...init?.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...init?.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "PUT",
      headers: { "Content-Type": "application/json", ...init?.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: "DELETE" }),
};

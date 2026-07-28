/**
 * The try-it-out executor (F2, decision #5 / ADR-0009).
 *
 * Deliberately raw `fetch`, not `src/lib/api/client.ts`: that client parses
 * the `{ error, code, details }` envelope and throws a typed `ApiError` on
 * any non-2xx response, which would swallow the raw status, headers, and
 * body this explorer exists to display verbatim -- including for the
 * three binary export routes, which are not JSON at all. Same-origin,
 * `credentials: "include"` reuses the caller's own session cookie; no
 * confirm step, no denylist, every verb executes immediately (decision #5).
 */

export interface ExecuteOperationInput {
  method: string;
  /** A same-origin, already path/query-substituted URL, e.g. "/api/patients/1". */
  url: string;
  /** A JSON string or `FormData`. Omit `contentType` for `FormData` so the browser sets its own boundary. */
  body?: string | FormData;
  contentType?: string;
}

export interface ExecutionResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  contentType: string | null;
  /** Set when the response content-type is application/json and parsed cleanly. */
  bodyJson?: unknown;
  /** The raw response text, for a JSON body that failed to parse or a non-JSON text body. */
  bodyText?: string;
  /** True for a body that was never text-decoded (an export's xlsx/pdf). */
  isBinary: boolean;
  blobUrl?: string;
  filename?: string;
  /** Set instead of the fields above when `fetch` itself rejected. */
  networkError?: string;
}

function extractFilename(contentDisposition: string | null): string | undefined {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1];
}

export async function executeOperation(input: ExecuteOperationInput): Promise<ExecutionResult> {
  const headers = new Headers();
  if (input.contentType) {
    headers.set("Content-Type", input.contentType);
  }

  let response: Response;
  try {
    response = await fetch(input.url, {
      method: input.method,
      credentials: "include",
      headers,
      body: input.body,
    });
  } catch (cause) {
    return {
      status: 0,
      statusText: "Network Error",
      headers: {},
      contentType: null,
      isBinary: false,
      networkError: cause instanceof Error ? cause.message : "The request failed before reaching the server.",
    };
  }

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  const contentType = response.headers.get("content-type");

  if (response.status === 204 || !contentType) {
    return { status: response.status, statusText: response.statusText, headers: responseHeaders, contentType, isBinary: false };
  }

  if (contentType.includes("application/json")) {
    const text = await response.text();
    try {
      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        contentType,
        bodyJson: text ? JSON.parse(text) : undefined,
        isBinary: false,
      };
    } catch {
      // A JSON content-type with a body that didn't actually parse -- show
      // the raw text rather than crash the response panel.
      return { status: response.status, statusText: response.statusText, headers: responseHeaders, contentType, bodyText: text, isBinary: false };
    }
  }

  if (contentType.startsWith("text/")) {
    const text = await response.text();
    return { status: response.status, statusText: response.statusText, headers: responseHeaders, contentType, bodyText: text, isBinary: false };
  }

  // Anything else -- the three export routes' xlsx/pdf -- is never
  // text-decoded or JSON-parsed; it is offered as a download instead.
  const blob = await response.blob();
  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    contentType,
    isBinary: true,
    blobUrl: URL.createObjectURL(blob),
    filename: extractFilename(response.headers.get("content-disposition")),
  };
}

import type { z } from "zod";

/**
 * Types for the OpenAPI route registry (F2, ADR-0008).
 *
 * Route handlers (`src/lib/api/route-handler.ts`) carry no introspectable
 * metadata -- a validator is just a function call inside the closure, and
 * nothing declares whether a schema describes a body or query params. This
 * registry is the hand-authored binding that makes generation possible;
 * `tests/unit/openapi-registry-parity.test.ts` is what keeps it from
 * silently drifting from the routes it describes.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** A path or query parameter not backed by a reusable zod schema. */
export interface ParamDef {
  name: string;
  description: string;
  required?: boolean;
  schema: z.ZodType;
}

export interface RequestBodyDef {
  contentType: "application/json" | "multipart/form-data";
  /** The JSON (or non-binary multipart field) shape. */
  schema?: z.ZodType;
  /**
   * The binary part of a multipart body (FL4 -- the patient record upload).
   * Never expressed as a zod schema: `z.instanceof(File)` produces no
   * useful JSON Schema, so the constraints are documented here instead.
   */
  fileField?: {
    name: string;
    description: string;
    maxSizeBytes?: number;
    allowedMimeTypes?: string[];
  };
  description?: string;
}

export interface ResponseDef {
  status: number;
  description: string;
  /** Added per-domain in M8; absent responses are still valid operations. */
  schema?: z.ZodType;
  /** A binary response (the 3 report exports) -- content types, no schema. */
  binary?: { contentTypes: string[] };
}

/** A hand-rolled error response that predates `AppError` (FL5). */
export interface ExtraErrorDef {
  status: number;
  description: string;
}

export interface OperationEntry {
  method: HttpMethod;
  /** OpenAPI-form path, e.g. `/api/patients/{id}`. */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  /**
   * `public` routes use `createPublicRouteHandler` (no session required);
   * everything else uses `createRouteHandler`, which authenticates before
   * the handler runs (FL2).
   */
  auth: "public" | "session";
  /**
   * The authorization predicate name, only where `withCapability` actually
   * wraps the handler. Most operations authorize inside the service layer
   * instead, so this is populated for one operation today
   * (`canBootstrapOrganization`), not inferred for the rest (FL2).
   */
  capability?: string;
  pathParams?: ParamDef[];
  /** A reusable query schema, or hand-authored params where none exists. */
  query?: z.ZodType | ParamDef[];
  requestBody?: RequestBodyDef;
  responses: ResponseDef[];
  extraErrors?: ExtraErrorDef[];
  /** Rendered as a visible warning in the explorer (decision #8). */
  warning?: string;
}

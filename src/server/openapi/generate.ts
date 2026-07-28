import { z } from "zod";
import { registry } from "./registry";
import type { OperationEntry, ParamDef, RequestBodyDef } from "./types";
import { errorEnvelopeSchema } from "@/contracts/shared.contract";

/**
 * Assembles the OpenAPI 3.1 document from the route registry (F2,
 * ADR-0008). `z.toJSONSchema()` converts individual zod schemas; everything
 * here is the hand-rolled document assembly around it -- paths, parameters,
 * request bodies, security, and the mechanical error-response floor
 * described below. Pure and synchronous: no I/O, so it can run at build
 * time (`scripts/generate-openapi.ts`) or inside a test with no mocking.
 *
 * ## The mechanical error-response floor
 *
 * The registry does not record which `AppError` codes a given operation's
 * service call chain can throw -- auditing that for all 90 operations is a
 * separate, larger task. Rather than guess, every operation gets a
 * documented floor derived only from fields already in its registry entry:
 *
 * - `400` iff it declares a request body, a query, or `extraErrors` (a
 *   validation failure is possible).
 * - `401` iff `auth === "session"`.
 * - `403` iff `auth === "session"` -- deliberately over-inclusive: most
 *   session routes enforce some authorization check beyond the session
 *   itself, but a few (e.g. `GET /api/users/me`) never actually 403. Safer
 *   to over-document a security-relevant status than omit it silently.
 * - `404` iff it declares path parameters.
 * - `500` always (`mapErrorToResponse`'s unconditional catch-all).
 *
 * Domain-specific statuses (409 conflicts, 402 subscription-required, ...)
 * are not enumerated per operation and are a named follow-up, not a silent
 * gap.
 */

type Schema = z.core.JSONSchema.JSONSchema;

const ERROR_REF = "#/components/schemas/Error";

const CONVERT_OPTIONS = {
  target: "draft-2020-12" as const,
  unrepresentable: "any" as const,
};

/** Converts a zod schema to JSON Schema and strips the per-call `$schema` key. */
function toSchema(schema: z.ZodType, io: "input" | "output"): Schema {
  const json = z.toJSONSchema(schema, { io, ...CONVERT_OPTIONS }) as Schema;
  delete json.$schema;
  return json;
}

/**
 * `z.string().date()` emits a leap-year-aware `pattern` alongside
 * `format: "date"` -- correct, but unreadable in a UI and it bloats the
 * document (F2, decision #10). Stripped wherever both are present; every
 * other format keeps its pattern.
 */
function stripDatePattern(node: Schema): Schema {
  if (node.format === "date" && "pattern" in node) {
    delete node.pattern;
  }
  if (node.properties) {
    for (const value of Object.values(node.properties)) {
      if (typeof value === "object" && value) stripDatePattern(value as Schema);
    }
  }
  if (node.items && typeof node.items === "object" && !Array.isArray(node.items)) {
    stripDatePattern(node.items as Schema);
  }
  for (const branch of [...(node.anyOf ?? []), ...(node.allOf ?? [])]) {
    stripDatePattern(branch as Schema);
  }
  return node;
}

/**
 * `.pipe()` fields (e.g. patient `email`) validate their format on the
 * *output* side of the pipe, invisible under `io: "input"` -- which is
 * otherwise the right mode for requests, since it is what makes
 * `z.coerce.number()` query params show as `integer` rather than `number`
 * (F2, decision #10). Rather than choose one mode globally, both are
 * converted and every property's `format`/`pattern` is backfilled from the
 * output side onto the input side where the input side lacks one. This
 * never touches `type`, so a coerced field's input-mode type is preserved.
 */
function mergeFormats(input: Schema, output: Schema): Schema {
  if (input.format === undefined && typeof output.format === "string") {
    input.format = output.format;
    if (typeof output.pattern === "string") {
      input.pattern = output.pattern;
    }
  }
  if (input.properties && output.properties) {
    for (const [key, inputProp] of Object.entries(input.properties)) {
      const outputProp = output.properties[key];
      if (typeof inputProp === "object" && inputProp && typeof outputProp === "object" && outputProp) {
        mergeFormats(inputProp as Schema, outputProp as Schema);
      }
    }
  }
  if (Array.isArray(input.anyOf) && Array.isArray(output.anyOf)) {
    input.anyOf.forEach((branch, index) => {
      const outputBranch = output.anyOf?.[index];
      if (outputBranch) mergeFormats(branch as Schema, outputBranch as Schema);
    });
  }
  return input;
}

/** Converts a request-side object schema with the format backfill applied. */
function toRequestSchema(schema: z.ZodType): Schema {
  const input = toSchema(schema, "input");
  const output = toSchema(schema, "output");
  return stripDatePattern(mergeFormats(input, output));
}

/**
 * Query parameters whose wire format differs from what `z.toJSONSchema`
 * reports for the validator's post-coercion type. `isActive` is a
 * `z.preprocess` mapping the query *string* `"true"`/`"false"` to a
 * boolean -- the validator's coercion is intentional and untouched; only
 * the spec's description of the wire format is corrected here (F2,
 * decision #10).
 */
const QUERY_PARAM_OVERRIDES: Record<string, Schema> = {
  isActive: { type: "string", enum: ["true", "false"] },
};

interface ParameterObject {
  name: string;
  in: "path" | "query";
  required: boolean;
  description?: string;
  schema: Schema;
}

/** Path params are always required UUIDs today; hand-authored either way. */
function buildPathParameters(params: ParamDef[] | undefined): ParameterObject[] {
  return (params ?? []).map((param) => ({
    name: param.name,
    in: "path",
    required: true,
    description: param.description,
    schema: toSchema(param.schema, "input"),
  }));
}

/**
 * Flattens a query schema (or hand-authored param list) into individual
 * OpenAPI parameters. A cross-field `.describe()` on the schema itself
 * (e.g. the report date-range rule) cannot attach to any single flattened
 * parameter, so it is returned separately for the caller to fold into the
 * operation's own `description`.
 */
function buildQueryParameters(query: OperationEntry["query"]): { parameters: ParameterObject[]; description?: string } {
  if (!query) {
    return { parameters: [] };
  }

  if (Array.isArray(query)) {
    return {
      parameters: query.map((param) => ({
        name: param.name,
        in: "query",
        required: Boolean(param.required),
        description: param.description,
        schema: toSchema(param.schema, "input"),
      })),
    };
  }

  const schema = toRequestSchema(query);
  const required = new Set(schema.required ?? []);
  const properties = schema.properties ?? {};

  const parameters = Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: "query" as const,
    required: required.has(name),
    description: (propertySchema as Schema).description,
    schema: QUERY_PARAM_OVERRIDES[name] ?? (propertySchema as Schema),
  }));

  return { parameters, description: schema.description };
}

interface RequestBodyObject {
  required: boolean;
  description?: string;
  content: Record<string, { schema: Schema }>;
}

function buildRequestBody(requestBody: RequestBodyDef | undefined): RequestBodyObject | undefined {
  if (!requestBody) return undefined;

  if (requestBody.contentType === "multipart/form-data") {
    const base = requestBody.schema ? toRequestSchema(requestBody.schema) : { type: "object" as const, properties: {} };
    const properties = { ...(base.properties ?? {}) };
    const required = [...(base.required ?? [])];

    if (requestBody.fileField) {
      properties[requestBody.fileField.name] = {
        type: "string",
        format: "binary",
        description: requestBody.fileField.description,
      };
      required.push(requestBody.fileField.name);
    }

    return {
      required: true,
      description: requestBody.description,
      content: {
        "multipart/form-data": {
          schema: { type: "object" as const, properties, required },
        },
      },
    };
  }

  return {
    required: true,
    description: requestBody.description,
    content: {
      "application/json": {
        schema: requestBody.schema ? toRequestSchema(requestBody.schema) : {},
      },
    },
  };
}

interface ResponseObject {
  description: string;
  content?: Record<string, { schema: Schema }>;
}

function errorResponse(description: string): ResponseObject {
  return {
    description,
    content: { "application/json": { schema: { $ref: ERROR_REF, description } } },
  };
}

function buildResponses(entry: OperationEntry): Record<string, ResponseObject> {
  const responses: Record<string, ResponseObject> = {};

  for (const response of entry.responses) {
    const status = String(response.status);
    if (response.binary) {
      const content: Record<string, { schema: Schema }> = {};
      for (const contentType of response.binary.contentTypes) {
        content[contentType] = { schema: { type: "string", format: "binary" } };
      }
      responses[status] = { description: response.description, content };
    } else if (response.schema) {
      responses[status] = {
        description: response.description,
        content: { "application/json": { schema: toRequestSchema(response.schema) } },
      };
    } else {
      // No schema yet (pre-M8) or a genuinely bodiless response (204).
      responses[status] = { description: response.description };
    }
  }

  const hasBody = Boolean(entry.requestBody);
  const hasQuery = Boolean(entry.query);
  const fourHundredMessages = [
    ...(hasBody || hasQuery ? ["Invalid request payload"] : []),
    ...(entry.extraErrors ?? []).filter((e) => e.status === 400).map((e) => e.description),
  ];
  if (fourHundredMessages.length > 0) {
    responses["400"] = errorResponse(fourHundredMessages.join(" "));
  }

  for (const extra of entry.extraErrors ?? []) {
    if (extra.status === 400) continue; // folded into the message list above
    const status = String(extra.status);
    responses[status] = responses[status]
      ? errorResponse(`${responses[status].description} ${extra.description}`)
      : errorResponse(extra.description);
  }

  if (entry.auth === "session") {
    responses["401"] ??= errorResponse("Unauthorized -- no active session.");
    responses["403"] ??= errorResponse("Forbidden -- insufficient privileges.");
  }
  if ((entry.pathParams?.length ?? 0) > 0) {
    responses["404"] ??= errorResponse("Not found.");
  }
  responses["500"] ??= errorResponse("Internal Server Error.");

  return responses;
}

interface OperationObject {
  summary: string;
  description?: string;
  tags: string[];
  security: { cookieAuth: never[] }[];
  parameters?: ParameterObject[];
  requestBody?: ReturnType<typeof buildRequestBody>;
  responses: Record<string, ResponseObject>;
  "x-warning"?: string;
  "x-capability"?: string;
}

function buildOperation(entry: OperationEntry): OperationObject {
  const pathParameters = buildPathParameters(entry.pathParams);
  const { parameters: queryParameters, description: queryDescription } = buildQueryParameters(entry.query);

  return {
    summary: entry.summary,
    description: [entry.description, queryDescription].filter(Boolean).join(" ") || undefined,
    tags: [entry.tag],
    security: entry.auth === "session" ? [{ cookieAuth: [] }] : [],
    parameters: [...pathParameters, ...queryParameters],
    requestBody: buildRequestBody(entry.requestBody),
    responses: buildResponses(entry),
    ...(entry.warning ? { "x-warning": entry.warning } : {}),
    ...(entry.capability ? { "x-capability": entry.capability } : {}),
  };
}

function buildErrorComponent(): Schema {
  const schema = toSchema(errorEnvelopeSchema, "output");
  delete schema.$id;
  return schema;
}

/** OpenAPI's own `SecurityScheme` object -- not a JSON Schema shape. */
interface SecuritySchemeObject {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  in?: "query" | "header" | "cookie";
  name?: string;
  description?: string;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string }[];
  paths: Record<string, Record<string, OperationObject>>;
  components: {
    schemas: Record<string, Schema>;
    securitySchemes: Record<string, SecuritySchemeObject>;
  };
}

/** Builds the full OpenAPI document from the route registry. Pure; no I/O. */
export function generateOpenApiDocument(): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};

  for (const entry of registry) {
    paths[entry.path] ??= {};
    paths[entry.path][entry.method.toLowerCase()] = buildOperation(entry);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "PhysioCare Platform API",
      version: "1.0.0",
      description:
        "Generated from the server validators and the route registry (F2, ADR-0008). " +
        "Same-origin only: every operation is reachable at its documented path under this origin.",
    },
    servers: [{ url: "/" }],
    paths,
    components: {
      schemas: { Error: buildErrorComponent() },
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "session",
          description:
            "The Supabase session cookie set by POST /api/auth/login. Exact cookie name(s) are " +
            "managed by @supabase/ssr and vary by project; try-it-out relies on the browser's own " +
            "cookie jar (same-origin fetch with credentials: \"include\") rather than this field.",
        },
      },
    },
  };
}

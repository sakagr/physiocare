/**
 * Types and pure selectors over the fetched OpenAPI document (F2). No
 * fetch, no rendering -- these are provable against a small fixture, which
 * is what `tests/unit/platform-api-spec.test.ts` does.
 *
 * Deliberately its own loose shape rather than importing the server's
 * `z.core.JSONSchema` types: the explorer only ever reads this JSON to
 * render it, and frontend types derive from the API contract, not the
 * server's internals (AGENTS.md → "Error Handling and Types").
 */

export interface JsonSchemaNode {
  type?: string;
  format?: string;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
  $ref?: string;
}

export interface OpenApiParameter {
  name: string;
  in: "path" | "query";
  required: boolean;
  description?: string;
  schema: JsonSchemaNode;
}

export interface OpenApiRequestBody {
  required: boolean;
  description?: string;
  content: Record<string, { schema: JsonSchemaNode }>;
}

export interface OpenApiResponse {
  description: string;
  content?: Record<string, { schema: JsonSchemaNode }>;
}

export interface OpenApiOperation {
  summary: string;
  description?: string;
  tags: string[];
  security: unknown[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
  "x-warning"?: string;
  "x-capability"?: string;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers?: { url: string }[];
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, JsonSchemaNode>;
    securitySchemes: Record<string, unknown>;
  };
}

/** One HTTP verb at one path -- the explorer's unit of navigation. */
export interface Operation {
  method: string;
  path: string;
  tag: string;
  operation: OpenApiOperation;
}

/** The stable identity of an operation, used as a list/selection key. */
export function operationKey(op: Operation): string {
  return `${op.method} ${op.path}`;
}

/** Flattens `paths` into one `Operation` per method, in document order. */
export function listOperations(doc: OpenApiDocument): Operation[] {
  const operations: Operation[] = [];
  for (const [path, methods] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      operations.push({
        method: method.toUpperCase(),
        path,
        tag: operation.tags[0] ?? "Other",
        operation,
      });
    }
  }
  return operations;
}

/** Groups operations by tag, preserving each tag's first-encountered order. */
export function groupByTag(operations: Operation[]): Map<string, Operation[]> {
  const grouped = new Map<string, Operation[]>();
  for (const op of operations) {
    const existing = grouped.get(op.tag);
    if (existing) {
      existing.push(op);
    } else {
      grouped.set(op.tag, [op]);
    }
  }
  return grouped;
}

/** Case-insensitive match against method, path, or summary. */
export function filterOperations(operations: Operation[], query: string): Operation[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return operations;

  return operations.filter((op) => {
    const haystack = `${op.method} ${op.path} ${op.operation.summary}`.toLowerCase();
    return haystack.includes(needle);
  });
}

/**
 * A plausible starting value for a JSON request body, so the try-it-out
 * textarea opens with the right shape rather than `{}`. Not validation --
 * the caller can edit or replace it freely before sending.
 */
export function buildExampleValue(node: JsonSchemaNode): unknown {
  if (node.default !== undefined) return node.default;
  if (node.const !== undefined) return node.const;
  if (node.enum && node.enum.length > 0) return node.enum[0];
  if (node.anyOf && node.anyOf.length > 0) return buildExampleValue(node.anyOf[0]);

  switch (node.type) {
    case "object": {
      const result: Record<string, unknown> = {};
      for (const [name, child] of Object.entries(node.properties ?? {})) {
        result[name] = buildExampleValue(child);
      }
      return result;
    }
    case "array":
      return node.items ? [buildExampleValue(node.items)] : [];
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "string":
      return node.format === "date" ? new Date().toISOString().slice(0, 10) : "";
    default:
      return null;
  }
}

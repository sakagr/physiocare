import { describe, expect, it } from "vitest";
import {
  buildExampleValue,
  filterOperations,
  groupByTag,
  listOperations,
  operationKey,
  type OpenApiDocument,
} from "@/features/platform-api";

/**
 * Pure selectors over the fetched OpenAPI document -- no fetch, no
 * QueryClient, no rendering, so the explorer's grouping/filtering logic is
 * provable with a small fixture document.
 */
const doc: OpenApiDocument = {
  openapi: "3.1.0",
  info: { title: "t", version: "1", description: "d" },
  paths: {
    "/api/patients": {
      get: { summary: "List patients", tags: ["Patients"], security: [{ cookieAuth: [] }], responses: {} },
      post: { summary: "Create a patient", tags: ["Patients"], security: [{ cookieAuth: [] }], responses: {} },
    },
    "/api/patients/{id}": {
      get: { summary: "Get patient details", tags: ["Patients"], security: [{ cookieAuth: [] }], responses: {} },
    },
    "/api/auth/login": {
      post: {
        summary: "Sign in",
        tags: ["Auth"],
        security: [],
        responses: {},
        "x-warning": "Replaces your session.",
      },
    },
  },
  components: { schemas: {}, securitySchemes: {} },
};

describe("listOperations", () => {
  it("flattens every method under every path into one operation per entry", () => {
    const operations = listOperations(doc);
    expect(operations).toHaveLength(4);
    expect(operations.map(operationKey).sort()).toEqual([
      "GET /api/patients",
      "GET /api/patients/{id}",
      "POST /api/auth/login",
      "POST /api/patients",
    ]);
  });

  it("carries the tag and the x-warning extension through", () => {
    const operations = listOperations(doc);
    const login = operations.find((op) => op.path === "/api/auth/login")!;
    expect(login.tag).toBe("Auth");
    expect(login.operation["x-warning"]).toBe("Replaces your session.");
  });
});

describe("groupByTag", () => {
  it("groups operations by their tag, preserving encounter order", () => {
    const grouped = groupByTag(listOperations(doc));
    expect([...grouped.keys()]).toEqual(["Patients", "Auth"]);
    expect(grouped.get("Patients")).toHaveLength(3);
    expect(grouped.get("Auth")).toHaveLength(1);
  });
});

describe("filterOperations", () => {
  const operations = listOperations(doc);

  it("returns everything for an empty filter", () => {
    expect(filterOperations(operations, "")).toHaveLength(4);
  });

  it("matches on path, method, or summary, case-insensitively", () => {
    expect(filterOperations(operations, "login")).toHaveLength(1);
    expect(filterOperations(operations, "PATIENTS/{ID}")).toHaveLength(1);
    expect(filterOperations(operations, "create a")).toHaveLength(1);
    expect(filterOperations(operations, "get")).toHaveLength(2);
  });

  it("matches nothing for a filter with no hits", () => {
    expect(filterOperations(operations, "nonexistent")).toHaveLength(0);
  });
});

describe("buildExampleValue", () => {
  it("builds a nested example object from an object schema's properties", () => {
    expect(
      buildExampleValue({
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
          active: { type: "boolean" },
        },
      })
    ).toEqual({ name: "", age: 0, active: false });
  });

  it("prefers a declared default over a type-based placeholder", () => {
    expect(buildExampleValue({ type: "integer", default: 10 })).toBe(10);
  });

  it("uses the first enum value", () => {
    expect(buildExampleValue({ type: "string", enum: ["a", "b"] })).toBe("a");
  });

  it("builds a one-element array from the items schema", () => {
    expect(buildExampleValue({ type: "array", items: { type: "string" } })).toEqual([""]);
  });
});

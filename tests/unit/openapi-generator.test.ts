import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "@/server/openapi/generate";
import { registry } from "@/server/openapi/registry";

/**
 * Assembles and inspects the generated OpenAPI document (F2, ADR-0008).
 * `z.toJSONSchema()` handles the request/response shapes; this module is
 * the hand-rolled document assembly around it -- paths, parameters,
 * request bodies, security, and the mechanical error-response floor.
 */
describe("generateOpenApiDocument", () => {
  const doc = generateOpenApiDocument();

  it("declares an OpenAPI 3.1 document with populated info", () => {
    expect(doc.openapi).toMatch(/^3\.1\.\d+$/);
    expect(doc.info.title).toBeTruthy();
    expect(doc.info.version).toBeTruthy();
  });

  it("carries a path entry with the right verb for every registry operation", () => {
    for (const op of registry) {
      const pathItem = doc.paths[op.path];
      expect(pathItem, `paths["${op.path}"]`).toBeDefined();
      const operationObject = pathItem[op.method.toLowerCase()];
      expect(operationObject, `${op.method} ${op.path}`).toBeDefined();
      expect(operationObject.summary).toBe(op.summary);
      expect(operationObject.tags).toEqual([op.tag]);
    }
  });

  it("declares every path-template segment as a required path parameter", () => {
    const op = registry.find((o) => o.path === "/api/patients/{id}")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    const pathParams = operationObject.parameters!.filter((p) => p.in === "path");
    expect(pathParams).toEqual([
      expect.objectContaining({ name: "id", required: true }),
    ]);
  });

  it("flattens a query schema into individual query parameters", () => {
    const op = registry.find((o) => o.method === "GET" && o.path === "/api/patients")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    const queryParamNames = operationObject.parameters!
      .filter((p) => p.in === "query")
      .map((p) => p.name);
    expect(queryParamNames.sort()).toEqual(["gender", "isActive", "limit", "page", "search"].sort());
  });

  it("declares hand-authored query params where no schema exists (FL5)", () => {
    const op = registry.find((o) => o.method === "DELETE" && o.path === "/api/user-clinics")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    const queryParams = operationObject.parameters!.filter((p) => p.in === "query");
    expect(queryParams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "userId", required: true }),
        expect.objectContaining({ name: "clinicId", required: true }),
      ])
    );
  });

  it("puts a JSON request body under application/json", () => {
    const op = registry.find((o) => o.method === "POST" && o.path === "/api/patients")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    expect(operationObject.requestBody!.content["application/json"].schema).toBeDefined();
  });

  it("puts the record upload's body under multipart/form-data with a binary file field (FL4)", () => {
    const op = registry.find((o) => o.method === "POST" && o.path === "/api/patients/{id}/records")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    const multipart = operationObject.requestBody!.content["multipart/form-data"];
    expect(multipart!.schema.properties!.file).toEqual(
      expect.objectContaining({ type: "string", format: "binary" })
    );
    expect(multipart!.schema.required).toContain("file");
  });

  it("declares no security for the three public auth routes and cookie security for the rest (FL2)", () => {
    const publicPaths = ["/api/auth/login", "/api/auth/logout", "/api/auth/request-password-reset"];
    for (const path of publicPaths) {
      const op = registry.find((o) => o.path === path)!;
      const operationObject = doc.paths[op.path][op.method.toLowerCase()];
      expect(operationObject.security, path).toEqual([]);
    }

    const sessionOp = registry.find((o) => o.path === "/api/auth/set-password")!;
    const sessionOperationObject = doc.paths[sessionOp.path][sessionOp.method.toLowerCase()];
    expect(sessionOperationObject.security).toEqual([{ cookieAuth: [] }]);
  });

  it("declares no response content for a 204 operation (FL6)", () => {
    const op = registry.find((o) => o.path === "/api/auth/login")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    expect(operationObject.responses["204"]).toBeDefined();
    expect(operationObject.responses["204"]!.content).toBeUndefined();
  });

  it("declares binary xlsx/pdf content for an export operation", () => {
    const op = registry.find((o) => o.path === "/api/reports/billing/export")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    const content = operationObject.responses["200"]!.content;
    expect(Object.keys(content!).sort()).toEqual(
      [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ].sort()
    );
  });

  it("carries a visible warning on every /api/auth/* operation (decision #8)", () => {
    for (const op of registry.filter((o) => o.path.startsWith("/api/auth/"))) {
      const operationObject = doc.paths[op.path][op.method.toLowerCase()];
      expect(operationObject["x-warning"], `${op.method} ${op.path}`).toBeTruthy();
    }
  });

  it("merges hand-rolled extraErrors alongside the mechanical error floor (FL5)", () => {
    const op = registry.find((o) => o.method === "DELETE" && o.path === "/api/user-clinics")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    const fourHundred = operationObject.responses["400"]!;
    expect(fourHundred.content!["application/json"].schema.description).toContain(
      "Missing userId or clinicId parameter"
    );
  });

  it("includes a 401 for every session-authenticated operation and none for public ones", () => {
    for (const op of registry) {
      const operationObject = doc.paths[op.path][op.method.toLowerCase()];
      if (op.auth === "session") {
        expect(operationObject.responses["401"], `${op.method} ${op.path}`).toBeDefined();
      } else {
        expect(operationObject.responses["401"]).toBeUndefined();
      }
    }
  });

  it("resolves the shared error component by $ref with no stray $defs", () => {
    expect(doc.components.schemas.Error).toBeDefined();
    const op = registry.find((o) => o.path === "/api/patients/{id}")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    expect(operationObject.responses["404"]!.content!["application/json"].schema).toEqual(
      expect.objectContaining({ $ref: "#/components/schemas/Error" })
    );

    const serialized = JSON.stringify(doc);
    expect(serialized).not.toContain("$defs");
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateOpenApiDocument } from "@/server/openapi/generate";
import { registry } from "@/server/openapi/registry";

/** Narrows a property's `_JSONSchema` (`boolean | JSONSchema`) to a schema object. */
function asSchema(node: z.core.JSONSchema._JSONSchema): z.core.JSONSchema.JSONSchema {
  if (typeof node === "boolean") {
    throw new Error("Expected a schema object, got a boolean JSON Schema.");
  }
  return node;
}

/**
 * Decision #10: each place `z.toJSONSchema()` silently drops or misrepresents
 * a constraint, resolved rather than shipped as a documentation gap. See the
 * plan's fidelity-resolutions table for the reasoning behind each case.
 */
describe("OpenAPI fidelity resolutions", () => {
  const doc = generateOpenApiDocument();

  function requestSchema(method: string, path: string) {
    const op = registry.find((o) => o.method === method && o.path === path)!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    return operationObject.requestBody!.content["application/json"].schema;
  }

  it("narrows the role enum to organization roles only, not the full 8-role AppRole set", () => {
    const schema = requestSchema("POST", "/api/users");
    expect(asSchema(schema.properties!.role).enum).toEqual([
      "ORG_OWNER",
      "ORG_ADMIN",
      "ORG_PHYSIOTHERAPIST",
      "ORG_RECEPTIONIST",
    ]);

    const changeRoleOp = registry.find((o) => o.path === "/api/users/{id}/change-role")!;
    const changeRoleSchema = doc.paths[changeRoleOp.path][changeRoleOp.method.toLowerCase()]
      .requestBody!.content["application/json"].schema;
    expect(asSchema(changeRoleSchema.properties!.role).enum).not.toContain("SUPER_ADMIN");
  });

  it("describes the report date-range rules the .refine()s enforce but z.toJSONSchema drops", () => {
    for (const path of ["/api/reports/billing", "/api/reports/commission", "/api/reports/physiotherapists"]) {
      const op = registry.find((o) => o.path === path)!;
      const operationObject = doc.paths[op.path][op.method.toLowerCase()];
      // The rule spans dateFrom/dateTo together, so it is read off the query
      // schema's own top-level .describe() and surfaced on the operation --
      // no single flattened parameter can carry a cross-field constraint.
      expect(operationObject.description, path).toMatch(/dateTo.*dateFrom|366 days/i);
    }
  });

  it("describes the change-password rule forbidding reuse of the current password", () => {
    const schema = requestSchema("POST", "/api/auth/change-password");
    expect(schema.description).toMatch(/haven't used|different from.*current/i);
  });

  it("represents isActive as the query string the wire actually sends, not a JSON boolean", () => {
    const op = registry.find((o) => o.method === "GET" && o.path === "/api/patients")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    const isActive = operationObject.parameters!.find((p) => p.name === "isActive")!;
    expect(isActive.schema).toEqual({ type: "string", enum: ["true", "false"] });
  });

  it("keeps pagination as bounded integers with their real defaults", () => {
    const op = registry.find((o) => o.method === "GET" && o.path === "/api/patients")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    const page = operationObject.parameters!.find((p) => p.name === "page")!;
    expect(page.schema).toEqual(expect.objectContaining({ type: "integer", minimum: 1, default: 1 }));
  });

  it("gives the patient email field its format back after the .pipe() idiom", () => {
    const schema = requestSchema("POST", "/api/patients");
    expect(asSchema(schema.properties!.email)).toEqual(
      expect.objectContaining({
        anyOf: expect.arrayContaining([expect.objectContaining({ format: "email" })]),
      })
    );
  });

  it("strips the unreadable leap-year pattern from a date field while keeping format: date", () => {
    const op = registry.find((o) => o.path === "/api/reports/billing")!;
    const operationObject = doc.paths[op.path][op.method.toLowerCase()];
    const dateFrom = operationObject.parameters!.find((p) => p.name === "dateFrom")!;
    expect(dateFrom.schema.format).toBe("date");
    expect(dateFrom.schema.pattern).toBeUndefined();
  });
});

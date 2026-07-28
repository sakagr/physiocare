import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorEnvelopeSchema, pagedResultSchema } from "@/contracts/shared.contract";
import type { PagedResult } from "@/server/validators/shared.validator";

/**
 * Shared response contracts (F2, ADR-0008): the paginated envelope every
 * list operation returns, and the error envelope every route's
 * `mapErrorToResponse` produces. Landing these first unblocks every
 * per-domain contract in M8, which build on `pagedResultSchema` rather than
 * each hand-rolling its own paging shape.
 */
describe("pagedResultSchema", () => {
  const itemSchema = z.object({ id: z.string(), name: z.string() });
  const schema = pagedResultSchema(itemSchema);

  it("parses a paginated list response", () => {
    const fixture = {
      items: [{ id: "1", name: "North Clinic" }],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };

    expect(schema.parse(fixture)).toEqual(fixture);

    // Type-level: the inferred shape is the same one every service returns
    // as `PagedResult<T>` (src/server/validators/shared.validator.ts).
    type Item = { id: string; name: string };
    const typed: PagedResult<Item> = fixture;
    void typed;
  });

  it("parses an empty page", () => {
    const fixture = { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
    expect(schema.parse(fixture)).toEqual(fixture);
  });

  it("rejects an item that fails the item schema", () => {
    expect(() =>
      schema.parse({
        items: [{ id: 1 }],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      })
    ).toThrow();
  });
});

describe("errorEnvelopeSchema", () => {
  it("parses the full envelope with a code and details", () => {
    const fixture = {
      error: "Invalid request payload",
      code: "NOT_FOUND",
      details: [{ path: ["id"], message: "Required" }],
    };
    expect(errorEnvelopeSchema.parse(fixture)).toEqual(fixture);
  });

  it("parses the bare envelope some routes hand-roll with no code (FL5)", () => {
    expect(errorEnvelopeSchema.parse({ error: "A file is required" })).toEqual({
      error: "A file is required",
    });
  });
});

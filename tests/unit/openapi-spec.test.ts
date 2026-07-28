import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateOpenApiDocument } from "@/server/openapi/generate";

/**
 * The drift guard for the committed artifact (F2, ADR-0008, decision #9).
 * `src/server/openapi/openapi.json` is generated at build time by
 * `npm run openapi:generate` (`scripts/generate-openapi.ts`) rather than at
 * request time, so the route handler never pulls the validator tree into
 * its bundle. That only stays honest if the committed file matches what the
 * generator produces right now -- this test regenerates the document in
 * memory and deep-equals it against the committed one. There is no CI yet
 * (ROADMAP.md → R9), so this is what makes drift visible: it runs under
 * plain `npm test` today, and R9's CI inherits the check for free.
 */
describe("committed OpenAPI artifact", () => {
  it("matches a freshly generated document exactly", () => {
    const committedPath = join(process.cwd(), "src/server/openapi/openapi.json");
    const committed = JSON.parse(readFileSync(committedPath, "utf-8"));
    const fresh = generateOpenApiDocument();

    expect(committed).toEqual(fresh);
  });
});

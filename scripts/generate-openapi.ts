import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateOpenApiDocument } from "@/server/openapi/generate";

/**
 * Build-time generation of the platform API's OpenAPI document (F2,
 * ADR-0008, decision #9). Invoked via `npm run openapi:generate`
 * (`vite-node -c vitest.config.mts scripts/generate-openapi.ts`, reusing
 * the project's own path aliases rather than a second build config).
 *
 * Writes the committed artifact at `src/server/openapi/openapi.json`, which
 * the spec route imports statically. Generation is build-time, not
 * request-time, so the ~20 validator modules the registry touches never
 * enter the serverless function's bundle. There is deliberately no
 * `prebuild` hook wiring this in automatically: `npm run build` is a Phase
 * Completion Checklist gate, and a prebuild step that silently rewrites a
 * committed file mid-verification would mask drift rather than reveal it.
 * `tests/unit/openapi-spec.test.ts` is the drift guard instead -- it runs
 * under plain `npm test` and fails if this script has not been re-run.
 */
const outputPath = join(process.cwd(), "src/server/openapi/openapi.json");
const document = generateOpenApiDocument();

writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

console.log(`Wrote ${outputPath}`);

import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { registry } from "@/server/openapi/registry";

/**
 * The drift guard for routes (F2, ADR-0008). The registry is a
 * hand-authored binding -- method/path/tag/summary/schemas -- because route
 * handlers carry no introspectable metadata of their own (the validator link
 * is just a function call inside the closure). A hand-authored binding can
 * silently drift from the filesystem it describes, so this test walks
 * `src/app/api/**\/route.ts` on disk, reads each file's exported HTTP method
 * handlers, and asserts a bijection with the registry: nothing on disk is
 * undocumented, and nothing in the registry describes a route that no
 * longer exists.
 */

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const API_ROOT = join(process.cwd(), "src/app/api");
const APP_ROOT = join(process.cwd(), "src/app");

function findRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return findRouteFiles(fullPath);
    }
    return entry.name === "route.ts" ? [fullPath] : [];
  });
}

/** `src/app/api/patients/[id]/route.ts` -> `/api/patients/{id}`. */
function toOpenApiPath(routeFilePath: string): string {
  const relativePath = relative(APP_ROOT, routeFilePath);
  const withoutFile = relativePath.slice(0, -"/route.ts".length);
  const segments = withoutFile
    .split(sep)
    .map((segment) =>
      segment.startsWith("[") && segment.endsWith("]")
        ? `{${segment.slice(1, -1)}}`
        : segment
    );
  return `/${segments.join("/")}`;
}

async function operationsOnDisk(): Promise<Set<string>> {
  const files = findRouteFiles(API_ROOT);
  const operations = new Set<string>();

  for (const file of files) {
    const path = toOpenApiPath(file);
    const mod: Record<string, unknown> = await import(pathToFileURL(file).href);

    for (const method of HTTP_METHODS) {
      if (typeof mod[method] === "function") {
        operations.add(`${method} ${path}`);
      }
    }
  }

  return operations;
}

describe("OpenAPI registry ↔ filesystem parity", () => {
  it("registers exactly the operations exported by route.ts files on disk", async () => {
    const onDisk = await operationsOnDisk();
    const inRegistry = new Set(registry.map((op) => `${op.method} ${op.path}`));

    const undocumented = [...onDisk].filter((key) => !inRegistry.has(key)).sort();
    const stale = [...inRegistry].filter((key) => !onDisk.has(key)).sort();

    expect(undocumented, "routes on disk missing from the registry").toEqual([]);
    expect(stale, "registry entries with no route behind them").toEqual([]);
  });

  it("has no duplicate method+path entries", () => {
    const keys = registry.map((op) => `${op.method} ${op.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every path parameter placeholder a matching pathParams entry", () => {
    for (const op of registry) {
      const placeholders = [...op.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      const declared = (op.pathParams ?? []).map((p) => p.name);
      expect(
        declared.sort(),
        `${op.method} ${op.path} path params`
      ).toEqual(placeholders.sort());
    }
  });
});

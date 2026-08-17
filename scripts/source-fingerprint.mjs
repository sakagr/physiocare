/**
 * A cheap fingerprint of the source state that a verify run covered.
 *
 * Deliberately mtime-and-size based rather than content-hashed: this is read by a Stop hook
 * that fires on every turn, so it has to cost milliseconds. It can produce a false "stale"
 * after a touch that changed nothing, which is the safe direction to be wrong in.
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOTS = ["src", "tests", "supabase/migrations", "scripts"];
const FILES = ["package.json", "tsconfig.json", "eslint.config.mjs", "vitest.config.mts", "next.config.ts", "playwright.config.ts"];
const EXT = new Set([".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".sql", ".json", ".css"]);

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.has(e.name.slice(e.name.lastIndexOf("."))))  out.push(p);
  }
  return out;
}

export function sourceFingerprint() {
  const files = [];
  for (const r of ROOTS) if (existsSync(r)) walk(r, files);
  for (const f of FILES) if (existsSync(f)) files.push(f);
  files.sort();

  const h = createHash("sha1");
  let count = 0;
  for (const f of files) {
    try {
      const s = statSync(f);
      h.update(`${f}:${s.size}:${Math.floor(s.mtimeMs)}\n`);
      count++;
    } catch {
      /* raced with a delete; ignore */
    }
  }
  return { hash: h.digest("hex"), files: count };
}

/**
 * A fingerprint of the source state that a verify run covered.
 *
 * Delegates to git rather than comparing mtimes. An earlier version stat'd every source file
 * and hashed size+mtime, which reported "stale" for files whose content had not changed at all
 * — a checkout, a commit, a `touch`, or an editor rewriting a file identically all move mtime.
 * Combined with a blocking Stop hook that was a lockout, not a safe default.
 *
 * git already answers "has the content changed" correctly and cheaply (it keeps its own stat
 * cache and falls back to content comparison when the cache misses), so the guard now asks git
 * instead of re-deriving a worse answer.
 *
 * The fingerprint is HEAD plus the porcelain status of source paths only. Documentation, agent
 * configuration, and `.reviews/` artifacts deliberately do not appear in it: changing those
 * cannot invalidate a verify run, and treating them as source is what made a stage-1 session,
 * which writes nothing but markdown, trip a gate about compiled code.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

/** Paths whose contents a verify run actually proves something about. */
const SOURCE_PREFIXES = ["src/", "tests/", "supabase/migrations/", "scripts/"];
const SOURCE_FILES = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "eslint.config.mjs",
  "vitest.config.mts",
  "next.config.ts",
  "playwright.config.ts",
];

const isSource = (p) =>
  SOURCE_PREFIXES.some((prefix) => p.startsWith(prefix)) || SOURCE_FILES.includes(p);

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return r.status === 0 ? (r.stdout ?? "").trim() : null;
}

export function sourceFingerprint() {
  const head = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);

  if (head === null || status === null) {
    // Not a git repo, or git is unavailable. Report unknown rather than a confident wrong
    // answer; the guard treats unknown as "cannot tell" and stays quiet.
    return { unknown: true, hash: null, files: 0 };
  }

  // Porcelain lines are "XY path"; a rename is "R  old -> new". Take the destination path.
  const changed = status
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const path = line.slice(3);
      return path.includes(" -> ") ? path.split(" -> ")[1] : path;
    })
    .map((p) => p.replace(/^"|"$/g, ""))
    .filter(isSource)
    .sort();

  const h = createHash("sha1");
  h.update(`${head}\n`);
  for (const p of changed) h.update(`${p}\n`);

  return { hash: h.digest("hex"), head, files: changed.length, changed };
}

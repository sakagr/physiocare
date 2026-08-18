#!/usr/bin/env node
/**
 * Stop-hook guard. Runs on every agent turn end, so it must cost milliseconds.
 *
 * It does NOT run the gate. Running tsc + eslint + vitest + next build on every turn would add
 * minutes to a one-line question. Its single job is to catch source changing without
 * `npm run verify` being run.
 *
 *   exit 0  — nothing to say
 *   exit 2  — block, reason on stderr for the agent to read and act on
 *
 * Three rules learned from it locking a session for nine consecutive turns:
 *
 * 1. `stop_hook_active` is honoured. Claude Code sets it once this hook has already blocked
 *    the turn; re-blocking then cannot achieve anything the first block did not, and just
 *    traps the session. Blocking is therefore at most once per turn.
 * 2. Staleness is judged by git, not mtime. See scripts/source-fingerprint.mjs.
 * 3. An incomplete verify is NOT on its own a reason to block. `db-types` skips whenever the
 *    local Supabase stack is down, which is the normal state of a laptop — so blocking on
 *    completeness meant a gate that could never go green. Disclosing an unproven gate is the
 *    agent's job when it reports work, and `verify` itself prints it loudly; it is not
 *    something to enforce on every turn end.
 *
 * Escape hatches, because a guard that cannot be silenced becomes a guard that gets deleted:
 *   VERIFY_GUARD=off       skip entirely
 *   node scripts/verify-guard.mjs --warn    report on stdout, never block
 */

import { readFileSync, existsSync } from "node:fs";
import { sourceFingerprint } from "./source-fingerprint.mjs";

if (process.env.VERIFY_GUARD === "off") process.exit(0);
const warnOnly = process.argv.includes("--warn");

/** Claude Code pipes the hook payload as JSON on stdin. Absent or malformed is not an error. */
function hookInput() {
  if (process.stdin.isTTY) return {};
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

// Rule 1. Already blocked once this turn — say nothing further.
if (hookInput().stop_hook_active === true) process.exit(0);

function block(message) {
  if (warnOnly) {
    console.log(`verify-guard: ${message}`);
    process.exit(0);
  }
  console.error(message);
  process.exit(2);
}

const current = sourceFingerprint();

// Cannot tell (no git, or git unavailable) — stay quiet rather than guess.
if (current.unknown) process.exit(0);

if (!existsSync(".verify-ok")) {
  if (current.files === 0) process.exit(0); // nothing uncommitted under source; nothing to prove
  block(
    `The verification gate has not been run in this working tree, and ${current.files} source ` +
      `file(s) differ from HEAD:\n  ${current.changed.slice(0, 10).join("\n  ")}\n` +
      "Run `npm run verify:quiet` and fix what it reports before finishing.",
  );
}

let marker;
try {
  marker = JSON.parse(readFileSync(".verify-ok", "utf8"));
} catch {
  block("`.verify-ok` is unreadable. Run `npm run verify:quiet` to regenerate it.");
}

// Rule 2 + 3. The only blocking condition: source differs from what was last verified.
if (marker.fingerprint?.hash !== current.hash) {
  const skipped = (marker.steps ?? []).filter((s) => s.state === "SKIP").map((s) => s.name);
  block(
    `Source has changed since the last successful verify (${marker.at}).\n` +
      (current.files
        ? `Changed under source paths:\n  ${current.changed.slice(0, 10).join("\n  ")}\n`
        : "HEAD moved since that run.\n") +
      "Run `npm run verify:quiet` and fix what it reports before finishing." +
      (skipped.length
        ? `\n\nNote: the previous run skipped ${skipped.join(", ")} (environment prerequisite ` +
          "missing). If it skips again, name that gate as unproven rather than reporting the " +
          "work as verified."
        : ""),
  );
}

process.exit(0);

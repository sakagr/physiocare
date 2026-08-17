#!/usr/bin/env node
/**
 * Stop-hook guard. Runs on every agent turn end, so it must cost milliseconds.
 *
 * It does NOT run the gate. Running tsc + eslint + vitest + next build on every turn would
 * add minutes to a one-line question. What it does is catch the failure mode the gate exists
 * for: source changed, and the agent is about to declare the work done without having run
 * `npm run verify:quiet`.
 *
 * Compares the current source fingerprint against .verify-ok, written by a successful verify.
 *
 *   exit 0  — nothing to say
 *   exit 2  — block, with the reason on stderr for the agent to read and act on
 *
 * Escape hatches, because a guard that cannot be silenced becomes a guard that gets deleted:
 *   VERIFY_GUARD=off       skip entirely
 *   node scripts/verify-guard.mjs --warn    report on stdout, never block
 */

import { readFileSync, existsSync } from "node:fs";
import { sourceFingerprint } from "./source-fingerprint.mjs";

if (process.env.VERIFY_GUARD === "off") process.exit(0);
const warnOnly = process.argv.includes("--warn");

function block(message) {
  if (warnOnly) {
    console.log(`verify-guard: ${message}`);
    process.exit(0);
  }
  console.error(message);
  process.exit(2);
}

const current = sourceFingerprint();

if (!existsSync(".verify-ok")) {
  block(
    "The verification gate has not been run in this working tree. If you changed source, " +
      "run `npm run verify:quiet` and fix what it reports before finishing. If you changed nothing " +
      "under src/, tests/, supabase/migrations/ or scripts/, say so and stop.",
  );
}

let marker;
try {
  marker = JSON.parse(readFileSync(".verify-ok", "utf8"));
} catch {
  block("`.verify-ok` is unreadable. Run `npm run verify:quiet` to regenerate it.");
}

if (marker.fingerprint?.hash !== current.hash) {
  block(
    "Source has changed since the last successful verify " +
      `(${marker.at}). Run \`npm run verify:quiet\` and fix what it reports before finishing. ` +
      "If the only changes were to documentation or agent configuration, say so and stop.",
  );
}

if (marker.complete === false) {
  const skipped = (marker.steps ?? []).filter((s) => s.state === "SKIP").map((s) => s.name);
  const missing = marker.missing ?? [];
  const detail = [
    skipped.length ? `skipped: ${skipped.join(", ")}` : null,
    missing.length ? `never ran: ${missing.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("; ");
  block(
    `The last verify (${marker.at}) did not cover the whole gate` +
      (detail ? ` — ${detail}` : "") +
      ". Run `npm run verify:quiet` in full, or tell the user which gates are unproven rather than " +
      "reporting the work as verified.",
  );
}

process.exit(0);

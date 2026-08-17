#!/usr/bin/env node
/**
 * The Phase Completion Checklist, as a gate.
 *
 * AGENTS.md -> Phase Completion Checklist defines what must be true. This script is what
 * makes it mechanical: named steps, run strictly in order, fail-fast, each step's real exit
 * code read directly rather than inferred from output. Nothing is piped through another
 * command, so no step's status can be masked (the failure mode AGENTS.md used to warn about
 * in prose for eslint).
 *
 * Steps run SEQUENTIALLY and never in parallel: this is an 8GB machine that is usually also
 * running OrbStack and the local Supabase stack.
 *
 *   node scripts/verify.mjs                 the standard gate
 *   node scripts/verify.mjs --full          plus the integration and E2E lanes
 *   node scripts/verify.mjs --quiet         compact output; full output to .verify.log
 *   node scripts/verify.mjs --only=A,B      just these steps
 *   node scripts/verify.mjs --skip=A,B      everything except these
 *   node scripts/verify.mjs --list          print step names and exit
 *
 * Verbose is the default because the usual caller is a human in a terminal who wants to see
 * the suite run. --quiet exists for the opposite caller: an agent, whose every line of tool
 * output is context it pays for. A green run in quiet mode is a dozen lines regardless of how
 * many tests ran; on failure it prints the tail of the step that failed, which is the only
 * part worth reading anyway. Full output always lands in .verify.log either way.
 *
 * On success it writes .verify-ok, a marker recording the source state that passed.
 * scripts/verify-guard.mjs reads it. Deleting the marker is harmless; it just means the
 * next guard check reports "never verified".
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, appendFileSync } from "node:fs";
import { sourceFingerprint } from "./source-fingerprint.mjs";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const quiet = flag("quiet");
const LOG = ".verify.log";
const FAIL_TAIL_LINES = 40;

if (quiet) writeFileSync(LOG, `verify — ${new Date().toISOString()}\n`);

/**
 * Run a subprocess. In verbose mode it inherits stdio so the user watches it live. In quiet
 * mode it captures, appends to .verify.log, and returns the text so a failing step can print
 * its tail. Every step goes through here so the two modes cannot drift.
 */
function run(cmd, args, { step } = {}) {
  if (!quiet) {
    return { status: spawnSync(cmd, args, { stdio: "inherit" }).status, output: null };
  }
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  appendFileSync(LOG, `\n${"=".repeat(70)}\n${step ?? cmd} — ${cmd} ${args.join(" ")}\n${"=".repeat(70)}\n${output}`);
  return { status: r.status, output };
}

function tail(text, n = FAIL_TAIL_LINES) {
  if (!text) return null;
  const lines = text.trimEnd().split("\n");
  const cut = lines.slice(-n);
  return (lines.length > n ? `… ${lines.length - n} earlier line(s) in ${LOG}\n` : "") + cut.join("\n");
}

/**
 * `optional: true` means an unmet environment prerequisite (no local Supabase stack, no
 * Playwright browser) downgrades the step to SKIP with a warning rather than failing the
 * gate. A step that RUNS and fails always fails, optional or not.
 */
const STEPS = [
  {
    name: "db-types",
    label: "Database types regenerated and in sync",
    optional: true,
    run: () => {
      const probe = spawnSync("npx", ["supabase", "status"], { encoding: "utf8" });
      if (probe.status !== 0) {
        return {
          skipped: true,
          reason:
            "local Supabase stack is not running, so types cannot be regenerated. " +
            "Every check below therefore ran against the committed src/types/database.ts. " +
            "If this phase changed the schema, start the stack and re-run.",
        };
      }
      const gen = run("npm", ["run", "db:types"], { step: "db-types" });
      if (gen.status !== 0) return gen;
      const diff = spawnSync("git", ["diff", "--quiet", "--", "src/types/database.ts"]);
      if (diff.status !== 0) {
        return {
          status: 1,
          message:
            "src/types/database.ts changed when regenerated — the committed types were " +
            "stale, so any type check before now was validating against the wrong schema. " +
            "Review the diff, then re-run.",
        };
      }
      return { status: 0 };
    },
  },
  { name: "typecheck", label: "TypeScript compiles", cmd: ["npx", ["tsc", "--noEmit"]] },
  { name: "lint", label: "Lint is clean", cmd: ["npx", ["eslint", "."]] },
  { name: "test", label: "Unit, API and component tests pass", cmd: ["npx", ["vitest", "run"]] },
  { name: "build", label: "Production build succeeds", cmd: ["npm", ["run", "build"]] },
  {
    name: "integration",
    label: "Integration tests pass",
    fullOnly: true,
    optional: true,
    run: () => {
      const probe = spawnSync("npx", ["supabase", "status"], { encoding: "utf8" });
      if (probe.status !== 0) {
        return { skipped: true, reason: "local Supabase stack is not running" };
      }
      return run("npm", ["run", "test:integration"], { step: "integration" });
    },
  },
  {
    name: "e2e",
    label: "End-to-end tests pass",
    fullOnly: true,
    optional: true,
    run: () => {
      const probe = spawnSync("npx", ["supabase", "status"], { encoding: "utf8" });
      if (probe.status !== 0) {
        return { skipped: true, reason: "local Supabase stack is not running" };
      }
      return run("npm", ["run", "test:e2e"], { step: "e2e" });
    },
  },
];

if (flag("list")) {
  for (const s of STEPS) console.log(`${s.name}${s.fullOnly ? "  (--full only)" : ""}`);
  process.exit(0);
}

const only = value("only")?.split(",").map((s) => s.trim()).filter(Boolean);
const skip = value("skip")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
const full = flag("full");

const selected = STEPS.filter((s) => {
  if (only) return only.includes(s.name);
  if (skip.includes(s.name)) return false;
  return full || !s.fullOnly;
});

if (selected.length === 0) {
  console.error("verify: no steps selected");
  process.exit(1);
}

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const results = [];
let failed = null;

console.log(
  quiet
    ? `verify — ${selected.length} step(s)${full ? ", full" : ""}, output in ${LOG}`
    : `\nverify — ${selected.length} step(s)${full ? ", full" : ""}\n`,
);

for (const [i, step] of selected.entries()) {
  const n = `${i + 1}/${selected.length}`;
  if (quiet) process.stdout.write(`  ${n} ${step.name} … `);
  else process.stdout.write(`\n▸ ${n}  ${step.name} — ${step.label}\n\n`);
  const started = Date.now();

  let outcome;
  if (step.run) {
    outcome = step.run();
  } else {
    const [cmd, args] = step.cmd;
    outcome = run(cmd, args, { step: step.name });
  }

  const took = Date.now() - started;

  if (outcome.skipped) {
    results.push({ ...step, state: "SKIP", took, reason: outcome.reason });
    if (quiet) console.log(`SKIP (${secs(took)}) — ${outcome.reason}`);
    else console.log(`\n  SKIP  ${step.name} (${secs(took)}) — ${outcome.reason}\n`);
    continue;
  }
  if (outcome.status !== 0) {
    results.push({ ...step, state: "FAIL", took, message: outcome.message });
    if (quiet) {
      console.log(`FAIL (${secs(took)}, exit ${outcome.status})`);
      if (outcome.message) console.log(`\n  ${outcome.message}`);
      const excerpt = tail(outcome.output);
      if (excerpt) console.log(`\n${excerpt}\n`);
    } else {
      console.log(`\n  FAIL  ${step.name} (${secs(took)}), exit ${outcome.status}\n`);
      if (outcome.message) console.log(`  ${outcome.message}\n`);
    }
    failed = step;
    break;
  }
  results.push({ ...step, state: "PASS", took });
  if (quiet) console.log(`PASS (${secs(took)})`);
  else console.log(`\n  PASS  ${step.name} (${secs(took)})\n`);
}

const notRun = selected.slice(results.length);
if (!quiet) {
  console.log("\n" + "─".repeat(60));
  for (const r of results) {
    console.log(`  ${r.state.padEnd(5)} ${r.name.padEnd(12)} ${secs(r.took).padStart(7)}`);
  }
  for (const s of notRun) console.log(`  ----  ${s.name.padEnd(12)}       not run`);
  console.log("─".repeat(60) + "\n");
} else if (notRun.length) {
  console.log(`  not run: ${notRun.map((s) => s.name).join(", ")}`);
}

if (failed) {
  console.error(`verify FAILED at "${failed.name}".` + (quiet ? ` Full output: ${LOG}` : ""));
  if (notRun.length) {
    console.error(`${notRun.length} later step(s) did not run — fix this one and re-run.`);
  }
  process.exit(1);
}

const skipped = results.filter((r) => r.state === "SKIP");
if (skipped.length) {
  console.log(`verify passed, with ${skipped.length} step(s) skipped:`);
  for (const s of skipped) console.log(`  - ${s.name}: ${s.reason}`);
  console.log("");
}

/**
 * "complete" means: this run actually covered every step a default (or --full) run would,
 * and none of them were skipped. A partial run via --only/--skip is never complete, however
 * green it looked — otherwise the marker would tell the guard the gate passed when only the
 * typecheck ran.
 */
const expected = STEPS.filter((s) => full || !s.fullOnly).map((s) => s.name);
const ran = results.filter((r) => r.state === "PASS").map((r) => r.name);
const missing = expected.filter((name) => !ran.includes(name));
const complete = missing.length === 0;
writeFileSync(
  ".verify-ok",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      steps: results.map((r) => ({ name: r.name, state: r.state })),
      full,
      complete,
      missing,
      fingerprint: sourceFingerprint(),
    },
    null,
    2,
  ) + "\n",
);

console.log(quiet ? "verify passed." : "verify passed.\n");

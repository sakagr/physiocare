import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Liveness is enforced at the repository layer, not in RLS (AGENTS.md ->
 * Soft Delete Strategy). Nothing structural makes a forgotten
 * `.is("deleted_at", null)` fail, so this guard makes an omission loud.
 *
 * It is project-wide rather than scoped to one phase's tables: a *new*
 * omission is not confined to any phase, and the cost of covering everything
 * from the start is that the reads unfiltered today must be declared below
 * rather than adjudicated.
 *
 * What it cannot catch is stated plainly, because a guard trusted beyond its
 * reach is worse than none:
 *
 * - Reads outside `src/server/repositories/`. Services query tables inline in
 *   places; widening the scan to `src/server/**` would sweep in service-layer
 *   writes it cannot classify.
 * - Chains split across statements. `let query = supabase.from(...)...;
 *   if (x) query = query.eq(...)` is matched on the first statement only.
 * - Wrong-column or re-admitting filters -- an `.or()` that reintroduces
 *   deleted rows, or a filter on the wrong table in a join, both pass.
 * - RPCs and views. `consume_package_session` is opaque to it, and
 *   `patient_packages_view` is treated as a table because the generated types
 *   do.
 * - It proves nothing about correctness, only the presence of a token. The
 *   per-function behavioural tests are the strong assertion; this is the
 *   cheap net under them.
 */

const REPOSITORY_DIR = join(process.cwd(), "src/server/repositories");
const DATABASE_TYPES = join(process.cwd(), "src/types/database.ts");

/**
 * Reads that deliberately see soft-deleted rows, keyed `file#function`.
 *
 * Keyed by function rather than by line: line numbers rot on the first edit
 * above them and would turn every unrelated change into a failing guard. A
 * `file#function` key survives edits, moves with the function, and fails
 * usefully when a function is renamed or removed -- at which point the entry
 * is stale and should go.
 *
 * This list is the complete inventory of where lifecycle filtering is
 * deliberately absent. Adding to it is a decision, not a workaround.
 *
 * `PENDING_R9` marks a read that is unfiltered today but has not been
 * assessed. It is not a claim that the absence is correct. R9 works this list
 * down (ROADMAP.md -> Phase R9); the phase is done when no entry carries the
 * marker.
 */
const PENDING_R9 = "PENDING_R9";

const SOFT_DELETE_EXEMPT: Record<string, string> = {
  // --- Legitimate: the read genuinely needs deleted rows ---
  "patient.repository.ts#findLatestPatientCodeInOrg":
    "Patient codes are immutable and must never be reused, so the high-water mark must count soft-deleted patients.",
  "patient-package.repository.ts#listPatientPackagesByIds":
    "Report aggregation; includes soft-deleted assignments so historical commission figures stay stable.",
  "patient-package.repository.ts#insertPatientPackage":
    "Re-reads the row just inserted, by id, to return the view's derived status. Cannot be deleted.",
  "patient-package.repository.ts#updatePatientPackage":
    "Same re-read after an update.",

  // --- Accepted behaviour, not an oversight ---
  "patient-package.repository.ts#existsPatientPackagesForPackage":
    "Counts every assignment ever, including soft-deleted and cancelled -- the behaviour package.service.ts documents and accepts, and the reason a package assigned once can be neither deleted nor deactivated. Narrowing it is a separate decision.",

  // --- Pending an R9 judgment: unfiltered today, not yet assessed ---
  "user.repository.ts#findUserById": PENDING_R9,
  "user.repository.ts#findUserByEmail": PENDING_R9,
  "user.repository.ts#findUserByUsername": PENDING_R9,
  "user.repository.ts#findUserWithRoleById": PENDING_R9,
  "organization.repository.ts#findOrganizationById": PENDING_R9,
  "organization.repository.ts#findOrganizationByName": PENDING_R9,
  "subscription.repository.ts#findSubscriptionPlanById": PENDING_R9,
  "subscription.repository.ts#findSubscriptionPlanByName": PENDING_R9,
  "invoice.repository.ts#findLatestInvoiceNumberInOrg": PENDING_R9,
  "user-clinic.repository.ts#findAssignment": PENDING_R9,
};

/** Every table whose generated `Row` type carries a `deleted_at` column. */
function softDeletableTables(): Set<string> {
  const source = readFileSync(DATABASE_TYPES, "utf8");
  const tables = new Set<string>();
  const blockPattern = /\n {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/g;
  for (const match of source.matchAll(blockPattern)) {
    if (match[2].includes("deleted_at")) {
      tables.add(match[1]);
    }
  }
  return tables;
}

interface Read {
  key: string;
  table: string;
  statement: string;
}

const WRITE_MARKERS = [".insert(", ".update(", ".upsert(", ".delete("];

/**
 * Splits a repository module into `.from("<table>")` statements, attributing
 * each to the exported function it sits in.
 */
function collectReads(fileName: string, source: string, tables: Set<string>): Read[] {
  const lines = source.split("\n");
  const reads: Read[] = [];
  let currentFunction = "<module>";
  let statement: string[] = [];

  const flush = (functionName: string) => {
    const text = statement.join(" ");
    statement = [];
    const fromMatch = text.match(/\.from\("(\w+)"\)/);
    if (!fromMatch || !tables.has(fromMatch[1])) return;
    if (WRITE_MARKERS.some((marker) => text.includes(marker))) return;
    reads.push({ key: `${fileName}#${functionName}`, table: fromMatch[1], statement: text });
  };

  for (const line of lines) {
    const functionMatch = line.match(/^export (?:async )?function (\w+)/);
    if (functionMatch) {
      flush(currentFunction);
      currentFunction = functionMatch[1];
    }
    statement.push(line.trim());
    if (line.trimEnd().endsWith(";")) {
      flush(currentFunction);
    }
  }
  flush(currentFunction);

  return reads;
}

function allReads(): Read[] {
  const tables = softDeletableTables();
  return readdirSync(REPOSITORY_DIR)
    .filter((file) => file.endsWith(".ts"))
    .flatMap((file) => collectReads(file, readFileSync(join(REPOSITORY_DIR, file), "utf8"), tables));
}

describe("soft-delete liveness guard", () => {
  it("derives a non-trivial set of soft-deletable tables", () => {
    // If the derivation silently returned nothing, every assertion below
    // would pass vacuously.
    const tables = softDeletableTables();
    expect(tables.size).toBeGreaterThan(10);
    expect(tables.has("patients")).toBe(true);
    expect(tables.has("patient_records")).toBe(true);
    // audit_logs has neither deleted_at nor updated_at (dropped in
    // 20260714000700_audit_logs_cleanup.sql): an audit trail is append-only,
    // so it never enters this set and needs no exemption. If a future
    // migration added the column, the guard would start demanding a filter --
    // which would itself be the right alarm.
    expect(tables.has("audit_logs")).toBe(false);
  });

  it("filters deleted rows out of every repository read that is not declared exempt", () => {
    const offenders = allReads()
      .filter((read) => !read.statement.includes('.is("deleted_at", null)'))
      .filter((read) => !(read.key in SOFT_DELETE_EXEMPT))
      .map((read) => `${read.key} (${read.table})`);

    expect(offenders).toEqual([]);
  });

  it("carries no stale exemption", () => {
    const unfiltered = new Set(
      allReads()
        .filter((read) => !read.statement.includes('.is("deleted_at", null)'))
        .map((read) => read.key)
    );

    // A declared function that no longer exists, or that has since gained its
    // filter, is an entry excusing nothing -- so the list cannot quietly
    // outlive what it was written for.
    const stale = Object.keys(SOFT_DELETE_EXEMPT).filter((key) => !unfiltered.has(key));
    expect(stale).toEqual([]);
  });
});

---
name: migration-rls
description: Write a PhysioCare database migration and its RLS policies, then regenerate types and verify. Use whenever an increment adds or changes a table, column, index, constraint, database function, trigger, view, or row-level-security policy.
---

# Migrations and RLS

Read `AGENTS.md` → *Database Types*, *Database Functions for Atomic Operations*,
*Soft Delete Strategy*, *Partial Unique Index Convention*, and *Audit Logging* before
starting.

## Writing the migration

Migrations live in `supabase/migrations/` and are named
`YYYYMMDDHHMMSS_<snake_case_description>.sql`. The two unprefixed files, `2100_triggers.sql`
and `2200_indexes.sql`, are applied last by ordering convention — put triggers and
indexes that belong to a specific change in that change's own timestamped file unless
they genuinely belong to the shared set.

- Migrations are forward-only. Never edit a migration that has been applied to the
  remote project; write a new one.
- A change that must be atomic across multiple statements belongs in a database
  function, not in application code issuing several round-trips
  (`AGENTS.md` → *Database Functions for Atomic Operations*).
- Partial unique indexes follow the convention in `AGENTS.md` — soft-deleted rows must
  not consume a unique slot.
- New tables with a soft-delete column need their liveness filter enforced at the
  repository layer, not in RLS, and `tests/unit/soft-delete-liveness.test.ts` will
  require a judgment on any new read.

## RLS policies — the trap to check every time

**RLS filters; it does not error.** A policy narrower than what a service's call chain
needs does not produce a permission error the caller can see — it returns zero rows,
and the service treats that as "no data" and returns a plausible, wrong answer.

Before narrowing or adding a SELECT policy, trace every service path that reads the
table under the **caller's own session-scoped client** (`createRouteHandler` never
passes an admin client). ADR-0011 is the worked example: narrowing
`user_compensations`' SELECT policy to Owner-only would have made every Admin-run
commission report silently return `totalCommission: 0`.

Where the UX-level boundary is narrower than the data-access boundary, enforce it in an
`authorization.service.ts` predicate and leave RLS as the permissive backstop — then
record why in an ADR, because the reasoning is not visible from the policy definition.

Use the admin client only where `AGENTS.md` → *Admin Client* sanctions it.

## After the migration

1. Apply it against the local stack.
2. `npm run db:types` — regenerate `src/types/database.ts`. Do this **before** any
   compile-time check, or `tsc` validates against a stale schema.
3. Run `get_advisors` on the Supabase MCP server for security and performance findings
   — an unindexed foreign key or a table with RLS disabled shows up here for free.
4. Write or extend the integration test that proves the policy from a real caller's
   session, not from the service-role client. `tests/integration/clinical-rls.test.ts`
   is the pattern.
5. Run the Phase Completion Checklist in `AGENTS.md`.

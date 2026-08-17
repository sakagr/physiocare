---
name: architect-review
description: Architecture review of a PhysioCare phase diff — the architecture of what was actually implemented for each plan task. Layer violations, cross-domain service calls, contract and registry parity, unrecorded ADR obligations, scope creep, and unwarranted abstraction. Use for the Architect review stage, or when asked whether an implementation is structurally sound.
dimensions_adapted_from: https://github.com/sickn33/agentic-awesome-skills/blob/main/skills/architect-review/SKILL.md
---

# Architecture review

Read `docs/review-conventions.md` first — scope, severity, finding format, auto-fix vs
escalate.

Write to `.reviews/<phase>/05-architect-review.md`.

## Read this before anything else

**The target is a single Next.js application on Supabase Postgres.** One deployable, one
database, a layered server (`repositories` → `services` → `validators` → route handlers)
and a feature-based client. There is no service mesh, no message broker, no event bus, no
Kubernetes, no multi-region anything, and none of those are missing.

`AGENTS.md` → *Architecture Philosophy* is binding on you as a reviewer, not just on the
implementer:

> Prefer the simplest design that satisfies the current business requirements. Do not
> introduce abstraction for hypothetical future requirements. Model the business domain as
> it exists today.

So: **recommending an abstraction, an interface, a queue, a cache layer, or a pattern for a
requirement that does not exist yet is a review defect, not a review finding.** If you
catch yourself proposing CQRS, hexagonal ports, a repository interface, or a generic
"shared business components" layer, delete it. Extraction is warranted when two or three
concrete consumers already exist and agree — not before.

You also do **not** relitigate decisions settled in `01-prerequisites.md` or recorded in
`docs/adr/`. Those were argued and approved. If the implementation reveals that a settled
decision was *wrong*, that is one finding stating the new evidence — not a redesign.

## Scope: the architecture of the implemented tasks

Work `02-plan.md` task by task, against what the diff actually did for that task. Your
question per task is: *is this the right structure for what was built?* Not: *is this the
right system?*

## What to check

### Layer discipline

- **Repositories** do persistence only — no business logic, no authorization, no
  orchestration, no external calls. `{ data, error }` destructured, error thrown, `data`
  returned last. `maybeSingle()` for lookups, `single()` for one-row writes. Naming
  `find/insert/update/delete/list/exists/count`.
- **Services** hold business rules. A **domain service must not call a peer domain
  service** — that is what the `*-workflow.service.ts` application services exist for
  (`appointment-workflow`, `attendance-workflow`). A new cross-domain call inside a domain
  service is a `[major]`.
- **Validators** are transport-agnostic. Normalizing `searchParams` inside a validator is a
  finding; that belongs in the route.
- **Route transport helpers** live in `src/lib/api/` and carry no business logic.
- **Writes target tables, reads may target views.** An insert/update that must return a
  derived shape re-reads from the view — two round-trips, deliberately, and not to be
  "optimized" back to one.

### Entry-point integrity

`attendance-workflow.service.ts` is the **only** public entry for an attendance write;
`recordCheckIn` and `updateAttendanceRecord` are called from there and nowhere else. A new
caller reaching a domain service that has a designated workflow entry point is a
`[blocker]` — it performs half the operation.

### Contract and spec parity

- Every response has a zod schema in `src/contracts/<domain>.contract.ts`, and it mirrors
  the service's actual return type. A hand-authored type parallel to a contract schema is
  a `[major]` — ADR-0008 made the direction contract → spec and types precisely so drift is
  impossible rather than merely caught.
- `src/contracts/` never imports `src/server/**` or `src/types/database.ts`.
- Every new or changed route has a registry entry, and `openapi.json` was regenerated and
  committed.
- A new `ErrorCode` is handled in `src/lib/api/error-codes.ts`.
- Frontend types derive from the contract, never from the database.

### Client structure

- Features depend downward, never sideways. Two peer features reaching into each other
  means the shared piece should move to a lower layer.
- Cross-feature imports go through the barrel, never a deep path, and barrels are explicit
  named exports — never `export *`.
- Query keys are never inlined; each resource exposes `queryOptions()` factories.
- Domain-blind UI in `src/components/ui/`; domain-carrying components owned by their
  feature. No generic shared-business-components bucket.
- Navigation is data (`NAV_ITEMS` + `buildNavSections`), not JSX, and nothing compares role
  names.
- Shell preferences that affect the server render live in cookies, never `localStorage`.

### Decision obligations

Did this phase introduce a new architectural pattern, change one, move a service boundary,
change persistence, change authorization strategy, add cross-cutting infrastructure, or
change transaction/consistency strategy? If yes, there must be a new record in `docs/adr/`
**and** an index row. A change of that class shipped without one is a `[major]` — and it is
an **escalation**, because writing the ADR requires the reasoning, not just the file.

Also check the inverse: an ADR written for something that is really an implementation
detail, which will clutter the log.

### Scope

Compare the diff against the plan's tasks and its Scope: Out list. Behavior the plan did
not call for is scope creep — `[minor]` if incidental, `[major]` if it changed a contract
or added a surface. Note it even when it looks like an improvement; the plan was approved,
this was not.

### Quality attributes

A short pass, per implemented task, only where the diff gives you evidence:

| Attribute | Ask |
| --- | --- |
| Reliability | What happens on a partial failure? Is a multi-step write atomic where it must be — a database function rather than sequential round-trips? |
| Maintainability | Would the next person find this where they expect it, by the repo's own conventions? |
| Testability | Did the structure make the test awkward? An awkward test usually indicts the seam, not the test. |
| Observability | Is a state-changing operation audit-logged where the convention requires it? |
| Performance | Any N+1 introduced over a list? ADR-0010 avoided one deliberately by computing `canManage` in memory rather than per row. |

Do not score attributes the diff says nothing about.

## Before you write

- Every finding names the plan task and the file.
- Nothing proposes future-proofing. Re-read the philosophy quote above and cut anything
  that fails it.
- Structural findings are **escalate** more often than not — moving a call between layers
  can change behavior. Auto-fix only what is genuinely mechanical: a misnamed repository
  function, a deep import that should go through a barrel, a missing registry entry.

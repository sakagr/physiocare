---
name: qa-review
description: QA review of a PhysioCare phase diff — plan scenarios vs actual tests, TDD compliance, test-lane correctness, loading/empty/error states, E2E presence, accessibility semantics, and untested edge cases. Use for the QA review stage, or whenever asked to review test coverage or test quality for a change.
---

# QA review

Read `docs/review-conventions.md` first — scope, severity, finding format, auto-fix vs
escalate. Read `.claude/skills/tdd/SKILL.md` too: it is the procedure the implementation
was supposed to follow, and half your job is judging whether it did.

Write to `.reviews/<phase>/05-qa-review.md`.

You own: whether the plan's scenarios are actually tested, whether TDD was followed,
whether tests are in the right lane and prove what they claim, and whether the user-facing
states exist. You do **not** own security defects (Security's) or structural problems
(Architect's) — but a *missing test* for either is yours.

## 1. Plan coverage — the primary check

Walk `02-plan.md` task by task. Each task carries verification notes; those are the
acceptance criteria you are auditing against.

For every task: does a test exist for each scenario the plan named? Build the list
explicitly — a named scenario with no test is a `[major]` finding, and an untested
scenario the plan called a security or data-integrity concern is a `[blocker]`.

Then the reverse: does the diff contain behavior the plan did **not** name? Untested extra
behavior is yours to flag; the fact that it was added at all is the Architect's scope-creep
call.

## 2. TDD compliance

You cannot see the commit sequence — the phase is one working tree. So judge it from what
the tests look like:

- Do tests assert **behavior** through the public surface, or do they reach into internals?
  A test coupled to a private helper will break on the next refactor and is a `[minor]`
  at least.
- Do test names describe a behavior or a function name?
- Is there a test that could not fail? A test asserting a value it also computed, a mock
  asserted against itself, an `expect` with no meaningful assertion.
- Is the tracer-bullet shape visible — does at least one path go end to end through the
  layers this phase touched, or are there five layers of unit tests and no integration?

## 3. Lane correctness

`AGENTS.md` → *Testing Requirements* and `docs/frontend.md` → *Frontend Testing* define the
lanes. Common failures:

- **RLS or a policy tested with the service-role client.** It passes regardless of the
  policy. This proves nothing and is a `[major]` — it is worse than no test, because it
  reads as coverage.
- **A responsive behavior tested in jsdom.** Media queries are not evaluated there. If the
  behavior only appears at a viewport, the component test is not proving it; it needs E2E
  or an explicit note that it stays manual until F10.
- **E2E re-covering the component lane.** E2E is for real cookies, real navigation, media
  queries, clipboard. A browser test asserting a capability filter that a jsdom test
  already covers is expensive duplication — `[minor]`.
- **Integration test not seeded through the shared helper**, so it depends on residue from
  another test.
- **Missing E2E entirely.** Every F-phase from F3 on writes its own E2E specs. A frontend
  phase with none is a `[major]`.

## 4. User-facing states

`docs/frontend.md` and `UX.md` make these structural, but a primitive can be used and its
convention still missed:

- Every data-driven region has loading, empty, and error states — and the loading state is
  a layout-matched skeleton, not a bare spinner.
- Every destructive confirmation names its target and consequence.
- Every status carries text, not colour alone.
- A forbidden state has a way back; a 403 is never a dead end.
- Limit and subscription enforcement renders its dedicated state where the phase owns the
  surface, and the flat toast elsewhere — `meta.suppressToastForCodes` on the mutation, not
  a change to `ERROR_BEHAVIORS` (ADR-0012).
- A secret is revealed once, masked by default, with dismissal behind a confirmation.

## 5. Accessibility semantics

The component lane can prove these, so absence of a test is a finding:

- Interactive elements have accessible names; tests query by role and name rather than by
  test id or class.
- Form fields are labelled and their errors are programmatically associated.
- Dialog and drawer semantics: correct role, focus moved in, focus restored on close.
- Loading and busy regions are announced.
- No control reachable only by pointer.

## 6. Edge cases the plan named but nothing tests

Boundaries this domain keeps producing: empty result sets, a single row, pagination at
exactly the page size, a package with zero sessions remaining, an appointment at a
day boundary, a half-day attendance window with no status, concurrent status transitions,
a soft-deleted parent with live children, dates around month end. Flag the ones the plan
named and nothing covers; do not invent a backlog of hypotheticals.

## Before you write

- Coverage findings name the plan task and scenario, so remediation knows exactly what to
  write.
- A missing test is usually **auto-fixable** — writing a test changes no contract and no
  authorization rule. Say so. QA should be the reviewer with the highest auto-fix rate.
- **Escalate** when a missing test would require a fixture, seed, or harness that does not
  exist yet, or when covering a scenario properly means changing the plan.

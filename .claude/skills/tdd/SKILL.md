---
name: tdd
description: Run the test-driven cycle for a PhysioCare implementation stage — per-task vertical slices off the approved plan, tracer bullet first, RED-GREEN-refactor per behavior. Use during the Implementation stage, and whenever writing tests for a feature or reproducing a bug. Also use when reviewing whether an implementation actually followed TDD.
adapted_from: https://github.com/sickn33/agentic-awesome-skills/blob/main/skills/tdd/SKILL.md
upstream_author: Matt Pocock
upstream_license: MIT
---

# The TDD cycle

`AGENTS.md` → *Test-Driven Development* states the policy: TDD is mandatory, and production
code is not complete until its tests exist and pass. This skill is the procedure that
policy is accountable to. Where the two appear to disagree, `AGENTS.md` wins on *what*
must be true and this skill wins on *how* to get there.

## Where the scenarios come from

**You do not derive the test scenarios here.** The approved plan
(`.reviews/<phase>/02-plan.md`) already enumerates them, and the user signed off on that
enumeration. Re-deriving them at implementation time silently changes what was approved.

Read the plan. Its numbered tasks are your slice boundaries. Its per-task verification
notes are your acceptance criteria. If a task's scenarios turn out to be wrong or
incomplete once you are inside the code, **stop and say so** — that is a plan defect and
it is cheaper to amend the plan than to quietly implement something else.

## Slice vertically, one task at a time

Do **not** write every test in the plan and then implement everything. That ordering
defers all integration risk to the end, and every test you wrote in hour one is a
guess you have to maintain until hour nine.

Instead, take plan task 1, drive it to green, then task 2. Within a task:

1. **RED** — write the test for one behavior. Run it. Confirm it fails, and that it
   fails for the reason the plan says it should. A test that passes immediately, or
   fails on a typo or missing import, has proven nothing.
2. **GREEN** — write the least production code that satisfies it.
3. **Repeat** for the next behavior in the task.
4. **REFACTOR** at the end of the task, with the task's tests green, before moving on.
   Not at the end of the phase — by then the pressure is to ship and it does not happen.

### Task 1 is the tracer bullet

Whichever plan task comes first should cut through **every layer it touches** —
validator, repository, service, authorization, route, contract schema, registry entry,
client — for one narrow case, end to end, before task 2 begins. A wrong assumption about
the layer boundaries surfaces on task 1 rather than on task 9 after eight tasks have been
built on it.

If the plan's task 1 is not layer-spanning, say so and propose reordering rather than
implementing eight horizontal layers and integrating last.

## Test the behavior, not the implementation

A test should describe something the system *does*, exercised through the surface a real
caller uses. Assert on the observable outcome — the response, the returned entity, the
persisted row, the rendered accessible name — not on which internal function ran.

The check is: **would this test survive a refactor that preserved behavior?** If
renaming a private helper or reshaping an internal call breaks it, it is coupled to the
implementation and it will cost more than it protects.

Pure functions are the exception the repo already sanctions: `resolveLanding`,
`guardNamespace`, and `buildNavSections` are deliberately unit-tested directly against
fixtures, because their whole design purpose is to be decidable without a session or a
database. Testing them is testing behavior; their public surface just happens to be small.

## Which lane

Pick per behavior, not per file. `AGENTS.md` → *Testing Requirements* and
`docs/frontend.md` → *Frontend Testing* own the details; the short form:

| Proving | Lane | Location |
| --- | --- | --- |
| A pure function, a map, a schema's shape | unit, Node | `tests/unit/` |
| A service or repository against a real schema, RLS from a real caller's session | integration | `tests/integration/`, `npm run test:integration` |
| A route's status, envelope, authorization | API | `tests/api/` |
| Component logic, DOM, capability filtering, accessible semantics | component, jsdom | `tests/components/`, via `renderWithProviders` |
| Real session cookies, real navigation, CSS media queries, clipboard | E2E | `tests/e2e/`, `npm run test:e2e` |

Two things worth stating because they are easy to get wrong:

- **RLS must be proven from a real caller's session**, never from the service-role
  client — a service-role test passes regardless of the policy and proves nothing. See
  `tests/integration/clinical-rls.test.ts`.
- **jsdom cannot evaluate media queries.** A component test cannot prove responsive
  behavior. If a behavior is only visible at a viewport, it needs E2E or it stays manual.

## Per-cycle checklist

Before moving off a behavior:

- [ ] The test names a behavior, not a function.
- [ ] It was observed failing, for the stated reason.
- [ ] It exercises the public surface a real caller would use.
- [ ] It would survive a behavior-preserving refactor.
- [ ] It is in the right lane, and does not re-cover what a cheaper lane already proves.

Before moving off a task:

- [ ] Every scenario the plan named for this task has a test.
- [ ] Refactor pass done with tests green.
- [ ] No scenario was added that the plan did not name — or if one was, it is recorded
      for the walkthrough rather than absorbed silently.

## Bugs

A bug is reproduced by a failing test before it is fixed — including bugs found by the
review stages. The reproduction is the proof the fix works and the guard against its
return. A fix without one is not a fix, it is an edit.

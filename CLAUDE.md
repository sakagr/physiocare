# CLAUDE.md

## Reading the guidelines

This project's conventions are layered. Load what the work in hand needs — not everything, every time.

| Document | Read it | Contents |
| --- | --- | --- |
| [AGENTS.md](AGENTS.md) | **Always, in full, before making any changes.** | Core engineering and architecture conventions: layer responsibilities, naming, types, error/result handling, database and query conventions, authentication and authorization, project decisions, TDD, the Phase Completion Checklist. |
| [docs/frontend.md](docs/frontend.md) | Before any work under `src/app/`, `src/features/`, `src/components/`, `src/contracts/`, or `src/lib/`. | Frontend architecture: project structure, client authorization, forms, design system, shared UI primitives, app shell, frontend testing, error handling and types. |
| [UX.md](UX.md) | Before any work that changes what a user sees or does. | The experience the frontend architecture serves: information architecture, flows, screen inventory, interaction and state conventions. |
| [docs/adr/](docs/adr/README.md) | Read the index; then read only the records the current increment touches. | Accepted frontend and UX decisions, one file per record. Append-only and immutable. |
| [ROADMAP.md](ROADMAP.md) | When scoping or starting a phase. | Backend (R) and frontend (F) phase definitions. |
| [docs/review-conventions.md](docs/review-conventions.md) | Before any review stage, and when consolidating or remediating findings. | Reviewer charters, severity model, finding format, auto-fix vs escalate rule, loop limit. |

Do not load `docs/adr/` in bulk. The index carries each record's title, scope, and status; that is enough to decide which ones are relevant, and pulling the whole log crowds out the code the increment is actually about.

When a change introduces a new architectural decision, record it in the layer that owns it: `AGENTS.md` for core/backend conventions, `docs/frontend.md` for frontend conventions, a new file in `docs/adr/` plus its index row for a frontend or UX decision, `UX.md` for the experience detail an ADR references.

### Precedence

When two sources conflict, the earlier one wins:

1. The user's instruction in the current conversation.
2. `AGENTS.md`, `CLAUDE.md`, `docs/frontend.md`, `UX.md`, `docs/adr/` — this repository's own conventions.
3. Skills in `.claude/skills/`.
4. Anything adapted from an external source.

Several skills are adapted from third-party skill libraries and say so in their frontmatter. They contribute **checklists, dimensions, and procedure** — never format, architecture philosophy, or a decision this repo has already made. A skill that appears to contradict `AGENTS.md` is wrong about this codebase; follow `AGENTS.md` and say that the conflict exists.

The one deliberate exception: `AGENTS.md` → *Test-Driven Development* states the TDD **policy** and explicitly delegates the **procedure** to the `tdd` skill. There, the skill is the authority on how.

## Skills

`.claude/skills/` holds the repo's recurring recipes and review charters. Invoke the matching one rather than re-deriving the convention from the guidelines.

**Workflow**

- **`implement-phase`** — the phase workflow orchestrator. Triggered by any request to implement, start, or continue a roadmap phase.
- **`tdd`** — the test-driven cycle: per-task vertical slices off the approved plan, tracer bullet first, RED-GREEN-refactor per behavior. The authority on TDD procedure.

**Recipes**

- **`api-endpoint`** — adding or changing an `/api` operation, end to end: validator, repository, authorization, service, route, contract schema, OpenAPI registry entry, tests.
- **`migration-rls`** — database migrations, RLS policies, type regeneration, and the filters-not-errors trap that makes a too-narrow SELECT policy return a plausible wrong answer.
- **`adr`** — deciding whether a decision warrants an ADR, and writing it into `docs/adr/`.
- **`ask-question`** — writing a decision request for the user in the Question / Background / Options / Recommendations format, and judging whether a question is warranted at all.

**Review** — charters for the three reviewers; the shared contract (scope, severity, finding format, auto-fix vs escalate) is in [docs/review-conventions.md](docs/review-conventions.md).

- **`security-review`** — authorization boundaries, RLS and tenant isolation, admin-client use, environment gating, secret and PII exposure, the generic web surface.
- **`qa-review`** — plan-scenario coverage, TDD compliance, test-lane correctness, user-facing states, E2E presence, accessibility semantics.
- **`architect-review`** — layer discipline, cross-domain calls, contract and registry parity, ADR obligations, scope creep, unwarranted abstraction.

Each review skill has a matching read-only subagent in `.claude/agents/`, invoked concurrently at stage 5.

## MCP Servers

`.mcp.json` registers two servers:

- **`mantine`** — component documentation and props. Consult it before guessing a Mantine API.
- **`supabase`** — connected to the remote project in **read-only** mode. Use `list_tables` and `execute_sql` to observe the real schema instead of inferring it, `get_advisors` for security and performance findings after a migration (unindexed foreign keys, tables with RLS disabled), and `query_logs` when debugging a live failure. It requires `SUPABASE_ACCESS_TOKEN` in the environment; if the server does not start, that is why.

  It points at the **remote** project, not the local stack — it is an observation and review tool, not the development database. Schema changes are still made as migrations applied locally and verified with `npm run db:types`.

## The Verification Gate

`npm run verify` runs the mechanical part of `AGENTS.md` → *Phase Completion Checklist*: types regeneration and drift check, `tsc`, `eslint`, `vitest`, `next build` — sequentially, fail-fast, each step's own exit code. `npm run verify:full` adds the integration and E2E lanes. `npm run typecheck` is `tsc --noEmit` alone.

Run it rather than the individual commands. A step whose prerequisite is missing (no local Supabase stack) is reported **skipped**, not passed, and the run is marked incomplete — when that happens, say which gate is unproven instead of reporting the work as verified.

**When you run it, use `npm run verify:quiet`** (or `verify:full:quiet`). Verbose mode streams every tool's full output into the context window — a green run with the test suite and build included is a few hundred lines of noise you pay for. Quiet mode writes all of it to `.verify.log` and prints one status line per step, and on failure prints the tail of the step that failed, which is the only part worth reading. Plain `npm run verify` stays verbose because its usual caller is a human watching a terminal.

The user may also run the gate themselves in their own terminal. `.verify-ok` is written whoever invokes it, so that satisfies the Stop hook without costing anything here — if the guard passes and you did not run the gate yourself, that is why.

Useful flags while iterating: `--only=typecheck,lint`, `--skip=build`, `--list`.

A **Stop hook** (`.claude/settings.json` → `scripts/verify-guard.mjs`) blocks when source changed since the last successful verify. It deliberately does **not** run the gate — that would add minutes to every turn — and costs milliseconds.

Three things it deliberately does not do, each learned from it locking a session for nine consecutive turns:

- It **blocks at most once per turn**, honouring `stop_hook_active`. If it has already blocked and you have answered it, it will not block again on the same turn; re-blocking cannot achieve anything the first block did not.
- It judges staleness **via git**, not file timestamps. A checkout, a commit, or a `touch` moves mtime without changing content, and an earlier timestamp-based version reported those as stale.
- An **incomplete verify is not on its own a reason to block.** `db-types` skips whenever the local Supabase stack is down, which is a laptop's normal state — blocking on completeness meant a gate that could never go green. Disclosing an unproven gate is your job when you report the work, not something enforced every turn.

Its scope is `src/`, `tests/`, `supabase/migrations/`, `scripts/` and the build config files. Documentation, `.claude/` configuration and `.reviews/` artifacts are not source — a stage that writes only markdown will not trip it. `VERIFY_GUARD=off` disables it entirely.

## The Phase Workflow

**Vocabulary:** a *phase* is a roadmap unit (`F8`, `R9`); a *stage* is a step of the workflow below. `AGENTS.md` → *Phase Completion Checklist* means the roadmap sense.

**Any request to implement, start, begin, work on, or continue a roadmap phase runs this workflow** — never an ad-hoc approach. "Implement phase F8", "start F8", "let's do the next phase", "continue F8" all mean the same thing. Invoke the `implement-phase` skill, or run `/implement-phase <code>`. Individual stages have their own commands (`/stage-prereqs`, `/stage-plan`, `/stage-implement`, `/stage-verify`, `/stage-review`, `/stage-remediate`) for re-running one in isolation.

| Stage | Output in `.reviews/<phase>/` | Gate |
| --- | --- | --- |
| 1 Prerequisites | `01-prerequisites.md` — gaps, ROADMAP prerequisites, design questions | **user approves** |
| 2 Plan | `02-plan.md` | **user approves** |
| 3 Implementation | code, per the `tdd` skill | — |
| 4 Verification | `npm run verify` green, `04-walkthrough.md`, `04-implementation.diff` | verify green |
| 5 Review | `05-security-review.md`, `05-qa-review.md`, `05-architect-review.md` — three concurrent read-only subagents | — |
| 6 Consolidation | `06-findings.md` — deduped, ranked, split auto-fix vs escalate | — |
| 7 Remediation | auto-fixes applied; escalations and all blockers surfaced | **user decides** |
| 8 Completion | re-verify, targeted re-review, `✅` on `ROADMAP.md` | — |

Stages 1 and 2 are hard stops; silence is not approval. Stages 3–8 then run continuously, pausing only for an escalated finding at stage 7.

**The workflow never commits and never pushes.** Stage 8 lists the artifacts and stops; the user reviews the completed work before committing.

Full detail — resolving the phase from `ROADMAP.md`, `STATE.md`, resumption — is in the `implement-phase` skill.

## Review Documents

Architecture reviews, design reviews, implementation plans, and implementation walkthrough reviews must be written to a markdown file rather than only output as chat text.

Write them to **`.reviews/<phase>/NN-<stage>.md`** in the repository — a stable, gitignored path, so a later session (or Cowork, reviewing before commit) can read what an earlier stage produced without it being re-supplied by hand. `<phase>` is the roadmap phase code lowercased (`f8`, `r9`), and `NN` is the stage number. A stage re-run after feedback takes the next free number rather than overwriting its predecessor. See [.reviews/README.md](.reviews/README.md) for the full layout.

Before starting a stage, read `.reviews/<phase>/STATE.md`, then the highest-numbered document for each preceding stage of that phase. Do not read other phases' directories by default.

Tell the user the path of the document you wrote.

The document is the deliverable, not the chat message. Do not restate its contents in the chat window — no section-by-section summary, no reproducing its findings, tables, or reasoning. Reply with the file path plus a few lines at most: anything that needs a decision, and anything that contradicts what was asked. The user reads the document.

## Questions in Review and Plan Documents

When asking questions in review or plan documents, follow this structure for clarity and decision-making:

1. **Question** — A proper question sentence that clearly states what needs to be decided.
2. **Background** — A very brief explanation of why this question matters or what context the user needs to understand it.
3. **Options** — Present the available choices or approaches, each with a short description.
4. **Recommendations** — State which option(s) you recommend and provide brief reasoning for each recommendation.

Number them `Q1`, `Q2`, … so answers can be referenced by number and the plan that follows can cite them.

**Before asking, check whether it warrants a question at all** — if the codebase, an ADR, `AGENTS.md`, or `UX.md` already answers it, or if one option is obviously right, decide it and record the decision instead. A document with eight questions buries the two that matter.

The craft — when to ask, how to build options that are not strawmen, always recommending and stating your confidence, and the escalated-finding variant — is in the **`ask-question`** skill. Read it before writing the questions section of a prerequisites document, plan, or findings document.

## Implementation Plans

An implementation plan is structured as a **numbered list of tasks**, in the order they are to be done — the shape of a Jira story broken into tasks and sub-tasks, not a prose narrative.

- Each task is numbered (`1.`, `2.`, `3.` …) and titled with the outcome it produces.
- A task that is too large to verify in one pass is broken into numbered sub-tasks (`1.1`, `1.2` …). Break down only where it helps; a task that stands on its own stays a single item.
- Every task and sub-task carries a short description: what is being changed, which files or modules it touches, and how it is verified. Keep it to what someone picking up that task alone would need.
- Decisions, trade-offs, and rationale belong in their own section, referenced by task number — not woven through the task list.

The task list is the plan's spine. Anything that cannot be expressed as a task to be done belongs in a supporting section around it.

**Task titles** are verb-first, concrete, and name the files or modules they touch — "Add `canViewCompensation` predicate and wire the `compensation:view` token", not "Authorization work". Each task is atomic: one logical unit that can be verified on its own.

**Task 1 is the tracer bullet** — it cuts through every layer the phase touches, end to end, for one narrow case, before task 2 begins. See the `tdd` skill.

**Every plan carries a Scope section** with explicit **In** and **Out** lists. The Out list is not decoration: it is what the architect reviewer checks scope creep against at stage 6, and what stops a phase quietly absorbing the next one's work.

## Implementation Walkthroughs

A walkthrough is written at **stage 4**, after verification passes, and is **derived from `git diff <base>` plus the new files `git ls-files --others --exclude-standard` reports** — not from memory of what was implemented. A walkthrough written from intent describes what you meant to do; one written from the diff describes what actually landed, including what you did not notice you did.

It covers: what changed per plan task, what was added that the plan did not name, what was left out and why, and anything discovered along the way.

It is not optional and does not need to be offered — stage 4 produces it. `04-implementation.diff` is written alongside it, before any reviewer runs, so implementation and later remediation can always be told apart.

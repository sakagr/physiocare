---
name: implement-phase
description: Run the full PhysioCare phase workflow for a roadmap phase — prerequisites, plan, implementation, verification, review, consolidation, remediation, completion. Use whenever the user asks to implement, start, begin, work on, do, or continue a roadmap phase or a prerequisite increment ("implement phase F8", "start F8", "let's do the next phase", "continue F8", "implement the billing prerequisite"). Also use to resume a phase already in progress.
---

# The phase workflow

## Vocabulary — do not confuse these

- A **phase** is a roadmap unit: `F8`, `R9`. Defined in `ROADMAP.md`.
- A **stage** is a step of this workflow: Prerequisites, Plan, Implementation, and so on.

`AGENTS.md` → *Phase Completion Checklist* means the roadmap sense. This document is the
only place the two words appear together; everywhere else, say which one you mean.

## Hard rules

1. **Never commit. Never push.** Not at stage 8, not "as a checkpoint", not because
   verification went green. The user commits after reviewing the completed work. Stage 8
   ends by listing artifacts and stopping.
2. **The two approval gates are hard stops.** After stage 1 and after stage 2, stop and
   wait. Silence is not approval. Do not begin the next stage in the same turn.

   **Instructions for a later stage do not pre-approve the gates before it.** A message may
   approve stage 1 *and* tell you how to implement, what to plant, what to check at stage 6 —
   supplying that guidance early is convenient for the user, not a waiver. Hold it, run the
   next stage only, and stop at its gate. The only thing that clears a gate is the user
   responding to the artifact that gate produced: stage 2's gate is cleared by a reply to
   `02-plan.md`, which cannot exist before you write it.

   If you are unsure whether a message approved the gate in front of you or a later one, ask.
   One question costs a turn; blowing through a gate costs the plan the user never saw.
3. **Stages 3 through 8 run continuously** once the plan is approved, pausing only for an
   escalated finding at stage 7.
4. **Never skip a stage.** If one cannot run, say why and stop.
5. **Write every artifact before moving on.** A stage that produced no file did not happen.
6. **Update `STATE.md` as the last action of every stage, before reporting.** It is the only
   thing a fresh session reads to learn where the work stands, so a stale `STATE.md` is worse
   than none: it asserts something false with the same confidence as something true. If
   `STATE.md` says stage 1 while `02-plan.md` exists on disk, the record is lying. Check it
   against the artifacts actually present whenever you start or resume.

## Resolving the phase

Read `ROADMAP.md`. Headings are `# Phase <CODE> – <Name>`, optionally followed by `✅`.

- **A bare number is ambiguous.** "Phase 7" could be `R7` or `F7`. Ask which; never guess.
- **`✅` means complete.** If the requested phase is marked complete, say so and ask
  whether to proceed anyway before doing anything else.
- **Prerequisites are the italic `*Prerequisite: …*` lines immediately _before_ a phase
  heading, not after.** The line above `# Phase F7` belongs to F7. Reading them forward
  attaches every prerequisite to the wrong phase.
- A prerequisite increment is its own phase code with a slug suffix: `f7-billing-writes`.
  It runs the same eight stages, in its own `.reviews/f7-billing-writes/` directory.

The phase's own bullets in `ROADMAP.md` are the scope statement stage 1 works from.

## Start or resume

`.reviews/<phase>/` is the record. If it exists, this is a **resume** — read
`.reviews/<phase>/STATE.md`, report where things stand, and continue from the current
stage. Do not restart a stage whose artifact already exists unless the user asks.

If it does not exist, this is a **start**. Before creating anything, **check the working tree
is clean** (`git status --porcelain`). If it is not, stop and tell the user what is uncommitted
and that it should be committed or stashed first.

This is not fussiness. `<base>` is the last commit, and the phase's scope is everything that
differs from it — so unrelated uncommitted work becomes part of this phase's diff, gets written
into `04-implementation.diff`, and gets reviewed by three subagents as though the phase had done
it. If the user says to proceed anyway, record what was already dirty in `STATE.md` so later
stages can discount it.

Then create the directory and write `STATE.md`.

```markdown
# F8 — Reporting & Analytics

- **Phase:** F8
- **Base SHA:** 792a8c8
- **Started:** 2026-08-17
- **Current stage:** 2 — Plan
- **Status:** awaiting approval

## Stage log

| Stage | Artifact | Status |
| --- | --- | --- |
| 1 Prerequisites | 01-prerequisites.md | approved 2026-08-17 |
| 2 Plan | 02-plan.md | awaiting approval |

## Gate dispositions

- **Stage 1:** approved. Billing-write prerequisite confirmed already shipped; report
  export format decided as CSV-first.
```

The **base SHA** is `git rev-parse HEAD` at the moment stage 1 starts, and it is what every
later diff and every reviewer is scoped against. Record it once; never update it mid-phase.

Because the workflow never commits, `HEAD` stays at `<base>` for the whole phase. The phase's
work therefore lives in the working tree, and its scope is `git diff <base>` plus the paths
`git ls-files --others --exclude-standard` reports. `git diff <base>..HEAD` is always empty
here — anything that uses it silently reviews nothing.

Update `STATE.md` at the end of every stage. It is how a fresh session — or Cowork — knows
where the work stands without reading everything.

## The stages

Artifacts go in `.reviews/<phase>/`. Document conventions are in `CLAUDE.md`; the decision-request
format has its own skill, `ask-question`, which also covers when a question is warranted at all.

### 1 — Prerequisites → `01-prerequisites.md`

Review the documentation and the codebase for what this phase needs and what is missing.
Not a plan; the ground truth the plan will rest on.

Covers: what exists already; what is missing or wrong and must be fixed first; any
`*Prerequisite:*` line from `ROADMAP.md` and whether it is genuinely satisfied (check
`docs/adr/`, `.reviews/`, and `git log`, and say which evidence you used); relevant
accepted ADRs; and the design decisions this phase forces.

**Every decision the phase needs from the user is a Question block here** (see the
`ask-question` skill) — including
whether an unmet ROADMAP prerequisite should ship as its own increment first. This is the
document where questions are cheap; a question deferred to stage 2 is a question asked
after a plan was written around a guess.

Consider using the `architect-review` skill's quality-attribute lens (reliability,
maintainability, testability, observability, performance) to find gaps — but its
"recommend nothing that future-proofs" rule applies here too.

**Then stop.** Report the path and anything needing a decision.

### 2 — Plan → `02-plan.md`

Only after stage 1 is approved, and it must answer stage 1's questions as the user
answered them. Follow `CLAUDE.md` → *Implementation Plans*: numbered tasks and sub-tasks,
Scope In/Out, decisions section keyed by task number.

Task 1 should be the tracer bullet — layer-spanning, end to end. See the `tdd` skill.

**Then stop** — update `STATE.md`, report the path, and wait. Do not start implementing in the
same turn, even if the message that approved stage 1 also told you how to implement.

### 3 — Implementation

**Requires a reply to `02-plan.md` from the user.** If the plan has not been approved since it
was written, stop and say so — approval of stage 1 is not approval of a plan that did not exist
yet.

Follow the `tdd` skill. Per-task vertical slices, RED-GREEN per behavior, refactor at the
end of each task. Use `api-endpoint`, `migration-rls`, and `adr` where they apply.

If the plan turns out to be wrong, **stop and say so.** Do not silently implement something
else — the plan is what was approved.

### 4 — Verification → `04-walkthrough.md`, `04-implementation.diff`

1. Run `npm run verify:quiet` — the quiet form, because verbose streams the whole suite's
   output into context for no benefit; full output lands in `.verify.log` and the failing
   step's tail is printed. Use `npm run verify:full:quiet` where this phase touched the
   integration or E2E lanes. It must pass. If it fails, fix and re-run; if it cannot pass,
   stop and report.

   If it reports any step as **skipped** — typically `db-types`, because the local Supabase
   stack is not running — that run is incomplete. Say which gate is unproven rather than
   reporting the phase as verified. If this phase changed the schema, start the stack and
   re-run; a skipped `db-types` means every check after it validated against possibly stale
   types.
2. Run integration and E2E lanes where the phase touched them.
3. Write `04-implementation.diff` **before any reviewer runs**, from
   `git diff <base>` followed by the full contents of every path in
   `git ls-files --others --exclude-standard`.

   Not `git diff <base>..HEAD` — the workflow never commits, so `HEAD` is still `<base>` and
   that form yields an empty diff. New files appear in no diff, hence the second command.
   This is the pre-review snapshot: it is what lets the user and Cowork separate what the
   implementation did from what remediation later changed.
4. Write `04-walkthrough.md` **from the diff**, not from memory. What changed, per plan
   task; what was added that the plan did not name; what was left out and why; anything
   discovered along the way. A walkthrough written from intent describes what you meant to
   do; one written from the diff describes what landed.

### 5 — Review → three documents

Invoke all three reviewer subagents **concurrently**, passing the phase code:
`security-reviewer`, `qa-reviewer`, `architect-reviewer`.

They are read-only and diff-scoped. They do not run tests or builds — verification already
passed, and three concurrent suites would thrash the machine. Charters and the finding
format are in `docs/review-conventions.md`.

### 6 — Consolidation → `06-findings.md`

Merge the three into one ranked list per `docs/review-conventions.md`: drop anything already
in `.reviews/deferred-findings.md`, merge duplicates keeping the owning reviewer's version,
rank by severity then blast radius, and split into **Auto-fix** and **Needs your decision**.

### 7 — Remediation

Apply the auto-fix findings. Every fix follows the `tdd` skill: a bug is reproduced by a
failing test before it is fixed.

Then surface the escalations — and **every blocker, even ones you auto-fixed.** The user
should know a blocker existed. Escalations use the `ask-question` skill's escalated-finding
variant. **Stop and wait** for their decisions, then apply what they chose
and append anything they deferred to `.reviews/deferred-findings.md` with its ID, claim,
severity, reason, and phase.

### 8 — Completion

1. Re-run `npm run verify:quiet`.
2. Targeted re-review of **only** the lines remediation changed. A new blocker here goes to
   the user — it does not start another review round.
3. Mark the phase `✅` in `ROADMAP.md`.
4. Update `STATE.md` to complete.
5. Report: the artifact list, what was fixed, what was deferred, and that it is ready for
   review before commit.

**Do not commit. Do not push.** Say it is ready and stop.

## Running out of context

A full phase will not fit in one session. When context gets tight, finish the stage you are
in, update `STATE.md`, and tell the user to resume by asking to implement the same phase
again. Resumption is deterministic because the artifacts and `STATE.md` are the state — do
not try to push through and lose the stage boundary.

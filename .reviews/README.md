# Review documents

The working directory for the artifacts the phase workflow produces. One directory per
roadmap phase.

Everything here is gitignored except this file and `deferred-findings.md`. The path is
stable so a later session — or Cowork, reviewing before commit — can read what an earlier
stage produced without it being re-supplied by hand. It is not repository history: these are
working artifacts, and durable decisions graduate out of them into `AGENTS.md`,
`docs/frontend.md`, `docs/adr/`, `UX.md`, or `ROADMAP.md`.

**Vocabulary:** a *phase* is a roadmap unit (`F8`, `R9`); a *stage* is a step of the
workflow. See `.claude/skills/implement-phase/SKILL.md`.

## Layout

```
.reviews/<phase>/STATE.md                    where the phase stands
.reviews/<phase>/01-prerequisites.md         stage 1  — gate
.reviews/<phase>/02-plan.md                  stage 2  — gate
.reviews/<phase>/04-walkthrough.md           stage 4
.reviews/<phase>/04-implementation.diff      stage 4  — pre-review snapshot
.reviews/<phase>/05-security-review.md       stage 5
.reviews/<phase>/05-qa-review.md             stage 5
.reviews/<phase>/05-architect-review.md      stage 5
.reviews/<phase>/06-findings.md              stage 6  — gate on escalations
.reviews/deferred-findings.md                tracked in git
```

`<phase>` is the roadmap phase code, lowercased (`f8`, `r9`). A prerequisite increment that
ships ahead of a phase gets its own directory with a slug suffix:
`.reviews/f7-billing-writes/`.

Stage 3 (Implementation) produces code, not a document. Stages 7 and 8 amend the artifacts
above rather than adding their own.

A stage re-run after feedback takes the next free number rather than overwriting its
predecessor — `03-plan.md` after `02-plan.md` was revised — so the sequence records how the
increment was argued. `STATE.md` names the current one.

## `04-implementation.diff`

The diff as it stood when verification passed, **before any reviewer ran**. It exists so the
implementation and the remediation can always be told apart: at the end of the workflow the
working tree contains both, and this file is the only record of where one stopped and the
other began. Written at stage 4, never updated.

## Reading a phase

Read `STATE.md` first — it carries the base SHA, the current stage, and how each gate was
dispositioned. Then read the highest-numbered document for each preceding stage.

Do not read other phases' directories by default; only the phase in hand, plus one it
explicitly depends on.

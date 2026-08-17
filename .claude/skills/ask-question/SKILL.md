---
name: ask-question
description: Write a decision request for the user in the PhysioCare Question / Background / Options / Recommendations format. Use when a prerequisites document, implementation plan, review, or consolidated findings needs a decision from the user — and to judge whether a question is warranted at all rather than something to decide yourself.
---

# Asking for a decision

`CLAUDE.md` → *Questions in Review and Plan Documents* names the four parts. This skill is how
to write them well, and — first — how to decide whether to ask at all.

The whole phase workflow turns on these blocks. Stage 1 is a hard gate precisely so decisions
get made where they are cheap; a question asked badly, or not asked, is how a plan ends up
built around a guess.

## First: does this warrant a question?

**Do not ask** when:

- **The codebase answers it.** Go read it. "Does `user.service.ts` already have a
  compensation read?" is a search, not a question.
- **`AGENTS.md`, `docs/frontend.md`, `UX.md`, or an ADR already answers it.** Re-asking a
  settled decision invites relitigating it, which those documents explicitly forbid. Cite the
  answer instead.
- **One option is obviously right.** Decide, state what you decided and why in the document's
  decisions section, and move on. A question per micro-choice buries the two that matter.
- **It is a preference with no consequence.** Naming, ordering, file layout inside an existing
  convention — pick the one the repo already uses.
- **You are asking permission rather than for a decision.** "Shall I proceed?" is not a
  question; the gate itself is the permission.

**Do ask** when:

- Two or more paths are genuinely defensible and the choice has consequences the user will
  live with.
- It changes scope, sequencing, or what ships in this phase.
- It needs a new ADR, or narrows or contradicts an existing one.
- It changes an authorization boundary, a wire contract, or the database schema.
- It affects the user experience in a way `UX.md` does not already settle.
- Every available option is bad. Say so plainly rather than dressing one up.

The test: **would a wrong guess here be expensive or hard to reverse?** If yes, ask. If no,
decide.

## The four parts

### Question

One sentence, a real question, naming the decision — not the topic. Answerable by choosing.

- Good: "Should the report export ship as CSV only in F8, with XLSX deferred to F9?"
- Bad: "Report export format." That is a heading.
- Bad: "How should we handle report exports?" Open-ended; invites an essay, not a decision.

**One decision per question.** If it contains "and", check whether you have two questions.
Bundled decisions get half-answered.

### Background

Two or three sentences at most. It exists to make the question answerable by someone who has
not just read the code — not to prove you did the work.

Say what is already true, and what breaks or becomes awkward depending on the answer. Cite the
specific file, predicate, ADR, or `UX.md` section that constrains it. Leave out everything the
user does not need in order to choose.

### Options

Two to four. Each one:

- **Genuinely viable.** No strawmen. If an option exists only to make another look good,
  delete it — it wastes a read and erodes trust in the recommendation.
- **Materially different.** Two options that differ in wording are one option.
- **Named by what it does**, not "Option A".
- **Carries its consequence**, not just its description. What does choosing this cost, defer,
  or foreclose? That is what the user is actually weighing.

Put the recommended option first.

State the do-nothing option when it is real — deferring to a later phase, or leaving the
current behaviour in place, is frequently the right answer and is easy to omit by accident.

### Recommendations

**Always recommend.** A question with no recommendation hands the analysis back to the user,
which is the work you were doing. Name the option, give the reason in a sentence or two, and
say what would change your mind.

Be honest about confidence. "I recommend the first, but weakly — it turns on whether you
expect XLSX demand before F9, which I cannot see from here" is more useful than false
certainty. If the recommendation depends on something only the user knows, say what that is;
often that is the real question.

## Shape

```markdown
### Q1 — Should report export ship CSV-only in F8?

**Background.** `UX.md` → Reporting lists CSV and XLSX side by side, and `exceljs` is already
a dependency (used by the F7 invoice export). Nothing in the plan needs XLSX, but adding it
later means revisiting the export route's content negotiation, which currently assumes one
format.

**Options.**

1. **CSV only, XLSX in F9.** Smallest surface this phase; the export route stays
   single-format, so F9 pays the content-negotiation cost.
2. **Both now.** `exceljs` is present and the F7 export is a working reference, so the
   marginal cost is one service method and its tests. Widens F8's scope by roughly a task.
3. **XLSX only.** Matches what clinics actually open, and avoids shipping a format you would
   then support forever. Loses the scriptable output the reporting API implies.

**Recommendation.** Option 2. The route's content negotiation is the expensive part and it is
cheaper to build once than to retrofit, and `exceljs` plus the F7 precedent make the second
format nearly free. I would switch to option 1 if F8 is already at the edge of what you want
in one increment.
```

Number questions `Q1`, `Q2`, … within a document so answers can be referenced by number, and
so the plan that follows can cite "per Q2" in its decisions section.

## Escalated findings

A finding escalated at stage 7 (`docs/review-conventions.md`) is a question with two
additions: lead with the finding's **ID and severity**, and let the options be the candidate
fixes rather than design directions.

```markdown
### SEC-03 [blocker] — Should `user_compensations` RLS narrow to Owner?
```

Keep the finding's *claim* in the Background — the user needs to know what is actually wrong
before choosing a fix. And include "defer it" as an option whenever deferring is survivable,
with what the exposure is until then; that is what
`.reviews/deferred-findings.md` exists to record.

## Before you submit the document

- Every question would be expensive to guess wrong. Delete the rest.
- No question bundles two decisions.
- No option is a strawman, and the recommended one is first.
- Every question has a recommendation, with its confidence stated honestly.
- Nothing asks what a file, an ADR, or `UX.md` already answers.
- Questions are numbered.

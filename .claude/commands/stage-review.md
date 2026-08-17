---
description: Stages 5-6 — run the three reviewers concurrently and consolidate findings
argument-hint: <phase code>
---

Run **stages 5 and 6 (Review, Consolidation)** of the phase workflow for: **$ARGUMENTS**

Invoke `security-reviewer`, `qa-reviewer`, and `architect-reviewer` **concurrently in a
single message**, passing the phase code to each. They are read-only, diff-scoped, and must
not run tests or builds.

Then consolidate into `.reviews/<phase>/06-findings.md` per `docs/review-conventions.md`:
drop anything already in `.reviews/deferred-findings.md`, merge duplicates keeping the
owning reviewer's version per the charter table, rank by severity then blast radius, and
split into **Auto-fix** and **Needs your decision**.

Do not apply any fix in this stage.

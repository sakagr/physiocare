---
description: Stage 4 — verify, snapshot the diff, and write the walkthrough
argument-hint: <phase code>
---

Run **stage 4 (Verification)** of the phase workflow for: **$ARGUMENTS**

Follow the `implement-phase` skill's stage 4 section.

1. `npm run verify:quiet` must pass — or `npm run verify:full:quiet` where this phase
   touched the integration or E2E lanes. Use the quiet form: full output goes to
   `.verify.log`, and a failure prints the failing step's tail. Any step reported as
   **skipped** makes the run incomplete; name the unproven gate rather than reporting the
   phase as verified.
2. Write `.reviews/<phase>/04-implementation.diff` — **before any reviewer runs** — from
   `git diff <base>` plus the full contents of every path in
   `git ls-files --others --exclude-standard`. Not `<base>..HEAD`: nothing is committed, so
   that diff is empty. This is the pre-review snapshot.
3. Write `04-walkthrough.md` **from that diff**, not from memory.

Do not commit. Do not push.

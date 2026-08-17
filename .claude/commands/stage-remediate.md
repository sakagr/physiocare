---
description: Stages 7-8 — apply auto-fixes, surface escalations, re-verify, complete
argument-hint: <phase code>
---

Run **stages 7 and 8 (Remediation, Completion)** of the phase workflow for: **$ARGUMENTS**

Follow the `implement-phase` skill's stage 7 and 8 sections.

Apply the auto-fix findings from `06-findings.md`, each reproduced by a failing test first
per the `tdd` skill. Then surface every escalation **and every blocker, including ones you
auto-fixed**, and stop for the user's decisions. Append anything deferred to
`.reviews/deferred-findings.md`.

Then re-run `npm run verify:quiet`, re-review only the lines remediation changed, mark the phase
`✅` in `ROADMAP.md`, and update `STATE.md`.

Reviewers run once and remediation runs once. A new blocker in the targeted re-review goes
to the user; it does not start another round.

**Do not commit. Do not push.** Report that it is ready for review and stop.

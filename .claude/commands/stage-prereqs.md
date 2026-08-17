---
description: Stage 1 — prerequisites review for a roadmap phase
argument-hint: <phase code>
---

Run **stage 1 (Prerequisites)** of the phase workflow for: **$ARGUMENTS**

Follow the `implement-phase` skill's stage 1 section only. Do not proceed to stage 2 — stage
1 ends at a hard approval gate.

Record the base SHA in `.reviews/<phase>/STATE.md`. Every decision this phase needs from the
user goes in `01-prerequisites.md` as a Question block — follow the `ask-question` skill —
including whether an unmet
`ROADMAP.md` prerequisite should ship as its own increment first.

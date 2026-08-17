---
description: Run the full phase workflow for a roadmap phase (start or resume)
argument-hint: <phase code, e.g. F8 or f7-billing-writes>
---

Run the phase workflow for: **$ARGUMENTS**

Invoke the `implement-phase` skill and follow it exactly.

If no phase code was given, read `ROADMAP.md` and ask which phase is intended — offer the
first phase without a `✅` as the likely answer. Do not guess between `R` and `F` for a bare
number.

Start at stage 1, or resume from `.reviews/<phase>/STATE.md` if the phase is already in
progress.

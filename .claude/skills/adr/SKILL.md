---
name: adr
description: Write an Architecture Decision Record for PhysioCare in docs/adr/, or decide whether a decision warrants one. Use when an increment introduces or changes an architectural pattern, service boundary, persistence strategy, authorization strategy, cross-cutting infrastructure, or transaction/consistency strategy.
---

# Writing an ADR

## First, decide whether it needs one

An ADR is warranted when a decision introduces or changes an architectural pattern,
service boundary, persistence strategy, authorization strategy, transaction or
consistency strategy, or introduces new cross-cutting infrastructure.

Minor implementation details, bug fixes, refactoring, naming changes, and isolated
optimizations do **not** get an ADR. Neither does a decision that merely applies an
existing record — cite the existing one instead.

Frontend and UX decisions go in `docs/adr/`. Broader project/domain decisions go in
`AGENTS.md` → *Project Decisions*. Check both before writing: the decision may already
be recorded, or may be a supersession of something that is.

## Where it goes

`docs/adr/NNNN-<slug>.md`, where `NNNN` is the next unused four-digit number (read
`docs/adr/README.md` for the current highest) and `<slug>` is a short kebab-case
descriptor. One record per file. Add a row to the table in `docs/adr/README.md` in the
same change — the index is how a later session finds the record without loading the
whole log.

## Structure

```markdown
# ADR-NNNN — Title

- **Status:** Accepted (YYYY-MM-DD)
- **Scope:** Frontend | Backend | Authorization | UX | …
- **Context:** …
- **Decision:** …
- **Consequences:** …
```

Optional trailing fields the existing records use where they apply: `**Related:**` for
a downstream constraint the decision creates, and `**Reference:**` pointing at the
`UX.md` section carrying a UX decision's full design detail.

## What makes these records worth reading

The existing twelve records set a standard worth matching. They are dense, and
deliberately so.

- **Context states the problem including what was already tried or already true.**
  Name the specific code, predicate, or policy that made the naive approach wrong.
  ADR-0011's context is valuable because it explains *why* narrowing the RLS policy
  would have silently zeroed every Admin-run commission report — a reader tidying that
  policy later needs exactly that.
- **Decision records what was decided and what was deliberately left alone.** An
  explicit "X was deliberately not changed, unchanged" is often the most load-bearing
  sentence in the record, because it is the thing a future contributor will otherwise
  "fix".
- **Consequences names the cost, not just the benefit** — the extra predicate, the
  stricter API, the manual verification that stays manual, the follow-up that is now a
  named gap rather than a silent one.
- **Supersession is recorded in the new record, never by editing the old one.**
  Accepted ADRs are immutable. If this record narrows or reverses part of an earlier
  one, say so explicitly and name the earlier record (ADR-0010 supersedes part of
  ADR-0003 this way).
- **Cite the real authority.** If a convention in `AGENTS.md` or `docs/frontend.md` is
  what actually sanctions the approach, cite that — not an ADR that would be misread as
  sanctioning it.

## Keeping the rest of the docs honest

If the decision changes a convention, update the file that owns it in the same change:
`AGENTS.md` for core/backend, `docs/frontend.md` for frontend, `UX.md` for experience
detail. An ADR that contradicts a still-standing line in a conventions file leaves the
next reader with two answers.

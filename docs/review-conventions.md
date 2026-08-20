# Review conventions

The contract shared by the three review stages (Security, QA, Architect), the
consolidation stage, and the remediation stage. Each reviewer skill owns *what* to look
for; this document owns *how findings are expressed, owned, ranked, and dispositioned*,
so three independent reviewers produce one coherent list.

## Scope

Reviewers read the **phase diff**, not the repository:

- `git diff <base>` where `<base>` is the SHA recorded in `.reviews/<phase>/STATE.md`, **plus**
  `git ls-files --others --exclude-standard` for files the phase added, read in full

  Not `git diff <base>..HEAD`. The workflow never commits, so `HEAD` never moves off `<base>`
  and that form returns nothing — a reviewer using it would report a clean bill of health on
  code it never saw. A new file appears in no diff at all, which is why the second command is
  not optional. **An empty scope is a stop-and-report condition, never "no findings".**
- plus `.reviews/<phase>/02-plan.md` (what was supposed to happen)
- plus `.reviews/<phase>/04-walkthrough.md` (what the implementer says happened)
- plus `.reviews/deferred-findings.md` (what has already been dispositioned)

A pre-existing problem the diff did not touch is **out of scope**. Note it in a
*Adjacent observations* section at most; it is not a finding. Reviewers that audit the
whole codebase re-report the same things every phase until the reports stop being read.

Reviewers are **read-only**. Do not edit files. Do not run the test suite, the build, or
migrations — three reviewers running Vitest concurrently on an 8GB machine will thrash,
and verification already ran and passed before this stage.

## Charters — one owner per finding

A finding belongs to exactly **one** reviewer, by its primary lens. When two could claim
it, the earlier row wins.

| Reviewer | Owns |
| --- | --- |
| **Security** | Authorization boundaries (predicates, capability tokens, `withCapability`), RLS and tenant isolation, admin-client use, environment gating, secret and PII exposure, input validation reaching a trust boundary, the generic web surface (CSRF, headers, SSRF, output encoding, log injection) |
| **QA** | Plan scenarios vs actual tests, TDD compliance, test-lane correctness, loading/empty/error states, E2E presence, accessibility semantics, named edge cases without a test |
| **Architect** | Layer violations, cross-domain service calls, contract/registry parity, unrecorded ADR obligations, scope creep beyond the plan, abstraction the requirements did not ask for |

So: a missing `withCapability` is **Security** (not Architect, not QA). A missing test for
an authorization path is **QA**. A service reaching a peer domain service is **Architect**.

## Severity

| Severity | Means |
| --- | --- |
| **blocker** | Ships a security hole, data-loss path, or silently wrong result. Cannot be deferred. |
| **major** | Real defect or violated invariant. Fix this phase unless explicitly deferred. |
| **minor** | Correct but fragile, inconsistent, or under-tested. Deferrable with a reason. |
| **nit** | Style, naming, wording — **cosmetic only**. Batch or drop. Never escalate. |

If a finding has any behavioural consequence — a wrong status code, a wrong number, an
error a caller can observe — it is **minor at least, never a nit**, however consistent it is
with its neighbours or however small the fix. "Consistent with eleven sibling call sites" is an
argument for batching it, not for calling it cosmetic. `nit` is the one severity that may
disappear without a record, which is exactly why nothing with consequence may be filed there.

A blocker is surfaced to the user **even when it is auto-fixed**. They should know one
existed.

## Finding format

Every finding, in every reviewer's document:

```markdown
### SEC-03 — Compensation history readable by ORG_ADMIN  [blocker]

- **Where:** `src/server/services/user.service.ts:212`
- **Claim:** …one or two sentences stating the defect.
- **Why it matters:** …the concrete consequence, with the input or state that triggers it.
- **Fix:** …the specific change proposed.
- **Disposition:** auto | escalate
- **Escalation reason:** …required when `escalate`; omit when `auto`.
```

IDs are `SEC-`, `QA-`, `ARCH-` plus a two-digit sequence, assigned per phase. They are how
the consolidation, remediation, and deferred ledger refer to the same thing.

State the failure concretely. "Could be a security issue" is not a finding; "an
`ORG_ADMIN` calling `GET /api/users/{id}/compensation` receives the full history" is.

## Disposition: auto-fix or escalate

**Escalate to the user** when the fix would:

- Require a new ADR, or contradict an existing one
- Change a wire contract, response schema, or registry entry's semantics
- Change an authorization predicate, capability token, or RLS policy
- Require a database migration
- Contradict the approved plan
- Have two defensible fixes with a real trade-off
- Rest on low confidence, or on a concern the reviewer could not confirm from the diff

**Auto-fix** is the complement: local, mechanical, obviously correct, changes no contract,
authorization rule, or schema, and is covered by an existing test or one trivially added.

When in doubt, escalate. A wrongly-escalated finding costs the user thirty seconds; a
wrongly-auto-fixed authorization change costs a phase.

## Consolidation

The consolidation stage merges the three documents into `.reviews/<phase>/06-findings.md`:

1. Drop anything already in `.reviews/deferred-findings.md` with the same claim.
2. Merge duplicates — keep the owning reviewer's version per the charter table, and note
   the other reviewers that raised it.
3. Rank by severity, then by blast radius.
4. Split into **Auto-fix** and **Needs your decision**, the latter using the Question /
   Background / Options / Recommendations format — see the `ask-question` skill, which covers
   the escalated-finding variant (lead with the finding ID and severity; options are candidate
   fixes; include "defer it" whenever deferring is survivable).

## Loop limit

Reviewers run **once** per phase. Remediation runs **once**. Then verification re-runs and
a **targeted** re-review covers only the lines remediation changed.

If that re-review surfaces a new blocker, it goes to the user — it does not start round
three. An unbounded review→fix→review cycle is how a phase never finishes.

## Deferred findings

There are exactly three dispositions: **auto-fix**, **escalate**, and **defer**. "Drop" is not
one of them for anything above a nit.

Anything at minor or above that is not fixed — whether the user decided that or a reviewer
recommended it — is appended to `.reviews/deferred-findings.md` with its ID, claim, severity,
the reason, and the phase it came from. A reviewer recommending "not worth fixing" is a
recommendation to **defer**, and it still earns a ledger line; without one the next phase's
reviewers rediscover it and you triage the same question again. That file is tracked in
git — it is project state in the same category as a tech-debt list, and it is what stops
the next phase's reviewers re-reporting a settled question.

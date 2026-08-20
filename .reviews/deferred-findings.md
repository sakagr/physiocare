# Deferred findings

Findings from the Review stages that were surfaced and **deliberately not fixed**. Tracked
in git — this is project state in the same category as a tech-debt list, and it is what
stops each phase's reviewers re-reporting a settled question.

Appended at stage 7 when the user defers a finding. Remove a row when the finding is
actually fixed, noting where.

Reviewers read this file and must not re-report anything listed here. If a deferred finding
becomes materially worse — a new caller reaches the same path, its severity changes — that
is a *new* finding referencing the old ID, not a re-report.

| ID | Phase | Severity | Claim | Deferred because | Date |
| --- | --- | --- | --- | --- | --- |
| SEC-03 | T0 | minor | `getOrganizationDetail` and roughly eleven sibling functions in `src/server/services/organization.service.ts` throw a bare `Error("Caller not found")` when the caller's `users` row is missing. `mapErrorToResponse` maps a bare `Error` to `500 Internal Server Error`, so an authorization condition — an authenticated session whose user row was hard-deleted — surfaces as a server fault rather than a 4xx. | Every call site does the same thing, so fixing one in isolation would make it the odd one out; this needs a single pass across all of them, deciding `FORBIDDEN` vs `NOT_FOUND` once. Surfaced by T0's summary endpoint, which inherited the pattern and has since been torn down — the finding is recorded against the surviving call sites, which are where the behaviour still lives. Originally filed `nit` and dropped; reclassified `minor` under the updated severity rule, since an observable wrong status code is a behavioural consequence and consistency with siblings is an argument for batching, not for calling it cosmetic. | 2026-08-20 |

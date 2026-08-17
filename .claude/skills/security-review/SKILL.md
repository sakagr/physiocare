---
name: security-review
description: Security review of a PhysioCare phase diff — authorization boundaries, RLS and tenant isolation, admin-client use, environment gating, secret and PII exposure, and the generic web surface. Use for the Security review stage, or whenever asked to security-review a change.
breadth_checklist_adapted_from: https://github.com/sickn33/agentic-awesome-skills/blob/main/skills/backend-security-coder/SKILL.md
---

# Security review

Read `docs/review-conventions.md` first — it defines scope, severity, the finding format,
and the auto-fix vs escalate rule. This skill is the *what to look for*.

Write to `.reviews/<phase>/05-security-review.md`.

You own: authorization boundaries, RLS and tenant isolation, admin-client use, environment
gating, secret and PII exposure, validation at trust boundaries, and the generic web
surface. A missing test for an authorization path is QA's, not yours. A layer violation is
the Architect's.

## Depth pass — this codebase's known traps

These are not hypotheticals. Each one has already happened here and is recorded in
`docs/adr/`. Check every one that the diff touches.

**RLS filters, it does not error.** A policy narrower than a service's call chain needs
returns *zero rows*, and the service reports a plausible wrong answer. ADR-0011: narrowing
`user_compensations`' SELECT policy would have made every Admin-run commission report
return `totalCommission: 0`, silently. For any new or changed policy, trace every service
path that reads that table under the **caller's own session client** — `createRouteHandler`
never passes an admin client. `[blocker]` when a narrowed policy has a reachable silent-zero
path.

**Group-level guards are not role-level guards.** `guardNamespace` admits every platform
role. ADR-0009: against a real surface, that was a live privilege-escalation path for
`PLATFORM_SUPPORT` / `SALES` / `BILLING`. A new platform surface needs its own capability
token, not the namespace guard alone.

**Capability tokens must be partitioned.** A token in neither `ORG_CAPABILITIES` nor
`PLATFORM_CAPABILITIES` is ungrantable; one in both is evaluated twice. The partition test
exists, but check the intent: is the token in the *correct* vocabulary?

**Coarse tokens cannot express narrow boundaries.** `settings:manage` admits Owner and
Admin; organization-profile editing is Owner-only (ADR-0012). If a new surface is narrower
than the token gating its destination, it needs its own predicate — and widening an
existing broad predicate silently changes every current caller. `[blocker]` on a widened
predicate whose other callers were not audited.

**Client gates are advisory.** `useCan` / `<Can>` improve UX; `withCapability` in the route
handler is the boundary. A route relying on the client gate alone is a `[blocker]`.
Conversely, per-item hints (`canManage`, `assignableRoles`) are advisory by design — flag
them only if they are being *relied on* for enforcement.

**Environment gating is a real authorization input.** The API Explorer and the spec route
are hard-disabled in production, and the spec route checks environment *before*
authentication so it 404s rather than confirming the route exists (ADR-0009). Any new
development-only surface follows that shape.

**Tenant isolation.** Every read and write scopes to the caller's organization. A query
that takes an ID from the request and does not verify it belongs to the caller's org is a
`[blocker]` regardless of what RLS would do — RLS is the backstop, not the check.

**The subscription write boundary.** An unsubscribed organization's writes throw
`SUBSCRIPTION_REQUIRED` across ~40 service functions. A new write path that bypasses it is
a finding.

**Admin client.** Only where `AGENTS.md` → *Admin Client* sanctions it. A new
`createAdminClient()` call is a finding until justified — it bypasses RLS entirely.

**Soft delete.** Liveness is enforced at the repository layer, not RLS. A new read that
does not filter deleted rows either needs the filter or needs a recorded reason.

## Breadth pass — categories the ADRs never had reason to cover

The depth pass covers where this codebase has been bitten. This pass covers the ordinary
web surface, so a first-time-here class of bug is not missed. Check only what the diff
plausibly touches:

- **Input validation at the boundary** — does anything reach a service unvalidated? Two
  operations already pass an unvalidated body to a service that validates internally
  (noted in ADR-0008); a *third* is a finding, not a precedent.
- **Injection** — parameterized queries only. Raw SQL in a migration or an RPC that
  interpolates input is a `[blocker]`.
- **Error responses and logs** — does an error message or audit-log entry leak an internal
  identifier, a stack trace, another tenant's data, or a patient's clinical detail?
- **PII and clinical data** — patient records are the most sensitive data here. Does a new
  response, export, log line, or error include more than the caller may see?
- **Cookies and sessions** — `httpOnly`, `secure`, `sameSite`, expiry. The password-setup
  ticket's 15-minute expiry and single use (ADR-0007) is the reference shape.
- **CSRF** — state-changing routes reached from the browser: is the `sameSite` posture
  plus origin still sufficient for the new shape?
- **Security headers** — a new route or response type that bypasses the standard headers.
- **SSRF** — any new outbound request from the server: is the destination validated?
- **Output encoding** — anything rendered as HTML from user- or patient-supplied text.
- **Rate limiting and payload limits** — new unauthenticated or expensive endpoints.
- **File and binary responses** — the export routes: path handling, content type, size.

## Before you write

- Every finding has a concrete trigger — the role, the request, the state.
- Every `[blocker]` names the reachable path, not the theoretical one. If you cannot show
  reachability from the diff, it is `[major]` with an escalation.
- Anything touching a predicate, token, policy, or migration is **escalate**, per
  `docs/review-conventions.md`. Security findings are auto-fixable less often than the
  other reviewers' — that is expected, not a failure.

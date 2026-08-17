<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data.

Before writing or modifying any Next.js code:

- Read the relevant guide in `node_modules/next/dist/docs/`.
- Follow the latest Next.js conventions.
- Respect deprecation notices.
- Do not use deprecated APIs when newer alternatives exist.
<!-- END:nextjs-agent-rules -->

# PhysioCare Engineering Guidelines

These guidelines define the architecture and coding conventions for the PhysioCare codebase.


AI agents should follow these conventions unless explicitly instructed otherwise.

# Project Roadmap

The high-level product roadmap is defined in [ROADMAP.md](ROADMAP.md).

AI agents should consult `ROADMAP.md` to understand:

- Overall project phases.
- Planned feature progression.
- Current development phase.
- Module sequencing.

`ROADMAP.md` defines **what** will be built and **when**.

`AGENTS.md` defines **how** the project should be built, including architecture, engineering conventions, coding standards, and development workflow.

If an implementation plan conflicts with the roadmap, the implementation plan takes precedence for the current task. If engineering conventions conflict with the roadmap, `AGENTS.md` takes precedence.

---

# General Principles

- Follow the existing architecture instead of introducing new patterns.
- Prefer simplicity over unnecessary abstraction.
- Keep responsibilities small and well-defined.
- Do not redesign existing architecture unless explicitly requested.
- Do not implement features outside the requested scope.
- Avoid premature optimization.
- Keep files cohesive and focused.

---

# Project Stack

- Next.js App Router
- TypeScript
- Supabase
- PostgreSQL
- Mantine (frontend design system)
- TanStack Query (frontend server state)
- Server Components
- Local-first Supabase development

---

# Layer Responsibilities

## Repositories

Repositories are responsible only for persistence and data access. They should remain deterministic and reusable.

Repositories may:

- Read database tables.
- Insert rows.
- Update rows.
- Delete rows.
- Execute simple queries.
- Return domain models.

Repositories must not:

- Contain business logic.
- Send emails.
- Call external APIs.
- Make authorization decisions.
- Perform orchestration.

Repository implementation style:

```ts
const { data, error } = await supabase
    ...

if (error) {
    throw error;
}

return data;
```

Conventions:

- Destructure `data` and `error` directly.
- Check `error` immediately after the query.
- Throw unexpected database errors.
- Return `data` as the final statement.
- Use `maybeSingle()` for lookup methods.
- Use `single()` for insert/update/delete methods expected to affect exactly one row.

Repository naming convention:

- find...
- insert...
- update...
- delete...
- list...
- exists...
- count...

Examples:

```ts
findUserByEmail()
insertOrganization()
updatePatient()
deleteInvoice()
```

A repository may read from a database view instead of its table when a value must be derived from other columns and would otherwise go stale between writes (for example, a status computed from dates and counters). Writes always target the table directly, never the view. An insert/update function that must return the entity re-reads it from the view after the write completes, so callers receive the same fully-derived shape a subsequent read would produce -- this is the one case a repository issues two round-trips for what looks like a single operation, and it should stay that way rather than being "optimized" back to one, since the view is the only source of the derived fields.

---

## Services

The application follows a layered service architecture consisting of **Domain Services** and **Application (Orchestration) Services**.

### Domain Services

Domain services implement business capabilities within a single bounded context. They encapsulate business rules, perform read/query operations, coordinate with repositories, and return domain entities or DTOs. They should remain independent of other domain services whenever possible and must not orchestrate workflows across multiple domains.

Examples:

- `user.service.ts`
- `clinic.service.ts`
- `user-clinic.service.ts`

### Application (Orchestration) Services

Application services coordinate multi-step workflows spanning multiple domains. They call participating domain services, manage transaction boundaries, execute compensation logic for external systems, and enforce workflow consistency. They must not contain persistence logic that belongs in repositories.

Services may call external systems only through dedicated service abstractions. Complex workflows should be orchestrated by a dedicated application service. For example, `organization.service.ts` orchestrates organization onboarding by coordinating the Auth Service, User Service, and repositories.

Service boundaries:

- `organization.service.ts` orchestrates organization-related workflows.
- `authorization.service.ts` determines whether the caller is authorized to perform an operation.
- `user.service.ts` encapsulates user-related business rules and profile management.
- `auth.service.ts` encapsulates all Supabase Auth interactions.
- `session.service.ts` orchestrates the session workflows — sign-in, sign-out, password recovery, and password changes — across the Authentication subsystem and the User domain. Username resolution belongs to the User domain and authentication to `auth.service.ts`; neither calls the other, so the workflow that needs both lives here.
- `appointment-workflow.service.ts` orchestrates an appointment status transition together with its cross-domain side effect on package session consumption (Appointment domain + Patient Package domain). Neither `appointment.service.ts` nor `patient-package.service.ts` calls the other directly.
- `attendance-workflow.service.ts` orchestrates an attendance marking together with its cross-domain side effects on scheduling and patient notification (Attendance + Appointment + Notification). It is the **only** public entry point for an attendance write: `attendance.service.ts`'s `recordCheckIn` and `updateAttendanceRecord` are called from here and nowhere else, so no caller can perform half the operation. Reads (`getAttendanceDetails`, `listOrganizationAttendance`) and `recordCheckOut`, which cannot affect availability, stay public on the domain service. Neither `attendance.service.ts` nor `appointment.service.ts` calls the other directly. The booking-side availability check is not orchestrated — it is a validation read inside `createAppointment`/`updateAppointment`, alongside the patient, clinic and clinic-assignment reads they already perform.

Service naming convention:

- create...
- bootstrap...
- invite...
- assign...
- calculate...
- consume...
- generate...
- send...

Examples:

```ts
createOrganization()
bootstrapOrganization()
inviteUser()
calculateCommission()
```

---

## Validators

Validators are responsible only for validating and parsing input.

Validation is performed before business logic. The API layer performs transport parsing; validators remain transport-agnostic, validate application data only, and must not compensate for HTTP, URL, framework, or transport-specific behavior.

For example, normalize `searchParams.get("search") ?? undefined` inside the route handler, not inside a validator.

Validator naming convention:

- validate...
- parse...

Examples:

```ts
validateCreateOrganizationInput()
parseAppointmentRequest()
```

---

## Route Transport Helpers

Route transport helpers (authentication wrappers, error mapping, route composition) belong under `src/lib/api/`. Business logic must never be placed here.

---

# Database Types

Each repository should export the generated Supabase table types.

Example:

```ts
export type User =
    Database["public"]["Tables"]["users"]["Row"];

export type InsertUser =
    Database["public"]["Tables"]["users"]["Insert"];

export type UpdateUser =
    Database["public"]["Tables"]["users"]["Update"];
```

### View-Backed Entities

An entity sources its `Entity` type from a database view instead of its table when a derived value (for example, a computed status) must be recomputed on every read to avoid going stale between writes. In that case:

- `Entity` sources from `Database["public"]["Views"][...]["Row"]`.
- `InsertEntity`/`UpdateEntity` still source from `Database["public"]["Tables"][...]["Insert"/"Update"]` -- the view is read-only from the application's perspective; writes always target the table.
- `supabase gen types` marks every view column nullable regardless of the underlying table's constraints (Postgres views carry no NOT NULL metadata to introspect). Where a column is actually `NOT NULL` on the source table, or -- for a derived column -- is guaranteed non-null by the view's own expression, narrow it back with a mapped type rather than living with the widened optionality; genuinely nullable columns keep their `| null`. Repository read chains cast the query result to that narrowed type via `.overrideTypes<Entity, { merge: false }>()`, since the client library's own inferred type is the same unnecessarily-widened one.

Example:

```ts
type PatientPackageViewRow = Database["public"]["Views"]["patient_packages_view"]["Row"];
type NullableInPatientPackageView = "extended_validity_to" | "deleted_at" | "cancelled_at" | "cancelled_by";

export type PatientPackage = {
  [K in keyof PatientPackageViewRow]: K extends NullableInPatientPackageView
    ? PatientPackageViewRow[K]
    : NonNullable<PatientPackageViewRow[K]>;
};
export type InsertPatientPackage = Database["public"]["Tables"]["patient_packages"]["Insert"];
export type UpdatePatientPackage = Database["public"]["Tables"]["patient_packages"]["Update"];
```

This is the exception, not the default. Most entities have no view and source all three types from the same table.

---

# Placeholder Implementations

Unimplemented functions must fail fast.

Use:

```ts
throw new Error("Not implemented");
```

Do not use placeholder return values such as:

```ts
return {} as SomeType;
```

---

# Naming Conventions

Repositories should use generic parameter names that reflect database columns.

Prefer:

```ts
name
email
id
```

instead of:

```ts
roleName
planName
subscriptionName
```

unless the additional specificity is genuinely required.

---

# Admin Client

The project convention is:

```ts
createAdminClient()
```

Usage:

```ts
const adminClient = createAdminClient();
```

Use `adminClient` consistently throughout the codebase.

---

# Error Handling

Throw exceptions on failure.

Do not return success/error objects such as:

```ts
{
  success: false,
  error: "..."
}
```

unless explicitly required by an external API.

---

# Result Types

Functions should return successful results only.

Failures should be communicated by throwing exceptions.

Do not return success/error discriminated unions or objects such as:

```ts
Promise<
    | { success: true; ... }
    | { success: false; error: ... }
>
```

Instead:

- Return the successful result type.
- Throw exceptions for failures.

Example:

```ts
Promise<CreateOrganizationResult>
```

The only exception is when interacting with third-party libraries or APIs that already define their own success/error response contract (for example, Supabase client methods).

---

# Type Naming Conventions

## Repository Types

```
Entity
InsertEntity
UpdateEntity
```

Example:

```ts
User
InsertUser
UpdateUser
```

---

## Input Types

Public functions should expose named input types.

Convention:

```
<Operation>Input
```

Examples:

```ts
CreateOrganizationInput
CreateOrganizationAdminInput
```

Avoid anonymous object types in public APIs.

---

## Result Types

Public functions should expose named result types where appropriate.

Convention:

```
<Operation>Result
```

Example:

```ts
BootstrapOrganizationResult
```

---

# Documentation

Comments and JSDoc should describe **what** the code does, not **how** it does it.

Good:

```ts
/**
 * Creates a new authentication user.
 */
```

Avoid:

```ts
/**
 * Calls supabase.auth.admin.createUser().
 */
```

Implementation details belong in the code.

---

# Business Rules

Business rules belong in the Service layer.

Repositories should not know about concepts such as:

- Trial subscription
- Organization onboarding
- Invitation workflow
- Billing rules
- Application roles
- Authorization rules

Repositories operate on data.

Services implement business decisions.

Business state transitions must be enforced in the Service layer. Database enums and constraints define valid values and structural integrity, but they should not encode workflow state machines unless explicitly required by the architecture.

---

# Scope Control

Implement only what is requested.

Do not:

- Add extra features.
- Introduce new architectural patterns.
- Refactor unrelated code.
- Add dependencies unless explicitly requested.

Keep changes focused on the requested task.


---

# Project Decisions

The following architectural decisions have been intentionally made for PhysioCare. These decisions should be considered part of the system design and should not be changed unless explicitly requested.

## Organization Model

- Every user belongs to exactly one organization.
- `SUPER_ADMIN` is the only platform-wide role and does not belong to any organization.
- All other users belong to exactly one organization.
- Organizations may own multiple clinics.

Example:

```
Organization
    ├── Clinic A
    ├── Clinic B
    └── Clinic C
```

---

## User-Organization Relationship

The `organization_users` table has been intentionally removed from the design.

Reason:

A user can belong to only one organization.

A separate mapping table is unnecessary and introduces duplicated data and additional joins.

The relationship is represented directly in the `users` table.

```text
users
------
organization_id
role_id
```

Do not reintroduce `organization_users` unless the business requirements explicitly change to support users belonging to multiple organizations simultaneously.

---

## Organization Bootstrap

Organizations are created only by `SUPER_ADMIN`.

There is no public organization signup.

The bootstrapping workflow is:

```
Validate Input
    ↓
Check Organization Name Uniqueness
    ↓
Check Administrator Email Uniqueness
    ↓
Invite User (Creates Supabase Auth User)
    ↓
Create Organization (status = draft)
    ↓
Create ORG_OWNER
    ↓
Update Organization.created_by
    ↓
Activate Organization (status = active)
    ↓
Return Result
```

- The authentication provider is responsible for creating the authentication identity during the invitation process.
- The application does not create Auth users separately before inviting them.
- The Auth User ID returned by the invitation process is used when creating the application user.
- Organizations are initially created with `status = draft`.
- Organizations become `active` only after bootstrapping completes successfully.

Temporary passwords are never used.

Users create their own passwords through the invitation flow.

---

## Organization Lifecycle

Organization lifecycle is independent from subscription lifecycle.

`status` represents the operational state of an organization.

Possible states:

- draft
  - Organization has been created but bootstrapping is not complete.

- active
  - Organization is fully operational.

- inactive
  - Organization has been temporarily disabled.

- archived
  - Organization has been retired and retained only for historical purposes.

**V1 implements exactly one transition: `draft → active`, at the end of `bootstrapOrganization` (`organization.service.ts`), once the owner and organization record both exist.** No code path sets `status` to `inactive` or `archived` — there is no organization-suspend or organization-archive feature yet. Consequently, `canOrganizationTransact`'s `organization.status === "active"` clause is not yet a live enforcement dimension for any organization that finishes bootstrapping — it is always true for one. It exists ahead of a suspend/archive feature, not in place of one; do not read its presence as evidence that organization suspension works today.

---

## Subscription Principles

Organization onboarding and subscription management are separate business workflows.

The following rules apply:

- `subscription_plan_id` is nullable.
- New organizations are created without a subscription plan.
- `subscription_status` defaults to `inactive`.
- Trial or paid subscriptions begin only when explicitly activated by the business workflow.
- Organization onboarding must not contain subscription or billing logic.

### The write/read boundary

`canOrganizationTransact` (`authorization.service.ts`) decides whether an organization may write at all, independent of who the caller is or what they're trying to do. Gated call sites use its throwing form, `assertOrganizationCanTransact` — one helper across every site so the error code and message cannot drift.

**Every write is gated except the exemptions below. Every read is always available.**

The product is a record of what happened, not the mechanism: an organization whose subscription has lapsed can still refund a patient in cash, phone them to cancel, or deliver a visit — it simply cannot record any of it until it pays. Recording is the service being sold.

Exempt, and why:

- **Subscription lifecycle** — `selectSubscriptionPlan`, `activateOrganizationSubscription`, `renewOrganizationSubscription`, `expireLapsedSubscriptions`. These are how an organization leaves the gated state, so they can never depend on it.
- **Bootstrap** — `bootstrapOrganization`. The organization does not exist yet.
- **Identity and recovery** — `authenticate`, `endSession`, `requestPasswordReset`, `setPassword`, `changePassword`, `resetUserPassword`. Locking a paying-again customer out of their own account is never the right lever.
- **Organization profile** — `updateOrganizationProfile`. The billing contact must stay correctable while lapsed.
- **Wind-down of people and places** — `deactivateUser`, `offboardUser`, `deactivateClinic`, `deleteClinic`, `removeUserFromClinic`. Shrinking is always allowed; growing and correcting are not.
- **System-triggered writes** — `createNotification`, which no caller initiates.

Apply the rule to anything new by asking whether the write is one of the six exemptions. If it is not, gate it. "It is only an edit", "it is only a cancellation", and "it is only configuration" are not exemptions — those were all considered and rejected.

A newly bootstrapped organization therefore cannot do anything but read until it selects at least a trial plan (`subscription_status = "trialing"` satisfies the gate).

Anchor the gate on the organization the write lands in. Most call sites already resolve the caller and use `caller.organization_id`; where a path never fetches the caller — and its authorization predicate admits `SUPER_ADMIN`, which has no organization of its own — anchor on the resource instead (`patient.organization_id`, `appointment.organization_id`, the target user's). Authorization is checked first, then the gate, then anything else.

---

## Physiotherapist Availability via Attendance-Driven Scheduling

- **Scope:** Backend — prerequisite for frontend phase F6.
- **Context:** The product needs a physiotherapist to declare themselves unavailable and have the system handle their appointments. Today the attendance module is fully decoupled from scheduling, self-attendance is open to any active org member, the schema cannot express a partial (half-day) window, and patient-notification delivery is unimplemented (persistence only).
- **Decision:** Introduce attendance-driven availability with these backend changes:
  1. **Restrict who may record attendance.** Physiotherapists record their own; management records anyone's, including their own; no other role records attendance. Implementation: narrow `canRecordOwnAttendance` to `ORG_PHYSIOTHERAPIST` — management already covers itself through `canManageAttendance`.
  2. **Link attendance to scheduling.** Marking a physiotherapist absent/leave/half-day for a date auto-cancels their affected appointments and blocks new bookings for the affected window. Implement as an application-service orchestration across the Attendance and Appointment domains (which never call each other directly), mirroring the existing appointment-workflow ↔ package-session pattern, with compensation semantics per *External System Consistency*.
  3. **Model the half-day window.** Add an unavailable-window (a from/to time, or an AM/PM marker) to `user_attendance` so half-day cancels and blocks only the affected part of the day; absent/leave apply to the whole day.
  4. **Record patient notifications only (no delivery in V1).** The auto-cancel path writes a patient notification record (recipient patient, appointment link, channel) via the existing notifications module — persistence only; the record stays `pending`. Actual delivery (SMS / email / WhatsApp) is **out of V1 scope** and will likely be handled later by a separate serverless dispatch service.
- **Consequences:** Scheduling gains its first real availability gate (none exists today — there is no double-booking/availability check). The Attendance module gains a scheduling side effect and a schema field; the Notification module is reused as-is (a record is written, not delivered). The booking-block logic is reused by **Leave Management (V1.1/V2)** for advance-planned leaves. Items 1–3 are a **set** — F6 should not build the frontend availability surface against a backend that implements only part of them. In V1 the system does not deliver the notification, so reception follows up with affected patients manually until a dispatch service exists.
- **Reference:** `UX.md` → Flow 14 (*Staff attendance & physiotherapist availability*) and the attendance note; `ROADMAP.md` → *Feature: Physiotherapist Availability (V1)*.

---

## Platform Role Reduction

- **Scope:** Backend + docs — prerequisite for frontend phase F4.
- **Context:** `PLATFORM_SUPPORT`, `PLATFORM_SALES`, and `PLATFORM_BILLING` were introduced in ADR-0009 (F2, API Explorer access control) as the platform namespace's operational roles, but never gained any capability beyond what `SUPER_ADMIN` already carries, and no UI was ever built for them (they reached `/platform/admin` only to be turned away by the API Explorer's `SUPER_ADMIN`-only gate). They are not part of the V1 product.
- **Decision:** Remove all three roles entirely — from the `app_role` enum and `roles` seed, from every authorization predicate that named them (`ROLE_HIERARCHY`, `PLATFORM_BILLING_ROLES`, `canActivateSubscription`, `canManageSubscription`, `resolveGroup`'s `startsWith("PLATFORM_")` rule), and from every test and doc reference. No re-introduction path, placeholder, or "reserved for future use" note is kept anywhere — a later need is a later decision. The V1 role set is exactly `SUPER_ADMIN`, `ORG_OWNER`, `ORG_ADMIN`, `ORG_PHYSIOTHERAPIST`, `ORG_RECEPTIONIST`; all platform duties are `SUPER_ADMIN`'s. `PLATFORM_CAPABILITIES` and the platform/org group split are unchanged — `SUPER_ADMIN` remains the sole platform-group role and `platformApi:explore` is untouched.
- **Consequences:** `canActivateSubscription`/`canManageSubscription` narrow to `SUPER_ADMIN`-only / `{ORG_OWNER, SUPER_ADMIN}` respectively; the "sales-assisted selection" branch `canManageSubscription` used to carry is dropped, not reworded, since it never had a real caller. `organizations_select_policy` and `organizations_update_policy` already admitted `is_super_admin()` unconditionally, so no RLS widening was needed for subscription activation/renewal — removing the roles closes what would otherwise have been a gap, rather than requiring new grants. The `users_select_policy` clause added in `20260728000000_users_select_self_read.sql` (`id = auth.uid()`, worked around a `NULL = NULL` self-read bug for platform roles other than `SUPER_ADMIN`) becomes dead code — every remaining platform-group user (`SUPER_ADMIN`) was always covered by the policy's `is_super_admin()` branch; left in place rather than removed as a drive-by cleanup. The `ApiExplorerPage`/`platform-admin-page` `ForbiddenState` fallback branch has no reachable real-role scenario left, but the `<Can>` gate and the capability check are kept as-is — the mechanism is cheap, correct, and harmless to leave in place even though nothing can currently trigger its negative branch. `organizations_update_policy`'s pre-existing `using`/`with check` disagreement (`with check` omits the `ORG_OWNER` role check `using` carries) was recreated verbatim as part of the enum-driven policy sweep this removal required — held, not fixed, since it's a functional change independent of role removal; whoever next recreates this policy for any reason inherits the same trap.
- **Reference:** ADR-0009 (historical — its Consequences describe the three roles as reaching `/platform/admin`, and separately cite `tests/integration/me.test.ts` as pinning that all three receive no capabilities; that test was removed by this change. Both statements were accurate when written, neither describes current reality). `supabase/migrations/20260801000000_remove_platform_roles.sql`.

---

## Patient Package Status as a Derived View

- **Scope:** Backend — prerequisite for frontend phase F5.
- **Context:** `patient_packages.status` was a stored four-value enum where three of four values (`completed`, `expired`) were pure functions of other columns already on the row, and only `cancelled` recorded a real decision. Because the derived values were stored, they went stale: `expired` was applied only by `evaluatePackageExpiry`, called from individual read/write paths, never from the two list paths (`listPatientPackagesForPatient`, `listOrganizationPatientPackages`) — a lapsed package could display `active` indefinitely in any list view. Separately, the expiry check compared a JS `Date` instant against a date column's UTC-midnight instant — a genuine, asymmetric timezone defect for any user in a timezone ahead of UTC (the addition that computes `expiry_date` in the first place has no such defect: its local-time round-trip through `getDate`/`setDate`/`toISOString` cancels out the server's timezone offset exactly, and is unchanged by this decision).
- **Decision:** `status` is dropped from `patient_packages` entirely. Cancellation becomes an explicit `cancelled_at timestamptz null` / `cancelled_by uuid null` pair (the latter a composite FK to `users(organization_id, id)`, mirroring `appointment_status_logs.changed_by`), populated by the service layer from the caller's resolved identity. `status` is derived live in a new view, `patient_packages_view` (`security_invoker = true`, explicit `grant select ... to authenticated`), with precedence `cancelled -> completed -> expired -> active` and an explicit cast to `public.package_status` so the generated TypeScript type stays the four-value union rather than widening to `string`. Repositories read from the view, write to the table; insert/update repository functions perform the table write, then re-read the row from the view so callers still receive the fully-derived shape from a single function call. `evaluatePackageExpiry`/`isPackageExpired` are removed entirely; the two session-consumption RPCs (`consume_package_session`, `reverse_package_session_usage`) stop writing `status`, becoming pure counter operations. A new error code, `PACKAGE_CANCELLED`, blocks session consumption against a cancelled assignment — a gap that existed before this change and is closed here because `cancelled` is now a first-class, explicitly-checked precedence branch rather than an implicit enum value.
- **Consequences:** No index exists on `status` today and none is added: the `expired` branch depends on `current_date`, which is `STABLE` not `IMMUTABLE`, so Postgres disallows a functional index on it directly; at this project's per-organization row scale this is a non-issue, and a materialized-view or trigger-maintained column is explicitly not adopted. `select pp.*` freezes the view's column list at creation time — a future column added to `patient_packages` will not appear in `patient_packages_view` until the view itself is recreated; `tests/integration/patient-packages.test.ts` asserts the two column sets stay in sync so this can't drift silently, and whoever next adds a column to `patient_packages` must also replace this view. `supabase gen types` marks every view column nullable regardless of the table's constraints (see *Database Types* → *View-Backed Entities*), so `PatientPackage` narrows the generated `Row` type back with a mapped type rather than sourcing it directly. This is the first view in this schema; it does not establish a general policy of converting other derivable-looking status columns (`appointments.status`, `payments.payment_status`, `organizations.status`/`subscription_status`) to views — those are explicit, service-enforced state machines with no equivalent "mostly-derivable" pathology, and should be evaluated on their own terms if ever proposed. Removing the `status` writes from the two consumption RPCs tightens their alignment with the *Database Functions for Atomic Operations* constraint that such functions must not encode business-rule branching.
- **Reference:** `supabase/migrations/20260803000000_patient_package_status_view.sql`.

---

## Unsubscribed Organization Write Enforcement

- **Scope:** Backend — prerequisite for frontend phase F5.
- **Context:** `canOrganizationTransact` (`authorization.service.ts`) already gated 7 call sites (`createOrganizationUser`, `createClinic`, `createAppointment`, `createPatientPackage`, `consumePackageSession`, `createPayment`, `createInvoice`), but the boundary deciding which writes gate and which don't existed only as an emergent pattern across those 7 call sites — never written down, and never checked against the other ~50 write entry points in the service layer.
- **Decision:** The write/read boundary is written down in *Subscription Principles* → *The write/read boundary*, and stated as an inversion: **every write is gated except six named exemptions.** An unsubscribed organization reads everything and records nothing. Thirty-one call sites are added to the nine that were gated first (patients and patient records, in the initial pass), for forty in total — cancellations and reversals, visit delivery (appointment status, consultations, prescriptions, attendance), edits to existing records, and the package catalog. The exemptions are subscription lifecycle, bootstrap, identity/recovery, organization profile, wind-down of people and places, and system-triggered notifications.

  The four-line lookup-and-throw is extracted into `assertOrganizationCanTransact` (`authorization.service.ts`, adjacent to the predicate) and every site uses it. At forty sites the duplication is not the main argument — the error code and message must be identical everywhere, and forty hand-written copies would eventually diverge in a way no test would catch. It is the only throwing function in a module of boolean predicates; that is deliberate.

  Separately, a self-action guard is added: no caller, including `SUPER_ADMIN`, may deactivate, offboard, or change the role of their own account. Enforced in the service layer (*Business Rules*) as a `callerUserId === targetUserId` check in `deactivateUser`, `offboardUser`, and `changeUserRole` (`organization.service.ts`), alongside each function's existing authorization check, throwing a new `TARGET_USER_IS_SELF` (409, `toast`) error code. No separate last-active-owner count check or repository function is added: with self-action blocked, `ROLE_HIERARCHY` (`authorization.service.ts`) already guarantees the invariant, since only `ORG_OWNER` may act on `ORG_OWNER` — a sole owner cannot be removed by anyone else inside the organization. `SUPER_ADMIN` is a deliberate exception, consistent with its existing global override in `canManageTargetUser`.
- **Consequences:** A freshly bootstrapped organization cannot do anything but read until it selects at least a trial plan — plan selection becomes a hard gate on setup, not only on later transacting.

  Four consequences read oddly and are intended, recorded here so they are not relitigated as bugs. A lapsed organization **can deactivate a user but cannot correct their name**, and **can delete a clinic but cannot rename it** — wind-down is exempt, editing is not; shrinking your footprint is always allowed, changing your records is the paid service. It **cannot cancel an appointment**, so its schedule keeps showing visits it will not deliver; the visit is still cancelled by phone, only the record is frozen. And it **cannot record a check-out against a check-in taken while subscribed**, leaving a half-open attendance row. Reads stay complete throughout, so the organization can always see exactly what it can no longer change.

  Gating `updateUserProfile` and `changeUserRole` required adding a target-user lookup neither had, which also gives them the `NOT_FOUND` their siblings already returned — a new error path on two shipped endpoints, and one extra query per call. At those three user-lifecycle sites the gate is skipped when the target has no organization, since a platform user has no subscription to check.

  `transitionAppointmentStatus` gets no gate of its own: both of its steps are gated, and in every branch the gate fires before the first write, so a lapsed organization gets one clean rejection and no partial state.

  Two pre-existing issues were found but are explicitly not addressed by this decision: `bootstrapOrganization`'s compensation logic never unwinds the organization row itself if a later step fails, leaving an unrecoverable `status: draft` orphan; and `activateUser` never re-checks `canCreateUserWithinLimit`, unlike `createOrganizationUser`, so reactivating a user can silently exceed a downgraded plan's seat limit. Both are tracked as follow-ups, not fixed here.

  Because `SUPER_ADMIN` is exempt from the self-action guard, a platform caller can still remove an organization's last active owner (deactivate, offboard, or demote them) — an accepted consequence, not a gap this decision closes. Such an organization cannot recover on its own: `canManageSubscription` is owner-or-`SUPER_ADMIN`, and promoting a replacement owner itself requires an owner. Recovery is `SUPER_ADMIN` promoting a new owner by hand; V1 exposes no platform console surface for this beyond the API explorer.

  `UX.md`'s error table gains a third 409 treatment row, *prohibited action*, for `TARGET_USER_IS_SELF` — neither existing 409 row fits an action that is refused in every state (there is nothing to resync and no safe alternative to offer). `PAYMENT_EXCEEDS_INVOICE_TOTAL` currently sits in *blocking message + resync* and arguably belongs in the new row; it was deliberately left in place, as moving it changes behavior on a shipped surface and belongs to a later error-table pass.
- **Reference:** `assertOrganizationCanTransact` (`authorization.service.ts`) and its forty call sites; `tests/integration/subscription-gate-matrix.test.ts` enumerates every one — a gate with no row there is untested, and a new gated write should add a row. ADR-0012 (historical — its context paragraph enumerating "seven call sites" and "the other five `SUBSCRIPTION_REQUIRED` sites" was accurate when written and describes the state before this decision, not current reality).

---

## Patient Record Access and F5 Capability Vocabulary

- **Scope:** Backend + docs — F5.
- **Context:** `canViewPatientRecords` (`authorization.service.ts`) scoped `ORG_RECEPTIONIST` to patients with an appointment at a clinic they were assigned to, which made `UX.md` Flow 4's documented intake path impossible for its own primary actor: Reception creates the patient and attaches the first scans *before* any appointment exists, then could not read back what it had just uploaded. Separately, the capability vocabulary had view tokens for patients and packages but no manage-tier token for any F5 domain, so no F5 write affordance could be gated client-side; `patient_records` had no `deleted_at` at all, making a scan attached to the wrong patient the one clinical write with no correction path; and `deactivatePackage` did not implement the block Flow 11 documented.
- **Decision:**

  **(a) Reception is widened to organization-wide, in the predicate *and* in the RLS select and update policies** (plus the two `storage.objects` policies that mirror them). The predicate change alone would not have been a partial delivery — it would have been a regression: `listPatientRecords` reads through the caller's session-scoped client, so a widened predicate against an unchanged policy returns **zero rows rather than a refusal**. That is the same failure mode ADR-0011 recorded for `user_compensations`, in the opposite direction: an authorization boundary living in RLS *filters* when a predicate disagrees with it, it does not *error*. That precedent is why the policy change is part of this decision rather than a follow-up. The **physiotherapist appointment boundary is retained deliberately** — a clinical boundary, not an oversight — in predicate and policy alike, is now documented in `UX.md`, and is pinned by an integration test that reads through a real session client so a future policy sweep cannot quietly drop it.

  The two storage policies are widened even though they are not in the app's request path (uploads and signed-URL creation both go through the admin client, which bypasses storage RLS). They are the backstop for direct object access, and leaving them narrower would leave a policy contradicting the boundary this decision establishes — at no behavioural cost.

  **(b) Four capability tokens are added**, each mapped 1:1 onto a predicate: `patients:manage` → `canManagePatients`, `packages:manage` → `canManagePackages`, `patientPackages:manage` → `canManagePatientPackages`, and `patientRecords:delete` → `canDeletePatientRecords`. **No ADR, deliberately:** ADR-0011 and ADR-0012 each existed to resolve a *tension* between a coarse token and a narrower boundary, and each had to explain why the boundary moved. These four resolve no such tension — they are vocabulary additions over predicates whose role sets are unchanged. That precedent is declined on its own terms, not overlooked.

  **(c) `deactivatePackage` blocks on existing assignments**, on the same predicate `deletePackage` already used, matching Flow 11.

  **(d) Patient records gain `deleted_at` and an Owner/Admin soft delete** (the forty-first subscription gate). `canDeletePatientRecords` is `ORG_MANAGEMENT_ROLES` — deliberately narrower than the manage predicate that admits Reception and appointment-linked physiotherapists, mirroring `canCorrectPackageSessionUsage`: destroying a record is a different act from creating one. **The Storage object is removed along with the row.** A soft delete that left the file in place would not fix the misfiled-scan case the decision exists for, since the storage policies grant on the patient folder in the object path. Ordering is row first, then object, matching `createPatientRecord`'s existing compensation asymmetry. A hard delete was not an option: `patient_records_delete_policy` is `is_super_admin()` only, so an Owner's delete would have silently affected zero rows.

  **(e) Audit logging becomes standard for everything F5 builds** — see *Audit Logging* — via a new `recordAuditLogSafe`, at fourteen call sites across twelve functions. `recordAuditLogSafe` inserts **without reading the row back**: `audit_logs_insert_policy` admits any org member but `audit_logs_select_policy` admits only Owner/Admin, so an `insert().select()` through a receptionist's session client commits the row and then returns nothing — warning on a write that had in fact succeeded.

- **Also fixed in passing:** `createPatient`'s audit call sat inside the patient-code retry loop, whose `catch` treats any unique violation as a code collision — so a unique violation raised by the audit insert would have been retried and created a **second patient row** for one create call. The call moves outside the loop (and onto `recordAuditLogSafe`). A pre-existing defect, not a consequence of the audit work.
- **Consequences:** `existsPatientPackagesForPackage` filters neither `deleted_at` nor `status`, so a package assigned even once can now be **neither deleted nor deactivated** and remains in the catalogue permanently — accepted as the cost of matching Flow 11; narrowing that predicate is explicitly not attempted here, and it is declared in the soft-delete exemption list as accepted behaviour rather than an oversight.

  `existsPatientRecordForPatient` gains a `deleted_at` filter, which also loosens patient deletion: a patient whose only record was deleted becomes deletable. Without it the block would cite records that no longer exist.

  Because the Storage object is removed while the row is retained, a soft-deleted record's `file_url` points at nothing and **the delete is not practically reversible**. The row is an audit trail, not a restore point, and nothing in the product offers to restore it. The audit entry's `old_data` snapshot is therefore the only surviving trace of the document — `file_url` included, since that is what ties the entry to storage-level logs and backups.

  Full row snapshots duplicate patient data into `audit_logs` — names, phones, emails, addresses, and record titles and notes — and `audit_logs` has no retention bound today. `ROADMAP.md` R11's *Data Retention & Audit Log Archival Strategy* is where that gets bounded; the growth is recorded here rather than left unremarked. `audit_logs` RLS is strictly more restrictive than every table it snapshots (Owner/Admin only, append-only by the absence of update/delete policies), so the trail narrows access rather than widening it.

  The RLS policies deliberately do **not** filter `deleted_at`; no policy in this schema filters its own table's soft-delete column, and the repository layer remains the single place that decides which rows are live. That rule is now written down in *Soft Delete Strategy* → *Where liveness is enforced* and guarded by `tests/unit/soft-delete-liveness.test.ts`.
- **Reference:** `20260804000000_patient_records_front_desk_access.sql` and `20260804000100_patient_records_soft_delete.sql`; `canViewPatientRecords` / `canDeletePatientRecords` (`authorization.service.ts`); `me.contract.ts`; `recordAuditLogSafe` (`audit-log.service.ts`); ADR-0011 (for the RLS-filters-rather-than-errors precedent). ADR-0012 (historical — its context paragraph points at `UX.md`'s F4 note on the enforcement table, which this decision replaced with the *Which surface gets which treatment* rule; that pointer was accurate when written and describes the state before this decision, not current reality).

---

## Physiotherapist Availability via Attendance-Driven Scheduling (Implementation)

- **Scope:** Backend — prerequisite for frontend phase F6.
- **Context:** The entry above this one declared four items but got the first one's mechanism wrong: `recordCheckIn` (`attendance.service.ts`) selects **one** predicate up front, by whether the target is the caller —
  ```ts
  const isAuthorized = targetUserId === callerUserId
    ? await canRecordOwnAttendance(supabase, callerUserId)
    : await canManageAttendance(supabase, callerUserId);
  ```
  — with no fall-through. `canManageAttendance` never runs on the self branch, so whatever `canRecordOwnAttendance` admits *is* the self-recording role set and nothing else covers it. "Management already covers itself through `canManageAttendance`" is not how the function is built. This entry supersedes the original on implementation; the original's Context and Decision items 1–4 stand as the product intent.
- **Decision:**
  1. **Self-recording role set: Owner, Admin, SUPER_ADMIN, and Physiotherapist. Receptionist is deliberately excluded** — a receptionist records other staff's attendance but not their own; this is the clinic policy the mistaken original rationale was reaching for, now implemented directly in `canRecordOwnAttendance` rather than assumed to fall out of `canManageAttendance`. `recordCheckIn`'s branch structure is untouched — one predicate per branch, no fall-through — since that structure is exactly what makes the exclusion real. `ORG_FRONT_DESK_ROLES` (Owner/Admin/Receptionist/SUPER_ADMIN, read by `canManageAttendance` and five other predicates across five further domains) is pinned by a unit test asserting all six consumers admit the same four roles, so the refactor that composed it from `ORG_MANAGEMENT_ROLES` could not silently narrow or widen any of them.
  2. **The half-day window is a `time` pair**, `unavailable_from`/`unavailable_to` on `user_attendance`, over an AM/PM marker: a marker still needs a boundary instant, so it buys no simplicity at the comparison site and loses expressive power. Both columns carry a `COMMENT ON COLUMN` stating explicitly that they record the period the person is **not** available, not their working hours — the inversion is easy to make and F6 builds form copy against these fields. Three CHECK constraints make the pairing structural: both-or-neither, `from < to`, and the window exists **exactly** when `status = 'half_day'`. Every comparison — the booking block, the reschedule re-check, the half-day auto-cancel filter — resolves the appointment to its **UTC** calendar date and UTC clock time (`attendance_date` is a `date`, `appointment_time` is `timestamptz`, and no organization timezone column exists). This is wrong near midnight or a window edge for a non-UTC organization; the fix (an organization timezone column) is named and deliberately deferred as a schema-wide concern outside this feature's scope.
  3. **Auto-cancel eligibility is `scheduled`/`confirmed` only.** `checked_in` means the patient is already in the clinic — cancelling that is a clinical/administrative act with a person at the desk, not something the system decides — so it is **skipped and reported**, never silently dropped: the result carries `skippedCheckedInAppointmentIds` alongside `cancelledAppointmentIds`. `completed` is untouched; `completed → cancelled` is the existing *correction* path and reverses a consumed package session, which an availability marking must never do. The eligibility set is checked twice on purpose — once when the orchestration lists appointments, once inside `cancelAppointmentAsSystem` itself — so "an availability cancel can never touch a completed visit" is structural, not a caller convention.
  4. **Compensation: cancels stand, failures are reported.** Per marking: write the attendance row first (so `ATTENDANCE_ALREADY_RECORDED` rejects before anything is cancelled — the one atomicity guarantee that matters), then per eligible appointment, cancel, then notify. A notification failure never unwinds its cancellation, and a cancellation failure never unwinds earlier ones: the physiotherapist genuinely is unavailable, and restoring a visit nobody will deliver is worse than a missing reminder. Both failure modes populate their own result arrays (`failedCancellationIds`, `failedNotificationAppointmentIds`) and are logged with identifiers and the error only, never a message body — never silently dropped.
  5. **`recordSystemNotification` (`notification.service.ts`) resolves the `createNotification` authorization contradiction**, making "no caller initiates" (this file's *Subscription Principles* → *The write/read boundary*) true for the first time: no caller-authorization check, `organizationId` supplied by the orchestration from the already-resolved attendance record and never from client input. It runs on the **caller's session client**, not the admin client — `notifications_insert_policy` is org-scoped and admits any org member's own session. It **returns `Promise<void>`, not the inserted row** — discovered while proving the RLS boundary through a real signed-in session (item 10 below), not planned up front: `notifications_select_policy` is narrower than the insert policy (recipient-self, ORG_ADMIN, or SUPER_ADMIN only), so `insert().select()` requires a read-back the physiotherapist or receptionist sessions this function exists for cannot perform, and Postgres reports the whole statement as an RLS violation even though the insert itself was admitted. `notification.repository.ts` gains `insertNotificationWithoutReturn`, mirroring `insertAuditLogWithoutReturn`'s existing precedent for the identical insert-wider-than-select policy shape (`audit_logs_insert_policy` vs `audit_logs_select_policy`, item (e) of the entry above). Unlike `recordAuditLogSafe`, it still **throws** on a genuine failure — the attendance workflow relies on the throw to populate `failedNotificationAppointmentIds`. `notifications_select_policy` itself is not widened: it is separately stale (admits `ORG_ADMIN`, not `ORG_OWNER`) and touching it means deciding who may read a patient notification row, a question for a later phase, not this one.
  6. **The auto-cancel runs under system authority, via `createAdminClient()`, not the recording caller's own access.** Cancelling through `updateAppointmentStatus`'s `canAccessAppointment` check would make the effect depend on who recorded the absence: a receptionist would clear only appointments at clinics she is assigned to, both at the service layer and under `appointments_update_policy` in RLS — the remainder landing in `failedCancellationIds` with no patient notification, a schedule silently half-cleared. The **listing is affected as much as the write, and worse**: under a receptionist's session, `appointments_select_policy` would filter it to her assigned clinics, so out-of-clinic appointments are never even found — a filtered list fails silently where an update failure at least errors. `cancelAppointmentAsSystem(adminClient, organizationId, appointmentId, changedByUserId)` (`appointment.service.ts`) and its supporting repository listing, `listActiveAppointmentsForPhysiotherapistInRange`, both run on the admin client. Every property the write needs is still preserved: the subscription gate is the function's own first statement (and has its own gate-matrix row); transition legality is checked independently of the orchestration's filter; the status log still records `changed_by` as the user who recorded the absence — **system authority is about what may be written, not about hiding who triggered it**; and organization scoping comes from the resolved attendance record, never client input, with the function rejecting a mismatched appointment outright. Admin authority is confined to exactly the appointment read and write — `recordSystemNotification` deliberately stays on the session client, keeping the admin blast radius minimal and the RLS proof below real rather than a tautology.
  7. **Reschedule re-checks availability, against the destination time only, when the time is actually changing.** Without this, the booking block is trivially bypassed: book outside the window, then reschedule into it. A check against the new time never prevents moving *out* of a window, so no case is made worse by adding it. An edit to type or notes alone re-checks nothing.
  8. **Attendance writes have exactly one public entry point per operation; appointments deliberately do not follow this shape.** `attendance-workflow.service.ts` exports `recordAttendance` and `updateAttendance`; `attendance.service.ts`'s `recordCheckIn` and `updateAttendanceRecord` (renamed from `updateAttendance`) are called only from there. A prior shape considered during planning — `correctAttendance` on the workflow alongside a still-public `updateAttendance` on the domain service — was rejected: two names for one act, with the inner one silently skipping the cancellations, so the obvious name led to the wrong behaviour. Reads (`getAttendanceDetails`, `listOrganizationAttendance`) and `recordCheckOut`, which can never affect availability, stay public on the domain service. `appointment.service.ts` and `appointment-workflow.service.ts` keep their existing two-public-function shape — changing it was out of scope and would have touched the gate matrix, the workflow service, the routes, and several test files for no behavioural gain. The difference between the two modules is a decision, not drift.
  9. **Updating an attendance record is `canManageAttendance` only — a physiotherapist records their own attendance and cannot update it.** This is a deliberate policy about who performs which act in the clinic, decided for this feature — not an instance of a more general rule: the predicate sets for recording and updating are not nested either way. A physiotherapist may record their own attendance but not update it; a receptionist may update anyone's but not record their own. No self-update branch exists in `updateAttendanceRecord`. `recordCheckOut` is unchanged and stays outside the workflow entirely — a check-out never changes `status`, so it can never make someone unavailable.
  10. **Unavailability is organization-wide, not per clinic**, even though the attendance row itself is recorded against a clinic. Neither the appointment listing nor the booking-block lookup filters by clinic — a physiotherapist marked absent at one clinic has their appointments cancelled, and their bookings blocked, at every clinic they work in that day. This is forced by the schema and is the right behaviour anyway: the partial unique index on `(organization_id, user_id, attendance_date)` permits exactly one live attendance row per person per day, so "absent at clinic A, present at clinic B" cannot be expressed. Stated in code comments at all three sites (the repository listing, the booking-block helper, and the orchestration's own cancel loop) because the presence of `clinic_id` on the row makes the opposite easy to assume.
  11. **Gate-matrix consequences of the above:** the pre-existing `updateAttendance` row is renamed to `updateAttendanceRecord` — a rename, not a new commitment, since the gate stays on the same domain function. `cancelAppointmentAsSystem` gets a **new** row: it no longer routes through `updateAppointmentStatus`, so it is a genuinely new gated write with its own `assertOrganizationCanTransact`. The workflow entry points (`recordAttendance`, `updateAttendance`) get no rows of their own, on the `transitionAppointmentStatus` precedent — both of their first writes are already gated and the gate fires before any state changes.
  12. **Patient notifications remain persistence-only** (no delivery), as the original entry specified. Nothing here changes that.
- **A note on what this feature is not:** the product records attendance; it is not a punch-clock. There is no mid-day-departure workflow, and none of the above should be read as implying one — a physiotherapist who does not appear has their absence recorded directly, and one who leaves partway through a recorded day is handled by reception coordinating the remaining appointments by hand. The update path (item 5 of the original entry, elaborated in items 8–9 above) exists for two narrower reasons: a status entered wrongly and then corrected must clear the schedule exactly as it would have if recorded correctly the first time, and a half-day window recorded with the wrong hours must be re-applied so the cancelled set matches what is actually on the record. Re-application only ever cancels appointments the corrected state newly covers — **extending or shifting** a window produces new cancellations; **shrinking** one produces none and restores nothing already cancelled under the wider window (item 4 above: a cancelled visit is a fact the patient has been told about, not a toggle).
- **Consequences:** Scheduling gains its first real availability gate. `notifications_select_policy`'s staleness (admits `ORG_ADMIN`, not `ORG_OWNER`) is now known to matter beyond read access — it shapes what a write path can safely do — and remains unfixed pending a policy decision this phase does not make. No RLS policy is changed by this phase (`insertNotificationWithoutReturn` is a repository-layer workaround for an existing policy pair, not a policy edit).

  One consequence is accepted rather than closed. `updateAttendanceSchema` allows `unavailableFrom`/`unavailableTo` without `status` — correcting the window alone, resolved against the existing record by the service — but the validator has no way to see whether that existing record's status will actually resolve to `half_day`. If it will not, `updateAttendanceRecord` nulls the window it was just given rather than objecting, per the same rule that clears an orphaned window on any correction away from `half_day`. **The caller's window input is silently discarded in that case; this is deliberately not enforced server-side.** Closing it server-side would mean the update path re-deriving the resolved status before validating the window, which the validator layer cannot do (it never sees the database). F6 designs the case out instead, at the point of entry: the availability form offers exactly two fixed half-day windows rather than free `time` inputs, so a caller can never submit a window without an accompanying `half_day` status in the first place. Those two values must be pinned in `UX.md` so the picker and any future validation agree on them — not decided freshly by F6's own implementation.
- **Reference:** `canRecordOwnAttendance` / `ORG_FRONT_DESK_ROLES` (`authorization.service.ts`); `attendance-workflow.service.ts`; `cancelAppointmentAsSystem` / `listActiveAppointmentsForPhysiotherapistInRange` (`appointment.service.ts` / `appointment.repository.ts`); `recordSystemNotification` / `insertNotificationWithoutReturn` (`notification.service.ts` / `notification.repository.ts`); `20260805000000_physiotherapist_availability.sql`; ADR-0011 (RLS-filters-rather-than-errors, the same shape this decision's item 6 relies on). The entry above (historical on implementation only — its item 1 rationale, "management already covers itself through `canManageAttendance`", does not describe how `recordCheckIn` branches; accurate as intent, not as a description of the mechanism this entry replaces).

## Billing Write Correctness

- **Scope:** Backend — prerequisite for frontend phase F7.
- **Context:** Four phases shipped over a broken billing write path because the invoice and payment integration suites drive every call through `ctx.admin`, which bypasses RLS entirely. Proven through real signed-in session clients, three defects were live. **Reception — `UX.md` Flow 8's named primary actor — could not perform a single billing write:** `createInvoice` and `createPayment` called the throwing `recordAuditLog`, whose `insert().select()` read-back fails with `42501` under a receptionist's session, since `audit_logs_insert_policy` admits any org member but `audit_logs_select_policy` admits Owner/Admin only. `createPayment` was the worse of the two — no compensation at all, so the payment row committed and finalized the invoice while the caller saw a 500 and a retry returned `PAYMENT_ALREADY_EXISTS_FOR_INVOICE`. **Editing an invoice appended to its line items rather than replacing them**, for every role including Owner: `deleteInvoiceItemsByInvoice` issued a client `DELETE` that `invoice_items_delete_policy` (`is_super_admin()`) filtered to zero rows, which Postgres does not report as an error, leaving an invoice whose header total contradicted its own items and drifting further with every save. **A failed invoice create left a live orphan** that had permanently consumed an invoice number, its compensation a hard delete against the same `is_super_admin()`-only shape. Separately, `updateInvoice` and `deleteInvoice` — the void-invoice path, the only way `UX.md` Flow 8 offers to correct a finalized invoice — wrote no audit entry at all, and `updatePaymentStatus` audited a lifecycle transition under a generic `update`.
- **Decision:**

  **(a) The three delete policies are deliberately not widened.** `invoices_delete_policy`, `invoice_items_delete_policy` and `payments_delete_policy` stay `is_super_admin()`. Every table in this schema restricts hard delete that way, and *Soft Delete Strategy* makes soft deletion the default with hard deletes "exceptional administrative operations". The defect is that the application hard-deleted at all, not that it was prevented from doing so. `invoice_items` already carries `deleted_at`, `invoice_items_update_policy` already admits Owner/Admin/Reception org-scoped, and `listInvoiceItemsByInvoice` already filters `deleted_at is null`, so soft-delete-by-update needed no policy change and no repository read change. **No RLS policy is changed by this increment.** This is the point most likely to be "corrected" later by someone reading the policy and not this note.

  **(b) Both new database functions are `security invoker`, unlike `consume_package_session`.** *Database Functions for Atomic Operations* makes invoker the default and definer the exception, justified only when a legitimate, service-authorized caller would otherwise be blocked by a deliberately narrower table policy — true for session consumption (a physiotherapist may consume but must not gain free-form `UPDATE` on `patient_packages`), and not true here: every role `canManageInvoices` admits is already admitted by `invoices_insert/update_policy` and `invoice_items_insert/update_policy`. Invoker also keeps RLS applying to every statement inside the function, which is what makes the session-client proofs meaningful rather than tautological. Neither function derives a total; the service computes every amount and passes it in, per the same section's rule that business logic never moves into the function.

  **(c) `createInvoice`'s compensation was removed, not repaired, and the rule deciding which pattern applies is written down.** *External System Consistency* scopes compensating actions to systems "that cannot participate in PostgreSQL transactions" — Supabase Auth, file storage. **Two writes to the same Postgres database are not that**; the applicable section is *Database Functions for Atomic Operations*. The compensation was a misapplication that happened also to be unable to run, so repairing it would have preserved the misapplication. `create_invoice_with_items` makes the write atomic, and `deleteInvoice` (the hard-delete repository function), `insertInvoice` and `insertInvoiceItems` are deleted along with the `try`/`catch`. `create_invoice_with_items` deliberately does not catch `unique_violation`: the invoice-number retry loop depends on seeing `23505`, which was verified to survive the trip through `.rpc()` before the rewrite committed to it.

  **(d) `listPaymentsForInvoice` now refuses through `canAccessInvoice` instead of returning a lying 404.** A deliberate behaviour change on a shipped endpoint. **The symptom is a `NOT_FOUND` that misdescribes an invoice that exists — not the silent empty list first supposed.** The function resolved the invoice through `findInvoiceById` on the caller's own session client before it ever queried payments, so `invoices_select_policy` filtered the row and the caller was told the invoice did not exist. `invoices_select_policy` and `payments_select_policy` partition the organization identically, branch for branch, so no caller can read an invoice but not its payments and the empty-list case is unreachable. Still ADR-0011's failure mode — an authorization boundary living only in RLS filters rather than errors — in its 404 rather than its `[]` form. `getInvoiceDetails` already resolves `canAccessInvoice` to `FORBIDDEN` ahead of its own invoice read, so this makes the two endpoints consistent rather than introducing a new shape. The service's `caller.organization_id !== invoice.organization_id → FORBIDDEN` branch was dead for the same reason and is removed; the inline `supabase.from("payments")` query — the only persistence code in either billing service, against *Layer Responsibilities* — moves to `listPaymentsByInvoice`. `canAccessInvoice` keeps admitting the appointment's physiotherapist, so no role loses access it had.

  **(e) Payment transitions audit under the target status; the void audits as `cancel`.** `STATUS_AUDIT_ACTIONS` (`payment.service.ts`) maps `refunded → refund` and `cancelled → cancel`, the shape F6 D8 made structural for appointments. Editing an invoice is a field change and stays `update`; voiding one is a lifecycle transition and `UX.md` Flow 8 calls it cancellation, so `cancel` is the verb the domain already uses. This changes the verb on `updatePaymentStatus`, a shipped path; existing rows keep `"update"` and no backfill is possible, since the trail is append-only.

  **(f) F-2, F-3 and `listPaymentsForPatient` are F7's, not this increment's.** The line is *live and silently wrong* versus *dependent on a screen*. `updateInvoice` accepting and discarding `patientId`/`clinicId`/`appointmentId`/`patientPackageId` corrupts nothing — the request simply has no effect, no client sends those fields, and the correct fix is not knowable without an edit form; decisively, it is the only one of the three that moves `openapi.json`, so carrying it would cost this increment the contract-neutrality it uses as a scope guard. The missing billing entries in `RESYNC_ERROR_CODES` would wire invalidation for mutations that do not exist, and this increment touches no client code at all. `listPaymentsForPatient` has no route and no caller, so it is neither live nor wrong in production; fixing its page-derived `total` means designing a patient-payments endpoint, which is a screen decision.
- **Consequences:** `tests/unit/soft-delete-liveness.test.ts` states plainly what it cannot see, and "RPCs and views" is on that list — `consume_package_session` is already named as opaque to it. Moving item deletion into `replace_invoice_items` puts this soft delete in the same blind spot: **nothing structural will notice if the `update ... set deleted_at` is ever dropped from the function body.** `tests/integration/billing-session-rls.test.ts`'s repeated-edit case is the entire guard, which is why it is a test of its own rather than folded into the replacement case. The exemption list itself is unchanged: no write function could ever have been keyed there (its collector discards any statement containing `.insert(`/`.update(`/`.upsert(`/`.delete(`), and `findLatestInvoiceNumberInOrg` stays `PENDING_R9` correctly, since it must keep seeing deleted rows so invoice numbers are never reused.

  `createInvoice` now re-reads its line items after the write, because the function returns the invoice row alone. One extra round-trip, kept deliberately rather than widening the function's return type to carry both.

  No ADR. The ADR triggers are for *new* or *changed* patterns; the atomic-function pattern, `recordAuditLogSafe`, and soft deletion as the default all already exist and are already documented. This increment applies three settled conventions to a domain that never adopted them — F5's stated reason for adding four capability tokens without an ADR, applied unchanged.
- **Reference:** `20260806000000_invoice_write_atomicity.sql` (`replace_invoice_items`, `create_invoice_with_items`); `createInvoiceWithItems` / `replaceInvoiceItems` / `listPaymentsByInvoice` (`invoice.repository.ts` / `invoice-item.repository.ts` / `payment.repository.ts`); `STATUS_AUDIT_ACTIONS` (`payment.service.ts`); `tests/integration/billing-session-rls.test.ts`, and the three billing tables in `tests/integration/clinical-rls.test.ts`. ADR-0011 (RLS filters rather than errors — the precedent (d) rests on). `ROADMAP.md` R9, whose audit-migration item this increment shrank.

---

## Clinical Operations (F6)

- **Scope:** Frontend — the five F6 modules (Appointments, Appointment Status Workflow, Consultation, Prescription, Attendance) plus the backend read/authorization seam they needed.
- **Decision:**
  1. **Appointment reads carry a display projection; appointment writes do not.** `appointmentSchema` stays the bare row and remains what every write returns; `appointmentReadSchema` adds nested `patient`/`physiotherapist`/`clinic` objects and is what `GET` returns. A database view was rejected — it forces a write-then-re-read round trip, widens every column to nullable, and freezes its column list behind a parity test — and requiring the projection on write responses would have reintroduced that same round trip through the contract instead of the schema. Nothing needs it: mutation feedback is pessimistic, so the projection arrives on the refetch the client already performs. `physiotherapist` names its foreign key explicitly (`appointments` has *two* into `users`, so an unqualified embed is ambiguous). Each embed is nullable because RLS filters a joined row to `null` rather than erroring (ADR-0011); that it is never null in practice is proved **per role through real signed-in session clients**, which is a hard requirement of this design rather than incidental coverage. The embeds carry no liveness filter, so a soft-deleted patient or clinic still renders its name — deliberate, since the reference is historical.
  2. **Per-item hints are `allowedTransitions: AppointmentStatus[]`, not `canManage: boolean`** (ADR-0010's shape, extended). Two facts decide whether to render a status control — may this caller act on this row, and is the transition legal from its current status — and a boolean carries only the first, forcing the client to mirror `LEGAL_APPOINTMENT_STATUS_TRANSITIONS` where it would drift silently. The array carries both: the legality row when the caller may act, empty when they may not. **So the transition matrix is published per row as data and exists nowhere on the client.** Computed in memory from the caller's role resolved once per request, never by calling `canAccessAppointment` per row (2–3 lookups each, an N+1 of 50–75 over a page).
  3. **The access conjunct of that hint is unreachable today and is kept anyway.** `listOrganizationAppointments` and `canAccessAppointment` partition the organization identically, role for role, and `getAppointmentDetails` 403s before any hint is computed — so no row a caller receives can carry `[]` for access reasons. It is retained because that agreement is not stable: **F5 widened Reception from clinic-scoped to organization-wide for patients and patient records**, predicate and RLS both, when the narrower scoping made Flow 4 impossible for its own primary actor. Appointments are the same shape and the same role. The invariant that makes it redundant — *every row the list returns is one `canAccessAppointment` admits* — is asserted per role, in that one direction only, so the day someone widens the listing without the predicate, the guard fires instead of the UI silently offering actions the server refuses.
  4. **One hint governs both the consultation form and the prescription section.** `canManageConsultation` (keyed on the appointment) and `canManagePrescription` (keyed on the consultation) agree for every consultation reachable from a row, because `createConsultation` copies `physiotherapist_id` from the appointment and no input shape can change it afterwards. Structural but not obvious, so it is pinned in two places: a validator test that neither create nor update admits `physiotherapistId`, and an integration test that the two predicates agree across all five roles.
  5. **`GET /api/appointments/{id}/consultation` returns the consultation or `null` with a 200, never a 404.** The destination is routed by appointment id and must choose between the create and edit forms before rendering; "not started yet" is the *normal* state there, and a 404 would route the client into the not-found frame. Authorized on the **appointment's** read boundary, not the consultation's — a caller who may see the appointment must be able to learn it has none. This is what removes 409-as-control-flow from the phase entirely.
  6. **Three new capability tokens, and two nav items with no capability at all.** `appointments:manage` → `canManageAppointments`, `attendance:record` → `canRecordOwnAttendance`, `attendance:manage` → `canManageAttendance` — 1:1 vocabulary additions over unchanged predicates, the class F5 added four of without an ADR. Both the Appointments and Attendance nav items **drop their `capability` field**: `canViewAppointments` is "any active org member", so a token for it would be granted to every org user and gate nothing; and Attendance is reached through three different capabilities, which one field cannot express. `appointments:oversee` and `attendance:oversee` are kept and re-purposed — they now gate the org-wide framing *inside* each destination (the physiotherapist filter and column, the user/clinic filters and cross-staff columns) rather than the door. The service layer does the real scoping in both cases.
  7. **The two attendance capabilities cross rather than nest, and the UI never derives one from the other.** A physiotherapist records their own attendance and not another's; a receptionist records another's and not their own; Owner and Admin hold both. The mark-attendance dialog gates the self path on `attendance:record` and the record-for-others path on `attendance:manage` as two independent affordances — deriving the first from the second would let a receptionist record their own attendance, which `canRecordOwnAttendance` refuses by deliberate clinic policy. **This resolved a contradiction inside `UX.md`**: the Screen Inventory scoped Mark-attendance to "Physio (own), Owner/Admin" while Flow 14 assigned recording-for-others to the attendance-management capability, which Reception holds. Flow 14 was the correct side; the Screen Inventory row was amended, not the behaviour.
  8. **F6 covers its own audit surface, and R9's retrofit shrinks accordingly.** Ten `recordAuditLogSafe` sites: appointments (create, update, every status transition, delete, auto-cancel), consultations and prescriptions (create, update), and `recordCheckOut` — the one attendance path the availability phase left uncovered, because it sits outside the workflow that audits the other two. **A status transition emits the target status as its verb** (`confirm`, `check_in`, `complete`, `cancel`, `no_show`), never a generic `update`, so an auditor filtering one entity can separate lifecycle from field edits without diffing snapshots. **`cancelAppointmentAsSystem` emits `auto_cancel`**, deliberately distinct: "was this cancelled by a person or by the availability workflow?" is the first question asked of a cancelled appointment, and `changed_by` cannot answer it — the status log records the user who marked the absence either way. `transitionAppointmentStatus` writes nothing of its own; it delegates to the function that does. `ROADMAP.md`'s R9 item now names what remains rather than leaving its scope to be re-derived.
  9. **Blocking-message + resync is a per-call-site invalidation, not a new `ErrorBehavior`.** All nine of F6's conflict codes already map to `toast` with written copy in `ERROR_BEHAVIORS`, which this phase **does not touch**. The resync half — refetch so the stale UI reflects current state — is a small feature-local helper (`resyncOnConflict`), the same layering ADR-0012 uses for `meta.suppressToastForCodes`. F6 is the first phase to raise these at scale, so the set and the invalidation live in one place rather than at nine sites.
  10. **The half-day window is a two-choice control, and that is load-bearing rather than cosmetic.** `09:00–14:00` and `14:00–19:00`, pinned in `UX.md` at Flow 14. The server accepts *any* window — it validates format, pairing, ordering, and the `half_day` correspondence, never the values — and an update supplying a window without a status is **silently discarded**, an accepted behaviour the availability phase recorded and deliberately left open for F6 to design out at the point of entry. Two fixed choices do exactly that: a window can never be submitted without an accompanying `half_day` status. A stored window matching neither choice can still exist (written through the API, or backfilled by the availability migration at `09:00–13:00`); it is shown as recorded and requires an explicit choice to change, never snapped silently. **The migration's backfill was deliberately not aligned** — it is applied and committed, and a new migration would rewrite recorded attendance data to values nobody entered.
  11. **An attendance write is never reported as a bare success.** Both write endpoints return the workflow's four id arrays, and the dialog surfaces all four: cancelled, skipped-because-checked-in, failed cancellations, and failed patient notifications. A marking that cleared six visits and failed two notifications is not honestly "Attendance recorded".
  12. **F6 does no dashboard work at all — the appointments widget is F8's entirely, component included.** `UX.md`'s Screen Inventory assigns the surface to the `appointments` feature at phase F6 but hosts it on the Dashboard, an F8 destination. Splitting that (F6 builds, F8 mounts) was considered and rejected: `UX.md` records an **open question** about how the widget exposes fuller detail — reschedule, cancel, full view — and building the component ahead of that answer means building against a shape nobody has settled, then shipping it unmounted and unproven for a whole phase. The open question is **reassigned to F8**, which will host the widget and can settle it by use rather than on paper, and F8 builds the component when it does. `src/features/appointments/` therefore exports no widget.
- **Consequences:** The Patient Workspace seam held exactly as F5 documented it — F6 appended its tab at the route with no change inside `src/features/patients/`. The responsive collection composite is still **not** extracted: F6's two collections are the least table-like in the product and so the poorest evidence of agreement, and F7's invoice list is a much closer sibling to the existing four.

  Two things the E2E lane caught that the mocked component lane structurally could not. **A picker asked for `limit: 200` against a pagination validator that caps it at 100**, which 400s and surfaces as a silently empty picker rather than an error — mocked `api.get` cannot see a server-side bound. And **the E2E seed's "additive" requirement was subtler than the plan recorded**: the plan named the receptionist's unassigned state as load-bearing (F5's records boundary), but the main org's *physiotherapist and clinic* are equally load-bearing for F3's assign-then-remove spec, and the org's Trial plan headroom is load-bearing for the F3 create-user and F4 limit specs. F6 therefore seeds **its own organization**, following the `saturated`/`unsubscribed`/`lapsed` precedent, rather than adding to `main`.
- **Reference:** `appointmentReadSchema` (`src/contracts/appointment.contract.ts`); `resolveAppointmentHints` / `callerCanAccess` / `STATUS_AUDIT_ACTIONS` (`appointment.service.ts`); `getConsultationForAppointment` (`consultation.service.ts`); `HALF_DAY_WINDOWS` (`src/features/attendance/schemas.ts`); `resyncOnConflict` (`src/features/appointments/resync.ts`); ADR-0010 (per-item hints), ADR-0011 (RLS filters rather than errors), ADR-0012 (per-call-site toast suppression).

---

# User Identity & Authentication

The application separates **user identity** from **authentication**.

The application owns the user identity and business lifecycle.

Supabase Auth is responsible only for authentication.

---

## User Model

The application uses a single `users` table for all users.

There are no separate platform user and organization user tables.

Users are differentiated by their application role, which determines whether they are a platform user or an organization user.

Platform roles include:

- `SUPER_ADMIN`

`SUPER_ADMIN` is the sole platform role in V1; all platform duties (support, sales, billing) are its responsibility. See the "Platform Role Reduction" entry in Project Decisions for why `PLATFORM_SUPPORT`/`PLATFORM_SALES`/`PLATFORM_BILLING` were removed.

Organization roles include:

- `ORG_OWNER`
- `ORG_ADMIN`
- `ORG_PHYSIOTHERAPIST`
- `ORG_RECEPTIONIST`

Platform users do not belong to an organization.

Organization users belong to exactly one organization.

Platform users are provisioned directly by the platform using Supabase Auth. Every organization user has a globally unique username, an email address for communication and account recovery, an optional phone number, and exactly one organization.

---

## Roles

Application roles contain two names.

### System Name

The system name is the immutable identifier used by the application for authorization.

Examples:

```text
SUPER_ADMIN
ORG_OWNER
ORG_ADMIN
ORG_PHYSIOTHERAPIST
ORG_RECEPTIONIST
```

System names:

- Are seeded.
- Must never be renamed.
- Are used by the application for authorization.

### Display Name

Each role also contains a display name used by the UI.

Display names:

- Are required.
- May be changed without affecting application behavior.

Examples:

| System Name | Display Name |
| ------------ | ------------ |
| SUPER_ADMIN | Super Admin |
| ORG_OWNER | Owner |
| ORG_ADMIN | Administrator |
| ORG_PHYSIOTHERAPIST | Physiotherapist |

---

## User Identity

Every user has:

- Application User ID
- Username
- Email
- Phone Number
- Application Role
- Organization (nullable for platform users)

### Username

Username is the primary login identifier.

Rules:

- Globally unique.
- Immutable after creation.
- Never reused.
- Created only by administrators.
- Stored in lowercase.
- Normalized by the validation layer before persistence.
- Used for authentication instead of email.

### Email

Email is used for communication.

It is **not** used as the login identifier.

Email is used for:

- Password recovery.
- Notifications.
- User communication.

Rules:

- Required.
- An email address may belong to only one active application user.
- An email address may be reused after the previous user has been off-boarded.

### Phone Number

Phone numbers are used for communication only.

They are not used for authentication and are not required to be unique.

---

## Authentication

Supabase Auth is an external authentication provider, not another database table. The application owns user identity and business lifecycle; Supabase Auth is responsible only for authentication. The `public.users` table manages application user information, and the two concerns must remain separate.

The Auth Service is the abstraction over Supabase Auth. It owns all authentication identity operations, including invitations, which belong to the authentication subsystem rather than the business domain. Authentication-related operations belong in:

```
src/server/services/auth.service.ts
```

The Auth Service is the only layer that may interact directly with Supabase Auth, including:

- inviteUser()
- resendInvitation()
- deleteUser()
- disableUser()
- enableUser()
- updateUser()
- resetPassword()

Passwords are managed exclusively by Supabase Auth.

The application never stores user passwords.

Users authenticate using:

```text
Username
Password
```

The application resolves the username to the corresponding authentication identity before authenticating through Supabase Auth.

Supabase Auth email addresses are considered an implementation detail and are never used as the application's login identifier.

---

## User Onboarding


### SUPER_ADMIN

Platform users are provisioned by the platform.

`SUPER_ADMIN` users are onboarded using the Supabase invitation flow (`inviteUserByEmail()`).

The user sets their own password during onboarding.

---

### ORG_OWNER

The initial organization owner is created during the Organization Bootstrap workflow.

`ORG_OWNER` users are onboarded using the Supabase invitation flow (`inviteUserByEmail()`).

The owner sets their own password during onboarding.

---

### Organization Users

All other organization users are created by an `ORG_OWNER` or an authorized `ORG_ADMIN`.

The onboarding workflow is:

1. Validate the request and authorization.
2. Validate username and email availability.
3. Generate an initial password.
4. Administrator creates the user.
5. Backend creates the Supabase Auth user using `auth.admin.createUser()` with `email_confirm` set to `true`.
6. Create the application user profile.
7. Roll back the Auth user if profile creation fails.
8. The administrator securely communicates the username and initial password to the employee.
9. Organization users are not required to change their password on first login. Users may change their password at any time through the password management workflow.

Organization users are **not** onboarded using the Supabase invitation flow.

Current authorization for organization user onboarding is:

- `ORG_OWNER`
- `ORG_ADMIN`

---

## User Lifecycle

### Platform Users

```text
Create
    ↓
Active
    ↓
Deactivated
    ↓
Deleted
```

Platform users are never off-boarded because they do not belong to an organization.

Platform users are onboarded by the platform and authenticated using Supabase Auth. Currently, only `SUPER_ADMIN` users are created during organization bootstrap.

---

### Organization Users

```text
Create
    ↓
Active
    ↓
Deactivated
    ↓
Off-boarded
```

### Deactivated

A deactivated user:

- Has `is_active = false`.
- Cannot log in.
- May be reactivated by an authorized administrator.

### Off-boarded

An off-boarded user:

- Has `deleted_at` populated.
- Is no longer associated with the organization.
- Is retained for historical and audit purposes.

The re-onboarding behavior for off-boarded users will be defined as part of the User Invitation and Off-boarding workflow.

---

## Login Flow

```
Username
    ↓
Resolve Application User
    ↓
Resolve Authentication Identity
    ↓
Authenticate through Supabase Auth
```

---

## Password Policy

### System-Generated Initial Password

This password is generated by the application when creating a new user account.

Requirements:

- Exactly **16 characters** long.
- Cryptographically secure random generation.
- Must contain at least:
  - One uppercase letter (`A-Z`)
  - One lowercase letter (`a-z`)
  - One numeric digit (`0-9`)
  - One special character.
- Must never be stored in the application database.
- Must never be logged or written to audit logs.
- Must only be returned once in the API response immediately after successful user creation.
- If lost, it must be reset through the password reset workflow — self-service (emailed link) for a role with a real email, or **admin-mediated** (`POST /api/users/{id}/reset-password`, F3) for Physiotherapist/Receptionist, whose email may be a placeholder and so cannot use the emailed workflow at all. The admin-mediated reset generates a new value under the same requirements above (16 characters, cryptographically secure, never stored/logged, returned once) and is gated on `canManageTargetUser` — the same hierarchy check that governs every other action an Owner/Admin takes on a target user.

### User-Defined Password

Requirements:

- Minimum **8 characters**.
- Must contain at least:
  - One uppercase letter (`A-Z`)
  - One lowercase letter (`a-z`)
  - One numeric digit (`0-9`)
  - One special character.
- Password expiry is not enforced.
- Users are encouraged, but not required, to change their password periodically.

---

## Role Hierarchy

Current organization role hierarchy:

```
ORG_OWNER
    │
    ├── ORG_OWNER
    ├── ORG_ADMIN
    ├── ORG_PHYSIOTHERAPIST
    └── ORG_RECEPTIONIST

ORG_ADMIN
    │
    ├── ORG_PHYSIOTHERAPIST
    └── ORG_RECEPTIONIST
```

Current platform roles do not participate in organization user management.

---

## User–Clinic Relationship

Users and clinics have an intentional many-to-many relationship modeled with the `user_clinics` table.

```text
Users
    ↕
User Clinics
    ↕
Clinics
```

Design principles:

- A user may be assigned to zero, one, or many clinics.
- A clinic may have zero, one, or many users.
- Clinic assignment is independent of the user's role.
- Every organization user belongs to exactly one organization but may operate across multiple clinics within that organization.

### Clinic Assignment Lifecycle

Clinic assignments are managed independently from the user lifecycle.

- Creating a user does not require assigning them to a clinic.
- Creating a clinic does not require assigning any users.
- Clinic assignments may be created, updated, or removed at any time.
- User-clinic assignments use soft deletion to preserve historical relationships.
- Permanent deletion (purge) may be introduced in the future to satisfy business or regulatory requirements.

### Operational Scope

A user's role determines **what** they are allowed to do. Clinic assignments determine **where** they are allowed to perform those actions. These are independent concepts and should remain decoupled.

---

## Authorization

`users.role_id` is the single source of truth for application authorization; role information must not be duplicated in additional tables.

Authorization decisions are centralized in `authorization.service.ts`. API routes must never perform role comparisons or contain business authorization logic, and business services must never compare role names directly. New reusable capability methods must make authorization decisions rather than exposing role checks.

Examples:

- `canCreateUser()`
- `canManageUsers()`
- `canCreateClinic()`
- `canManageClinic()`
- `canAssignUserToClinic()`

This capability-based abstraction allows authorization to evolve beyond the current role-based model without changing consumers. Future modules requiring clinic-based access should use a shared authorization helper, such as `getAccessibleClinicIds(userId)`, instead of implementing clinic access logic independently.

---

## Development Workflow

Schema changes are developed locally first.

Workflow:

```
Modify local database
        ↓
Test locally
        ↓
Generate migration using supabase db diff
        ↓
Review migration
        ↓
Push to remote
```

Do not manually edit production databases.

---

# Frontend Engineering Guidelines

The frontend architecture and conventions (project structure, client authorization, forms, design system, app shell, frontend testing, error handling and types) live in **[docs/frontend.md](docs/frontend.md)**. Read that file before any work under `src/app/`, `src/features/`, `src/components/`, `src/contracts/`, or `src/lib/`.

The user experience those conventions serve — information architecture, user flows, screen inventory, interaction/state conventions — is defined in **[UX.md](UX.md)**. `docs/frontend.md` owns the *how* (architecture); `UX.md` owns the *what* and *why* (experience).

---

# Architecture Decision Records (ADR)

Significant architectural decisions must be documented as Architecture Decision Records (ADRs).

Create or update an ADR whenever a decision:

- Introduces a new architectural pattern.
- Changes an existing architectural pattern.
- Changes service boundaries.
- Changes persistence strategy.
- Changes authorization strategy.
- Introduces new cross-cutting infrastructure.
- Changes transaction or consistency strategy.

Minor implementation details, bug fixes, refactoring, naming changes, or isolated optimizations do not require ADRs.

Accepted ADRs are immutable. If an architectural decision changes, create a new ADR that supersedes the previous one rather than modifying historical ADRs.

The implementation plan should reference any new or updated ADRs whenever architectural decisions are introduced.

Frontend and UX ADRs are stored one per file in [docs/adr/](docs/adr/README.md) and indexed in that directory's `README.md`; broader project/domain decisions are recorded in the *Project Decisions* section above.

---

## Architecture Philosophy

Prefer the simplest design that satisfies the current business requirements.

Do not introduce abstraction for hypothetical future requirements.

Model the business domain as it exists today.

Refactor only when business requirements change.

---

# Supabase Query Conventions

Repository methods should use the following conventions:

## Lookup Methods

Use:

```ts
.maybeSingle()
```

for methods beginning with:

- find...
- get...

These methods should return:

- Entity
- null

when no matching row exists.

---

## Insert / Update / Delete Methods

Use:

```ts
.single()
```

These methods are expected to affect exactly one row and should return that row.

---

## List Methods

Return arrays.

Do not use:

```ts
.single()
```

or

```ts
.maybeSingle()
```

---

## Error Handling

If Supabase returns an unexpected database error:

```ts
if (error) {
    throw error;
}
```

Do not inspect PostgREST error codes when `maybeSingle()` can naturally represent the "not found" case.

---

# Database Functions for Atomic Operations

Some operations touch multiple rows across tables and must succeed or fail as a single unit, in a way a sequence of Supabase client calls cannot guarantee (e.g. a session-consumption write that must never leave a usage record without its corresponding balance update, even under concurrent access).

For these cases, implement a `plpgsql` function in a migration and call it from the repository layer via `supabase.rpc(...)`, instead of issuing multiple sequential writes from the application.

Rules:

- Default to `security invoker` (the caller's own RLS-authenticated role) so RLS policies still apply to every statement inside it. Use `security definer` only when a legitimate, already-authorized caller (per the Service layer's own authorization check) would otherwise be blocked by a table-level RLS policy that is deliberately narrower than this one specific operation — e.g. a role that may trigger a tightly-scoped counter update but must not gain free-form `UPDATE` on that table via raw client access. A `security definer` function must still take its scoping identifiers (organization ID, etc.) as parameters sourced from the caller's own resolved identity in the service layer, never from unvalidated client input, and must have `EXECUTE` explicitly revoked from `PUBLIC` and granted only to the roles that need it.
- The function is limited to structural-integrity guarantees a single client round-trip can't provide — atomic multi-row writes and row-locked invariant checks (`for update`). It must not encode business-rule branching or workflow decisions; those stay in the Service layer, exactly as with any other business rule.
- Primary validation and user-facing error messages still belong in the calling service, checked *before* invoking the function. The function's internal checks are a concurrency safety net, not the primary validation path — the same role a `CHECK` constraint already plays elsewhere in this schema.
- The function raises a plain `raise exception` with a fixed, matchable message on its internal safety-net failures; the calling repository/service maps that message back to the same `AppError` code the pre-check would have thrown, so callers never see a raw Postgres error.
- Repository functions that call `.rpc(...)` follow the same conventions as any other repository method (check `error`, throw on unexpected failure, return `data`) — invoking a stored function is still a persistence concern, not business logic.
- A function that both enforces a structural-integrity invariant and separately writes a derivable business value (for example, setting a status alongside a counter update) is a signal the value should be derived on read instead — removing that write, rather than defending it, is usually the fix.

---

# Query / Command Separation

The project follows a CQRS-inspired separation of responsibilities.

## Query Operations

Read-only operations should:

- Live in the appropriate domain service.
- Not modify application state.
- Not trigger side effects.
- Be callable directly from API routes.

Examples:

- List endpoints
- Detail endpoints
- Search
- Filtering
- Pagination

---

## Command Operations

State-changing operations should:

- Execute through the application (orchestration) service.
- Coordinate all participating domain services.
- Execute validation.
- Manage consistency.
- Execute compensation logic when required.

Examples:

- Organization bootstrap
- User onboarding
- User activation
- User deactivation
- User offboarding
- Role changes
- Clinic creation
- User-clinic assignments

---

# External System Consistency

PhysioCare integrates with external systems (for example Supabase Auth) that cannot participate in PostgreSQL transactions.

Distributed transactions are **not** used.

Instead, workflows must use **Compensating Actions**.

Guidelines:

- Perform every possible validation before invoking external systems.
- Execute external operations only after all validations succeed.
- If a later database operation fails, execute the inverse external operation whenever possible.
- Surface failures only after attempting compensation.

Examples:

- User Activation
- User Deactivation
- Organization Bootstrap

If compensation cannot be performed safely, the implementation must document why and ensure failures leave the system in the safest possible state.

---

# Soft Delete Strategy

The application uses soft deletion as the default lifecycle strategy.

Rules:

- Records should be soft deleted using `deleted_at`.
- Soft deleted records remain part of system history.
- Reactivation should reuse existing records whenever possible.
- Hard deletes should be exceptional administrative operations.

## Where liveness is enforced

Liveness is enforced at the **repository layer**, not in RLS. No policy filters its own table's `deleted_at`; every repository read of a soft-deletable table carries an explicit `.is("deleted_at", null)`. The division is: **RLS enforces tenancy and role; the service and repository layers enforce lifecycle.**

Putting liveness in RLS would place the rule in two places that must then agree, and would make any legitimate read of deleted rows — audit, export, restore, uniqueness checks against retired records — a policy change rather than a query change. ADR-0011 records what a boundary living only in RLS costs: it *filters* rather than *errors*, so a disagreeing predicate produces an empty result instead of a refusal.

A read that genuinely needs deleted rows declares itself in the exemption list in `tests/unit/soft-delete-liveness.test.ts`, keyed `file#function` with a one-line reason. The guard fails on any unfiltered read that is not declared, so the list is the complete inventory of where lifecycle filtering is deliberately absent — adding to it is a decision, not a workaround. Entries marked `PENDING_R9` are reads that were unfiltered before the guard existed and have not yet been judged; they are not claims that the absence is correct.

---

# Audit Logging

Every create, lifecycle transition, and delete in a phase's own surface area writes an audit entry. Coverage before F5 was a deliberate starter set (D15: enough to validate the mechanism); F5 covers everything it builds, and the pre-F5 features are retrofitted in R9.

Rules:

- **Payload is a full row snapshot.** `newData` on create, both `oldData` and `newData` on update, `oldData` on delete. Every one of these operations already resolves the row before writing, so the snapshot is the value in scope — no extra query.
- **`entityName` is the table name** (`patients`, `packages`, `patient_packages`, `patient_records`), matching the existing sites.
- **Action strings distinguish kinds of change.** Generic CRUD verbs (`create`, `update`, `delete`) mean fields changed; domain verbs (`activate`, `deactivate`, `cancel`, `extend_validity`, and `subscription.service.ts`'s own set) mean a lifecycle transition happened. An auditor filtering one `entityName` can then tell them apart without diffing snapshots. Where one function serves two intents, it emits the verb for the intent that actually ran.
- **A failed audit never fails the operation.** The mutation has already committed and no transaction spans both writes, so use `recordAuditLogSafe`, which swallows and warns. `recordAuditLog` still throws and is left for the pre-F5 call sites until R9.
- **The warning carries identifiers and the error only — never the payload.** Logs are not access-controlled; `audit_logs` is (Owner/Admin). A full row snapshot of a patient or a patient record carries personal and clinical data and must not be spilled into stdout.
- **Do not put an audit call inside a `try` whose `catch` means something else.** `createPatient`'s retry loop interprets any unique violation as a patient-code collision; an audit insert in that block would have been retried and produced a second patient row.

---

# Partial Unique Index Convention

For entities supporting soft deletion, uniqueness should be enforced only for active records.

Avoid:

```sql
UNIQUE (...)
```

Prefer:

```sql
CREATE UNIQUE INDEX ...
WHERE deleted_at IS NULL;
```

This convention applies to future entities supporting soft deletion.

---

# Test-Driven Development (TDD)

## Policy

All new features and bug fixes **must follow a Test-Driven Development workflow** unless explicitly instructed otherwise. A test for a behavior is written before the production code that satisfies it, and is observed failing for the stated reason before that code exists.

This section states the *policy* — that TDD is mandatory and what "complete" means under it. **The cycle itself is not defined here.** How to run it — slice boundaries, the tracer-bullet first pass, the per-cycle checks, when to refactor — belongs to the `tdd` skill in `.claude/skills/tdd/`, which is the authority on procedure. Follow that skill when implementing; this section is what it is accountable to.

Production code is **not considered complete** until the corresponding automated tests exist and pass.

Tests should be developed and committed alongside the production implementation as part of the same change.

A feature or bug fix is not considered complete if the implementation exists without its corresponding automated tests.

Every bug discovered in production should first be reproduced with an automated failing test before implementing the fix.

---

## Testing Requirements

Every feature should include tests appropriate to its scope.

Depending on the implementation, this includes:

- Unit tests
- Integration tests
- API endpoint tests
- Validation tests

---

# Phase Completion Checklist

Before a development phase is considered complete:

- Implementation follows the approved architecture.
- Database migrations are created and reviewed.
- `src/types/database.ts` is regenerated against the migrated schema (`npm run db:types`) before any compile-time check below is run against it.
- Validation schemas are implemented.
- Repository layer is complete.
- Service layer is complete.
- Authorization is implemented.
- RLS policies are implemented and verified where applicable.
- TypeScript compilation passes.
- Linting passes with zero errors.
- Production build passes.
- Unit, API and component tests pass.
- Integration tests pass.
- Documentation is updated if new architectural decisions were introduced — `AGENTS.md` (core/backend conventions), `docs/frontend.md` (frontend conventions), and a new record in `docs/adr/` plus its index row.

The mechanical checks in that list — types regeneration, TypeScript, lint, tests, and build — are run by **`npm run verify`**; `npm run verify:full` adds the integration and E2E lanes. Use it rather than running them by hand.

It runs the steps in the order above, stops at the first failure, and reads each step's own exit code, so no step's status can be masked by piping it through another command and nothing can compile against types that were regenerated afterwards. Add `--quiet` (or use `npm run verify:quiet`) to send each step's full output to `.verify.log` and print only a status line per step — the form to use when an agent is running it, since every line of tool output is context. A step whose environment prerequisite is missing — no local Supabase stack — is reported as **skipped** rather than passed, and the run is recorded as incomplete. The remaining checklist items are judgment calls and stay manual.

---

# Frontend Decision Records

Accepted frontend and UX ADRs live in **[docs/adr/](docs/adr/README.md)**, one file per record, indexed by number, title, scope, and status. The log is append-only and immutable per the ADR convention above.

Read the index, then only the records the current increment touches — do not load the whole log by default. Broader project/domain decisions remain in *Project Decisions* above.

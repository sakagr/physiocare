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
- `appointment-workflow.service.ts` orchestrates an appointment status transition together with its cross-domain side effect on package session consumption (Appointment domain + Patient Package domain). Neither `appointment.service.ts` nor `patient-package.service.ts` calls the other directly.

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

---

## Subscription Principles

Organization onboarding and subscription management are separate business workflows.

The following rules apply:

- `subscription_plan_id` is nullable.
- New organizations are created without a subscription plan.
- `subscription_status` defaults to `inactive`.
- Trial or paid subscriptions begin only when explicitly activated by the business workflow.
- Organization onboarding must not contain subscription or billing logic.

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
- `PLATFORM_SUPPORT`
- `PLATFORM_SALES`
- `PLATFORM_BILLING`

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
PLATFORM_SUPPORT
ORG_OWNER
ORG_ADMIN
ORG_PHYSIOTHERAPIST
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
- If lost, it must be reset through the password reset workflow.

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

These guidelines define the architecture and conventions for the PhysioCare frontend. They complement the backend guidelines above. The frontend roadmap (phases F0–F10 in `ROADMAP.md`) implements them.

The user experience these conventions serve — information architecture, user flows, screen inventory, and interaction/state conventions — is defined in [UX.md](UX.md). This section owns the *how* (architecture); `UX.md` owns the *what* and *why* (experience).

## Foundational Principle

The frontend is an independent application that consumes the backend solely through its published API contract. The backend remains the single source of truth for business rules, authorization, and validation; the frontend owns user experience, presentation, and interaction. Every client-side check — capability gating, form validation — is advisory, existing to improve UX, never to enforce. Alignment with the contract is maintained structurally: request/response types are generated from the API, so drift surfaces at compile time rather than in production.

The conventions below are concrete applications of this principle.

## Backend Communication

- The frontend consumes the `/api` routes over HTTP as the single contract, for both reads and writes.
- Do not use Server Actions that call the service layer directly, and do not call services directly from Server Components. That would create a second authorization path that can drift from the route handlers.
- Mutations are HTTP requests to the command routes, which already enforce authorization and compensation.
- Promoting a hot read to a direct service call is a deliberate, documented exception — never the default.

## Rendering and Server State

- Client-first: data is fetched client-side against `/api` with TanStack Query as the server-state manager.
- Server Components own the app shell, layouts, route structure, and guards.
- Client (UI-only) state uses `zustand`; server state uses TanStack Query. Keep the two separate.
- Hybrid rendering (server prefetch + hydration) is available as an additive, route-local promotion for heavy routes. It is not implemented by default and must never change the component model.
- Two seams are mandatory from the start so hybrid stays additive:
  - An **isomorphic API client** that reaches `/api` identically on server and client, forwarding the session cookie via `next/headers` when run server-side.
  - Centralized `queryOptions()` factories per resource (stable keys + query function), consumed identically by `useQuery` and by server prefetch. Query keys are never inlined in components.
- On the server, the QueryClient is per-request (wrapped in React `cache()`).
- UI preferences that affect the server-rendered shell (for example the primary navigation's collapsed state) persist in a cookie, read during the server render via `next/headers` so the shell paints in its correct state. `localStorage` is not used for these — it is client-only and would render the default first, then correct itself after hydration. Preferences that do not affect server-rendered output may stay in client state.

## Project Structure

- Route groups: `(auth)` for the shared front door (`/login`, `/reset-password`, `/auth/callback`); `(platform)/platform/…` for the console and API tooling; `(org)/app/…` for the organization experience. Each group's `layout.tsx` mounts the shell and enforces the role-group guard; wrong-namespace access is bounced by the layout, not by per-page checks.
- Non-route code is feature-based: `src/features/<domain>/` per backend domain, holding `queries.ts` (queryOptions factories), `api.ts` (typed `/api` calls), `schemas.ts` (zod form schemas), components, and hooks. Route segments stay thin and compose feature modules.
- Shared code: `src/lib/` (isomorphic API client, QueryClient setup, auth helpers) and `src/components/ui/` (design-system primitives).
- The frontend is feature-based (not layer-based like the backend) for UI domain cohesion — a screen's queries, mutations, schema, and components belong together.
- Each feature exposes a curated `index.ts` barrel (explicit named exports, never `export *`) as its public surface. Cross-feature imports go through the barrel, never deep paths, enforced by an ESLint boundary rule. Prefer composing features at the route level over lateral feature-to-feature imports. Dependencies point down, never sideways: two peer features reaching into each other is a signal to extract the shared piece into a lower layer.
- Component ownership: generic, domain-blind UI lives in `src/components/ui/`; domain-carrying components are owned by the feature whose domain they express and shared via its public surface. There is no generic "shared business components" bucket.
- File growth: start single-file (`schemas.ts`, `queries.ts`, `api.ts`); promote to a folder with one file per operation when it grows.

## Client Authorization

- The client gates on capabilities, not roles. Components must not compare role names.
- The client gate is advisory UX only. The route handlers' `withCapability` checks remain the security boundary.
- `GET /api/users/me` returns identity, role, group, and org/clinic context, plus a coarse capability map computed server-side. The client consumes these flags and never derives them from the role.
- Contextual, per-resource capabilities are not global flags: rely on the server and graceful 403 handling, and add per-item permission hints to list/detail responses only where showing-then-failing is a poor experience.
- Enforcement: route/navigation gating via the route-group layout guard and capability-filtered navigation; within-frame gating via a `useCan()` hook / `<Can>` wrapper backed by a current-user context populated once from `/me`.

## Forms and Validation

- react-hook-form for form state, zod for schemas, wired via `zodResolver`.
- Client form schemas are feature-owned and separate from the server validators, tailored for form UX (UI-only fields, tailored messages).
- Never import `src/server` validators into client code.
- Drift is caught at the type level: a form's submitted payload must satisfy the contract-generated request type.
- Server validators remain the authoritative runtime validation; client validation is advisory.

## Design System

- Mantine is the single design system and single token source. Tailwind is not used for application UI.
- One theme object defines colors, typography, spacing, and radii. V1 ships a light color scheme only; the theme is structured so a dark scheme can be added later via Mantine's color scheme without reworking components.
- Build `src/components/ui` composites only where they add application convention; use Mantine components directly otherwise. Do not wrap one-to-one.
- Custom styling uses Mantine CSS modules and style props, not sprawling inline styles.
- Icons use a single set: Tabler.

### Shared UI primitives

The composites F0 seeds in `src/components/ui`. Each one exists because it encodes a convention from `UX.md` that would otherwise be re-implemented — and drift — in every phase. All are generic and domain-blind; anything domain-carrying belongs to its feature.

| Primitive | Convention it encodes | Built on |
| --- | --- | --- |
| `PageHeader` | Destination title, optional one-line context, at most one primary action; parent and return path for a nested destination. Primary action relocates on narrow widths. | Mantine layout + `Button` |
| `EmptyState` | Names what would appear here and offers the primary create action where permitted. | Mantine `Stack`, `Text`, `Button` |
| `DataState` | The loading / empty / error triad for any data-driven region: skeletons matching the eventual layout, empty state, and a scoped inline error with retry. | `Skeleton`, `Alert`, `EmptyState` |
| `ConfirmDialog` | Destructive confirmation that names the target and its consequence, with the action's verb and danger styling on the confirm button. | Mantine `Modal` |
| `FormDialog` | Create/edit shell: titled dialog, footer actions with the primary right, submit progress, and the unsaved-changes guard. | Mantine `Modal` |
| `DetailDrawer` | Entity detail that keeps its list in view; consistent header, close affordance, and layering rules. | Mantine `Drawer` |
| `StatusBadge` | A status rendered as a semantic role (success / warning / danger / info / neutral) carrying both color and text, never colour alone. | Mantine `Badge` |
| `Can` | Capability gating inside a surface — hides or disables an action rather than showing it and failing. | current-user context |

Domain status → semantic role mapping (appointment, payment, package) lives in the owning feature and is passed to `StatusBadge`; the primitive itself knows no domain.

Use Mantine **directly** for everything else — `Button`, inputs, `Select`, `Table`, `Card`, `Tabs`, `Menu`, `Pagination`, `Tooltip`, `Avatar`, and the notifications system for toasts. Wrapping these adds nothing.

The responsive **collection** (toolbar plus the table↔card rendering) is deliberately *not* seeded as a primitive. Its shape is still settling per destination; build it inside the first feature that needs it and extract a shared composite once two or three exist and agree.

## App Shell and Navigation

- The three shells (`OrgShell`, `PlatformShell`, and the `(auth)` centered layout) live in `src/components/shell/`. This is application furniture, distinct from `src/components/ui/`, which holds the domain-blind design-system primitives.
- The primary navigation is **data, not JSX**: `NAV_ITEMS` declares each destination with the capability that reveals it, and `buildNavSections()` is a pure function from capability tokens to display sections. The rendered nav is a thin projection of its output. This is what makes "the client never compares role names" a testable property rather than a convention.
- Only top-level destinations are nav items. Child routes and contextual surfaces are reached from within a destination (ADR-0001).
- Shell preferences that affect server-rendered output (nav collapsed state, current clinic) persist in cookies named in `shell-preferences.ts`, read in the route-group layout via `cookies()` and passed down as initial state. Never `localStorage` — it would paint the default first and correct itself after hydration.
- `zustand` remains reserved for UI-only state that does *not* affect the server render; nothing in the shell needs it today.

## Frontend Testing

- Component tests are the verification gate for UI work, using the jsdom lane of the Vitest config (`tests/components/**`, `*.test.tsx`).
- Every component test renders through `renderWithProviders` (`tests/helpers/render.tsx`), which mounts the same provider tree as the application — theme, QueryClient, current-user context — with `env="test"` so Mantine transitions and portals do not interfere. Identity comes from the `CurrentUser` fixtures in `tests/helpers/current-user.ts`, whose per-role capability sets mirror what `me.service.ts` computes.
- **What component tests can and cannot prove:** they cover logic and DOM — capability filtering, state machines, accessible names and roles, ARIA state. They cannot prove *visual* responsiveness: Mantine's `visibleFrom`/`hiddenFrom` and breakpoint collapse are CSS media queries, which jsdom does not evaluate. Viewport-accurate verification is manual until the F10 responsive pass.

## Error Handling and Types

- The isomorphic API client is the single place that parses the `{ error, code }` response envelope and throws a typed `ApiError` (`code`, `message`, `status`). Nothing downstream hand-parses responses.
- One code→behavior mapping module mirrors the backend `ErrorCodes`, mapping each code to a default handling behavior (toast, inline field errors, redirect to login, forbidden view) with its message as one facet, overridable per screen. Cross-cutting cases (401, network) go through TanStack Query's cache-level `onError`.
- 400 validation errors (with `details`) are mapped back to react-hook-form fields via `setError`.
- Frontend types derive from the API contract, not the database. `src/types/database.ts` stays server-only and never crosses into client code. Request/response types are generated from the OpenAPI spec (phase F2); form value types come from `z.infer` on the client form schemas; error codes are shared or generated from the backend `ErrorCodes`.

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

## Development Workflow

All new features and bug fixes **must follow a Test-Driven Development (TDD) workflow** unless explicitly instructed otherwise.

The expected development sequence is:

1. Define or update the implementation plan.
2. Identify the required test scenarios.
3. Implement automated tests.
4. Verify that the tests fail for the expected reason.
5. Implement production code.
6. Refactor while keeping tests passing.
7. Execute the complete verification suite.

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
- Validation schemas are implemented.
- Repository layer is complete.
- Service layer is complete.
- Authorization is implemented.
- RLS policies are implemented and verified where applicable.
- TypeScript compilation passes (`npx tsc --noEmit`).
- Linting passes with zero errors (`npx eslint .`), confirmed via eslint's own exit code — never a value piped through another command (e.g. `| tail`), which masks the real status.
- Production build passes (`npm run build`).
- Integration tests pass.
- API tests pass where applicable.
- Documentation (`AGENTS.md` and ADRs) is updated if new architectural decisions were introduced.

---

# Frontend Decision Records

Accepted frontend and UX ADRs, append-only and immutable per the ADR convention above. Broader project/domain decisions live in the *Project Decisions* section; this log is scoped to the frontend track (F0–F10) and uses ADR codes. UX ADRs carry their full design detail in `UX.md` and are referenced from it.

## ADR-0001 — Navigation & Surface Model

- **Status:** Accepted (2026-07-17)
- **Scope:** UX / Frontend
- **Context:** The frontend (F0–F10) needs a consistent rule for when a screen becomes a routed page versus contextual UI. Unbounded routing produces deep breadcrumb chains, loss of working context, and a steeper learning curve.
- **Decision:** Dedicated routes are a scarce resource, reserved for **independent destinations** — workspaces users navigate to for focused work. All other surfaces (create/edit, entity detail, short self-contained tasks, child resources without their own workspace, frequent quick actions) render as **contextual UI** — dialogs, drawers, tabs, or inline sections — layered over their originating context. A child that is itself a substantial workspace (e.g. a consultation) may still earn a route.
- **Consequences:** The organization app resolves to ~13 destinations; details and actions are hosted surfaces rather than routes. Navigation stays shallow and working context is preserved. New screens must justify a route against the destination test or default to contextual UI.
- **Reference:** `UX.md` → *Navigation & Surface Model* (full design detail and the screen inventory).

## ADR-0002 — Frontend UI Testing Framework

- **Status:** Accepted (2026-07-26)
- **Scope:** Frontend
- **Context:** The frontend track (F0–F10) needs an automated verification gate for UI work from its first increment, not retrofitted at F10. The repository already runs Vitest for server tests, but only in a Node environment with no way to render a component.
- **Decision:** React Testing Library with `@testing-library/jest-dom` and `@testing-library/user-event`, running on the existing Vitest toolchain in a **jsdom** lane selected by `environmentMatchGlobs` (`tests/components/**` and any `*.test.tsx`); the Node lane is unchanged. A single global setup file registers the jest-dom matchers, runs RTL cleanup, and installs the browser API shims Mantine requires (`matchMedia`, `ResizeObserver`, `scrollIntoView`), all guarded so the Node lane is untouched. Every component test renders through a shared `renderWithProviders` helper that mounts the real provider tree. E2E (Playwright) remains a F10 concern and is deliberately not brought forward.
- **Consequences:** One test runner and one config for the whole codebase. Component tests prove logic, DOM structure, and accessibility semantics; they cannot prove CSS-media-query behavior, so viewport-accurate responsive verification stays manual until F10. A UI change without a component test is incomplete.

## ADR-0003 — Current-User Contract as the Single Client Identity Source

- **Status:** Accepted (2026-07-26)
- **Scope:** Frontend / Authorization
- **Context:** The client needs to know who the user is and what they may reach, without re-deriving authorization rules that the backend already owns — and without leaking role names into components, which would make every future role change a UI change.
- **Decision:** `GET /api/users/me` returns identity, role (system name plus display name), group (`platform` | `org`), organization, accessible clinics, and a **coarse capability map computed server-side**. The map is keyed by **contract-owned capability tokens** (`domain:action`, defined once as the `Capability` union in `src/types/contracts/me.ts`), deliberately decoupled from the backend predicate names so `authorization.service.ts` can be renamed or recomposed without changing the wire format or any client. `me.service.ts` maps each token onto its internal predicate. Clients consume tokens and never compare role names; the contract module is hand-authored now and is the seam F2's OpenAPI generation replaces.
- **Consequences:** Four purpose-specific predicates were added to `authorization.service.ts` (`canOverseeAppointments`, `canOverseeAttendance`, `canManageOrganizationSettings`, `canViewReports`) because the existing broad `canView*` read gates admit any active member and would over-expose the navigation relative to the UX navigation table. The capability map is the navigation/coarse set only — contextual, per-resource capabilities stay server-side and surface as graceful 403 handling. Client gating remains advisory; `withCapability` in the route handlers is the security boundary.

## ADR-0004 — Isomorphic API Client and Error Envelope Parsing

- **Status:** Accepted (2026-07-26)
- **Scope:** Frontend
- **Context:** The frontend consumes `/api` from both Server Components and the browser. Without one client, each context would grow its own fetch, its own envelope parsing, and its own error copy — and hybrid rendering later would require rewriting components rather than adding a prefetch.
- **Decision:** One client (`src/lib/api/client.ts`) reaches `/api` identically in both environments, resolving an absolute origin and forwarding the session cookie via `next/headers` when run server-side. It is the single place that parses the `{ error, code, details }` envelope and throws a typed `ApiError`. A companion code→behavior map (`src/lib/api/error-codes.ts`) is typed as a total `Record<ErrorCode, …>`, so adding a backend error code fails the build until the client decides how to present it. Cross-cutting failures (expired session, dead connection) are handled once at TanStack Query's cache level via a pure `error-policy` module; `forbidden` and `inline` are left to the screen that asked. Query keys are never inlined — each resource exposes `queryOptions()` factories.
- **Consequences:** Server prefetch is additive rather than a rewrite. Error copy lives in one place and is overridable per screen. A new backend error code cannot ship silently. 400 responses keep their `details` payload for mapping onto form fields via `setError`.

## ADR-0005 — Namespace Route Groups, Layout Guards, and the Pure Landing Resolver

- **Status:** Accepted (2026-07-26)
- **Scope:** Frontend / Authorization
- **Context:** Three audiences share one application: the shared front door, the platform console, and the organization app. Enforcing "who may be here" per page would scatter the rule and let a new page silently omit it; enforcing it in the proxy would make Next's Proxy an authorization layer, which its own documentation warns against.
- **Decision:** Three route groups — `(auth)` (no shell), `(platform)/platform/…`, `(org)/app/…` — each with a `layout.tsx` that resolves the current user server-side, applies the guard, and mounts its shell. The decision itself is two **pure functions** over `CurrentUser` (`resolveLanding`, `guardNamespace`) that return a redirect target or `null`, with no Next, Supabase, or cookie dependency. `getCurrentUser()` is wrapped in React `cache()` so one request shares a single `/me` fetch. A single root layout is retained (`<html>`/`<body>`, theme, providers): multiple root layouts would force a full page load when moving between namespaces. Wrong-namespace access bounces to the user's own home, never to a dead end. The proxy keeps only session refresh and coarse redirects, sending signed-in users at the front door to `/`, where the landing resolver decides.
- **Consequences:** The whole redirect matrix is unit-tested against fixtures with no session or database. A new page inherits its guard from the group it is placed in, and cannot forget it. Pages never repeat the check.
## ADR-0006 — Shared UI Primitives: Conventions Encoded as API

- **Status:** Accepted (2026-07-27)
- **Scope:** Frontend / UX
- **Context:** `UX.md` defines conventions every surface must honor — a destructive confirmation names its target and consequence, a loading state uses layout-matched skeletons rather than a spinner, a status carries text as well as color. Written as guidelines, each one is re-decided per screen and drifts across ten phases. The eight primitives in `src/components/ui` exist to hold these conventions, and the question is how firmly.
- **Decision:** Where a convention can be made **structurally required** by the component's type signature, it is — the primitive makes the correct thing the only expressible thing, not merely the documented one:
  - `ConfirmDialog` requires `target`, `consequence`, and a verb `confirmLabel`, so "Are you sure? / OK" cannot be rendered through it.
  - `DataState` requires a `skeleton` node, so "bare spinner" is not the easy path; no layout presets ship in F0 (they belong with the collection composite, deferred to its first consumer).
  - `StatusBadge` requires a `label`, so a status can never be color alone.
  - `PageHeader` accepts at most one `primaryAction`, so "two primary buttons" is not expressible.
  All eight are **domain-blind**: the domain status → semantic role mapping lives in the feature that owns the domain and is passed in. Capability gating is not built into primitives — callers withhold an action or wrap it in `<Can>`, so there is exactly one gating mechanism. `Can` is backed by the current-user context in `src/lib/auth/`, not by a feature, so a shared primitive depends downward on shared infrastructure rather than sideways on a feature.
- **Consequences:** Primitive APIs are slightly stricter than a thin Mantine wrapper would be, and callers must supply real copy and a real skeleton. In exchange the conventions cannot quietly erode: violating one is a type error rather than a review comment. Two conventions resist type-level encoding and remain **documented invariants**: *no drawer over a dialog* (enforcing it would require shared mutable overlay state across primitives, which costs more than the mistake it prevents — a dialog over a dialog, as `FormDialog`'s discard guard uses, is permitted and is the same task's guard), and *Undo on a soft delete*, which belongs to the success toast the caller fires, not to the confirmation.
- **Related:** `StatusBadge` renders Mantine's `light` variant — in Mantine 9, shade 9 text on a shade 1 surface, independent of `theme.primaryShade`. `tests/unit/semantic-contrast.test.ts` measures every role in `SEMANTIC_ROLES` against WCAG AA in both that pairing and white-on-`shade[primaryShade]`; changing `primaryShade` or passing an explicit shade (`color="warning.6"`) re-opens that audit and fails the suite if it drops below AA.

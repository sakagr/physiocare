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
- Tailwind CSS
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

- suspended
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
- Production build passes (`npm run build`).
- Integration tests pass.
- API tests pass where applicable.
- Documentation (`AGENTS.md` and ADRs) is updated if new architectural decisions were introduced.
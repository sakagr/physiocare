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

Repositories are responsible only for data access.

Repositories may:

- Read database tables.
- Insert rows.
- Update rows.
- Delete rows.
- Execute simple queries.

Repositories must not:

- Contain business logic.
- Send emails.
- Call external APIs.
- Make authorization decisions.
- Perform orchestration.

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

Services implement business capabilities. Complex business workflows are coordinated by dedicated orchestration services.

Services may:

- Coordinate repositories.
- Call other services.
- Call external systems through dedicated service abstractions.
- Implement business rules.
- Perform orchestration.

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

Validator naming convention:

- validate...
- parse...

Examples:

```ts
validateCreateOrganizationInput()
parseAppointmentRequest()
```

---

# Authentication

Supabase Auth is treated as an external authentication provider.

It is not treated as another database table.

The Auth Service is the abstraction over Supabase Auth. It owns all authentication identity operations (including invitations, as they belong to the authentication subsystem rather than the business domain).

Authentication-related operations belong in:

```
src/server/services/auth.service.ts
```

The Auth Service is the only layer that should interact directly with Supabase Auth, including:

- inviteUser()
- resendInvitation()
- deleteUser()
- disableUser()
- enableUser()
- updateUser()
- resetPassword()

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

## User-Clinic Relationship

Users may belong to multiple clinics.

This is modeled using the `user_clinics` table.

This many-to-many relationship is intentional and should be preserved.

```text
Users
    ↕
User Clinics
    ↕
Clinics
```

---

## Authorization

`users.role_id` is the single source of truth for application authorization.

Role information must not be duplicated in additional tables.

Authorization decisions should be based on `users.role_id`.

---

## Authentication

Supabase Auth manages authentication.

The `public.users` table manages application user information.

These represent different concerns and should remain separate.

Authentication operations belong in:

```
src/server/services/auth.service.ts
```

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
Create Application User
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

# Repository Implementation Style

Repository methods should follow a consistent implementation pattern.

Example:

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

---
# Service Orchestration

Complex business workflows should be orchestrated by a dedicated service.

Individual services should implement a single business capability.

Example:

Organization onboarding is orchestrated by:

```
organization.service.ts
```

which coordinates:

- Auth Service
- User Service
- Repositories

Individual services should not orchestrate other business workflows.
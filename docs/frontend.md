# Frontend Engineering Guidelines

> Part of the PhysioCare engineering guidelines. The core conventions live in [AGENTS.md](../AGENTS.md); the experience they serve is defined in [UX.md](../UX.md); accepted frontend decisions are in [docs/adr/](adr/README.md).

These guidelines define the architecture and conventions for the PhysioCare frontend. They complement the backend guidelines above. The frontend roadmap (phases F0–F10 in `ROADMAP.md`) implements them.

The user experience these conventions serve — information architecture, user flows, screen inventory, and interaction/state conventions — is defined in [UX.md](../UX.md). This section owns the *how* (architecture); `UX.md` owns the *what* and *why* (experience).

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
- `src/contracts/<domain>.contract.ts`: client-safe zod response schemas, one module per backend domain, never importing `src/server/**` or `src/types/database.ts`. The single source both the generated OpenAPI spec and any TS type derive from (phase F2, ADR-0008) — `src/types/contracts/me.ts` re-exports `z.infer`s of `src/contracts/me.contract.ts` rather than hand-authoring a parallel shape.
- `src/server/openapi/`: the OpenAPI generation pipeline (phase F2, ADR-0008) — `registry.ts` (the hand-authored route→spec binding), `generate.ts` (document assembly from `z.toJSONSchema()`), and the committed `openapi.json` artifact, regenerated via `npm run openapi:generate` (`scripts/generate-openapi.ts`).
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

The composites in `src/components/ui` — F0 seeds the first nine, later phases add more where a convention repeats across features. Each one exists because it encodes a convention from `UX.md` that would otherwise be re-implemented — and drift — in every phase. All are generic and domain-blind; anything domain-carrying belongs to its feature.

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
| `ForbiddenState` | The forbidden frame: names what was refused and always carries a way back, so a 403 is never a dead end. | Mantine `Stack`, `Text`, `Button` |
| `RevealOnce` (F3) | A secret shown exactly once, then never again — masked by default with a reveal toggle and copy affordance, dismissal routed through `ConfirmDialog` so it cannot be dismissed without naming the consequence. Domain-blind: displays *a secret*, not *a password*. | `PasswordInput`, `CopyButton`, `ConfirmDialog` |

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
- **E2E (Playwright), per-module from F3 onward.** ADR-0002 deferred Playwright to F10 as a lump-sum addition; in practice, F3 brought it forward as another test lane rather than a separate architectural decision — the formal ADR recording browser-based testing as a first-class part of the stack still lands at F10, once the pattern has run across enough phases to describe it properly, but every F-phase from F3 on writes its own E2E specs as part of that phase's own TDD work, not deferred to the end. Its own runner and lifecycle (`playwright.config.ts`, `tests/e2e/`), seeded directly against the local Supabase stack the same way `tests/helpers/integration-context.ts` seeds the Vitest integration lane, scoped to what only a real browser proves — actual session cookies and sign-in, real navigation, CSS media queries, the clipboard — never a re-cover of what the jsdom component lane already asserts. Run via `npm run test:e2e`; requires the local stack running and `next dev` (started automatically).

## Error Handling and Types

- The isomorphic API client is the single place that parses the `{ error, code }` response envelope and throws a typed `ApiError` (`code`, `message`, `status`). Nothing downstream hand-parses responses.
- One code→behavior mapping module mirrors the backend `ErrorCodes`, mapping each code to a default handling behavior (toast, inline field errors, redirect to login, forbidden view) with its message as one facet, overridable per screen. Cross-cutting cases (401, network) go through TanStack Query's cache-level `onError`.
- 400 validation errors (with `details`) are mapped back to react-hook-form fields via `setError`.
- Frontend types derive from the API contract, not the database. `src/types/database.ts` stays server-only and never crosses into client code. Response types derive from `src/contracts/<domain>.contract.ts` — client-safe zod schemas that are the single source both the generated OpenAPI spec and the TS types (`z.infer`) derive from (phase F2, ADR-0008), so drift between spec and type is structurally impossible rather than merely caught. `src/types/contracts/me.ts` is the worked example: it re-exports `z.infer`s of `src/contracts/me.contract.ts` with no change to any consumer. Form value types come from `z.infer` on the client form schemas; error codes are shared or generated from the backend `ErrorCodes`.

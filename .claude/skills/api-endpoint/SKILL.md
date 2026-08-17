---
name: api-endpoint
description: Add or change a PhysioCare /api operation end to end — validator, repository, service, authorization, route handler, OpenAPI registry entry, contract response schema, and tests. Use whenever an increment adds a new endpoint, changes an existing one's request or response shape, or adds a method to an existing path.
---

# Adding an `/api` operation

An operation is not one file. It is a fixed vertical slice, and an incomplete slice
fails a gate that is easy to miss until `npm test` or `npm run build` runs. Work the
steps in order — the order is TDD's, not convenience's.

Read `AGENTS.md` → *Layer Responsibilities*, *Supabase Query Conventions*,
*Query / Command Separation*, and *Error Handling* before starting. If the operation
has a client surface, also read `docs/frontend.md`.

## The slice

| # | Layer | File | Skip when |
| --- | --- | --- | --- |
| 1 | Tests | `tests/integration/<domain>.test.ts`, `tests/api/…` | never |
| 2 | Validator | `src/server/validators/<domain>.validator.ts` | no body and no query |
| 3 | Repository | `src/server/repositories/<domain>.repository.ts` | reuses existing reads/writes |
| 4 | Authorization | `src/server/services/authorization.service.ts` | an existing predicate is exactly right |
| 5 | Service | `src/server/services/<domain>.service.ts` | never |
| 6 | Route | `src/app/api/…/route.ts` | never |
| 7 | Contract | `src/contracts/<domain>.contract.ts` | never — every response needs a schema |
| 8 | Registry | `src/server/openapi/registry.ts` | never — parity test enforces it |
| 9 | Client | `src/features/<domain>/{api,queries,schemas}.ts` | backend-only increment |

## Step notes

**1. Tests first.** Write the failing test before the production code and confirm it
fails for the expected reason (`AGENTS.md` → *Test-Driven Development*). Integration
tests seed against the local Supabase stack via `tests/helpers/integration-context.ts`
and run with `npm run test:integration`.

**2. Validator.** Named `validate…` or `parse…`, transport-agnostic. Do not normalize
`searchParams` here — the route does that. Enum fields must be genuinely narrow: a
broad enum plus a `.refine()` is invisible to the generated OpenAPI spec and will
document values the operation rejects (ADR-0008 fixed exactly that bug in
`user.validator.ts`).

**3. Repository.** Persistence only. Destructure `{ data, error }`, throw on `error`,
return `data` last. `maybeSingle()` for lookups, `single()` for writes expected to
affect one row. Naming: `find… insert… update… delete… list… exists… count…`. Never
authorize, orchestrate, or call anything external here. If the entity has derived
columns behind a view, read the view and write the table (`AGENTS.md` → *Repositories*).

**4. Authorization.** Add a predicate to `authorization.service.ts` only if no existing
one expresses the boundary. Prefer a narrow, purpose-named predicate over widening an
existing broad one — widening silently changes every current caller. If the operation
needs a client-side gate, it also needs a capability token in
`src/contracts/me.contract.ts` wired through `CAPABILITY_PREDICATES` and the correct
vocabulary (`ORG_CAPABILITIES` or `PLATFORM_CAPABILITIES`) in `me.service.ts`; the
partition test in `tests/unit/me-capabilities.test.ts` will fail if you add a token to
neither or both.

**5. Service.** Business rules and orchestration. Cross-domain workflows belong in an
application service (`*-workflow.service.ts`), not in a domain service calling a peer.
Naming: `create… bootstrap… invite… assign… calculate… consume… generate… send…`.

**6. Route.** `createRouteHandler` (or `withCapability`) from `src/lib/api/route-handler.ts`.
The handler parses transport, calls the validator, calls the service, returns
`NextResponse.json(result, { status })`. `201` for creates, `200` otherwise. Null and
empty-string normalization of query params happens here.

**7. Contract.** A zod schema in `src/contracts/<domain>.contract.ts` mirroring the
service's actual return type. Client-safe: never import `src/server/**` or
`src/types/database.ts`. This module is the single source both the spec and any TS type
derive from (ADR-0008) — do not hand-author a parallel type elsewhere.

**8. Registry.** Add an `OperationEntry` to `src/server/openapi/registry.ts` with
`method`, `path` (OpenAPI `{id}` form), `tag`, `summary`, `auth`, `pathParams`,
`requestBody`, and `responses` referencing the contract schema. Then run
`npm run openapi:generate` and commit the regenerated `src/server/openapi/openapi.json`.

Two tests police this and both will fail if you skip it:
`tests/unit/openapi-registry-parity.test.ts` (registry ↔ route filesystem bijection) and
`tests/unit/openapi-spec.test.ts` (committed artifact ↔ regenerated document).

**9. Client.** `queries.ts` exposes `queryOptions()` factories — query keys are never
inlined. `api.ts` calls go through `src/lib/api/client.ts`, never raw `fetch`. A new
`ErrorCode` must be added to `src/lib/api/error-codes.ts`, whose total `Record` type
fails the build until it is handled.

## Before calling it done

Run the Phase Completion Checklist in `AGENTS.md`. `npm run db:types` first if the
schema changed, then `npx tsc --noEmit`, `npx eslint .` (read its own exit code — never
pipe it), `npm test`, `npm run test:integration`, `npm run build`.

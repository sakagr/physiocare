# Frontend Decision Records

Accepted frontend and UX ADRs, append-only and immutable per the ADR convention in [AGENTS.md](../../AGENTS.md) → *Architecture Decision Records (ADR)*. Broader project/domain decisions live in `AGENTS.md` → *Project Decisions*; this log is scoped to the frontend track (F0–F10) and uses ADR codes. UX ADRs carry their full design detail in [UX.md](../../UX.md) and are referenced from it.

**Read only the records the current increment touches.** This index exists so the full log does not have to be loaded to find them.

| ADR | Title | Scope | Status |
| --- | --- | --- | --- |
| [0001](0001-navigation-and-surface-model.md) | Navigation & Surface Model | UX / Frontend | Accepted (2026-07-17) |
| [0002](0002-frontend-ui-testing-framework.md) | Frontend UI Testing Framework | Frontend | Accepted (2026-07-26) |
| [0003](0003-current-user-contract.md) | Current-User Contract as the Single Client Identity Source | Frontend / Authorization | Accepted (2026-07-26) |
| [0004](0004-isomorphic-api-client-and-error-envelope.md) | Isomorphic API Client and Error Envelope Parsing | Frontend | Accepted (2026-07-26) |
| [0005](0005-namespace-route-groups-and-landing-resolver.md) | Namespace Route Groups, Layout Guards, and the Pure Landing Resolver | Frontend / Authorization | Accepted (2026-07-26) |
| [0006](0006-shared-ui-primitives.md) | Shared UI Primitives: Conventions Encoded as API | Frontend / UX | Accepted (2026-07-27) |
| [0007](0007-auth-route-client-and-password-setup-ticket.md) | The Auth Route Client and the Password-Setup Ticket | Frontend / Authorization | Accepted (2026-07-27) |
| [0008](0008-spec-generation-and-contract-layer.md) | Spec Generation and the Shared Contract Layer | Frontend / Backend | Accepted (2026-07-28) |
| [0009](0009-api-explorer-access-control.md) | API Explorer Access Control and the Environment Dimension | Frontend / Authorization | Accepted (2026-07-28) |
| [0010](0010-per-item-permission-hints.md) | Per-Item Permission Hints for Row-Level Gating | Frontend / Authorization | Accepted (2026-07-31) |
| [0011](0011-compensation-visibility-and-rls-backstop.md) | Compensation Visibility and the Permissive RLS Backstop | Frontend / Authorization / Backend | Accepted (2026-07-31) |
| [0012](0012-organization-profile-capability-and-toast-suppression.md) | Organization-Profile Capability and Per-Call-Site Toast Suppression | Frontend / Authorization / Error Handling | Accepted (2026-08-01) |

## Adding a record

Create `docs/adr/NNNN-<slug>.md` with a single `# ADR-NNNN — Title` heading and the **Status / Scope / Context / Decision / Consequences** structure the existing records use, then add a row to the table above. Never edit an accepted record — supersede it with a new one and note the supersession in the new record.

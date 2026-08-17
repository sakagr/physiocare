# ADR-0001 — Navigation & Surface Model

- **Status:** Accepted (2026-07-17)
- **Scope:** UX / Frontend
- **Context:** The frontend (F0–F10) needs a consistent rule for when a screen becomes a routed page versus contextual UI. Unbounded routing produces deep breadcrumb chains, loss of working context, and a steeper learning curve.
- **Decision:** Dedicated routes are a scarce resource, reserved for **independent destinations** — workspaces users navigate to for focused work. All other surfaces (create/edit, entity detail, short self-contained tasks, child resources without their own workspace, frequent quick actions) render as **contextual UI** — dialogs, drawers, tabs, or inline sections — layered over their originating context. A child that is itself a substantial workspace (e.g. a consultation) may still earn a route.
- **Consequences:** The organization app resolves to ~13 destinations; details and actions are hosted surfaces rather than routes. Navigation stays shallow and working context is preserved. New screens must justify a route against the destination test or default to contextual UI.
- **Reference:** `UX.md` → *Navigation & Surface Model* (full design detail and the screen inventory).

# ADR-0002 — Frontend UI Testing Framework

- **Status:** Accepted (2026-07-26)
- **Scope:** Frontend
- **Context:** The frontend track (F0–F10) needs an automated verification gate for UI work from its first increment, not retrofitted at F10. The repository already runs Vitest for server tests, but only in a Node environment with no way to render a component.
- **Decision:** React Testing Library with `@testing-library/jest-dom` and `@testing-library/user-event`, running on the existing Vitest toolchain in a **jsdom** lane selected by `environmentMatchGlobs` (`tests/components/**` and any `*.test.tsx`); the Node lane is unchanged. A single global setup file registers the jest-dom matchers, runs RTL cleanup, and installs the browser API shims Mantine requires (`matchMedia`, `ResizeObserver`, `scrollIntoView`), all guarded so the Node lane is untouched. Every component test renders through a shared `renderWithProviders` helper that mounts the real provider tree. E2E (Playwright) remains a F10 concern and is deliberately not brought forward.
- **Consequences:** One test runner and one config for the whole codebase. Component tests prove logic, DOM structure, and accessibility semantics; they cannot prove CSS-media-query behavior, so viewport-accurate responsive verification stays manual until F10. A UI change without a component test is incomplete.

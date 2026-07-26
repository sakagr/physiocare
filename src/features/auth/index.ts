/**
 * Public surface of the `auth` feature. Cross-feature imports go through this
 * barrel, never deep paths (AGENTS.md → Project Structure). Explicit named
 * exports only — never `export *`.
 *
 * Identity itself is *not* here: the current-user context lives in
 * `src/lib/auth/current-user-context.tsx`, alongside its server counterpart.
 * It is shared infrastructure that `src/components/ui` depends on, so it sits
 * below the feature layer — dependencies point down, never sideways. This
 * feature holds the auth *flows* (F1) and their queries.
 */
export { authQueryKeys, currentUserQueryOptions } from "./queries";

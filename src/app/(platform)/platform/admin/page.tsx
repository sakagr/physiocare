import { notFound } from "next/navigation";
import { Can, ForbiddenState, PageHeader } from "@/components/ui";
import { ApiExplorer } from "@/features/platform-api";
import { isApiExplorerEnabled } from "@/lib/env";

/**
 * The platform namespace guard (`guardNamespace`) is group-level: it admits
 * every platform role. `SUPER_ADMIN` is the only platform-group role in V1
 * (the former `PLATFORM_SUPPORT`/`SALES`/`BILLING` roles were removed --
 * see AGENTS.md's Project Decisions), so the `<Can>` gate below has no
 * reachable negative branch today. It stays in place regardless: this
 * destination gates on the `platformApi:explore` capability itself, via the
 * existing `<Can>` primitive -- the same mechanism every other capability
 * gate in the app uses, applied to a whole destination rather than a single
 * action. Falling back to `ForbiddenState` in place, rather than a redirect,
 * matters here specifically: `resolveLanding` sends every platform-group
 * user to this same path, so redirecting a disallowed one away from it
 * would send them right back.
 *
 * The environment gate runs before the capability check, mirroring
 * `GET /api/platform/openapi`'s before-auth ordering (ADR-0009): a disabled
 * environment 404s outright rather than revealing -- via a rendered
 * `ForbiddenState` -- that a gated destination exists here at all.
 */
export default function ApiExplorerPage() {
  if (!isApiExplorerEnabled()) {
    notFound();
  }

  return (
    <Can
      capability="platformApi:explore"
      fallback={
        <ForbiddenState
          backHref="/login"
          backLabel="Return to sign in"
          description="The API Explorer is available to Super Admin only."
        />
      }
    >
      <PageHeader
        title="API explorer"
        description="Browse the platform API and try requests against it. Unavailable in production."
      />
      <ApiExplorer />
    </Can>
  );
}

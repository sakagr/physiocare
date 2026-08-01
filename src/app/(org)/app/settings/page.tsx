import { Can, ForbiddenState } from "@/components/ui";
import { SettingsPageContent } from "@/features/organization";

/**
 * In-page capability guard (F3 readiness review §8 pattern, carried into
 * F4): the `(org)` layout checks namespace only, so this destination gates
 * itself on `settings:manage` the same way `users/page.tsx` gates on
 * `users:manage`.
 */
export default function SettingsPage() {
  return (
    <Can
      capability="settings:manage"
      fallback={<ForbiddenState backHref="/app" backLabel="Back to dashboard" />}
    >
      <SettingsPageContent />
    </Can>
  );
}

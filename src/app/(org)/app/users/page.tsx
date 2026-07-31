import { Can, ForbiddenState } from "@/components/ui";
import { UsersPageContent } from "@/features/users";

/**
 * In-page capability guard (F3 readiness review §8): the `(org)` layout
 * checks namespace only, so this destination gates itself on `users:manage`
 * the same way `platform/admin/page.tsx` gates on `platformApi:explore`.
 */
export default function UsersPage() {
  return (
    <Can
      capability="users:manage"
      fallback={<ForbiddenState backHref="/app" backLabel="Back to dashboard" />}
    >
      <UsersPageContent />
    </Can>
  );
}

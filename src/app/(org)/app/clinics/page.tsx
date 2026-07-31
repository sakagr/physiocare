import { Can, ForbiddenState } from "@/components/ui";
import { ClinicsPageContent } from "@/features/clinics";

/**
 * In-page capability guard (F3 readiness review §8) -- this one matters
 * most: `GET /api/clinics` admits any active org member (`canViewClinics`),
 * so an unguarded destination would render real clinic data to a
 * physiotherapist or receptionist. The `(org)` layout checks namespace only.
 */
export default function ClinicsPage() {
  return (
    <Can
      capability="clinics:manage"
      fallback={<ForbiddenState backHref="/app" backLabel="Back to dashboard" />}
    >
      <ClinicsPageContent />
    </Can>
  );
}

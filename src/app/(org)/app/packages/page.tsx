import { PackagesPageContent } from "@/features/packages";

/**
 * No in-page capability guard, deliberately: every role may browse the
 * catalogue (UX.md:355), so a guard here would refuse users the destination
 * is meant for. Write affordances inside are `packages:manage`-gated
 * individually. This differs from ClinicsPage, where the guard matters
 * because the destination itself is Owner/Admin-only.
 */
export default function PackagesPage() {
  return <PackagesPageContent />;
}

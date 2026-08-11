import { PatientsPageContent } from "@/features/patients";

/**
 * No in-page capability guard, deliberately: `patients:view` is granted to
 * every org member, so a guard would be a no-op. Write affordances inside are
 * `patients:manage`-gated individually.
 */
export default function PatientsPage() {
  return <PatientsPageContent />;
}

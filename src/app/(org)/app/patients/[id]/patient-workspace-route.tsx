"use client";

import { useQuery } from "@tanstack/react-query";
import { PatientWorkspace, PatientOverviewTab, PatientRecordsTab } from "@/features/patients";
import { PatientPackagesTab } from "@/features/patient-packages";
import { PatientAppointmentsTab } from "@/features/appointments";
import { packagesListQueryOptions } from "@/features/packages";

/**
 * Route-level composition of the three F5 features (see the page above).
 *
 * The catalogue query lives **here**, not in `patient-packages`: the assign
 * dialog needs a list of active packages, which is `packages`' data, and
 * fetching it inside the assignment feature is exactly the cross-feature
 * dependency the composition rule exists to prevent.
 *
 * Only active packages are offered -- assigning a withdrawn package would
 * contradict what deactivation means.
 *
 * F6 appended the Appointments tab here, changing nothing inside
 * `src/features/patients/` -- the seam F5 documented held.
 */
export function PatientWorkspaceRoute({ patientId }: { patientId: string }) {
  const catalogue = useQuery(packagesListQueryOptions({ page: 1, limit: 100, isActive: true }));

  const packageOptions = (catalogue.data?.items ?? []).map((pkg) => ({
    value: pkg.id,
    label: `${pkg.package_name} — ${pkg.total_sessions} sessions`,
  }));

  return (
    <PatientWorkspace
      patientId={patientId}
      // Invoices (F7) is deliberately still not stubbed: a placeholder tab
      // promises a thing that does not exist.
      tabs={[
        { value: "overview", label: "Overview", content: <PatientOverviewTab patientId={patientId} /> },
        {
          value: "appointments",
          label: "Appointments",
          content: <PatientAppointmentsTab patientId={patientId} />,
        },
        { value: "records", label: "Records", content: <PatientRecordsTab patientId={patientId} /> },
        {
          value: "packages",
          label: "Packages",
          content: <PatientPackagesTab patientId={patientId} packageOptions={packageOptions} />,
        },
      ]}
    />
  );
}

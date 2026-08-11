"use client";

import { useState } from "react";
import { PageHeader, useCan } from "@/components/ui";
import type { Patient } from "@/types/contracts/patient";
import { PatientsCollection } from "./patients-collection";
import { PatientFormDialog } from "./patient-form-dialog";
import type { PatientFormValues } from "../schemas";

/**
 * The Patients destination (UX.md:349).
 *
 * No destination-level `Can` guard, deliberately: `patients:view` is granted
 * to every org member (`canViewPatients` → `isActiveOrgMember`), so a guard
 * would be a no-op. This differs from ClinicsPage, where the guard matters
 * because that destination is Owner/Admin-only even though its view
 * capability is equally broad.
 */
export function PatientsPageContent() {
  const canManage = useCan("patients:manage");
  const [createOpened, setCreateOpened] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);

  const editValues: PatientFormValues | undefined = editing
    ? {
        fullName: editing.full_name,
        gender: editing.gender ?? "",
        dob: editing.dob ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        address: editing.address ?? "",
        emergencyContact: editing.emergency_contact ?? "",
      }
    : undefined;

  return (
    <>
      <PageHeader
        title="Patients"
        description="Everyone your organization treats."
        primaryAction={canManage ? { label: "New patient", onClick: () => setCreateOpened(true) } : undefined}
      />

      <PatientsCollection canManage={canManage} onCreate={() => setCreateOpened(true)} onEdit={setEditing} />

      {/* Keyed on `opened` so a reopened dialog starts clean -- including
          the duplicate-warning term, which is component state rather than
          form state. */}
      <PatientFormDialog
        key={createOpened ? "create-open" : "create-closed"}
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
      />

      <PatientFormDialog
        key={editing?.id ?? "no-edit"}
        opened={editing !== null}
        onClose={() => setEditing(null)}
        patientId={editing?.id}
        defaultValues={editValues}
      />
    </>
  );
}

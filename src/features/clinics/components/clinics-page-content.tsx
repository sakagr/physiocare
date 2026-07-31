"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui";
import { ClinicFormDialog } from "./clinic-form-dialog";
import { ClinicDetailDrawer } from "./clinic-detail-drawer";
import { ClinicsCollection } from "./clinics-collection";

export function ClinicsPageContent() {
  const [createOpened, setCreateOpened] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Clinics"
        description="Manage clinics and who works in them."
        primaryAction={{ label: "New clinic", onClick: () => setCreateOpened(true) }}
      />

      <ClinicsCollection
        onSelectClinic={setSelectedClinicId}
        canCreate
        onCreate={() => setCreateOpened(true)}
      />

      <ClinicFormDialog opened={createOpened} onClose={() => setCreateOpened(false)} />

      <ClinicDetailDrawer clinicId={selectedClinicId} onClose={() => setSelectedClinicId(null)} />
    </>
  );
}

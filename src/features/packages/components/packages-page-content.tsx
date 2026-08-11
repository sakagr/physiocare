"use client";

import { useState } from "react";
import { PageHeader, useCan } from "@/components/ui";
import type { Package } from "@/types/contracts/package";
import { PackagesCollection } from "./packages-collection";
import { PackageFormDialog } from "./package-form-dialog";
import type { PackageFormValues } from "../schemas";

/**
 * The Packages destination (UX.md:355). Every role may browse the catalogue,
 * so there is deliberately **no destination-level guard** -- this is the one
 * destination where guarding the page would be actively wrong. The write
 * affordances are individually `packages:manage`-gated instead.
 */
export function PackagesPageContent() {
  const canManage = useCan("packages:manage");
  const [createOpened, setCreateOpened] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);

  const editValues: PackageFormValues | undefined = editing
    ? {
        packageName: editing.package_name,
        totalSessions: editing.total_sessions,
        packagePrice: editing.package_price,
        validityDays: editing.validity_days,
      }
    : undefined;

  return (
    <>
      <PageHeader
        title="Packages"
        description="The session packages your organization offers patients."
        primaryAction={canManage ? { label: "New package", onClick: () => setCreateOpened(true) } : undefined}
      />

      <PackagesCollection canCreate={canManage} onCreate={() => setCreateOpened(true)} onEdit={setEditing} />

      <PackageFormDialog opened={createOpened} onClose={() => setCreateOpened(false)} />

      <PackageFormDialog
        key={editing?.id ?? "no-edit"}
        opened={editing !== null}
        onClose={() => setEditing(null)}
        packageId={editing?.id}
        defaultValues={editValues}
      />
    </>
  );
}

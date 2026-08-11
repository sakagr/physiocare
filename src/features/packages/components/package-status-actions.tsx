"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { ActionIcon, Group, Menu } from "@mantine/core";
import { IconDots, IconPencil, IconPlayerPause, IconPlayerPlay, IconTrash } from "@tabler/icons-react";
import { ConfirmDialog, useCan } from "@/components/ui";
import type { Package } from "@/types/contracts/package";
import { activatePackage, deactivatePackage, deletePackage } from "../api";
import { packagesQueryKeys } from "../queries";

/**
 * Row actions for one catalogue package (UX.md → Flow 11).
 *
 * Deactivate and delete both throw `PACKAGE_HAS_ACTIVE_ASSIGNMENTS` once the
 * package has ever been assigned, and there is **no safe alternative to
 * offer** -- deactivate is itself blocked -- so the copy says so rather than
 * pointing at a door that is also locked.
 *
 * These are destructive confirms, not form dialogs: `SUBSCRIPTION_REQUIRED`
 * arrives as the flat toast the query client already raises. A confirm has no
 * input to preserve and no natural slot for an in-dialog alert.
 */
export interface PackageStatusActionsProps {
  package: Package;
  onEdit: (pkg: Package) => void;
}

type PendingAction = "deactivate" | "delete" | null;

export function PackageStatusActions({ package: pkg, onEdit }: PackageStatusActionsProps) {
  const queryClient = useQueryClient();
  const canManage = useCan("packages:manage");
  const [pending, setPending] = useState<PendingAction>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: packagesQueryKeys.all });

  const activate = useMutation({
    mutationFn: () => activatePackage(pkg.id),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: "success", message: "Package activated." });
    },
  });

  const deactivate = useMutation({
    mutationFn: () => deactivatePackage(pkg.id),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: "success", message: "Package deactivated." });
      setPending(null);
    },
    onError: () => setPending(null),
  });

  const remove = useMutation({
    mutationFn: () => deletePackage(pkg.id),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: "success", message: "Package deleted." });
      setPending(null);
    },
    onError: () => setPending(null),
  });

  if (!canManage) {
    return null;
  }

  return (
    <Group gap="xs" justify="flex-end" onClick={(event) => event.stopPropagation()}>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${pkg.package_name}`}>
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => onEdit(pkg)}>
            Edit
          </Menu.Item>
          {pkg.is_active ? (
            <Menu.Item leftSection={<IconPlayerPause size={14} />} onClick={() => setPending("deactivate")}>
              Deactivate
            </Menu.Item>
          ) : (
            <Menu.Item
              leftSection={<IconPlayerPlay size={14} />}
              onClick={() => activate.mutate()}
              disabled={activate.isPending}
            >
              Activate
            </Menu.Item>
          )}
          <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => setPending("delete")}>
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <ConfirmDialog
        opened={pending === "deactivate"}
        onClose={() => setPending(null)}
        onConfirm={() => deactivate.mutate()}
        title="Deactivate package?"
        target={pkg.package_name}
        consequence="It stops being offered for new assignments. Existing assignments are unaffected. A package that has ever been assigned to a patient cannot be deactivated."
        confirmLabel="Deactivate"
        loading={deactivate.isPending}
      />

      <ConfirmDialog
        opened={pending === "delete"}
        onClose={() => setPending(null)}
        onConfirm={() => remove.mutate()}
        title="Delete package?"
        target={pkg.package_name}
        consequence="It is removed from the catalogue. A package that has ever been assigned to a patient cannot be deleted or deactivated — it stays in the catalogue permanently."
        confirmLabel="Delete"
        loading={remove.isPending}
      />
    </Group>
  );
}

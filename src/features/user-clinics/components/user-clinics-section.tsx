"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { ActionIcon, Button, Group, Select, Stack, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { Can, ConfirmDialog, DataState } from "@/components/ui";
import { allActiveClinicsQueryOptions, userClinicsByUserQueryOptions, userClinicsQueryKeys } from "../queries";
import { assignUserToClinic, removeUserFromClinic } from "../api";

/**
 * The user drawer's clinic list (UX.md → Flow 9 step 2, Flow 10 step 3):
 * the clinics a user is assigned to, with assign/remove. Mutating controls
 * are gated on `clinics:manage` -- `canAssignUserToClinic` is exactly
 * `canManageClinics` server-side, for either direction of the assignment.
 */
export function UserClinicsSection({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  const assignedQuery = useQuery(userClinicsByUserQueryOptions(userId));
  const allClinicsQuery = useQuery(allActiveClinicsQueryOptions());

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: userClinicsQueryKeys.byUser(userId) });
  }

  const assign = useMutation({
    mutationFn: (clinicId: string) => assignUserToClinic(userId, clinicId),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: "success", message: "Clinic assigned." });
      setSelectedClinicId(null);
    },
  });

  const remove = useMutation({
    mutationFn: (clinicId: string) => removeUserFromClinic(userId, clinicId),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: "success", message: "Clinic assignment removed." });
      setRemoveTarget(null);
    },
  });

  const assignedIds = new Set((assignedQuery.data ?? []).map((clinic) => clinic.id));
  const availableOptions = (allClinicsQuery.data?.items ?? [])
    .filter((clinic) => !assignedIds.has(clinic.id))
    .map((clinic) => ({ value: clinic.id, label: clinic.clinic_name }));

  return (
    <Stack gap="sm">
      <Text fw={500}>Clinics</Text>

      <DataState
        isLoading={assignedQuery.isPending}
        isError={assignedQuery.isError}
        error={assignedQuery.error}
        onRetry={() => assignedQuery.refetch()}
        isEmpty={assignedQuery.data?.length === 0}
        skeleton={
          <Text size="sm" c="dimmed">
            Loading clinics…
          </Text>
        }
        empty={
          <Text size="sm" c="dimmed">
            Not assigned to any clinic yet.
          </Text>
        }
      >
        <Stack gap="xs">
          {(assignedQuery.data ?? []).map((clinic) => (
            <Group key={clinic.id} justify="space-between">
              <Text size="sm">{clinic.clinic_name}</Text>
              <Can capability="clinics:manage">
                <ActionIcon
                  variant="subtle"
                  color="danger"
                  aria-label={`Remove ${clinic.clinic_name}`}
                  onClick={() => setRemoveTarget({ id: clinic.id, name: clinic.clinic_name })}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Can>
            </Group>
          ))}
        </Stack>
      </DataState>

      <Can capability="clinics:manage">
        <Group gap="xs">
          <Select
            aria-label="Assign to a clinic"
            placeholder="Assign to a clinic"
            data={availableOptions}
            value={selectedClinicId}
            onChange={setSelectedClinicId}
            style={{ flex: 1 }}
            searchable
          />
          <Button
            disabled={!selectedClinicId}
            loading={assign.isPending}
            onClick={() => selectedClinicId && assign.mutate(selectedClinicId)}
          >
            Assign
          </Button>
        </Group>
      </Can>

      <ConfirmDialog
        opened={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) remove.mutate(removeTarget.id);
        }}
        title="Remove clinic assignment?"
        target={removeTarget?.name ?? ""}
        consequence="They lose access to this clinic's records and scheduling."
        confirmLabel="Remove"
        loading={remove.isPending}
      />
    </Stack>
  );
}

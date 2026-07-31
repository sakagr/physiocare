"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { ActionIcon, Button, Group, Select, Stack, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { Can, ConfirmDialog, DataState } from "@/components/ui";
import { allActiveUsersQueryOptions, clinicUsersQueryOptions, userClinicsQueryKeys } from "../queries";
import { assignUserToClinic, removeUserFromClinic } from "../api";

/**
 * The clinic drawer's member list (UX.md → Flow 10 step 3): the staff
 * assigned to a clinic, with their role (D10 ii, role-embedded), and
 * assign/remove. Mutating controls gated on `clinics:manage`, matching
 * `canAssignUserToClinic`.
 */
export function ClinicMembersSection({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  const membersQuery = useQuery(clinicUsersQueryOptions(clinicId));
  const allUsersQuery = useQuery(allActiveUsersQueryOptions());

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: userClinicsQueryKeys.byClinic(clinicId) });
  }

  const assign = useMutation({
    mutationFn: (userId: string) => assignUserToClinic(userId, clinicId),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: "success", message: "User assigned." });
      setSelectedUserId(null);
    },
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeUserFromClinic(userId, clinicId),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: "success", message: "Assignment removed." });
      setRemoveTarget(null);
    },
  });

  const memberIds = new Set((membersQuery.data ?? []).map((member) => member.id));
  const availableOptions = (allUsersQuery.data?.items ?? [])
    .filter((user) => !memberIds.has(user.id))
    .map((user) => ({ value: user.id, label: `${user.full_name} (${user.role.display_name})` }));

  return (
    <Stack gap="sm">
      <Text fw={500}>Assigned staff</Text>

      <DataState
        isLoading={membersQuery.isPending}
        isError={membersQuery.isError}
        error={membersQuery.error}
        onRetry={() => membersQuery.refetch()}
        isEmpty={membersQuery.data?.length === 0}
        skeleton={
          <Text size="sm" c="dimmed">
            Loading staff…
          </Text>
        }
        empty={
          <Text size="sm" c="dimmed">
            No staff assigned yet.
          </Text>
        }
      >
        <Stack gap="xs">
          {(membersQuery.data ?? []).map((member) => (
            <Group key={member.id} justify="space-between">
              <Text size="sm">
                {member.full_name} · {member.role.display_name}
              </Text>
              <Can capability="clinics:manage">
                <ActionIcon
                  variant="subtle"
                  color="danger"
                  aria-label={`Remove ${member.full_name}`}
                  onClick={() => setRemoveTarget({ id: member.id, name: member.full_name })}
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
            aria-label="Assign a user"
            placeholder="Assign a user"
            data={availableOptions}
            value={selectedUserId}
            onChange={setSelectedUserId}
            style={{ flex: 1 }}
            searchable
          />
          <Button
            disabled={!selectedUserId}
            loading={assign.isPending}
            onClick={() => selectedUserId && assign.mutate(selectedUserId)}
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
        title="Remove from clinic?"
        target={removeTarget?.name ?? ""}
        consequence="They lose access to this clinic's records and scheduling."
        confirmLabel="Remove"
        loading={remove.isPending}
      />
    </Stack>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  ActionIcon,
  Box,
  Card,
  Group,
  Menu,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconDots, IconPencil, IconSearch, IconTrash, IconUsers } from "@tabler/icons-react";
import { ConfirmDialog, DataState, EmptyState } from "@/components/ui";
import type { Patient } from "@/types/contracts/patient";
import { deletePatient } from "../api";
import { patientsListQueryOptions, patientsQueryKeys } from "../queries";
import { GENDER_OPTIONS } from "../schemas";

const PAGE_SIZE = 20;

function PatientsSkeleton() {
  return (
    <Stack gap="sm">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} height={52} radius="sm" />
      ))}
    </Stack>
  );
}

export interface PatientsCollectionProps {
  canManage: boolean;
  onCreate: () => void;
  onEdit: (patient: Patient) => void;
}

export function PatientsCollection({ canManage, onCreate, onEdit }: PatientsCollectionProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [gender, setGender] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Patient | null>(null);

  const query = useQuery(
    patientsListQueryOptions({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      gender: gender ?? undefined,
    })
  );

  // A destructive confirm, so SUBSCRIPTION_REQUIRED arrives as the flat toast
  // the query client already raises: there is no input to preserve and no
  // natural slot for an in-dialog alert.
  const remove = useMutation({
    mutationFn: (patient: Patient) => deletePatient(patient.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientsQueryKeys.all });
      notifications.show({ color: "success", message: "Patient deleted." });
      setPendingDelete(null);
    },
    onError: () => setPendingDelete(null),
  });

  const rowActions = (patient: Patient) =>
    canManage ? (
      <Group gap="xs" justify="flex-end" onClick={(event) => event.stopPropagation()}>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${patient.full_name}`}>
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => onEdit(patient)}>
              Edit
            </Menu.Item>
            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => setPendingDelete(patient)}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    ) : null;

  return (
    <Stack gap="md" pb="xl">
      <Group gap="sm" wrap="wrap">
        {/* One input: the backend already matches name, patient code, phone,
            email, and emergency contact. */}
        <TextInput
          placeholder="Search by name, code, or phone"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
          style={{ flex: 1, minWidth: 240 }}
        />
        {/* No status filter: patients have no active/inactive concept, only
            soft delete, and deleted patients are never listed. */}
        <Select
          placeholder="Any gender"
          data={GENDER_OPTIONS}
          value={gender}
          onChange={(value) => {
            setGender(value);
            setPage(1);
          }}
          clearable
          w={180}
        />
      </Group>

      <DataState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        isEmpty={query.data?.items.length === 0}
        skeleton={<PatientsSkeleton />}
        empty={
          <EmptyState
            icon={<IconUsers size={24} stroke={1.5} />}
            title="No patients yet"
            description="Patients registered at the front desk will appear here."
            action={canManage ? { label: "New patient", onClick: onCreate } : undefined}
          />
        }
      >
        <Box visibleFrom="sm">
          <Table.ScrollContainer minWidth={680}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Gender</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Added</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(query.data?.items ?? []).map((patient) => (
                  <Table.Tr
                    key={patient.id}
                    onClick={() => router.push(`/app/patients/${patient.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <Table.Td>{patient.patient_code}</Table.Td>
                    <Table.Td>{patient.full_name}</Table.Td>
                    <Table.Td>
                      {GENDER_OPTIONS.find((option) => option.value === patient.gender)?.label ?? "—"}
                    </Table.Td>
                    <Table.Td>{patient.phone ?? "—"}</Table.Td>
                    <Table.Td>{patient.created_at.slice(0, 10)}</Table.Td>
                    <Table.Td>{rowActions(patient)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Box>

        <Stack gap="sm" hiddenFrom="sm">
          {(query.data?.items ?? []).map((patient) => (
            <Card
              key={patient.id}
              withBorder
              padding="sm"
              onClick={() => router.push(`/app/patients/${patient.id}`)}
              style={{ cursor: "pointer" }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={500}>{patient.full_name}</Text>
                  <Text size="xs" c="dimmed">
                    {patient.patient_code}
                    {patient.phone ? ` · ${patient.phone}` : ""}
                  </Text>
                </Stack>
                {rowActions(patient)}
              </Group>
            </Card>
          ))}
        </Stack>

        {query.data && query.data.totalPages > 1 && (
          <Group justify="center">
            <Pagination value={page} onChange={setPage} total={query.data.totalPages} />
          </Group>
        )}
      </DataState>

      <ConfirmDialog
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete);
        }}
        title="Delete patient?"
        target={pendingDelete ? `${pendingDelete.patient_code} · ${pendingDelete.full_name}` : ""}
        consequence="They are removed from the patient list. A patient with appointments, consultations, prescriptions, or records cannot be deleted."
        confirmLabel="Delete"
        loading={remove.isPending}
      />
    </Stack>
  );
}

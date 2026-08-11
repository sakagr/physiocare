"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Pagination,
  Skeleton,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconCalendarPlus, IconDots, IconList, IconPackage, IconTrash, IconX } from "@tabler/icons-react";
import { ConfirmDialog, DataState, EmptyState, StatusBadge, useCan } from "@/components/ui";
import type { PatientPackage } from "@/types/contracts/patient-package";
import { cancelPatientPackage, deletePatientPackage } from "../api";
import { patientPackagesListQueryOptions, patientPackagesQueryKeys } from "../queries";
import { STATUS_ROLES } from "../schemas";
import { AssignPackageDialog } from "./assign-package-dialog";
import { ExtendValidityDialog } from "./extend-validity-dialog";
import { PackageUsageDrawer } from "./package-usage-drawer";

const PAGE_SIZE = 20;

/**
 * The Packages tab of the patient workspace (M5).
 *
 * Read is open to every org member (`canViewPatientPackages`); writes need
 * `patientPackages:manage`.
 *
 * Status comes **from the server** (`patient_packages_view`) and is never
 * derived here -- the precedence rule (cancelled → completed → expired →
 * active) lives in the view, and a second implementation would drift.
 *
 * `packageOptions` is a prop rather than a query, so this feature does not
 * import `packages`. See AssignPackageDialog.
 */
export interface PatientPackagesTabProps {
  patientId: string;
  packageOptions: { value: string; label: string }[];
}

export function PatientPackagesTab({ patientId, packageOptions }: PatientPackagesTabProps) {
  const queryClient = useQueryClient();
  const canManage = useCan("patientPackages:manage");
  const [page, setPage] = useState(1);
  const [assignOpened, setAssignOpened] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<PatientPackage | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PatientPackage | null>(null);
  const [extending, setExtending] = useState<PatientPackage | null>(null);
  const [viewingUsage, setViewingUsage] = useState<PatientPackage | null>(null);

  const query = useQuery(patientPackagesListQueryOptions(patientId, { page, limit: PAGE_SIZE }));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: patientPackagesQueryKeys.allForPatient(patientId) });

  const cancel = useMutation({
    mutationFn: (assignment: PatientPackage) => cancelPatientPackage(assignment.id),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: "success", message: "Assignment cancelled." });
      setPendingCancel(null);
    },
    onError: () => setPendingCancel(null),
  });

  const remove = useMutation({
    mutationFn: (assignment: PatientPackage) => deletePatientPackage(assignment.id),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: "success", message: "Assignment deleted." });
      setPendingDelete(null);
    },
    onError: () => setPendingDelete(null),
  });

  const rowActions = (assignment: PatientPackage) => (
    <Group gap="xs" justify="flex-end" onClick={(event) => event.stopPropagation()}>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${assignment.package_name}`}>
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconList size={14} />} onClick={() => setViewingUsage(assignment)}>
            View sessions
          </Menu.Item>
          {canManage && (
            <>
              <Menu.Item leftSection={<IconCalendarPlus size={14} />} onClick={() => setExtending(assignment)}>
                Extend validity
              </Menu.Item>
              {assignment.status !== "cancelled" && (
                <Menu.Item leftSection={<IconX size={14} />} onClick={() => setPendingCancel(assignment)}>
                  Cancel
                </Menu.Item>
              )}
              <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => setPendingDelete(assignment)}>
                Delete
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );

  const expiry = (assignment: PatientPackage) => assignment.extended_validity_to ?? assignment.expiry_date;

  return (
    <Stack gap="md">
      {canManage && (
        <Group justify="flex-end">
          <Button size="xs" onClick={() => setAssignOpened(true)}>
            Assign package
          </Button>
        </Group>
      )}

      <DataState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        isEmpty={query.data?.items.length === 0}
        skeleton={<Skeleton height={160} radius="sm" />}
        empty={
          <EmptyState
            icon={<IconPackage size={24} stroke={1.5} />}
            title="No packages assigned"
            description="Session packages this patient has purchased will appear here."
            action={canManage ? { label: "Assign package", onClick: () => setAssignOpened(true) } : undefined}
          />
        }
      >
        <Box visibleFrom="sm">
          <Table.ScrollContainer minWidth={760}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Package</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Sessions</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Purchased</Table.Th>
                  <Table.Th>Expires</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(query.data?.items ?? []).map((assignment) => (
                  <Table.Tr key={assignment.id}>
                    <Table.Td>{assignment.package_name}</Table.Td>
                    <Table.Td>{assignment.package_price}</Table.Td>
                    <Table.Td>
                      {assignment.used_sessions}/{assignment.total_sessions}
                      <Text span size="xs" c="dimmed">
                        {" "}
                        ({assignment.remaining_sessions} left)
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge
                        role={STATUS_ROLES[assignment.status] ?? "neutral"}
                        label={assignment.status}
                      />
                      {/* cancelled_by is a user id and the response carries no
                          name for it, so V1 shows the timestamp only rather
                          than adding a join. */}
                      {assignment.cancelled_at && (
                        <Text size="xs" c="dimmed">
                          {assignment.cancelled_at.slice(0, 10)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{assignment.purchased_on}</Table.Td>
                    <Table.Td>
                      {expiry(assignment)}
                      {assignment.extended_validity_to && (
                        <Text size="xs" c="dimmed">
                          was {assignment.expiry_date}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{rowActions(assignment)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Box>

        <Stack gap="sm" hiddenFrom="sm">
          {(query.data?.items ?? []).map((assignment) => (
            <Card key={assignment.id} withBorder padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={500}>{assignment.package_name}</Text>
                  <Text size="xs" c="dimmed">
                    {assignment.used_sessions}/{assignment.total_sessions} used · expires {expiry(assignment)}
                  </Text>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                  <StatusBadge role={STATUS_ROLES[assignment.status] ?? "neutral"} label={assignment.status} />
                  {rowActions(assignment)}
                </Group>
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

      <AssignPackageDialog
        opened={assignOpened}
        onClose={() => setAssignOpened(false)}
        patientId={patientId}
        packageOptions={packageOptions}
      />

      <ExtendValidityDialog
        key={extending?.id ?? "no-extend"}
        opened={extending !== null}
        onClose={() => setExtending(null)}
        assignment={extending}
      />

      <PackageUsageDrawer assignment={viewingUsage} onClose={() => setViewingUsage(null)} />

      <ConfirmDialog
        opened={pendingCancel !== null}
        onClose={() => setPendingCancel(null)}
        onConfirm={() => {
          if (pendingCancel) cancel.mutate(pendingCancel);
        }}
        title="Cancel assignment?"
        target={pendingCancel?.package_name ?? ""}
        consequence="Remaining sessions can no longer be used. The purchase record is kept."
        confirmLabel="Cancel assignment"
        cancelLabel="Keep it"
        loading={cancel.isPending}
      />

      {/* Delete is dependency-blocked once sessions are consumed or an invoice
          references the assignment. Unlike the package catalogue, there *is* a
          safe alternative here, so the copy names it. */}
      <ConfirmDialog
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete);
        }}
        title="Delete assignment?"
        target={pendingDelete?.package_name ?? ""}
        consequence="An assignment with used sessions or an invoice cannot be deleted — cancel it instead to stop further use while keeping the record."
        confirmLabel="Delete"
        loading={remove.isPending}
      />
    </Stack>
  );
}

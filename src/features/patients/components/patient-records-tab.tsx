"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  ActionIcon,
  Anchor,
  Alert,
  Box,
  Button,
  Card,
  Group,
  Pagination,
  Skeleton,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconDownload, IconFileText, IconLock, IconTrash } from "@tabler/icons-react";
import { ConfirmDialog, DataState, EmptyState, useCan } from "@/components/ui";
import { ApiError } from "@/lib/api/api-error";
import type { PatientRecordWithDownloadUrl } from "@/types/contracts/patient-record";
import { deletePatientRecord } from "../api";
import { patientRecordsQueryOptions, patientsQueryKeys } from "../queries";
import { RECORD_TYPE_OPTIONS } from "../schemas";
import { RecordUploadDialog } from "./record-upload-dialog";

const PAGE_SIZE = 20;

/**
 * The Records tab (M4).
 *
 * Visibility: Owner, Admin, and Reception see records for any patient in the
 * organization; a physiotherapist sees them only for patients they have an
 * appointment with. When a physio without an appointment opens the tab, the
 * list 403s -- rendered **inside the tab**, not as a full-frame takeover.
 * UX.md's rule is "on a destination: forbidden frame; on an action: toast";
 * this is neither, so the tab body carries the explanation. The tab itself
 * stays visible: hiding it would need a per-patient signal the detail
 * response does not carry.
 *
 * Delete is Owner/Admin only -- narrower than upload, deliberately.
 */
export interface PatientRecordsTabProps {
  patientId: string;
}

export function PatientRecordsTab({ patientId }: PatientRecordsTabProps) {
  const queryClient = useQueryClient();
  const canUpload = useCan("patients:manage");
  const canDelete = useCan("patientRecords:delete");
  const [page, setPage] = useState(1);
  const [uploadOpened, setUploadOpened] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PatientRecordWithDownloadUrl | null>(null);

  const query = useQuery(patientRecordsQueryOptions(patientId, { page, limit: PAGE_SIZE }));
  const isForbidden = query.error instanceof ApiError && query.error.status === 403;

  const remove = useMutation({
    mutationFn: (record: PatientRecordWithDownloadUrl) => deletePatientRecord(patientId, record.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientsQueryKeys.allRecords(patientId) });
      notifications.show({ color: "success", message: "Record deleted." });
      setPendingDelete(null);
    },
    onError: () => setPendingDelete(null),
  });

  if (isForbidden) {
    return (
      <Alert color="gray" variant="light" title="You can't see this patient's records" icon={<IconLock size={18} stroke={1.5} />}>
        <Text size="sm">
          Records are visible to the front desk, and to physiotherapists for patients they have an appointment with.
        </Text>
      </Alert>
    );
  }

  const typeLabel = (value: string) =>
    RECORD_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;

  return (
    <Stack gap="md">
      {canUpload && (
        <Group justify="flex-end">
          <Button size="xs" onClick={() => setUploadOpened(true)}>
            Upload record
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
            icon={<IconFileText size={24} stroke={1.5} />}
            title="No records yet"
            description="Scans, lab reports, and referral letters uploaded for this patient will appear here."
            action={canUpload ? { label: "Upload record", onClick: () => setUploadOpened(true) } : undefined}
          />
        }
      >
        <Box visibleFrom="sm">
          <Table.ScrollContainer minWidth={700}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Uploaded</Table.Th>
                  <Table.Th>Notes</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(query.data?.items ?? []).map((record) => (
                  <Table.Tr key={record.id}>
                    <Table.Td>{record.title}</Table.Td>
                    <Table.Td>{typeLabel(record.record_type)}</Table.Td>
                    <Table.Td>{record.created_at.slice(0, 10)}</Table.Td>
                    <Table.Td>{record.notes ?? "—"}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        {/* The signed URL expires after 300 s, so this uses
                            the freshest fetched value rather than one held in
                            component state. */}
                        <Anchor href={record.downloadUrl} target="_blank" rel="noreferrer">
                          <ActionIcon variant="subtle" color="gray" aria-label={`Download ${record.title}`}>
                            <IconDownload size={16} />
                          </ActionIcon>
                        </Anchor>
                        {canDelete && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label={`Delete ${record.title}`}
                            onClick={() => setPendingDelete(record)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Box>

        <Stack gap="sm" hiddenFrom="sm">
          {(query.data?.items ?? []).map((record) => (
            <Card key={record.id} withBorder padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={500}>{record.title}</Text>
                  <Text size="xs" c="dimmed">
                    {typeLabel(record.record_type)} · {record.created_at.slice(0, 10)}
                  </Text>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                  <Anchor href={record.downloadUrl} target="_blank" rel="noreferrer">
                    <ActionIcon variant="subtle" color="gray" aria-label={`Download ${record.title}`}>
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Anchor>
                  {canDelete && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Delete ${record.title}`}
                      onClick={() => setPendingDelete(record)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
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

      <RecordUploadDialog
        key={uploadOpened ? "upload-open" : "upload-closed"}
        opened={uploadOpened}
        onClose={() => setUploadOpened(false)}
        patientId={patientId}
      />

      {/* The strongest confirmation tier: the file is destroyed with the row,
          so this is genuinely irreversible. The copy must not soften into
          "archived" or "hidden", and there is deliberately no Undo. */}
      <ConfirmDialog
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete);
        }}
        title="Delete record?"
        target={pendingDelete?.title ?? ""}
        consequence="The file is permanently removed and cannot be recovered. This cannot be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
      />
    </Stack>
  );
}

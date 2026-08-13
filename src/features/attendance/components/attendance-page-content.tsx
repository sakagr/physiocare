"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  Box,
  Button,
  Card,
  Group,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconClipboardList } from "@tabler/icons-react";
import { DataState, EmptyState, PageHeader, StatusBadge, useCan } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth/current-user-context";
import type { Attendance } from "@/types/contracts/attendance";
import { checkOut } from "../api";
import { attendanceListQueryOptions, attendanceQueryKeys } from "../queries";
import {
  ATTENDANCE_STATUS_OPTIONS,
  attendanceStatusLabel,
  attendanceStatusRole,
  describeStoredWindow,
} from "../schemas";
import { MarkAttendanceDialog } from "./mark-attendance-dialog";

const PAGE_SIZE = 20;

/**
 * The Attendance destination (`UX.md` → Screen Inventory).
 *
 * **Reached by all four org roles**, with no capability on its nav item
 * (F6, D11): a physiotherapist to self-mark, a receptionist to record for
 * staff, Owner/Admin for both. One capability field could not express that,
 * and `listOrganizationAttendance` already scopes the board correctly --
 * org-wide for management, accessible clinics for a receptionist, own records
 * for everyone else.
 *
 * Three separate gates inside:
 *  - `attendance:record` — the self-mark affordance.
 *  - `attendance:manage` — recording for others, and corrections.
 *  - `attendance:oversee` — the org-wide framing (the user and clinic
 *    filters, and the staff column).
 */
export function AttendancePageContent() {
  const currentUser = useCurrentUser();
  const canRecordOwn = useCan("attendance:record");
  const canManageOthers = useCan("attendance:manage");
  const canOversee = useCan("attendance:oversee");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [marking, setMarking] = useState(false);
  const [correcting, setCorrecting] = useState<Attendance | null>(null);

  const query = useQuery(
    attendanceListQueryOptions({
      page,
      limit: PAGE_SIZE,
      status: status ?? undefined,
      clinicId: clinicId ?? undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
  );

  const checkingOut = useMutation({
    mutationFn: (attendance: Attendance) => checkOut(attendance.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all });
      notifications.show({ color: "success", message: "Checked out." });
    },
  });

  const items = query.data?.items ?? [];
  const canMarkAnything = canRecordOwn || canManageOthers;

  return (
    <>
      <PageHeader
        title="Attendance"
        description={
          canOversee ? "Staff attendance and physiotherapist availability." : "Your attendance record."
        }
        primaryAction={
          canMarkAnything
            ? { label: canRecordOwn ? "Mark attendance" : "Record for staff", onClick: () => setMarking(true) }
            : undefined
        }
      />

      <Stack gap="md" pb="xl">
        <Group gap="sm" wrap="wrap">
          <Select
            aria-label="Status"
            placeholder="Any status"
            data={ATTENDANCE_STATUS_OPTIONS}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            clearable
            w={170}
          />
          {canOversee && (
            <Select
              aria-label="Clinic"
              placeholder="Any clinic"
              data={currentUser.clinics.map((clinic) => ({ value: clinic.id, label: clinic.name }))}
              value={clinicId}
              onChange={(value) => {
                setClinicId(value);
                setPage(1);
              }}
              clearable
              w={190}
            />
          )}
          <Group gap="xs" wrap="nowrap">
            <input
              aria-label="From date"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.currentTarget.value);
                setPage(1);
              }}
            />
            <input
              aria-label="To date"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.currentTarget.value);
                setPage(1);
              }}
            />
          </Group>
        </Group>

        <DataState
          isLoading={query.isPending}
          isError={query.isError}
          error={query.error}
          onRetry={() => query.refetch()}
          isEmpty={items.length === 0}
          skeleton={
            <Stack gap="sm">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} height={52} radius="sm" />
              ))}
            </Stack>
          }
          empty={
            <EmptyState
              icon={<IconClipboardList size={24} stroke={1.5} />}
              title="No attendance recorded"
              description="Attendance marked for this period will appear here."
              action={
                canMarkAnything ? { label: "Mark attendance", onClick: () => setMarking(true) } : undefined
              }
            />
          }
        >
          <Box visibleFrom="sm">
            <Table.ScrollContainer minWidth={640}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Unavailable</Table.Th>
                    <Table.Th>Checked in</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((attendance) => (
                    <Table.Tr key={attendance.id}>
                      <Table.Td>{attendance.attendance_date}</Table.Td>
                      <Table.Td>
                        <StatusBadge
                          role={attendanceStatusRole(attendance.status)}
                          label={attendanceStatusLabel(attendance.status)}
                        />
                      </Table.Td>
                      <Table.Td>
                        {describeStoredWindow(attendance.unavailable_from, attendance.unavailable_to) ?? "—"}
                      </Table.Td>
                      <Table.Td>{attendance.check_in_time ? attendance.check_in_time.slice(11, 16) : "—"}</Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="flex-end">
                          {attendance.check_in_time && !attendance.check_out_time && (
                            <Button
                              size="compact-xs"
                              variant="light"
                              loading={checkingOut.isPending}
                              onClick={() => checkingOut.mutate(attendance)}
                            >
                              Check out
                            </Button>
                          )}
                          {canManageOthers && (
                            <Button size="compact-xs" variant="subtle" onClick={() => setCorrecting(attendance)}>
                              Correct
                            </Button>
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
            {items.map((attendance) => (
              <Card key={attendance.id} withBorder padding="sm">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={500}>{attendance.attendance_date}</Text>
                    <Text size="sm" c="dimmed">
                      {describeStoredWindow(attendance.unavailable_from, attendance.unavailable_to) ?? "—"}
                    </Text>
                  </Stack>
                  <StatusBadge
                    role={attendanceStatusRole(attendance.status)}
                    label={attendanceStatusLabel(attendance.status)}
                  />
                </Group>
              </Card>
            ))}
          </Stack>

          {(query.data?.totalPages ?? 0) > 1 && (
            <Group justify="center">
              <Pagination value={page} onChange={setPage} total={query.data?.totalPages ?? 0} />
            </Group>
          )}
        </DataState>
      </Stack>

      <MarkAttendanceDialog
        key={marking ? "mark-open" : "mark-closed"}
        opened={marking}
        onClose={() => setMarking(false)}
        canRecordOwn={canRecordOwn}
        canManageOthers={canManageOthers}
      />

      <MarkAttendanceDialog
        key={correcting?.id ?? "no-correction"}
        opened={correcting !== null}
        onClose={() => setCorrecting(null)}
        canRecordOwn={canRecordOwn}
        canManageOthers={canManageOthers}
        correcting={correcting ?? undefined}
      />
    </>
  );
}

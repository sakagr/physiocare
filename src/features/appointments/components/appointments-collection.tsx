"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  Group,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconCalendarEvent } from "@tabler/icons-react";
import { DataState, EmptyState, StatusBadge } from "@/components/ui";
import type { AppointmentRead } from "@/types/contracts/appointment";
import { appointmentsListQueryOptions } from "../queries";
import { appointmentStatusLabel, appointmentStatusRole, APPOINTMENT_STATUS_OPTIONS } from "../status";

const PAGE_SIZE = 20;

function AppointmentsSkeleton() {
  return (
    <Stack gap="sm">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} height={52} radius="sm" />
      ))}
    </Stack>
  );
}

/** `2026-08-13T09:30:00Z` → `13 Aug 2026, 09:30`. */
export function formatAppointmentTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

export interface AppointmentsCollectionProps {
  /**
   * Whether the caller holds `appointments:oversee`. Controls the *framing*
   * only -- the physiotherapist filter and column. A physiotherapist's list
   * is by definition all their own, and a receptionist's is bounded to their
   * clinics by the service, so those controls are noise for them rather than
   * a leak. The rows themselves are scoped server-side either way.
   */
  canOversee: boolean;
  /** Clinics the caller may work in, from `/me`. */
  clinicOptions: { value: string; label: string }[];
  /** Physiotherapists for the filter; only ever supplied to an overseer. */
  physiotherapistOptions?: { value: string; label: string }[];
  /** Fixed patient scope, for the Patient Workspace tab. */
  patientId?: string;
  onSelect?: (appointment: AppointmentRead) => void;
  emptyAction?: { label: string; onClick: () => void };
  rowActions?: (appointment: AppointmentRead) => React.ReactNode;
}

export function AppointmentsCollection({
  canOversee,
  clinicOptions,
  physiotherapistOptions = [],
  patientId,
  onSelect,
  emptyAction,
  rowActions,
}: AppointmentsCollectionProps) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [physiotherapistId, setPhysiotherapistId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const query = useQuery(
    appointmentsListQueryOptions({
      page,
      limit: PAGE_SIZE,
      patientId,
      status: status ?? undefined,
      clinicId: clinicId ?? undefined,
      physiotherapistId: physiotherapistId ?? undefined,
      dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
    })
  );

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 0;

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <Stack gap="md" pb="xl">
      <Group gap="sm" wrap="wrap">
        <Select
          aria-label="Status"
          placeholder="Any status"
          data={APPOINTMENT_STATUS_OPTIONS}
          value={status}
          onChange={resetToFirstPage(setStatus)}
          clearable
          w={170}
        />
        <Select
          aria-label="Clinic"
          placeholder="Any clinic"
          data={clinicOptions}
          value={clinicId}
          onChange={resetToFirstPage(setClinicId)}
          clearable
          w={190}
        />
        {canOversee && (
          <Select
            aria-label="Physiotherapist"
            placeholder="Any physiotherapist"
            data={physiotherapistOptions}
            value={physiotherapistId}
            onChange={resetToFirstPage(setPhysiotherapistId)}
            clearable
            w={210}
          />
        )}
        <Group gap="xs" wrap="nowrap">
          <input
            aria-label="From date"
            type="date"
            value={dateFrom}
            onChange={(event) => resetToFirstPage(setDateFrom)(event.currentTarget.value)}
          />
          <input
            aria-label="To date"
            type="date"
            value={dateTo}
            onChange={(event) => resetToFirstPage(setDateTo)(event.currentTarget.value)}
          />
        </Group>
      </Group>

      <DataState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        isEmpty={items.length === 0}
        skeleton={<AppointmentsSkeleton />}
        empty={
          <EmptyState
            icon={<IconCalendarEvent size={24} stroke={1.5} />}
            title="No appointments"
            description="Appointments booked for this schedule will appear here."
            action={emptyAction}
          />
        }
      >
        <Box visibleFrom="sm">
          <Table.ScrollContainer minWidth={720}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>When</Table.Th>
                  <Table.Th>Patient</Table.Th>
                  {canOversee && <Table.Th>Physiotherapist</Table.Th>}
                  <Table.Th>Clinic</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((appointment) => (
                  <Table.Tr
                    key={appointment.id}
                    onClick={() => onSelect?.(appointment)}
                    style={onSelect ? { cursor: "pointer" } : undefined}
                  >
                    <Table.Td>{formatAppointmentTime(appointment.appointment_time)}</Table.Td>
                    {/* Names, never ids: the read response embeds them (D1). */}
                    <Table.Td>{appointment.patient?.full_name ?? "—"}</Table.Td>
                    {canOversee && <Table.Td>{appointment.physiotherapist?.full_name ?? "—"}</Table.Td>}
                    <Table.Td>{appointment.clinic?.clinic_name ?? "—"}</Table.Td>
                    <Table.Td>
                      <StatusBadge
                        role={appointmentStatusRole(appointment.status)}
                        label={appointmentStatusLabel(appointment.status)}
                      />
                    </Table.Td>
                    <Table.Td>{rowActions?.(appointment)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Box>

        <Stack gap="sm" hiddenFrom="sm">
          {items.map((appointment) => (
            <Card
              key={appointment.id}
              withBorder
              padding="sm"
              onClick={() => onSelect?.(appointment)}
              style={onSelect ? { cursor: "pointer" } : undefined}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2}>
                  <Text fw={500}>{appointment.patient?.full_name ?? "—"}</Text>
                  <Text size="sm" c="dimmed">
                    {formatAppointmentTime(appointment.appointment_time)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {appointment.clinic?.clinic_name ?? "—"}
                    {canOversee && appointment.physiotherapist
                      ? ` · ${appointment.physiotherapist.full_name}`
                      : ""}
                  </Text>
                </Stack>
                <Stack gap="xs" align="flex-end">
                  <StatusBadge
                    role={appointmentStatusRole(appointment.status)}
                    label={appointmentStatusLabel(appointment.status)}
                  />
                  {rowActions?.(appointment)}
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>

        {totalPages > 1 && (
          <Group justify="center">
            <Pagination value={page} onChange={setPage} total={totalPages} />
          </Group>
        )}
      </DataState>
    </Stack>
  );
}

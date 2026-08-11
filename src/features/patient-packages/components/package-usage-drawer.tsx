"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton, Stack, Table, Text } from "@mantine/core";
import { IconCalendarCheck } from "@tabler/icons-react";
import { DataState, DetailDrawer, EmptyState } from "@/components/ui";
import type { PatientPackage } from "@/types/contracts/patient-package";
import { packageUsageQueryOptions } from "../queries";

const PAGE_SIZE = 50;

/**
 * Session usage for one assignment (M6).
 *
 * **Read-only by construction.** Sessions are consumed only by
 * `transitionAppointmentStatus` → `consumePackageSession`, and corrections
 * run through `DELETE /api/appointments/{id}/package-session` -- both F6
 * surfaces. F5 ships no affordance that can create or remove a usage row.
 *
 * The row is thin because the table is: `appointment_id`, `used_on`, and ids,
 * and nothing else. V1 renders the date and a count rather than appointment
 * context, because the response carries none; the natural home for a richer
 * usage row is F6, where the appointment surfaces live.
 *
 * **The empty state is the normal state during F5** and reads as such, never
 * as an error or a missing feature.
 */
export interface PackageUsageDrawerProps {
  assignment: PatientPackage | null;
  onClose: () => void;
}

export function PackageUsageDrawer({ assignment, onClose }: PackageUsageDrawerProps) {
  const query = useQuery(packageUsageQueryOptions(assignment?.id ?? "", { page: 1, limit: PAGE_SIZE }));

  return (
    <DetailDrawer
      opened={assignment !== null}
      onClose={onClose}
      title={assignment ? `${assignment.package_name} — sessions` : "Sessions"}
    >
      <Stack gap="md">
        {assignment && (
          <Text size="sm" c="dimmed">
            {assignment.used_sessions} of {assignment.total_sessions} used · {assignment.remaining_sessions} remaining
          </Text>
        )}

        <DataState
          isLoading={query.isPending}
          isError={query.isError}
          error={query.error}
          onRetry={() => query.refetch()}
          isEmpty={query.data?.items.length === 0}
          skeleton={<Skeleton height={120} radius="sm" />}
          empty={
            <EmptyState
              icon={<IconCalendarCheck size={24} stroke={1.5} />}
              title="No sessions used yet"
              description="Sessions are recorded when a package-linked appointment is completed."
            />
          }
        >
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Used on</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(query.data?.items ?? []).map((usage, index) => (
                <Table.Tr key={usage.id}>
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>{usage.used_on.slice(0, 10)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataState>
      </Stack>
    </DetailDrawer>
  );
}

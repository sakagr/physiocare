"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { Box, Card, Group, Pagination, Select, Skeleton, Stack, Table, Text, TextInput } from "@mantine/core";
import { IconBuildingHospital, IconSearch } from "@tabler/icons-react";
import { DataState, EmptyState, StatusBadge } from "@/components/ui";
import { clinicsListQueryOptions } from "../queries";

const PAGE_SIZE = 20;

function ClinicsSkeleton() {
  return (
    <Stack gap="sm">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} height={52} radius="sm" />
      ))}
    </Stack>
  );
}

export interface ClinicsCollectionProps {
  onSelectClinic: (clinicId: string) => void;
  canCreate: boolean;
  onCreate: () => void;
}

export function ClinicsCollection({ onSelectClinic, canCreate, onCreate }: ClinicsCollectionProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [isActive, setIsActive] = useState<string | null>(null);

  const filters = {
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    isActive: isActive === null ? undefined : isActive === "active",
  };

  const query = useQuery(clinicsListQueryOptions(filters));

  return (
    <Stack gap="md" pb="xl">
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Search by name, email, or city"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
          style={{ flex: 1, minWidth: 240 }}
        />
        <Select
          placeholder="All statuses"
          data={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          value={isActive}
          onChange={(value) => {
            setIsActive(value);
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
        skeleton={<ClinicsSkeleton />}
        empty={
          <EmptyState
            icon={<IconBuildingHospital size={24} stroke={1.5} />}
            title="No clinics yet"
            description="Locations you add to the organization will appear here."
            action={canCreate ? { label: "New clinic", onClick: onCreate } : undefined}
          />
        }
      >
        <Box visibleFrom="sm">
          <Table.ScrollContainer minWidth={560}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>City</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(query.data?.items ?? []).map((clinic) => (
                  <Table.Tr
                    key={clinic.id}
                    onClick={() => onSelectClinic(clinic.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <Table.Td>{clinic.clinic_name}</Table.Td>
                    <Table.Td>{clinic.city ?? "—"}</Table.Td>
                    <Table.Td>{clinic.phone ?? "—"}</Table.Td>
                    <Table.Td>
                      <StatusBadge
                        role={clinic.is_active ? "success" : "neutral"}
                        label={clinic.is_active ? "Active" : "Inactive"}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Box>

        <Stack gap="sm" hiddenFrom="sm">
          {(query.data?.items ?? []).map((clinic) => (
            <Card
              key={clinic.id}
              withBorder
              padding="sm"
              onClick={() => onSelectClinic(clinic.id)}
              style={{ cursor: "pointer" }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={500}>{clinic.clinic_name}</Text>
                  <Text size="xs" c="dimmed">
                    {clinic.city ?? "—"}
                  </Text>
                </Stack>
                <StatusBadge
                  role={clinic.is_active ? "success" : "neutral"}
                  label={clinic.is_active ? "Active" : "Inactive"}
                />
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
    </Stack>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { Box, Card, Group, Pagination, Select, Skeleton, Stack, Table, Text, TextInput } from "@mantine/core";
import { IconPackage, IconSearch } from "@tabler/icons-react";
import { DataState, EmptyState, StatusBadge } from "@/components/ui";
import type { Package } from "@/types/contracts/package";
import { packagesListQueryOptions } from "../queries";
import { PackageStatusActions } from "./package-status-actions";

const PAGE_SIZE = 20;

function PackagesSkeleton() {
  return (
    <Stack gap="sm">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} height={52} radius="sm" />
      ))}
    </Stack>
  );
}

export interface PackagesCollectionProps {
  canCreate: boolean;
  onCreate: () => void;
  onEdit: (pkg: Package) => void;
}

export function PackagesCollection({ canCreate, onCreate, onEdit }: PackagesCollectionProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [isActive, setIsActive] = useState<string | null>(null);

  const query = useQuery(
    packagesListQueryOptions({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      isActive: isActive === null ? undefined : isActive === "active",
    })
  );

  return (
    <Stack gap="md" pb="xl">
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Search packages"
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
        skeleton={<PackagesSkeleton />}
        empty={
          <EmptyState
            icon={<IconPackage size={24} stroke={1.5} />}
            title="No packages yet"
            description="Session packages you offer patients will appear here."
            action={canCreate ? { label: "New package", onClick: onCreate } : undefined}
          />
        }
      >
        <Box visibleFrom="sm">
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Sessions</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Validity</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(query.data?.items ?? []).map((pkg) => (
                  <Table.Tr key={pkg.id}>
                    <Table.Td>{pkg.package_name}</Table.Td>
                    <Table.Td>{pkg.total_sessions}</Table.Td>
                    <Table.Td>{pkg.package_price}</Table.Td>
                    <Table.Td>{pkg.validity_days} days</Table.Td>
                    <Table.Td>
                      <StatusBadge
                        role={pkg.is_active ? "success" : "neutral"}
                        label={pkg.is_active ? "Active" : "Inactive"}
                      />
                    </Table.Td>
                    <Table.Td>
                      <PackageStatusActions package={pkg} onEdit={onEdit} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Box>

        <Stack gap="sm" hiddenFrom="sm">
          {(query.data?.items ?? []).map((pkg) => (
            <Card key={pkg.id} withBorder padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={500}>{pkg.package_name}</Text>
                  <Text size="xs" c="dimmed">
                    {pkg.total_sessions} sessions · {pkg.package_price} · {pkg.validity_days} days
                  </Text>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                  <StatusBadge
                    role={pkg.is_active ? "success" : "neutral"}
                    label={pkg.is_active ? "Active" : "Inactive"}
                  />
                  <PackageStatusActions package={pkg} onEdit={onEdit} />
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
    </Stack>
  );
}

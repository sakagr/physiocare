"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
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
  TextInput,
} from "@mantine/core";
import { IconSearch, IconUsers } from "@tabler/icons-react";
import { DataState, EmptyState, StatusBadge } from "@/components/ui";
import type { ManageableUser } from "@/types/contracts/user";
import { usersListQueryOptions } from "../queries";

const PAGE_SIZE = 20;

function UsersSkeleton() {
  return (
    <Stack gap="sm">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} height={52} radius="sm" />
      ))}
    </Stack>
  );
}

interface UsersCollectionProps {
  /** Opens the detail drawer for the clicked row. */
  onSelectUser: (userId: string) => void;
  /** Whether the caller may create a user, for the empty state's action. */
  canCreate: boolean;
  onCreate: () => void;
}

export function UsersCollection({ onSelectUser, canCreate, onCreate }: UsersCollectionProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [role, setRole] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<string | null>(null);

  const filters = {
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    role: role ?? undefined,
    isActive: isActive === null ? undefined : isActive === "active",
  };

  const query = useQuery(usersListQueryOptions(filters));
  const roleOptions = (query.data?.assignableRoles ?? []).map((option) => ({
    value: option.name,
    label: option.display_name,
  }));

  return (
    <Stack gap="md" pb="xl">
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Search by name, username, email, or phone"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
          style={{ flex: 1, minWidth: 240 }}
        />
        <Select
          placeholder="All roles"
          data={roleOptions}
          value={role}
          onChange={(value) => {
            setRole(value);
            setPage(1);
          }}
          clearable
          w={200}
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
        skeleton={<UsersSkeleton />}
        empty={
          <EmptyState
            icon={<IconUsers size={24} stroke={1.5} />}
            title="No users yet"
            description="People you add to the organization will appear here."
            action={canCreate ? { label: "New user", onClick: onCreate } : undefined}
          />
        }
      >
        <Box visibleFrom="sm">
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Username</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(query.data?.items ?? []).map((user) => (
                  <Table.Tr
                    key={user.id}
                    onClick={() => onSelectUser(user.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <Table.Td>{user.full_name}</Table.Td>
                    <Table.Td>{user.username}</Table.Td>
                    <Table.Td>{user.role.display_name}</Table.Td>
                    <Table.Td>
                      <StatusBadge
                        role={user.is_active ? "success" : "neutral"}
                        label={user.is_active ? "Active" : "Inactive"}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Box>

        <Stack gap="sm" hiddenFrom="sm">
          {(query.data?.items ?? []).map((user: ManageableUser) => (
            <Card
              key={user.id}
              withBorder
              padding="sm"
              onClick={() => onSelectUser(user.id)}
              style={{ cursor: "pointer" }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={500}>{user.full_name}</Text>
                  <Text size="xs" c="dimmed">
                    {user.username} · {user.role.display_name}
                  </Text>
                </Stack>
                <StatusBadge
                  role={user.is_active ? "success" : "neutral"}
                  label={user.is_active ? "Active" : "Inactive"}
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

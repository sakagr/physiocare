"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui";
import { usersListQueryOptions } from "../queries";
import { CreateUserDialog } from "./create-user-dialog";
import { UserDetailDrawer } from "./user-detail-drawer";
import { UsersCollection } from "./users-collection";

const DEFAULT_FILTERS = { page: 1, limit: 20 };

/**
 * The `/app/users` destination's client content, behind the page's
 * capability guard. Sources `assignableRoles` from the same page-1 list
 * fetch `UsersCollection` issues by default (identical filters hash to the
 * same query key, so this shares its cache rather than doubling the
 * request) -- avoids a dedicated assignable-roles endpoint (FL9 fallback).
 */
export function UsersPageContent() {
  const [createOpened, setCreateOpened] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const rolesQuery = useQuery(usersListQueryOptions(DEFAULT_FILTERS));
  const roleOptions = rolesQuery.data?.assignableRoles ?? [];

  return (
    <>
      <PageHeader
        title="Users"
        description="Browse the people in your organization."
        primaryAction={{ label: "New user", onClick: () => setCreateOpened(true) }}
      />

      <UsersCollection
        onSelectUser={setSelectedUserId}
        canCreate
        onCreate={() => setCreateOpened(true)}
      />

      <CreateUserDialog
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        roleOptions={roleOptions}
      />

      <UserDetailDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        roleOptions={roleOptions}
      />
    </>
  );
}

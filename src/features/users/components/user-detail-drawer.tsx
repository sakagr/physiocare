"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Button, Divider, Stack, Text } from "@mantine/core";
import { ConfirmDialog, DataState, DetailDrawer, StatusBadge, useCan } from "@/components/ui";
import { UserClinicsSection } from "@/features/user-clinics";
import { userDetailQueryOptions, usersQueryKeys } from "../queries";
import { activateUser, deactivateUser, offboardUser } from "../api";
import { EditUserDialog } from "./edit-user-dialog";
import { ChangeRoleDialog } from "./change-role-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { CompensationSection } from "./compensation-section";

/**
 * User detail & compensation (UX.md screen inventory: Drawer, Owner/Admin,
 * compensation: Owner). Row actions in the footer are gated on the
 * server-computed `canManage` hint (ADR-0010) -- advisory only, the service
 * layer remains the security boundary. Compensation is gated separately on
 * the `compensation:view` capability token (D1), independent of `canManage`.
 */
export interface UserDetailDrawerProps {
  userId: string | null;
  onClose: () => void;
  /** Server-supplied (D9), for the change-role dialog's picker. */
  roleOptions: { name: string; display_name: string }[];
}

export function UserDetailDrawer({ userId, onClose, roleOptions }: UserDetailDrawerProps) {
  const queryClient = useQueryClient();
  const canViewCompensation = useCan("compensation:view");
  const [editOpened, setEditOpened] = useState(false);
  const [roleOpened, setRoleOpened] = useState(false);
  const [resetOpened, setResetOpened] = useState(false);
  const [activateConfirmOpened, setActivateConfirmOpened] = useState(false);
  const [offboardOpened, setOffboardOpened] = useState(false);

  const query = useQuery({ ...userDetailQueryOptions(userId ?? ""), enabled: Boolean(userId) });
  const user = query.data;

  function invalidateUser() {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: usersQueryKeys.detail(userId) });
    queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
  }

  const activate = useMutation({
    mutationFn: () => activateUser(userId!),
    onSuccess: () => {
      invalidateUser();
      notifications.show({ color: "success", message: "User activated." });
      setActivateConfirmOpened(false);
    },
  });
  const deactivate = useMutation({
    mutationFn: () => deactivateUser(userId!),
    onSuccess: () => {
      invalidateUser();
      notifications.show({ color: "success", message: "User deactivated." });
      setActivateConfirmOpened(false);
    },
  });
  const offboard = useMutation({
    mutationFn: () => offboardUser(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
      notifications.show({ color: "success", message: "User off-boarded." });
      setOffboardOpened(false);
      onClose();
    },
  });

  return (
    <>
      <DetailDrawer
        opened={Boolean(userId)}
        onClose={onClose}
        title={user?.full_name ?? "User"}
        subtitle={user ? `${user.role.display_name} · ${user.username}` : undefined}
        footer={
          user?.canManage ? (
            <>
              <Button variant="default" onClick={() => setEditOpened(true)}>
                Edit
              </Button>
              <Button variant="default" onClick={() => setRoleOpened(true)}>
                Change role
              </Button>
              <Button variant="default" onClick={() => setResetOpened(true)}>
                Reset password
              </Button>
              <Button
                variant="default"
                color={user.is_active ? "danger" : undefined}
                onClick={() => setActivateConfirmOpened(true)}
              >
                {user.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button color="danger" onClick={() => setOffboardOpened(true)}>
                Off-board
              </Button>
            </>
          ) : undefined
        }
      >
        <DataState
          isLoading={query.isPending}
          isError={query.isError}
          error={query.error}
          onRetry={() => query.refetch()}
          skeleton={
            <Text size="sm" c="dimmed">
              Loading…
            </Text>
          }
        >
          {user && (
            <Stack gap="md">
              <StatusBadge
                role={user.is_active ? "success" : "neutral"}
                label={user.is_active ? "Active" : "Inactive"}
              />
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Email
                </Text>
                <Text>{user.email}</Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Phone
                </Text>
                <Text>{user.phone ?? "—"}</Text>
              </Stack>

              <Divider />
              <UserClinicsSection userId={user.id} />

              {canViewCompensation && (
                <>
                  <Divider />
                  <CompensationSection userId={user.id} />
                </>
              )}
            </Stack>
          )}
        </DataState>
      </DetailDrawer>

      {user && (
        <>
          <EditUserDialog
            opened={editOpened}
            onClose={() => setEditOpened(false)}
            userId={user.id}
            defaultValues={{ fullName: user.full_name, phone: user.phone ?? "" }}
          />
          <ChangeRoleDialog
            opened={roleOpened}
            onClose={() => setRoleOpened(false)}
            userId={user.id}
            currentRoleName={user.role.name}
            roleOptions={roleOptions}
          />
          <ResetPasswordDialog
            opened={resetOpened}
            onClose={() => setResetOpened(false)}
            userId={user.id}
            userName={user.full_name}
          />
          <ConfirmDialog
            opened={activateConfirmOpened}
            onClose={() => setActivateConfirmOpened(false)}
            onConfirm={() => (user.is_active ? deactivate.mutate() : activate.mutate())}
            title={user.is_active ? "Deactivate user?" : "Activate user?"}
            target={user.full_name}
            consequence={
              user.is_active
                ? "They lose access until reactivated."
                : "They regain access immediately."
            }
            confirmLabel={user.is_active ? "Deactivate" : "Activate"}
            danger={user.is_active}
            loading={activate.isPending || deactivate.isPending}
          />
          <ConfirmDialog
            opened={offboardOpened}
            onClose={() => setOffboardOpened(false)}
            onConfirm={() => offboard.mutate()}
            title="Off-board user?"
            target={user.full_name}
            consequence="This is terminal: they lose access permanently and cannot be reactivated. Their record is retained for audit history."
            confirmLabel="Off-board"
            loading={offboard.isPending}
          />
        </>
      )}
    </>
  );
}

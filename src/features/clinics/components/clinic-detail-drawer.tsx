"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Button, Divider, Stack, Text } from "@mantine/core";
import { Can, ConfirmDialog, DataState, DetailDrawer, StatusBadge } from "@/components/ui";
import { ClinicMembersSection } from "@/features/user-clinics";
import { clinicDetailQueryOptions, clinicsQueryKeys } from "../queries";
import { activateClinic, deactivateClinic } from "../api";
import { ClinicFormDialog } from "./clinic-form-dialog";

/**
 * Clinic detail (UX.md screen inventory: "Clinic detail & user–clinic
 * assignment", Drawer, Owner/Admin), including the member-list half (M6).
 * Gated on the flat `clinics:manage` capability -- clinics have no per-row
 * hierarchy like users do, so there is no server-computed `canManage` hint
 * here.
 */
export interface ClinicDetailDrawerProps {
  clinicId: string | null;
  onClose: () => void;
}

export function ClinicDetailDrawer({ clinicId, onClose }: ClinicDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [editOpened, setEditOpened] = useState(false);
  const [confirmOpened, setConfirmOpened] = useState(false);

  const query = useQuery({ ...clinicDetailQueryOptions(clinicId ?? ""), enabled: Boolean(clinicId) });
  const clinic = query.data;

  function invalidateClinic() {
    if (!clinicId) return;
    queryClient.invalidateQueries({ queryKey: clinicsQueryKeys.detail(clinicId) });
    queryClient.invalidateQueries({ queryKey: clinicsQueryKeys.all });
  }

  const activate = useMutation({
    mutationFn: () => activateClinic(clinicId!),
    onSuccess: () => {
      invalidateClinic();
      notifications.show({ color: "success", message: "Clinic activated." });
      setConfirmOpened(false);
    },
  });
  const deactivate = useMutation({
    mutationFn: () => deactivateClinic(clinicId!),
    onSuccess: () => {
      invalidateClinic();
      notifications.show({ color: "success", message: "Clinic deactivated." });
      setConfirmOpened(false);
    },
  });

  return (
    <>
      <DetailDrawer
        opened={Boolean(clinicId)}
        onClose={onClose}
        title={clinic?.clinic_name ?? "Clinic"}
        footer={
          clinic ? (
            <Can capability="clinics:manage">
              <>
                <Button variant="default" onClick={() => setEditOpened(true)}>
                  Edit
                </Button>
                <Button
                  variant="default"
                  color={clinic.is_active ? "danger" : undefined}
                  onClick={() => setConfirmOpened(true)}
                >
                  {clinic.is_active ? "Deactivate" : "Activate"}
                </Button>
              </>
            </Can>
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
          {clinic && (
            <Stack gap="md">
              <StatusBadge
                role={clinic.is_active ? "success" : "neutral"}
                label={clinic.is_active ? "Active" : "Inactive"}
              />
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Email
                </Text>
                <Text>{clinic.email ?? "—"}</Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Phone
                </Text>
                <Text>{clinic.phone ?? "—"}</Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Address
                </Text>
                <Text>
                  {[clinic.address, clinic.city, clinic.state, clinic.pincode].filter(Boolean).join(", ") || "—"}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  GST number
                </Text>
                <Text>{clinic.gst_number ?? "—"}</Text>
              </Stack>

              <Divider />
              <ClinicMembersSection clinicId={clinic.id} />
            </Stack>
          )}
        </DataState>
      </DetailDrawer>

      {clinic && (
        <>
          <ClinicFormDialog
            opened={editOpened}
            onClose={() => setEditOpened(false)}
            clinicId={clinic.id}
            defaultValues={{
              clinicName: clinic.clinic_name,
              email: clinic.email ?? "",
              phone: clinic.phone ?? "",
              address: clinic.address ?? "",
              city: clinic.city ?? "",
              state: clinic.state ?? "",
              pincode: clinic.pincode ?? "",
              gstNumber: clinic.gst_number ?? "",
            }}
          />
          <ConfirmDialog
            opened={confirmOpened}
            onClose={() => setConfirmOpened(false)}
            onConfirm={() => (clinic.is_active ? deactivate.mutate() : activate.mutate())}
            title={clinic.is_active ? "Deactivate clinic?" : "Activate clinic?"}
            target={clinic.clinic_name}
            consequence={
              clinic.is_active
                ? "Staff can no longer be assigned or booked here until reactivated."
                : "It becomes available for assignment and booking again."
            }
            confirmLabel={clinic.is_active ? "Deactivate" : "Activate"}
            danger={clinic.is_active}
            loading={activate.isPending || deactivate.isPending}
          />
        </>
      )}
    </>
  );
}

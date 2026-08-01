"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Button, Group, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useCan } from "@/lib/auth/current-user-context";
import type { OrganizationDetail } from "@/types/contracts/organization";
import { updateOrganizationProfile } from "../api";
import { organizationQueryKeys } from "../queries";
import { organizationProfileFormSchema, type OrganizationProfileFormValues } from "../schemas";

export interface OrganizationTabProps {
  organization: OrganizationDetail;
}

/**
 * Organization tab: Owner/SUPER_ADMIN (`organization:manage`) may edit the
 * name and default currency; ORG_ADMIN opens Settings (`settings:manage`)
 * but sees a read-only view of the same fields (decision 4, F4 plan).
 */
export function OrganizationTab({ organization }: OrganizationTabProps) {
  const canEdit = useCan("organization:manage");

  if (!canEdit) {
    return (
      <Paper withBorder p="lg" radius="md">
        <Stack gap="md">
          <Title order={3} fz="h4">
            Organization profile
          </Title>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Organization name
            </Text>
            <Text>{organization.organizationName}</Text>
          </Stack>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Default currency
            </Text>
            <Text>{organization.defaultCurrencyCode ?? "Not set"}</Text>
          </Stack>
          <Text size="sm" c="dimmed">
            Only the Owner can edit these fields.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return <OrganizationProfileForm organization={organization} />;
}

function OrganizationProfileForm({ organization }: OrganizationTabProps) {
  const queryClient = useQueryClient();
  const defaultValues: OrganizationProfileFormValues = {
    organizationName: organization.organizationName,
    defaultCurrencyCode: organization.defaultCurrencyCode ?? "",
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<OrganizationProfileFormValues>({
    resolver: zodResolver(organizationProfileFormSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization.organizationName, organization.defaultCurrencyCode, reset]);

  const mutation = useMutation({
    mutationFn: (values: OrganizationProfileFormValues) =>
      updateOrganizationProfile(organization.id, {
        organizationName: values.organizationName,
        defaultCurrencyCode: values.defaultCurrencyCode || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationQueryKeys.detail(organization.id) });
      notifications.show({ color: "success", message: "Organization profile updated." });
    },
  });

  return (
    <Paper withBorder p="lg" radius="md">
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Stack gap="md">
          <Title order={3} fz="h4">
            Organization profile
          </Title>

          <TextInput
            label="Organization name"
            error={errors.organizationName?.message}
            {...register("organizationName")}
          />
          <TextInput
            label="Default currency"
            description="3-letter ISO 4217 code, e.g. USD"
            placeholder="USD"
            error={errors.defaultCurrencyCode?.message}
            {...register("defaultCurrencyCode")}
          />

          <Group justify="flex-end">
            <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { notifications } from "@mantine/notifications";
import { Button, Group, NumberInput, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { DataState } from "@/components/ui";
import { userCompensationQueryOptions, usersQueryKeys } from "../queries";
import { setUserCompensation } from "../api";
import { setCompensationFormSchema, type SetCompensationFormValues } from "../schemas";

const TYPE_LABELS: Record<string, string> = {
  none: "None",
  percentage: "Percentage",
  fixed: "Fixed",
};

const TYPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed" },
];

/**
 * Compensation view and set form (D1/D2/ADR-0011). Owner-only -- the caller
 * gates mounting this on the `compensation:view` capability; the read
 * endpoint itself would refuse an Admin regardless. History is full and
 * newest-first (D2), not just the current-effective record.
 */
export function CompensationSection({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery(userCompensationQueryOptions(userId));

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SetCompensationFormValues>({
    resolver: zodResolver(setCompensationFormSchema),
    defaultValues: { type: "none", value: 0, effectiveFrom: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: SetCompensationFormValues) =>
      setUserCompensation(userId, { ...values, effectiveFrom: values.effectiveFrom || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.compensation(userId) });
      notifications.show({ color: "success", message: "Compensation updated." });
      reset({ type: "none", value: 0, effectiveFrom: "" });
    },
  });

  return (
    <Stack gap="md">
      <Text fw={500}>Compensation</Text>

      <DataState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        isEmpty={query.data?.length === 0}
        skeleton={
          <Text size="sm" c="dimmed">
            Loading compensation history…
          </Text>
        }
        empty={
          <Text size="sm" c="dimmed">
            No compensation has been set yet.
          </Text>
        }
      >
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Effective from</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Value</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(query.data ?? []).map((record) => (
              <Table.Tr key={record.id}>
                <Table.Td>{record.effective_from}</Table.Td>
                <Table.Td>{TYPE_LABELS[record.type]}</Table.Td>
                <Table.Td>{record.value}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataState>

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Stack gap="sm">
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select
                label="Type"
                data={TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "none")}
                error={errors.type?.message}
              />
            )}
          />
          <Controller
            name="value"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Value"
                value={field.value}
                onChange={(value) => field.onChange(value === "" ? 0 : value)}
                error={errors.value?.message}
              />
            )}
          />
          <TextInput
            label="Effective from"
            placeholder="YYYY-MM-DD (defaults to today)"
            error={errors.effectiveFrom?.message}
            {...register("effectiveFrom")}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={mutation.isPending}>
              Save compensation
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}

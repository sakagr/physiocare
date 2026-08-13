"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Button, Card, Group, Skeleton, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { IconNotes } from "@tabler/icons-react";
import { DataState, EmptyState, FormDialog } from "@/components/ui";
import { applyFieldErrors } from "@/lib/api/apply-field-errors";
import {
  LIMIT_ENFORCEMENT_CODES,
  LimitEnforcementState,
  limitEnforcementCode,
} from "@/features/organization";
import type { Prescription } from "@/types/contracts/prescription";
import { createPrescription, updatePrescription } from "../api";
import { prescriptionsQueryKeys, prescriptionsQueryOptions } from "../queries";
import {
  prescriptionFormSchema,
  EMPTY_PRESCRIPTION_FORM_VALUES,
  type PrescriptionFormValues,
} from "../schemas";

/**
 * Prescriptions for one consultation, as an inline section of the
 * Consultation destination (`UX.md` → Screen Inventory) rather than a
 * separate surface.
 *
 * **No delete affordance**, deliberately: no delete path exists server-side
 * (no `deleted_at`, no service function, no route) and `UX.md` never asks for
 * one -- it mentions only *edit prescription*. A recorded absence, not a gap.
 *
 * Gated on the appointment's `canManageConsultation` hint rather than a
 * second one (D14): a consultation's physiotherapist is copied from its
 * appointment and cannot afterwards diverge, so `canManagePrescription`
 * agrees with it for every prescription reachable here.
 */
export interface PrescriptionsSectionProps {
  consultationId: string;
  canManage: boolean;
}

export function PrescriptionsSection({ consultationId, canManage }: PrescriptionsSectionProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Prescription | null>(null);
  const [enforcement, setEnforcement] = useState<ReturnType<typeof limitEnforcementCode>>(null);

  const query = useQuery(prescriptionsQueryOptions(consultationId));

  const form = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionFormSchema),
    defaultValues: EMPTY_PRESCRIPTION_FORM_VALUES,
  });

  const opened = creating || editing !== null;

  function open(prescription: Prescription | null) {
    setEnforcement(null);
    form.reset(
      prescription
        ? { advice: prescription.advice ?? "", followupDate: prescription.followup_date ?? "" }
        : EMPTY_PRESCRIPTION_FORM_VALUES
    );
    if (prescription) setEditing(prescription);
    else setCreating(true);
  }

  function close() {
    setCreating(false);
    setEditing(null);
  }

  const save = useMutation({
    mutationFn: (values: PrescriptionFormValues) =>
      editing
        ? updatePrescription(editing.id, values)
        : createPrescription(consultationId, values),
    meta: { suppressToastForCodes: LIMIT_ENFORCEMENT_CODES },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: prescriptionsQueryKeys.forConsultation(consultationId),
      });
      notifications.show({ color: "success", message: editing ? "Prescription updated." : "Prescription added." });
      close();
    },
    onError: (error) => {
      setEnforcement(limitEnforcementCode(error));
      applyFieldErrors(error, form.setError);
    },
  });

  const items = query.data?.items ?? [];

  return (
    <Card withBorder padding="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={3} size="h4">
            Prescriptions
          </Title>
          {canManage && (
            <Button size="xs" variant="light" onClick={() => open(null)}>
              Add prescription
            </Button>
          )}
        </Group>

        <DataState
          isLoading={query.isPending}
          isError={query.isError}
          error={query.error}
          onRetry={() => query.refetch()}
          isEmpty={items.length === 0}
          skeleton={<Skeleton height={72} radius="sm" />}
          empty={
            <EmptyState
              icon={<IconNotes size={24} stroke={1.5} />}
              title="No prescriptions"
              description="Advice recorded for this visit will appear here."
              action={canManage ? { label: "Add prescription", onClick: () => open(null) } : undefined}
            />
          }
        >
          <Stack gap="sm">
            {items.map((prescription) => (
              <Card key={prescription.id} withBorder padding="sm">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2}>
                    <Text size="sm">{prescription.advice || "—"}</Text>
                    {prescription.followup_date && (
                      <Text size="xs" c="dimmed">
                        Follow up on {prescription.followup_date}
                      </Text>
                    )}
                  </Stack>
                  {canManage && (
                    <Button size="compact-xs" variant="subtle" onClick={() => open(prescription)}>
                      Edit
                    </Button>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        </DataState>
      </Stack>

      <FormDialog
        opened={opened}
        onClose={close}
        title={editing ? "Edit prescription" : "Add prescription"}
        submitLabel={editing ? "Save changes" : "Add prescription"}
        isDirty={form.formState.isDirty}
        isSubmitting={save.isPending}
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
      >
        <Stack gap="sm">
          {enforcement && <LimitEnforcementState code={enforcement} />}
          <Controller
            control={form.control}
            name="advice"
            render={({ field, fieldState }) => (
              <Textarea {...field} label="Advice" rows={4} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="followupDate"
            render={({ field, fieldState }) => (
              <TextInput {...field} type="date" label="Follow-up date" error={fieldState.error?.message} />
            )}
          />
        </Stack>
      </FormDialog>
    </Card>
  );
}

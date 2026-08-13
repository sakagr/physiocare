"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Button, Card, Group, MultiSelect, NumberInput, Stack, Textarea, Title } from "@mantine/core";
import { applyFieldErrors } from "@/lib/api/apply-field-errors";
import {
  LIMIT_ENFORCEMENT_CODES,
  LimitEnforcementState,
  limitEnforcementCode,
} from "@/features/organization";
import { resyncOnConflict } from "@/features/appointments";
import type { Consultation } from "@/types/contracts/consultation";
import { createConsultation, updateConsultation } from "../api";
import { consultationsQueryKeys } from "../queries";
import {
  consultationFormSchema,
  EMPTY_CONSULTATION_FORM_VALUES,
  PAIN_AREA_OPTIONS,
  type ConsultationFormValues,
} from "../schemas";

/**
 * Record or edit the consultation for one appointment.
 *
 * One form serves both intents: whether it creates or updates is decided by
 * whether a consultation exists, which the destination already knows from
 * `GET /api/appointments/{id}/consultation`. Nothing here creates blind and
 * catches `CONSULTATION_ALREADY_EXISTS` -- 409-as-control-flow was rejected
 * in D5, and that code is handled here only as the genuine race it describes.
 *
 * `SUBSCRIPTION_REQUIRED` renders the dedicated enforcement state inline:
 * `UX.md`'s enforcement rule pre-assigns *edit consultation* to it, and the
 * same rule applies to create through one form.
 */
export interface ConsultationFormProps {
  appointmentId: string;
  consultation: Consultation | null;
  /** From the appointment's `canManageConsultation` hint. */
  canManage: boolean;
}

function toFormValues(consultation: Consultation | null): ConsultationFormValues {
  if (!consultation) return EMPTY_CONSULTATION_FORM_VALUES;
  return {
    symptoms: consultation.symptoms ?? "",
    painAreas: consultation.pain_areas ?? [],
    painScale: consultation.pain_scale ?? "",
    diagnosisNotes: consultation.diagnosis_notes ?? "",
    followupNotes: consultation.followup_notes ?? "",
  };
}

export function ConsultationForm({ appointmentId, consultation, canManage }: ConsultationFormProps) {
  const queryClient = useQueryClient();
  const [enforcement, setEnforcement] = useState<ReturnType<typeof limitEnforcementCode>>(null);

  const form = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationFormSchema),
    defaultValues: toFormValues(consultation),
  });

  const invalidateKeys: readonly unknown[][] = [
    [...consultationsQueryKeys.forAppointment(appointmentId)],
  ];

  const save = useMutation({
    mutationFn: (values: ConsultationFormValues) => {
      const payload = {
        symptoms: values.symptoms,
        painAreas: values.painAreas,
        painScale: values.painScale === "" || values.painScale === undefined ? undefined : Number(values.painScale),
        diagnosisNotes: values.diagnosisNotes,
        followupNotes: values.followupNotes,
      };
      return consultation
        ? updateConsultation(consultation.id, payload)
        : createConsultation(appointmentId, payload);
    },
    meta: { suppressToastForCodes: LIMIT_ENFORCEMENT_CODES },
    onSuccess: () => {
      for (const queryKey of invalidateKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
      notifications.show({
        color: "success",
        message: consultation ? "Consultation updated." : "Consultation recorded.",
      });
      form.reset(form.getValues());
    },
    onError: (error) => {
      setEnforcement(limitEnforcementCode(error));
      resyncOnConflict(queryClient, error, invalidateKeys);
      applyFieldErrors(error, form.setError);
    },
  });

  return (
    <Card withBorder padding="lg">
      <form onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <Stack gap="sm">
          <Title order={3} size="h4">
            {consultation ? "Consultation" : "Record consultation"}
          </Title>

          {enforcement && <LimitEnforcementState code={enforcement} />}

          <Controller
            control={form.control}
            name="symptoms"
            render={({ field }) => (
              <Textarea {...field} label="Symptoms" rows={3} readOnly={!canManage} />
            )}
          />

          <Controller
            control={form.control}
            name="painAreas"
            render={({ field }) => (
              <MultiSelect
                label="Pain areas"
                data={PAIN_AREA_OPTIONS}
                value={field.value ?? []}
                onChange={field.onChange}
                readOnly={!canManage}
                searchable
              />
            )}
          />

          <Controller
            control={form.control}
            name="painScale"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Pain scale (0–10)"
                min={0}
                max={10}
                value={field.value}
                onChange={field.onChange}
                readOnly={!canManage}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={form.control}
            name="diagnosisNotes"
            render={({ field }) => (
              <Textarea {...field} label="Diagnosis notes" rows={3} readOnly={!canManage} />
            )}
          />

          <Controller
            control={form.control}
            name="followupNotes"
            render={({ field }) => (
              <Textarea {...field} label="Follow-up notes" rows={2} readOnly={!canManage} />
            )}
          />

          {canManage && (
            <Group justify="flex-end">
              <Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}>
                {consultation ? "Save changes" : "Record consultation"}
              </Button>
            </Group>
          )}
        </Stack>
      </form>
    </Card>
  );
}

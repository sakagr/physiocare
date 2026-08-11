"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Text, TextInput } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { LimitEnforcementState, LIMIT_ENFORCEMENT_CODES, limitEnforcementCode } from "@/features/organization";
import type { PatientPackage } from "@/types/contracts/patient-package";
import { extendPatientPackageValidity } from "../api";
import { patientPackagesQueryKeys } from "../queries";
import { extendValidityFormSchema, type ExtendValidityFormValues } from "../schemas";

/**
 * Extend an assignment's validity. A form dialog over a gated write, so it
 * renders the dedicated enforcement state and stays open with input intact
 * (UX.md → *Limit / subscription enforcement*). The surface, not the verb,
 * decides: a dialog that stays open can host a persistent, role-aware
 * message; a confirm that closes cannot.
 */
export interface ExtendValidityDialogProps {
  opened: boolean;
  onClose: () => void;
  assignment: PatientPackage | null;
}

export function ExtendValidityDialog({ opened, onClose, assignment }: ExtendValidityDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ExtendValidityFormValues>({
    resolver: zodResolver(extendValidityFormSchema),
    defaultValues: { extendedValidityTo: "" },
  });

  useEffect(() => {
    if (opened) {
      reset({ extendedValidityTo: assignment?.extended_validity_to ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, reset]);

  const mutation = useMutation({
    mutationFn: (values: ExtendValidityFormValues) =>
      extendPatientPackageValidity(assignment!.id, values.extendedValidityTo),
    meta: { suppressToastForCodes: LIMIT_ENFORCEMENT_CODES },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientPackagesQueryKeys.all });
      notifications.show({ color: "success", message: "Validity extended." });
      onClose();
    },
  });

  const enforcementCode = limitEnforcementCode(mutation.error);

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title="Extend validity"
      submitLabel="Extend"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      {enforcementCode && <LimitEnforcementState code={enforcementCode} />}
      {assignment && (
        <Text size="sm" c="dimmed">
          {assignment.package_name} currently expires on {assignment.extended_validity_to ?? assignment.expiry_date}.
        </Text>
      )}
      <TextInput
        label="New expiry date"
        placeholder="YYYY-MM-DD"
        error={errors.extendedValidityTo?.message}
        {...register("extendedValidityTo")}
      />
    </FormDialog>
  );
}

"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { NumberInput, TextInput } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { applyFieldErrors } from "@/lib/api/apply-field-errors";
import { LimitEnforcementState, LIMIT_ENFORCEMENT_CODES, limitEnforcementCode } from "@/features/organization";
import { createPackage, updatePackage } from "../api";
import { packagesQueryKeys } from "../queries";
import { packageFormSchema, EMPTY_PACKAGE_FORM_VALUES, type PackageFormValues } from "../schemas";

/**
 * Create/edit a catalogue package (UX.md → Flow 11). One dialog for both --
 * `packageId` present means edit. A form dialog, so `SUBSCRIPTION_REQUIRED`
 * renders the dedicated enforcement state above the footer with the input
 * intact rather than closing behind a toast.
 */
export interface PackageFormDialogProps {
  opened: boolean;
  onClose: () => void;
  /** Present for edit; absent for create. */
  packageId?: string;
  defaultValues?: PackageFormValues;
}

export function PackageFormDialog({ opened, onClose, packageId, defaultValues }: PackageFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(packageId);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: defaultValues ?? EMPTY_PACKAGE_FORM_VALUES,
  });

  useEffect(() => {
    if (opened) {
      reset(defaultValues ?? EMPTY_PACKAGE_FORM_VALUES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, reset]);

  const mutation = useMutation({
    mutationFn: (values: PackageFormValues) =>
      packageId ? updatePackage(packageId, values) : createPackage(values),
    meta: { suppressToastForCodes: LIMIT_ENFORCEMENT_CODES },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packagesQueryKeys.all });
      notifications.show({ color: "success", message: isEdit ? "Package updated." : "Package created." });
      onClose();
    },
    onError: (error) => {
      applyFieldErrors(error, setError, {
        PACKAGE_NAME_ALREADY_EXISTS: "packageName",
      });
    },
  });

  const enforcementCode = limitEnforcementCode(mutation.error);

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit package" : "Create package"}
      submitLabel={isEdit ? "Save changes" : "Create package"}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      {enforcementCode && <LimitEnforcementState code={enforcementCode} />}
      <TextInput label="Package name" error={errors.packageName?.message} {...register("packageName")} />
      <Controller
        name="totalSessions"
        control={control}
        render={({ field }) => (
          <NumberInput
            label="Sessions"
            min={1}
            value={field.value}
            onChange={(value) => field.onChange(value === "" ? 0 : Number(value))}
            error={errors.totalSessions?.message}
          />
        )}
      />
      <Controller
        name="packagePrice"
        control={control}
        render={({ field }) => (
          <NumberInput
            label="Price"
            min={0}
            value={field.value}
            onChange={(value) => field.onChange(value === "" ? 0 : Number(value))}
            error={errors.packagePrice?.message}
          />
        )}
      />
      <Controller
        name="validityDays"
        control={control}
        render={({ field }) => (
          <NumberInput
            label="Validity (days)"
            min={1}
            value={field.value}
            onChange={(value) => field.onChange(value === "" ? 0 : Number(value))}
            error={errors.validityDays?.message}
          />
        )}
      />
    </FormDialog>
  );
}

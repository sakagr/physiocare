"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Select, TextInput } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { LimitEnforcementState, LIMIT_ENFORCEMENT_CODES, limitEnforcementCode } from "@/features/organization";
import { assignPackage } from "../api";
import { patientPackagesQueryKeys } from "../queries";
import {
  assignPackageFormSchema,
  EMPTY_ASSIGN_PACKAGE_FORM_VALUES,
  type AssignPackageFormValues,
} from "../schemas";

/**
 * Assign a catalogue package to a patient (UX.md → Flow 11).
 *
 * **The package options are a prop, not a query this feature owns.** Fetching
 * them here would make `patient-packages` depend on `packages`; the route
 * composes the two instead, which keeps both features independent in either
 * direction and is what lets either be moved without touching the other.
 *
 * Multiple concurrent assignments are allowed (UX.md:216), so nothing here
 * blocks a second active package.
 */
export interface AssignPackageDialogProps {
  opened: boolean;
  onClose: () => void;
  patientId: string;
  /** Active catalogue packages, supplied by the route-level composition. */
  packageOptions: { value: string; label: string }[];
}

export function AssignPackageDialog({ opened, onClose, patientId, packageOptions }: AssignPackageDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AssignPackageFormValues>({
    resolver: zodResolver(assignPackageFormSchema),
    defaultValues: EMPTY_ASSIGN_PACKAGE_FORM_VALUES,
  });

  useEffect(() => {
    if (opened) {
      reset(EMPTY_ASSIGN_PACKAGE_FORM_VALUES);
    }
  }, [opened, reset]);

  const mutation = useMutation({
    mutationFn: (values: AssignPackageFormValues) =>
      assignPackage(patientId, {
        packageId: values.packageId,
        purchasedOn: values.purchasedOn || undefined,
      }),
    meta: { suppressToastForCodes: LIMIT_ENFORCEMENT_CODES },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientPackagesQueryKeys.allForPatient(patientId) });
      notifications.show({ color: "success", message: "Package assigned." });
      onClose();
    },
  });

  const enforcementCode = limitEnforcementCode(mutation.error);

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title="Assign package"
      submitLabel="Assign"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      {enforcementCode && <LimitEnforcementState code={enforcementCode} />}
      <Controller
        name="packageId"
        control={control}
        render={({ field }) => (
          <Select
            label="Package"
            placeholder="Choose a package"
            data={packageOptions}
            value={field.value || null}
            onChange={(value) => field.onChange(value ?? "")}
            searchable
            error={errors.packageId?.message}
          />
        )}
      />
      <TextInput
        label="Purchase date"
        placeholder="YYYY-MM-DD (defaults to today)"
        error={errors.purchasedOn?.message}
        {...register("purchasedOn")}
      />
    </FormDialog>
  );
}

"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { TextInput } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { applyFieldErrors } from "@/lib/api/apply-field-errors";
import { LimitEnforcementState, LIMIT_ENFORCEMENT_CODES, limitEnforcementCode } from "@/features/organization";
import { createClinic, updateClinic } from "../api";
import { clinicsQueryKeys } from "../queries";
import { clinicFormSchema, EMPTY_CLINIC_FORM_VALUES, type ClinicFormValues } from "../schemas";

/**
 * Create/edit clinic (UX.md → Flow 10 step 1). One dialog for both --
 * `clinicId` present means edit. `ORGANIZATION_NAME_ALREADY_EXISTS` is what
 * the duplicate-name conflict throws on this domain too (readiness review
 * §2), mapped onto `clinicName` here rather than the default clinic-blind
 * copy. Only the create path can hit `SUBSCRIPTION_REQUIRED`/
 * `ORGANIZATION_LIMIT_EXCEEDED`, which render the dedicated role-varying
 * state (F4 M6) instead of the F3-era generic toast.
 */
export interface ClinicFormDialogProps {
  opened: boolean;
  onClose: () => void;
  /** Present for edit; absent for create. */
  clinicId?: string;
  defaultValues?: ClinicFormValues;
}

export function ClinicFormDialog({ opened, onClose, clinicId, defaultValues }: ClinicFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(clinicId);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ClinicFormValues>({
    resolver: zodResolver(clinicFormSchema),
    defaultValues: defaultValues ?? EMPTY_CLINIC_FORM_VALUES,
  });

  useEffect(() => {
    if (opened) {
      reset(defaultValues ?? EMPTY_CLINIC_FORM_VALUES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, reset]);

  const mutation = useMutation({
    mutationFn: (values: ClinicFormValues) => {
      const input = {
        ...values,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        pincode: values.pincode || undefined,
        gstNumber: values.gstNumber || undefined,
      };
      return clinicId ? updateClinic(clinicId, input) : createClinic(input);
    },
    meta: { suppressToastForCodes: LIMIT_ENFORCEMENT_CODES },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clinicsQueryKeys.all });
      if (clinicId) {
        queryClient.invalidateQueries({ queryKey: clinicsQueryKeys.detail(clinicId) });
      }
      notifications.show({ color: "success", message: isEdit ? "Clinic updated." : "Clinic created." });
      onClose();
    },
    onError: (error) => {
      applyFieldErrors(error, setError, {
        ORGANIZATION_NAME_ALREADY_EXISTS: "clinicName",
      });
    },
  });

  const enforcementCode = limitEnforcementCode(mutation.error);

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit clinic" : "Create clinic"}
      submitLabel={isEdit ? "Save changes" : "Create clinic"}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      {enforcementCode && <LimitEnforcementState code={enforcementCode} />}
      <TextInput label="Clinic name" error={errors.clinicName?.message} {...register("clinicName")} />
      <TextInput label="Email" type="email" error={errors.email?.message} {...register("email")} />
      <TextInput label="Phone" error={errors.phone?.message} {...register("phone")} />
      <TextInput label="Address" error={errors.address?.message} {...register("address")} />
      <TextInput label="City" error={errors.city?.message} {...register("city")} />
      <TextInput label="State" error={errors.state?.message} {...register("state")} />
      <TextInput label="Pincode" error={errors.pincode?.message} {...register("pincode")} />
      <TextInput label="GST number" error={errors.gstNumber?.message} {...register("gstNumber")} />
    </FormDialog>
  );
}

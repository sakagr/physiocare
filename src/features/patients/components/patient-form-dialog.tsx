"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Select, TextInput, Textarea } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { applyFieldErrors } from "@/lib/api/apply-field-errors";
import { LimitEnforcementState, LIMIT_ENFORCEMENT_CODES, limitEnforcementCode } from "@/features/organization";
import { createPatient, updatePatient } from "../api";
import { patientsQueryKeys } from "../queries";
import {
  patientFormSchema,
  EMPTY_PATIENT_FORM_VALUES,
  GENDER_OPTIONS,
  type PatientFormValues,
} from "../schemas";
import { DuplicateWarning } from "./duplicate-warning";

/**
 * Create/edit a patient (UX.md → Flow 4). One dialog for both -- `patientId`
 * present means edit. A form dialog, so `SUBSCRIPTION_REQUIRED` renders the
 * dedicated enforcement state above the footer with the input intact rather
 * than closing behind a toast.
 *
 * The patient code is generated server-side and is immutable, so it is never
 * an input here.
 */
export interface PatientFormDialogProps {
  opened: boolean;
  onClose: () => void;
  /** Present for edit; absent for create. */
  patientId?: string;
  defaultValues?: PatientFormValues;
}

export function PatientFormDialog({ opened, onClose, patientId, defaultValues }: PatientFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(patientId);
  const [duplicateSearch, setDuplicateSearch] = useState("");

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: defaultValues ?? EMPTY_PATIENT_FORM_VALUES,
  });

  // Only `reset` here: it is react-hook-form's imperative API, not React
  // state. The duplicate-search term is reset by remounting instead -- call
  // sites key this dialog on `opened` -- because a setState in an effect
  // cascades a render.
  useEffect(() => {
    if (opened) {
      reset(defaultValues ?? EMPTY_PATIENT_FORM_VALUES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, reset]);

  const mutation = useMutation({
    mutationFn: (values: PatientFormValues) => {
      const input = {
        fullName: values.fullName,
        gender: values.gender || undefined,
        dob: values.dob || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
        emergencyContact: values.emergencyContact || undefined,
      };
      return patientId ? updatePatient(patientId, input) : createPatient(input);
    },
    meta: { suppressToastForCodes: LIMIT_ENFORCEMENT_CODES },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientsQueryKeys.all });
      notifications.show({ color: "success", message: isEdit ? "Patient updated." : "Patient created." });
      onClose();
    },
    onError: (error) => {
      applyFieldErrors(error, setError);
    },
  });

  const enforcementCode = limitEnforcementCode(mutation.error);

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit patient" : "New patient"}
      submitLabel={isEdit ? "Save changes" : "Create patient"}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      {enforcementCode && <LimitEnforcementState code={enforcementCode} />}

      {/* Create only: in edit mode the patient would match itself. */}
      {!isEdit && <DuplicateWarning search={duplicateSearch} />}

      <TextInput
        label="Full name"
        error={errors.fullName?.message}
        {...register("fullName", {
          onBlur: (event) => setDuplicateSearch(event.currentTarget.value),
        })}
      />
      <Controller
        name="gender"
        control={control}
        render={({ field }) => (
          <Select
            label="Gender"
            data={GENDER_OPTIONS}
            value={field.value || null}
            onChange={(value) => field.onChange(value ?? "")}
            clearable
            error={errors.gender?.message}
          />
        )}
      />
      <TextInput
        label="Date of birth"
        placeholder="YYYY-MM-DD"
        error={errors.dob?.message}
        {...register("dob")}
      />
      <TextInput
        label="Phone"
        error={errors.phone?.message}
        {...register("phone", {
          onBlur: (event) => setDuplicateSearch(event.currentTarget.value),
        })}
      />
      <TextInput label="Email" type="email" error={errors.email?.message} {...register("email")} />
      <Textarea label="Address" minRows={2} error={errors.address?.message} {...register("address")} />
      <TextInput
        label="Emergency contact"
        error={errors.emergencyContact?.message}
        {...register("emergencyContact")}
      />
    </FormDialog>
  );
}

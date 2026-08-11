"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { FileInput, Select, TextInput, Textarea } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { LimitEnforcementState, LIMIT_ENFORCEMENT_CODES, limitEnforcementCode } from "@/features/organization";
import { uploadPatientRecord } from "../api";
import { patientsQueryKeys } from "../queries";
import {
  recordUploadFormSchema,
  EMPTY_RECORD_UPLOAD_FORM_VALUES,
  RECORD_TYPE_OPTIONS,
  ALLOWED_RECORD_MIME_TYPES,
  MAX_RECORD_FILE_BYTES,
  type RecordUploadFormValues,
} from "../schemas";

/**
 * Upload a patient record (UX.md → Flow 4).
 *
 * The file limits mirror the route's own (`records/route.ts`), which stays
 * authoritative -- this is a courtesy so a 20 MiB upload fails before it is
 * sent, not a second source of truth.
 *
 * A form dialog, so `SUBSCRIPTION_REQUIRED` renders the dedicated enforcement
 * state with the chosen file and typed title intact.
 */
export interface RecordUploadDialogProps {
  opened: boolean;
  onClose: () => void;
  patientId: string;
}

export function RecordUploadDialog({ opened, onClose, patientId }: RecordUploadDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<RecordUploadFormValues>({
    resolver: zodResolver(recordUploadFormSchema),
    defaultValues: EMPTY_RECORD_UPLOAD_FORM_VALUES,
  });

  // Only `reset` here; the chosen file and its error are cleared by
  // remounting instead (the call site keys this on `opened`), since a
  // setState in an effect cascades a render.
  useEffect(() => {
    if (opened) {
      reset(EMPTY_RECORD_UPLOAD_FORM_VALUES);
    }
  }, [opened, reset]);

  const mutation = useMutation({
    mutationFn: (values: RecordUploadFormValues) =>
      uploadPatientRecord(patientId, {
        file: file!,
        recordType: values.recordType,
        title: values.title,
        notes: values.notes || undefined,
      }),
    meta: { suppressToastForCodes: LIMIT_ENFORCEMENT_CODES },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientsQueryKeys.allRecords(patientId) });
      notifications.show({ color: "success", message: "Record uploaded." });
      onClose();
    },
  });

  const validateFile = (): boolean => {
    if (!file) {
      setFileError("Choose a file to upload.");
      return false;
    }
    if (file.size === 0) {
      setFileError("That file is empty.");
      return false;
    }
    if (file.size > MAX_RECORD_FILE_BYTES) {
      setFileError("Files must be 20 MiB or smaller.");
      return false;
    }
    if (!ALLOWED_RECORD_MIME_TYPES.includes(file.type)) {
      setFileError("Upload a PDF, JPEG, PNG, or WebP.");
      return false;
    }
    setFileError(null);
    return true;
  };

  const enforcementCode = limitEnforcementCode(mutation.error);

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title="Upload record"
      submitLabel="Upload"
      onSubmit={handleSubmit((values) => {
        if (validateFile()) {
          mutation.mutate(values);
        }
      })}
      isDirty={isDirty || file !== null}
      isSubmitting={mutation.isPending}
    >
      {enforcementCode && <LimitEnforcementState code={enforcementCode} />}
      <FileInput
        label="File"
        placeholder="PDF, JPEG, PNG, or WebP — up to 20 MiB"
        accept={ALLOWED_RECORD_MIME_TYPES.join(",")}
        value={file}
        onChange={(next) => {
          setFile(next);
          setFileError(null);
        }}
        error={fileError}
      />
      <Controller
        name="recordType"
        control={control}
        render={({ field }) => (
          <Select
            label="Record type"
            data={RECORD_TYPE_OPTIONS}
            value={field.value || null}
            onChange={(value) => field.onChange(value ?? "")}
            error={errors.recordType?.message}
          />
        )}
      />
      <TextInput label="Title" error={errors.title?.message} {...register("title")} />
      <Textarea label="Notes" minRows={2} error={errors.notes?.message} {...register("notes")} />
    </FormDialog>
  );
}

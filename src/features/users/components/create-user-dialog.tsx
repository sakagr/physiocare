"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Modal, Select, TextInput } from "@mantine/core";
import { FormDialog, RevealOnce } from "@/components/ui";
import { applyFieldErrors } from "@/lib/api/apply-field-errors";
import { createUser } from "../api";
import { usersQueryKeys } from "../queries";
import { createUserFormSchema, type CreateUserFormValues } from "../schemas";

/**
 * Create user (UX.md → Flow 9 step 1): on success, swaps the dialog's body
 * into the reveal-once success state rather than closing and opening a
 * second dialog -- the initial password is part of this same command's
 * result, not a separate fetch. Per D8, a 402/403 (subscription/limit
 * enforcement) needs no bespoke handling here: the global mutation cache
 * already toasts it, and this dialog never calls `onClose` from `onError`,
 * so it stays open with the typed input intact by construction.
 */
export interface CreateUserDialogProps {
  opened: boolean;
  onClose: () => void;
  /** Server-supplied (D9) -- the client never hardcodes role names. */
  roleOptions: { name: string; display_name: string }[];
}

export function CreateUserDialog({ opened, onClose, roleOptions }: CreateUserDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: { fullName: "", username: "", email: "", phone: "", role: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateUserFormValues) =>
      createUser({ ...values, phone: values.phone || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
    onError: (error) => {
      applyFieldErrors(error, setError, {
        EMAIL_ALREADY_EXISTS: "email",
        USERNAME_ALREADY_EXISTS: "username",
      });
    },
  });

  // Each opening starts clean -- a half-typed form or a stale reveal-once
  // result must never be waiting for whoever opens the dialog next.
  useEffect(() => {
    if (opened) {
      reset();
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, reset]);

  function dismissReveal() {
    if (mutation.data) {
      notifications.show({ color: "success", message: `${mutation.data.username} was created.` });
    }
    mutation.reset();
    onClose();
  }

  if (mutation.isSuccess && mutation.data.initialPassword) {
    return (
      <Modal
        opened={opened}
        onClose={() => {}}
        title="User created"
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <RevealOnce
          label="Initial password"
          value={mutation.data.initialPassword}
          warning={`This is the only time ${mutation.data.username}'s password will be shown. Share it securely -- if lost, it must be reset.`}
          dismissConsequence="You won't be able to see this password again."
          onDismiss={dismissReveal}
        />
      </Modal>
    );
  }

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title="Create user"
      submitLabel="Create user"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      <TextInput label="Full name" error={errors.fullName?.message} {...register("fullName")} />
      <TextInput label="Username" error={errors.username?.message} {...register("username")} />
      <TextInput label="Email" type="email" error={errors.email?.message} {...register("email")} />
      <TextInput label="Phone" error={errors.phone?.message} {...register("phone")} />
      <Controller
        name="role"
        control={control}
        render={({ field }) => (
          <Select
            label="Role"
            placeholder="Select a role"
            data={roleOptions.map((option) => ({ value: option.name, label: option.display_name }))}
            value={field.value || null}
            onChange={(value) => field.onChange(value ?? "")}
            error={errors.role?.message}
          />
        )}
      />
    </FormDialog>
  );
}

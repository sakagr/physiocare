"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { TextInput } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { updateUserProfile } from "../api";
import { usersQueryKeys } from "../queries";
import { editUserFormSchema, type EditUserFormValues } from "../schemas";

/**
 * Edit a user's profile. Username and email have no update path (FL7:
 * `PATCH /api/users/{id}` accepts only `fullName`/`phone`) -- the form does
 * not offer either.
 */
export interface EditUserDialogProps {
  opened: boolean;
  onClose: () => void;
  userId: string;
  defaultValues: EditUserFormValues;
}

export function EditUserDialog({ opened, onClose, userId, defaultValues }: EditUserDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (opened) {
      reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, reset]);

  const mutation = useMutation({
    mutationFn: (values: EditUserFormValues) =>
      updateUserProfile(userId, { ...values, phone: values.phone || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
      notifications.show({ color: "success", message: "Profile updated." });
      onClose();
    },
  });

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title="Edit user"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      <TextInput label="Full name" error={errors.fullName?.message} {...register("fullName")} />
      <TextInput label="Phone" error={errors.phone?.message} {...register("phone")} />
    </FormDialog>
  );
}

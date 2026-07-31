"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Select } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { changeUserRole } from "../api";
import { usersQueryKeys } from "../queries";
import { changeRoleFormSchema, type ChangeRoleFormValues } from "../schemas";

export interface ChangeRoleDialogProps {
  opened: boolean;
  onClose: () => void;
  userId: string;
  currentRoleName: string;
  /** Server-supplied (D9) -- caller-derived, not per-row (FL3). */
  roleOptions: { name: string; display_name: string }[];
}

export function ChangeRoleDialog({
  opened,
  onClose,
  userId,
  currentRoleName,
  roleOptions,
}: ChangeRoleDialogProps) {
  const queryClient = useQueryClient();

  const {
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<ChangeRoleFormValues>({
    resolver: zodResolver(changeRoleFormSchema),
    defaultValues: { role: currentRoleName },
  });

  useEffect(() => {
    if (opened) {
      reset({ role: currentRoleName });
    }
  }, [opened, reset, currentRoleName]);

  const mutation = useMutation({
    mutationFn: (values: ChangeRoleFormValues) => changeUserRole(userId, values.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
      notifications.show({ color: "success", message: "Role changed." });
      onClose();
    },
  });

  return (
    <FormDialog
      opened={opened}
      onClose={onClose}
      title="Change role"
      submitLabel="Change role"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
    >
      <Controller
        name="role"
        control={control}
        render={({ field }) => (
          <Select
            label="Role"
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

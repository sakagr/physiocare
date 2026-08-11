import { z } from "zod";

/**
 * Client form schemas for patient package assignments. Feature-owned and
 * separate from the server validators (AGENTS.md → Forms and Validation).
 */
export const assignPackageFormSchema = z.object({
  packageId: z.string().min(1, { message: "Choose a package." }),
  purchasedOn: z.string().trim().optional(),
});

export type AssignPackageFormValues = z.infer<typeof assignPackageFormSchema>;

export const EMPTY_ASSIGN_PACKAGE_FORM_VALUES: AssignPackageFormValues = {
  packageId: "",
  purchasedOn: "",
};

export const extendValidityFormSchema = z.object({
  extendedValidityTo: z.string().trim().min(1, { message: "Choose a new expiry date." }),
});

export type ExtendValidityFormValues = z.infer<typeof extendValidityFormSchema>;

/** The four statuses `patient_packages_view` derives, for badge styling. */
export const STATUS_ROLES: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  active: "success",
  completed: "neutral",
  expired: "warning",
  cancelled: "danger",
};

export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

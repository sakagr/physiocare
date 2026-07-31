import { z } from "zod";

/**
 * Client form schemas for the Users feature. Feature-owned and separate from
 * the server validators, tailored for form UX (AGENTS.md → Forms and
 * Validation). The server validators remain authoritative; these are
 * advisory. No role-name literal appears here (D9) -- `role` is whatever
 * string the user picked from a server-supplied `assignableRoles` option.
 */

export const createUserFormSchema = z.object({
  fullName: z.string().trim().min(1, { message: "Enter a full name." }),
  username: z.string().trim().min(1, { message: "Enter a username." }),
  email: z
    .string()
    .trim()
    .min(1, { message: "Enter an email address." })
    .email({ message: "Enter a valid email address." }),
  phone: z.string().trim().optional(),
  role: z.string().min(1, { message: "Select a role." }),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export const editUserFormSchema = z.object({
  fullName: z.string().trim().min(1, { message: "Enter a full name." }),
  phone: z.string().trim().optional(),
});

export type EditUserFormValues = z.infer<typeof editUserFormSchema>;

export const changeRoleFormSchema = z.object({
  role: z.string().min(1, { message: "Select a role." }),
});

export type ChangeRoleFormValues = z.infer<typeof changeRoleFormSchema>;

const compensationTypeSchema = z.enum(["none", "percentage", "fixed"]);

export const setCompensationFormSchema = z
  .object({
    type: compensationTypeSchema,
    // A plain number, not `z.coerce.number()`: the Controller-driven
    // NumberInput already supplies a numeric value, and coercion here would
    // split the resolver's input/output types and break zodResolver's
    // generic inference against useForm<SetCompensationFormValues>.
    value: z.number({ message: "Enter a valid value." }),
    effectiveFrom: z.string().optional(),
  })
  .refine((values) => (values.type === "none" ? values.value === 0 : values.value >= 0), {
    message: "Value must be 0 when type is none.",
    path: ["value"],
  })
  .refine((values) => values.type !== "percentage" || (values.value >= 0 && values.value <= 100), {
    message: "A percentage must be between 0 and 100.",
    path: ["value"],
  });

export type SetCompensationFormValues = z.infer<typeof setCompensationFormSchema>;

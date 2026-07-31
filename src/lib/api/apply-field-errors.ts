import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { ApiError } from "./api-error";

/**
 * Maps a failed mutation onto react-hook-form fields, generalizing the
 * single hand-written `if` `change-password-dialog.tsx` used before F3
 * (AGENTS.md -> Error Handling and Types: "inline" is mapped back onto the
 * form field(s) by the screen that owns it -- the global mutation cache
 * intentionally does nothing for it, see `resolveQueryErrorAction`).
 *
 * Handles the two field-attributable shapes the API produces:
 *  - A known `AppError` code, via a caller-supplied code -> field map, since
 *    which field a code applies to is form-specific (e.g. `EMAIL_ALREADY_EXISTS`
 *    lands on `email` in the create-user form, but might land elsewhere in a
 *    different form that also takes an email).
 *  - A 400's Zod `details` issues (`{ path, message }[]`), generic across
 *    every form: each issue's first path segment is the field name.
 *
 * Returns whether anything was mapped, so the caller can decide whether to
 * also focus a field. An error that maps to neither shape needs no handling
 * here -- the global mutation cache already toasts it.
 */
export function applyFieldErrors<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  codeFieldMap: Partial<Record<string, FieldPath<TFieldValues>>> = {}
): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }

  const mappedField = error.code ? codeFieldMap[error.code] : undefined;
  if (mappedField) {
    setError(mappedField, { message: error.message });
    return true;
  }

  if (Array.isArray(error.details)) {
    let applied = false;
    for (const issue of error.details as { path?: unknown[]; message?: string }[]) {
      const field = issue?.path?.[0];
      if (typeof field === "string" && typeof issue.message === "string") {
        setError(field as FieldPath<TFieldValues>, { message: issue.message });
        applied = true;
      }
    }
    return applied;
  }

  return false;
}

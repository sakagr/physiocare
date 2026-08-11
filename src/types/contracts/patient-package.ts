import type { z } from "zod";
import {
  patientPackageSchema,
  patientPackageListResponseSchema,
  packageSessionUsageSchema,
  packageSessionUsageListResponseSchema,
} from "@/contracts/patient-package.contract";

/**
 * Response types for patient package assignments (F5). Client-safe: this
 * module must never import from `src/server` or `src/types/database.ts`.
 * Re-exported `z.infer`s of `src/contracts/patient-package.contract.ts`, the
 * single source both this module and the generated OpenAPI spec derive from
 * (ADR-0008).
 */

/**
 * An assignment as `patient_packages_view` returns it. `status` is derived by
 * the view and is time-dependent -- an `active` row becomes `expired` with no
 * write -- so a client renders what the server sent and never re-derives it.
 */
export type PatientPackage = z.infer<typeof patientPackageSchema>;

/** GET /api/patients/{id}/packages. */
export type PatientPackageListResponse = z.infer<typeof patientPackageListResponseSchema>;

export type PackageSessionUsage = z.infer<typeof packageSessionUsageSchema>;

/** GET /api/patient-packages/{id}/usage. */
export type PackageSessionUsageListResponse = z.infer<typeof packageSessionUsageListResponseSchema>;

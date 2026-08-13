/**
 * Public surface of the `consultations` feature (F6). Cross-feature imports
 * go through this barrel, never deep paths (`AGENTS.md` → *Project
 * Structure*). Explicit named exports only -- never `export *`.
 */
export { consultationsQueryKeys, consultationForAppointmentQueryOptions } from "./queries";
export { ConsultationForm, type ConsultationFormProps } from "./components/consultation-form";
export { ConsultationRouteContent } from "./components/consultation-route-content";
export {
  consultationFormSchema,
  EMPTY_CONSULTATION_FORM_VALUES,
  PAIN_AREA_OPTIONS,
  type ConsultationFormValues,
} from "./schemas";

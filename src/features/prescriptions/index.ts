/**
 * Public surface of the `prescriptions` feature (F6). Cross-feature imports
 * go through this barrel, never deep paths (`AGENTS.md` → *Project
 * Structure*). Explicit named exports only -- never `export *`.
 */
export { prescriptionsQueryKeys, prescriptionsQueryOptions } from "./queries";
export {
  PrescriptionsSection,
  type PrescriptionsSectionProps,
} from "./components/prescriptions-section";

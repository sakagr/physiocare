/**
 * Public surface of the `user-clinics` feature (F3, M6) -- the join between
 * `users` and `clinics`. Cross-feature imports go through this barrel, never
 * deep paths (AGENTS.md → Project Structure). This module depends on
 * neither `users` nor `clinics`, so both may depend on it without a cycle.
 */
export { userClinicsQueryKeys } from "./queries";
export { UserClinicsSection } from "./components/user-clinics-section";
export { ClinicMembersSection } from "./components/clinic-members-section";

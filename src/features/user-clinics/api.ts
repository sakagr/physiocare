import { api } from "@/lib/api/client";
import type { Clinic, ClinicListResponse } from "@/types/contracts/clinic";
import type { UserWithRole, UserListResponse } from "@/types/contracts/user";
import type { UserClinic } from "@/types/contracts/user-clinic";

/**
 * The user-clinic assignment reads and commands. This is the join feature
 * between `users` and `clinics` -- it reads directly against `/api/users`
 * and `/api/clinics` for its own minimal picker lists (id/name only) rather
 * than importing those features' own paginated list queries, so neither
 * sibling feature has to depend on this one (AGENTS.md → Project Structure:
 * dependencies point down, never sideways; `users`/`clinics` depend on this
 * module, this module depends on neither of them).
 */

export function listUserClinics(userId: string): Promise<Clinic[]> {
  return api.get<Clinic[]>(`/api/users/${userId}/clinics`);
}

export function listClinicUsers(clinicId: string): Promise<UserWithRole[]> {
  return api.get<UserWithRole[]>(`/api/clinics/${clinicId}/users`);
}

/**
 * Every active clinic, for the assignment picker only. `limit=100` is the
 * server's actual ceiling (`paginationSchema`'s `max(100)`) -- requesting
 * more 400s the request outright, which an E2E run against a real backend
 * caught (the picker silently showed no options). An organization with more
 * than 100 active clinics would still not see all of them here; that's a
 * pre-existing scale limit of the "fetch everything for a picker" shape,
 * not something this fix attempts to solve.
 */
export function listAllActiveClinics(): Promise<ClinicListResponse> {
  return api.get<ClinicListResponse>("/api/clinics?page=1&limit=100&isActive=true");
}

/** Every active organization user, for the assignment picker only. Same `limit=100` ceiling and caveat as `listAllActiveClinics`. */
export function listAllActiveUsers(): Promise<UserListResponse> {
  return api.get<UserListResponse>("/api/users?page=1&limit=100&isActive=true");
}

export function assignUserToClinic(userId: string, clinicId: string): Promise<UserClinic> {
  return api.post<UserClinic>("/api/user-clinics", { userId, clinicId });
}

/**
 * `DELETE /api/user-clinics` takes query params, not a body (FL6) -- there
 * is no reusable schema for this pair on the wire, so the query string is
 * built by hand here, same as the API Explorer does for the same route.
 */
export function removeUserFromClinic(userId: string, clinicId: string): Promise<UserClinic> {
  const params = new URLSearchParams({ userId, clinicId });
  return api.delete<UserClinic>(`/api/user-clinics?${params.toString()}`);
}

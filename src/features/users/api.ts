import { api } from "@/lib/api/client";
import type {
  UserListResponse,
  UserDetailResponse,
  User,
  CreateOrganizationUserResult,
  UserCompensation,
  UserCompensationHistory,
  ResetUserPasswordResult,
} from "@/types/contracts/user";

/**
 * The Users commands and reads, as typed calls against `/api` (AGENTS.md →
 * Backend Communication). `api.get` takes no params object, so this module
 * owns the query-string builder every list read needs (F3 readiness review,
 * §1).
 */

export interface UserListFilters {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}

function buildQueryString(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters) as [string, string | number | boolean | undefined][]) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listUsers(filters: UserListFilters): Promise<UserListResponse> {
  return api.get<UserListResponse>(`/api/users${buildQueryString(filters)}`);
}

export function getUser(id: string): Promise<UserDetailResponse> {
  return api.get<UserDetailResponse>(`/api/users/${id}`);
}

export interface CreateUserRequest {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  role: string;
}

export function createUser(input: CreateUserRequest): Promise<CreateOrganizationUserResult> {
  return api.post<CreateOrganizationUserResult>("/api/users", input);
}

export interface UpdateUserProfileRequest {
  fullName?: string;
  phone?: string;
}

/** Username and email have no update path here by design (FL7). */
export function updateUserProfile(id: string, input: UpdateUserProfileRequest): Promise<User> {
  return api.patch<User>(`/api/users/${id}`, input);
}

export function activateUser(id: string): Promise<User> {
  return api.post<User>(`/api/users/${id}/activate`);
}

export function deactivateUser(id: string): Promise<User> {
  return api.post<User>(`/api/users/${id}/deactivate`);
}

export function offboardUser(id: string): Promise<User> {
  return api.delete<User>(`/api/users/${id}`);
}

export function changeUserRole(id: string, role: string): Promise<User> {
  return api.post<User>(`/api/users/${id}/change-role`, { role });
}

export function resetUserPassword(id: string): Promise<ResetUserPasswordResult> {
  return api.post<ResetUserPasswordResult>(`/api/users/${id}/reset-password`);
}

export function getUserCompensationHistory(id: string): Promise<UserCompensationHistory> {
  return api.get<UserCompensationHistory>(`/api/users/${id}/compensation`);
}

export interface SetCompensationRequest {
  type: "none" | "percentage" | "fixed";
  value: number;
  effectiveFrom?: string;
}

export function setUserCompensation(id: string, input: SetCompensationRequest): Promise<UserCompensation> {
  return api.post<UserCompensation>(`/api/users/${id}/compensation`, input);
}

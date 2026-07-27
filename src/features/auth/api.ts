import { api } from "@/lib/api/client";

/**
 * The authentication commands, as typed calls against `/api` — the single
 * contract for reads and writes alike (AGENTS.md → Backend Communication).
 * Each returns nothing: the session lives in cookies the route sets, and
 * where the user goes next is the landing resolver's decision.
 */

export interface LoginRequest {
  username: string;
  password: string;
}

export function login(request: LoginRequest): Promise<void> {
  return api.post<void>("/api/auth/login", request);
}

export function logout(): Promise<void> {
  return api.post<void>("/api/auth/logout");
}

export function requestPasswordReset(username: string): Promise<void> {
  return api.post<void>("/api/auth/request-password-reset", { username });
}

export function setPassword(newPassword: string): Promise<void> {
  return api.post<void>("/api/auth/set-password", { newPassword });
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export function changePassword(request: ChangePasswordRequest): Promise<void> {
  return api.post<void>("/api/auth/change-password", request);
}

import { queryOptions } from "@tanstack/react-query";
import { listUsers, getUser, getUserCompensationHistory, type UserListFilters } from "./api";

/**
 * The first hierarchical query-key factory in the app (F3) -- `authQueryKeys`
 * is a flat literal with no `list(filters)`/`detail(id)` precedent.
 */
export const usersQueryKeys = {
  all: ["users"] as const,
  list: (filters: UserListFilters) => ["users", "list", filters] as const,
  detail: (id: string) => ["users", "detail", id] as const,
  compensation: (id: string) => ["users", "compensation", id] as const,
};

export function usersListQueryOptions(filters: UserListFilters) {
  return queryOptions({
    queryKey: usersQueryKeys.list(filters),
    queryFn: () => listUsers(filters),
  });
}

export function userDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: usersQueryKeys.detail(id),
    queryFn: () => getUser(id),
    enabled: Boolean(id),
  });
}

/** Owner-only read (ADR-0011); the caller decides whether to mount this query. */
export function userCompensationQueryOptions(id: string) {
  return queryOptions({
    queryKey: usersQueryKeys.compensation(id),
    queryFn: () => getUserCompensationHistory(id),
    enabled: Boolean(id),
  });
}

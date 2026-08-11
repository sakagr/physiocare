import { queryOptions } from "@tanstack/react-query";
import { listPackages, type PackageListFilters } from "./api";

export const packagesQueryKeys = {
  all: ["packages"] as const,
  list: (filters: PackageListFilters) => ["packages", "list", filters] as const,
};

export function packagesListQueryOptions(filters: PackageListFilters) {
  return queryOptions({
    queryKey: packagesQueryKeys.list(filters),
    queryFn: () => listPackages(filters),
  });
}

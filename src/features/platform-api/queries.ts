import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { OpenApiDocument } from "./spec";

/**
 * Query factories for the platform-api feature (F2). Fetching the spec
 * itself is an ordinary authenticated GET, so it goes through the
 * isomorphic API client like any other resource -- the raw-`fetch`
 * exception (decision #5) is scoped to *executing* an arbitrary operation
 * during try-it-out, whose status/headers/body must survive un-parsed.
 */
export const platformApiQueryKeys = {
  spec: ["platform-api", "spec"] as const,
};

export function platformApiSpecQueryOptions() {
  return queryOptions({
    queryKey: platformApiQueryKeys.spec,
    queryFn: () => api.get<OpenApiDocument>("/api/platform/openapi"),
  });
}

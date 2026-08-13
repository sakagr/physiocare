import { queryOptions } from "@tanstack/react-query";
import { listAttendance, type AttendanceListFilters } from "./api";

export const attendanceQueryKeys = {
  all: ["attendance"] as const,
  list: (filters: AttendanceListFilters) => ["attendance", "list", filters] as const,
};

export function attendanceListQueryOptions(filters: AttendanceListFilters) {
  return queryOptions({
    queryKey: attendanceQueryKeys.list(filters),
    queryFn: () => listAttendance(filters),
  });
}

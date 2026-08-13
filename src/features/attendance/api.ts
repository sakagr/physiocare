import { api } from "@/lib/api/client";
import type {
  Attendance,
  AttendanceListResponse,
  RecordAttendanceResult,
} from "@/types/contracts/attendance";

/** The Attendance reads and commands (F6). */

export interface AttendanceListFilters {
  page: number;
  limit: number;
  userId?: string;
  clinicId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

function buildQueryString(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters) as [string, string | number | undefined][]) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listAttendance(filters: AttendanceListFilters): Promise<AttendanceListResponse> {
  return api.get<AttendanceListResponse>(`/api/attendance${buildQueryString(filters)}`);
}

export interface RecordAttendanceRequest {
  userId?: string;
  clinicId: string;
  attendanceDate?: string;
  status: string;
  notes?: string;
  unavailableFrom?: string;
  unavailableTo?: string;
}

export function recordAttendance(input: RecordAttendanceRequest): Promise<RecordAttendanceResult> {
  return api.post<RecordAttendanceResult>("/api/attendance", input);
}

export interface CorrectAttendanceRequest {
  status?: string;
  notes?: string;
  unavailableFrom?: string;
  unavailableTo?: string;
}

export function correctAttendance(
  id: string,
  input: CorrectAttendanceRequest
): Promise<RecordAttendanceResult> {
  return api.patch<RecordAttendanceResult>(`/api/attendance/${id}`, input);
}

export function checkOut(id: string): Promise<Attendance> {
  return api.patch<Attendance>(`/api/attendance/${id}/checkout`);
}

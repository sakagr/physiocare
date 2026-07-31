import { queryOptions } from "@tanstack/react-query";
import {
  listUserClinics,
  listClinicUsers,
  listAllActiveClinics,
  listAllActiveUsers,
} from "./api";

export const userClinicsQueryKeys = {
  byUser: (userId: string) => ["user-clinics", "byUser", userId] as const,
  byClinic: (clinicId: string) => ["user-clinics", "byClinic", clinicId] as const,
  allActiveClinics: ["user-clinics", "allActiveClinics"] as const,
  allActiveUsers: ["user-clinics", "allActiveUsers"] as const,
};

export function userClinicsByUserQueryOptions(userId: string) {
  return queryOptions({
    queryKey: userClinicsQueryKeys.byUser(userId),
    queryFn: () => listUserClinics(userId),
    enabled: Boolean(userId),
  });
}

export function clinicUsersQueryOptions(clinicId: string) {
  return queryOptions({
    queryKey: userClinicsQueryKeys.byClinic(clinicId),
    queryFn: () => listClinicUsers(clinicId),
    enabled: Boolean(clinicId),
  });
}

export function allActiveClinicsQueryOptions() {
  return queryOptions({
    queryKey: userClinicsQueryKeys.allActiveClinics,
    queryFn: listAllActiveClinics,
  });
}

export function allActiveUsersQueryOptions() {
  return queryOptions({
    queryKey: userClinicsQueryKeys.allActiveUsers,
    queryFn: listAllActiveUsers,
  });
}

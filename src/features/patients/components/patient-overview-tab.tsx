"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, Skeleton, SimpleGrid, Stack, Text } from "@mantine/core";
import { DataState } from "@/components/ui";
import { patientDetailQueryOptions } from "../queries";
import { GENDER_OPTIONS } from "../schemas";

/**
 * Read-only demographics (M3). Any org member may see it
 * (`canViewPatients` → `isActiveOrgMember`). It has no writes of its own --
 * editing is the workspace header's action, so there is exactly one patient
 * form in the product.
 */
export interface PatientOverviewTabProps {
  patientId: string;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm">{value || "—"}</Text>
    </Stack>
  );
}

export function PatientOverviewTab({ patientId }: PatientOverviewTabProps) {
  const query = useQuery(patientDetailQueryOptions(patientId));
  const patient = query.data;

  return (
    <DataState
      isLoading={query.isPending}
      isError={query.isError}
      error={query.error}
      onRetry={() => query.refetch()}
      skeleton={<Skeleton height={200} radius="sm" />}
    >
      {patient && (
        <Card withBorder padding="md">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            <Field label="Full name" value={patient.full_name} />
            <Field label="Patient code" value={patient.patient_code} />
            <Field
              label="Gender"
              value={GENDER_OPTIONS.find((option) => option.value === patient.gender)?.label ?? null}
            />
            <Field label="Date of birth" value={patient.dob} />
            <Field label="Phone" value={patient.phone} />
            <Field label="Email" value={patient.email} />
            <Field label="Address" value={patient.address} />
            <Field label="Emergency contact" value={patient.emergency_contact} />
            <Field label="Added" value={patient.created_at.slice(0, 10)} />
          </SimpleGrid>
        </Card>
      )}
    </DataState>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Alert, Anchor, List, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { patientsListQueryOptions } from "../queries";

/**
 * Advisory duplicate-patient warning (UX.md → Flow 4).
 *
 * **Never blocks submission.** A clinic legitimately has two patients with
 * the same name, and the backend enforces no uniqueness on name or phone --
 * so this is a prompt to look, not a validation error. Shown on create only:
 * in edit mode the patient being edited would match itself.
 *
 * The search runs against the same list endpoint the collection uses, so it
 * sees exactly what the user would see by searching manually.
 */
export interface DuplicateWarningProps {
  /** The blurred full name or phone. Empty disables the lookup. */
  search: string;
}

export function DuplicateWarning({ search }: DuplicateWarningProps) {
  const trimmed = search.trim();
  const query = useQuery({
    ...patientsListQueryOptions({ page: 1, limit: 5, search: trimmed }),
    enabled: trimmed.length >= 2,
  });

  const matches = query.data?.items ?? [];
  if (trimmed.length < 2 || query.isPending || matches.length === 0) {
    return null;
  }

  return (
    <Alert
      color="warning"
      variant="light"
      role="status"
      title="Possible duplicate"
      icon={<IconAlertTriangle size={18} stroke={1.5} />}
    >
      <Text size="sm">
        {matches.length === 1 ? "A patient" : "Patients"} matching this already exist. You can continue if this is
        someone new.
      </Text>
      <List size="sm" mt="xs">
        {matches.map((patient) => (
          <List.Item key={patient.id}>
            <Anchor component={Link} href={`/app/patients/${patient.id}`} size="sm" target="_blank">
              {patient.patient_code} · {patient.full_name}
              {patient.phone ? ` · ${patient.phone}` : ""}
            </Anchor>
          </List.Item>
        ))}
      </List>
    </Alert>
  );
}

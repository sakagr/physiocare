"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Anchor, Button, Card, Group, Skeleton, Stack, Tabs, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconPencil } from "@tabler/icons-react";
import { DataState, EmptyState, useCan } from "@/components/ui";
import { ApiError } from "@/lib/api/api-error";
import { patientDetailQueryOptions } from "../queries";
import { PatientFormDialog } from "./patient-form-dialog";
import { GENDER_OPTIONS, type PatientFormValues } from "../schemas";

/**
 * The Patient Workspace (UX.md:350) -- a pinned summary header above a tab
 * strip, not a split layout. The split was written when the workspace was
 * imagined with five sections; F5 owns three, and a split pane for three tabs
 * spends horizontal room on navigation that the tab strip gives for free.
 * F5-scoped and revisitable when F6 adds appointments.
 *
 * **Tabs are supplied by the route, not imported here.** That is what lets
 * `patient-packages` own its own tab with no dependency in either direction
 * between the two features, and what lets F6/F7 append theirs without
 * touching this component.
 */
export interface PatientWorkspaceTab {
  value: string;
  label: string;
  content: ReactNode;
}

export interface PatientWorkspaceProps {
  patientId: string;
  tabs: PatientWorkspaceTab[];
}

function age(dob: string | null): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return `${years}`;
}

export function PatientWorkspace({ patientId, tabs }: PatientWorkspaceProps) {
  const canManage = useCan("patients:manage");
  const [editOpened, setEditOpened] = useState(false);
  const query = useQuery(patientDetailQueryOptions(patientId));
  const patient = query.data;
  const isNotFound = query.error instanceof ApiError && query.error.status === 404;

  const editValues: PatientFormValues | undefined = patient
    ? {
        fullName: patient.full_name,
        gender: patient.gender ?? "",
        dob: patient.dob ?? "",
        phone: patient.phone ?? "",
        email: patient.email ?? "",
        address: patient.address ?? "",
        emergencyContact: patient.emergency_contact ?? "",
      }
    : undefined;

  const patientAge = patient ? age(patient.dob) : null;
  const genderLabel = GENDER_OPTIONS.find((option) => option.value === patient?.gender)?.label;

  return (
    <Stack gap="md" pb="xl">
      <Anchor component={Link} href="/app/patients" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} />
          Patients
        </Group>
      </Anchor>

      {/* An unknown or out-of-organization id 404s from getPatientDetails.
          Handled before DataState because the generic error alert offers only
          a retry, and retrying a 404 will never succeed -- the not-found
          treatment needs a way back instead (UX.md:435). */}
      {isNotFound ? (
        <EmptyState
          title="Patient not found"
          description="It may have been deleted, or the link may be out of date."
          action={{ label: "Back to patients", href: "/app/patients" }}
        />
      ) : (
      <DataState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        skeleton={<Skeleton height={96} radius="sm" />}
      >
        {patient && (
          <Card withBorder padding="md">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Stack gap={4}>
                <Title order={2} fz="h3">
                  {patient.full_name}
                </Title>
                <Text size="sm" c="dimmed">
                  {patient.patient_code}
                  {genderLabel ? ` · ${genderLabel}` : ""}
                  {patientAge ? ` · ${patientAge} yrs` : ""}
                  {patient.phone ? ` · ${patient.phone}` : ""}
                </Text>
              </Stack>
              {canManage && (
                <Button
                  variant="default"
                  size="xs"
                  leftSection={<IconPencil size={14} />}
                  onClick={() => setEditOpened(true)}
                >
                  Edit patient
                </Button>
              )}
            </Group>
          </Card>
        )}
      </DataState>
      )}

      {patient && (
        <Tabs defaultValue={tabs[0]?.value} keepMounted={false}>
          <Tabs.List>
            {tabs.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Panel key={tab.value} value={tab.value} pt="md">
              {tab.content}
            </Tabs.Panel>
          ))}
        </Tabs>
      )}

      <PatientFormDialog
        key={editOpened ? "edit-open" : "edit-closed"}
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        patientId={patientId}
        defaultValues={editValues}
      />
    </Stack>
  );
}

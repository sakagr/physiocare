"use client";

import { useState } from "react";
import { Select } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { CurrentUserClinic } from "@/types/contracts/me";
import { CURRENT_CLINIC_COOKIE, writeShellPreference } from "./shell-preferences";

/**
 * Clinic switching, hosted in the user menu (UX.md → Working context & user
 * menu). The current clinic reads as the field's value, so the menu keeps a
 * fixed height however many clinics the user can work in.
 *
 * On desktop the list supports type-to-filter; on mobile it stays a plain
 * list, since an on-screen keyboard would cover the options.
 *
 * F0 scope: the choice is captured and persisted, but nothing re-scopes on it
 * yet — the features that read a working clinic arrive in F3+.
 */
export function ClinicSwitcher({
  clinics,
  initialClinicId,
}: {
  clinics: CurrentUserClinic[];
  initialClinicId?: string | null;
}) {
  const isDesktop = useMediaQuery("(min-width: 48em)", true);
  const [clinicId, setClinicId] = useState<string | null>(
    initialClinicId ?? clinics[0]?.id ?? null
  );

  if (clinics.length === 0) {
    return null;
  }

  return (
    <Select
      label="Clinic"
      size="xs"
      data={clinics.map((clinic) => ({ value: clinic.id, label: clinic.name }))}
      value={clinicId}
      onChange={(value) => {
        if (!value) {
          return;
        }
        setClinicId(value);
        writeShellPreference(CURRENT_CLINIC_COOKIE, value);
      }}
      searchable={isDesktop}
      allowDeselect={false}
      checkIconPosition="right"
      // Rendered inline so choosing an option does not dismiss the user menu.
      comboboxProps={{ withinPortal: false }}
    />
  );
}

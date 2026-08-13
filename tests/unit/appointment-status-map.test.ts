import { describe, expect, it } from "vitest";
import {
  appointmentStatusRole,
  appointmentStatusLabel,
  appointmentTransitionLabel,
  APPOINTMENT_STATUS_OPTIONS,
} from "@/features/appointments";
import { appointmentStatusSchema } from "@/contracts/appointment.contract";
import { SEMANTIC_ROLES } from "@/lib/theme";
import type { AppointmentStatus } from "@/types/contracts/appointment";

/**
 * The appointment status → semantic role mapping is owned by the
 * `appointments` feature and passed to `StatusBadge`; the primitive stays
 * domain-blind (`AGENTS.md` → *Shared UI primitives*).
 */
const ALL_STATUSES = appointmentStatusSchema.options as AppointmentStatus[];

describe("appointment status map", () => {
  it("covers every status the contract admits", () => {
    expect(ALL_STATUSES).toHaveLength(6);
    for (const status of ALL_STATUSES) {
      expect(SEMANTIC_ROLES).toContain(appointmentStatusRole(status));
      expect(appointmentStatusLabel(status).length).toBeGreaterThan(0);
      expect(appointmentTransitionLabel(status).length).toBeGreaterThan(0);
    }
  });

  it("reserves success for a delivered visit and danger for a cancelled one", () => {
    // Not a colour preference: `completed` is the only state meaning the
    // clinic did the work, and `cancelled` the only one with downstream
    // effects (a reversed package session). `no_show` is a warning rather
    // than a danger -- a fact about the patient, not an action taken.
    expect(appointmentStatusRole("completed")).toBe("success");
    expect(appointmentStatusRole("cancelled")).toBe("danger");
    expect(appointmentStatusRole("no_show")).toBe("warning");
    expect(appointmentStatusRole("scheduled")).toBe("neutral");
  });

  it("labels a transition with the verb and a status with the state", () => {
    // The control says what it will do; the badge says where the appointment
    // is. Using one string for both reads wrong at one site or the other.
    expect(appointmentTransitionLabel("checked_in")).toBe("Check in");
    expect(appointmentStatusLabel("checked_in")).toBe("Checked in");
  });

  it("offers every status as a filter option", () => {
    expect(APPOINTMENT_STATUS_OPTIONS.map((option) => option.value)).toEqual(ALL_STATUSES);
  });
});

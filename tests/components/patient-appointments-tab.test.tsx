import { describe, expect, it, vi } from "vitest";
import { PatientAppointmentsTab } from "@/features/appointments";
import type { AppointmentRead } from "@/types/contracts/appointment";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: (...a: unknown[]) => get(...a), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const appointment: AppointmentRead = {
  id: "appt-1",
  organization_id: "org-1",
  patient_id: "patient-1",
  clinic_id: "clinic-north",
  physiotherapist_id: "user-physio",
  appointment_time: "2026-09-01T09:30:00Z",
  appointment_type: "therapy_session",
  status: "scheduled",
  notes: null,
  created_by: "user-1",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  deleted_at: null,
  patient: { id: "patient-1", full_name: "Asha Rao", patient_code: "P-0001" },
  physiotherapist: { id: "user-physio", full_name: "Dr Menon" },
  clinic: { id: "clinic-north", clinic_name: "North Clinic" },
  allowedTransitions: ["confirmed"],
  canManageConsultation: false,
};

describe("PatientAppointmentsTab", () => {
  it("scopes the list to the patient it was given", async () => {
    get.mockResolvedValue({ items: [appointment], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    renderWithProviders(<PatientAppointmentsTab patientId="patient-1" />, {
      currentUser: currentUserFixtures.receptionist(),
    });

    await waitFor(() => expect(get).toHaveBeenCalled());
    const listCall = get.mock.calls.find(([path]) => String(path).startsWith("/api/appointments"));
    expect(String(listCall?.[0])).toContain("patientId=patient-1");
  });

  it("drops the physiotherapist framing, which answers nothing for one patient", async () => {
    get.mockResolvedValue({ items: [appointment], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    renderWithProviders(<PatientAppointmentsTab patientId="patient-1" />, {
      currentUser: currentUserFixtures.owner(),
    });

    await waitFor(() => expect(screen.getAllByText("North Clinic").length).toBeGreaterThan(0));
    expect(screen.queryAllByLabelText("Physiotherapist")).toHaveLength(0);
  });

  it("offers scheduling only to a caller who may book", async () => {
    get.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    const { unmount } = renderWithProviders(<PatientAppointmentsTab patientId="patient-1" />, {
      currentUser: currentUserFixtures.receptionist(),
    });
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Schedule appointment" }).length).toBeGreaterThan(0)
    );
    unmount();

    renderWithProviders(<PatientAppointmentsTab patientId="patient-1" />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });
    await waitFor(() => expect(screen.getByText("No appointments")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Schedule appointment" })).toBeNull();
  });
});

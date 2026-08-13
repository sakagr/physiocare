import { describe, expect, it, vi } from "vitest";
import { AppointmentDetailDrawer } from "@/features/appointments";
import type { AppointmentRead } from "@/types/contracts/appointment";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen } from "../helpers/render";

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

function makeAppointment(overrides: Partial<AppointmentRead> = {}): AppointmentRead {
  return {
    id: "appt-1",
    organization_id: "org-1",
    patient_id: "patient-1",
    clinic_id: "clinic-north",
    physiotherapist_id: "user-physio",
    appointment_time: "2026-09-01T09:30:00Z",
    appointment_type: "therapy_session",
    status: "scheduled",
    notes: "Bring previous scans",
    created_by: "user-1",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    deleted_at: null,
    patient: { id: "patient-1", full_name: "Asha Rao", patient_code: "P-0001" },
    physiotherapist: { id: "user-physio", full_name: "Dr Menon" },
    clinic: { id: "clinic-north", clinic_name: "North Clinic" },
    allowedTransitions: ["confirmed"],
    canManageConsultation: true,
    ...overrides,
  };
}

describe("AppointmentDetailDrawer", () => {
  it("renders the projected names, never the ids", () => {
    renderWithProviders(
      <AppointmentDetailDrawer appointment={makeAppointment()} onClose={vi.fn()} />,
      { currentUser: currentUserFixtures.owner() }
    );

    expect(screen.getAllByText("Asha Rao").length).toBeGreaterThan(0);
    expect(screen.getByText("Dr Menon")).toBeInTheDocument();
    expect(screen.getByText("North Clinic")).toBeInTheDocument();
    expect(screen.getByText("P-0001")).toBeInTheDocument();
    expect(screen.queryByText("patient-1")).toBeNull();
    expect(screen.queryByText("user-physio")).toBeNull();
  });

  it("links to the consultation only where the caller may author it", () => {
    const { unmount } = renderWithProviders(
      <AppointmentDetailDrawer appointment={makeAppointment()} onClose={vi.fn()} />,
      { currentUser: currentUserFixtures.physiotherapist() }
    );
    expect(screen.getByRole("link", { name: "Open consultation" })).toHaveAttribute(
      "href",
      "/app/appointments/appt-1/consultation"
    );
    unmount();

    // The same hint governs the prescription section inside that destination
    // (D14), so one field gates the whole clinical surface.
    renderWithProviders(
      <AppointmentDetailDrawer
        appointment={makeAppointment({ canManageConsultation: false })}
        onClose={vi.fn()}
      />,
      { currentUser: currentUserFixtures.receptionist() }
    );
    expect(screen.queryByRole("link", { name: "Open consultation" })).toBeNull();
  });

  it("offers reschedule only when the host supplies it", () => {
    const { unmount } = renderWithProviders(
      <AppointmentDetailDrawer appointment={makeAppointment()} onClose={vi.fn()} />,
      { currentUser: currentUserFixtures.owner() }
    );
    expect(screen.queryByRole("button", { name: "Reschedule" })).toBeNull();
    unmount();

    renderWithProviders(
      <AppointmentDetailDrawer appointment={makeAppointment()} onClose={vi.fn()} onReschedule={vi.fn()} />,
      { currentUser: currentUserFixtures.owner() }
    );
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeInTheDocument();
  });

  it("renders nothing when no appointment is selected", () => {
    renderWithProviders(<AppointmentDetailDrawer appointment={null} onClose={vi.fn()} />, {
      currentUser: currentUserFixtures.owner(),
    });

    expect(screen.queryByText("Asha Rao")).toBeNull();
  });
});

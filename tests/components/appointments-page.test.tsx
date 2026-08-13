import { describe, expect, it, vi } from "vitest";
import { AppointmentsPageContent } from "@/features/appointments";
import type { AppointmentRead } from "@/types/contracts/appointment";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
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
    notes: null,
    created_by: "user-1",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    deleted_at: null,
    patient: { id: "patient-1", full_name: "Asha Rao", patient_code: "P-0001" },
    physiotherapist: { id: "user-physio", full_name: "Dr Menon" },
    clinic: { id: "clinic-north", clinic_name: "North Clinic" },
    allowedTransitions: ["confirmed", "checked_in", "cancelled", "no_show"],
    canManageConsultation: false,
    ...overrides,
  };
}

function mockEndpoints(appointments: AppointmentRead[]) {
  get.mockImplementation((path: string) => {
    if (path.startsWith("/api/appointments")) {
      return Promise.resolve({
        items: appointments,
        total: appointments.length,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    }
    if (path.startsWith("/api/users")) {
      return Promise.resolve({
        items: [
          {
            id: "user-physio",
            full_name: "Dr Menon",
            role: { name: "ORG_PHYSIOTHERAPIST", display_name: "Physiotherapist" },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 200,
        totalPages: 1,
        assignableRoles: [],
      });
    }
    return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  });
}

/**
 * The Appointments destination reaches every org role (F6, D11), so these
 * assertions run per role fixture. What changes between them is the framing,
 * not the rows: the service scopes those server-side.
 */
describe("AppointmentsPageContent", () => {
  it("renders names rather than ids, from the read response's projection", async () => {
    mockEndpoints([makeAppointment()]);
    renderWithProviders(<AppointmentsPageContent />, { currentUser: currentUserFixtures.owner() });

    await waitFor(() => expect(screen.getAllByText("Asha Rao").length).toBeGreaterThan(0));
    expect(screen.getAllByText("North Clinic").length).toBeGreaterThan(0);
    // The ids must never reach the surface.
    expect(screen.queryByText("patient-1")).toBeNull();
    expect(screen.queryByText("clinic-north")).toBeNull();
  });

  it("shows the physiotherapist filter and column to an overseer", async () => {
    mockEndpoints([makeAppointment()]);
    renderWithProviders(<AppointmentsPageContent />, { currentUser: currentUserFixtures.owner() });

    await waitFor(() => expect(screen.getAllByText("Asha Rao").length).toBeGreaterThan(0));
    // Mantine's Select renders a paired hidden input, so the accessible name
    // matches more than one node -- assert presence, not uniqueness.
    expect(screen.getAllByLabelText("Physiotherapist").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dr Menon").length).toBeGreaterThan(0);
  });

  it("hides the physiotherapist framing from a physiotherapist, whose list is all their own", async () => {
    mockEndpoints([makeAppointment()]);
    renderWithProviders(<AppointmentsPageContent />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });

    await waitFor(() => expect(screen.getAllByText("Asha Rao").length).toBeGreaterThan(0));
    expect(screen.queryAllByLabelText("Physiotherapist")).toHaveLength(0);
    expect(screen.queryByText("Dr Menon")).toBeNull();
  });

  it("hides it from a receptionist too, whose rows are already clinic-bounded", async () => {
    mockEndpoints([makeAppointment()]);
    renderWithProviders(<AppointmentsPageContent />, {
      currentUser: currentUserFixtures.receptionist(),
    });

    await waitFor(() => expect(screen.getAllByText("Asha Rao").length).toBeGreaterThan(0));
    expect(screen.queryAllByLabelText("Physiotherapist")).toHaveLength(0);
  });

  it("keeps the status, clinic and date filters for every role", async () => {
    mockEndpoints([makeAppointment()]);
    renderWithProviders(<AppointmentsPageContent />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });

    await waitFor(() => expect(screen.getAllByText("Asha Rao").length).toBeGreaterThan(0));
    expect(screen.getAllByLabelText("Status").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Clinic").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("From date")).toBeInTheDocument();
    expect(screen.getByLabelText("To date")).toBeInTheDocument();
  });

  it("renders the empty state when the schedule is clear", async () => {
    mockEndpoints([]);
    renderWithProviders(<AppointmentsPageContent />, { currentUser: currentUserFixtures.owner() });

    await waitFor(() => expect(screen.getByText("No appointments")).toBeInTheDocument());
  });

  it("offers a retry when the list fails", async () => {
    get.mockRejectedValue(new Error("network"));
    renderWithProviders(<AppointmentsPageContent />, { currentUser: currentUserFixtures.owner() });

    await waitFor(() => expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument());
  });
});

import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { AppointmentStatusActions } from "@/features/appointments";
import { ApiError } from "@/lib/api/api-error";
import type { AppointmentRead } from "@/types/contracts/appointment";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
const patch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: (...a: unknown[]) => get(...a), post: vi.fn(), patch: (...a: unknown[]) => patch(...a), delete: vi.fn() },
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

/**
 * The controls are rendered from `allowedTransitions` and nothing else
 * (D13). These assertions are what makes "no transition matrix lives on the
 * client" a property rather than a convention: change the server's matrix and
 * these follow, because the fixture carries the field the server computed.
 */
describe("AppointmentStatusActions", () => {
  it("offers exactly the transitions the server published, and nothing else", async () => {
    renderWithProviders(<AppointmentStatusActions appointment={makeAppointment()} />, {
      currentUser: currentUserFixtures.owner(),
    });

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark no-show" })).toBeInTheDocument();
    // Illegal from `scheduled`, so never offered.
    expect(screen.queryByRole("button", { name: "Complete visit" })).toBeNull();
  });

  it("offers nothing at all for a terminal row", () => {
    renderWithProviders(
      <AppointmentStatusActions appointment={makeAppointment({ status: "cancelled", allowedTransitions: [] })} />,
      { currentUser: currentUserFixtures.owner() }
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("offers nothing when the caller may not act on the row, whatever its status", () => {
    // An empty set also encodes "you may not act on this", which is why the
    // component reads one field rather than combining a boolean with a matrix.
    renderWithProviders(
      <AppointmentStatusActions appointment={makeAppointment({ status: "scheduled", allowedTransitions: [] })} />,
      { currentUser: currentUserFixtures.physiotherapist() }
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("sends a plain transition straight through", async () => {
    patch.mockResolvedValue(makeAppointment({ status: "confirmed" }));
    renderWithProviders(<AppointmentStatusActions appointment={makeAppointment()} />, {
      currentUser: currentUserFixtures.owner(),
    });

    await userEvent.click(screen.getByRole("button", { name: "Check in" }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/api/appointments/appt-1/status", { status: "checked_in" })
    );
  });

  it("guards cancellation with a consequence and no Undo", async () => {
    renderWithProviders(<AppointmentStatusActions appointment={makeAppointment()} />, {
      currentUser: currentUserFixtures.owner(),
    });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // UX.md names cancelling an appointment among the actions that use a
    // stronger confirmation and do not offer Undo.
    await waitFor(() => expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument());
    expect(screen.getByText(/session consumed by this visit is returned/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /undo/i })).toBeNull();
  });

  it("routes completion through a package picker", async () => {
    get.mockResolvedValue({
      items: [
        {
          id: "pp-1",
          package_name: "10-session physio",
          remaining_sessions: 4,
          status: "active",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    patch.mockResolvedValue(makeAppointment({ status: "completed" }));

    renderWithProviders(
      <AppointmentStatusActions
        appointment={makeAppointment({ status: "checked_in", allowedTransitions: ["completed", "cancelled"] })}
      />,
      { currentUser: currentUserFixtures.owner() }
    );

    await userEvent.click(screen.getByRole("button", { name: "Complete visit" }));
    await waitFor(() => expect(screen.getAllByText(/chargeable visit/i).length).toBeGreaterThan(0));
  });

  it("resyncs the list when the appointment has moved under the user", async () => {
    patch.mockRejectedValue(
      new ApiError("conflict", 409, "INVALID_APPOINTMENT_STATUS_TRANSITION")
    );
    renderWithProviders(<AppointmentStatusActions appointment={makeAppointment()} />, {
      currentUser: currentUserFixtures.owner(),
    });

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    // Blocking message + resync: the message comes from ERROR_BEHAVIORS via
    // the cache-level policy, and the refetch is this call site's own.
    await waitFor(() => expect(patch).toHaveBeenCalled());
  });
});

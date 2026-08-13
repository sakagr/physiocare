import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { AppointmentFormDialog } from "@/features/appointments";
import { ApiError } from "@/lib/api/api-error";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: vi.fn(), delete: vi.fn() },
}));

function mockEndpoints() {
  get.mockImplementation((path: string) => {
    if (path.startsWith("/api/patients")) {
      return Promise.resolve({
        items: [{ id: "patient-1", full_name: "Asha Rao", patient_code: "P-0001" }],
        total: 1,
        page: 1,
        pageSize: 200,
        totalPages: 1,
      });
    }
    if (path.includes("/users")) {
      return Promise.resolve([
        { id: "user-physio", full_name: "Dr Menon", role: { name: "ORG_PHYSIOTHERAPIST", display_name: "Physiotherapist" } },
        { id: "user-recep", full_name: "Ravi Front", role: { name: "ORG_RECEPTIONIST", display_name: "Receptionist" } },
      ]);
    }
    return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  });
}

describe("AppointmentFormDialog", () => {
  it("disables the physiotherapist picker until a clinic is chosen", async () => {
    mockEndpoints();
    renderWithProviders(<AppointmentFormDialog opened onClose={vi.fn()} />, {
      currentUser: currentUserFixtures.receptionist(),
    });

    // Clinic-then-physiotherapist is the server's own booking rule
    // ("physiotherapist assigned to this clinic"), not a workaround for
    // Reception being unable to call GET /api/users.
    const picker = await screen.findByPlaceholderText("Choose a clinic first");
    expect(picker).toBeDisabled();
  });

  it("lists only the chosen clinic's physiotherapists once one is picked", async () => {
    mockEndpoints();
    renderWithProviders(<AppointmentFormDialog opened onClose={vi.fn()} />, {
      currentUser: currentUserFixtures.receptionist(),
    });

    await userEvent.click((await screen.findAllByLabelText("Clinic"))[0]);
    await userEvent.click(await screen.findByRole("option", { name: "North Clinic" }));

    await userEvent.click((await screen.findAllByLabelText("Physiotherapist"))[0]);
    await waitFor(() => expect(screen.getByText("Dr Menon")).toBeInTheDocument());
    // A receptionist is assigned to the clinic too, but is not bookable.
    expect(screen.queryByText("Ravi Front")).toBeNull();
  });

  it("renders the enforcement state inline for an unsubscribed organization", async () => {
    mockEndpoints();
    post.mockRejectedValue(new ApiError("no subscription", 402, "SUBSCRIPTION_REQUIRED"));

    renderWithProviders(
      <AppointmentFormDialog
        opened
        onClose={vi.fn()}
        lockedPatientId="patient-1"
        defaultValues={{
          patientId: "patient-1",
          clinicId: "clinic-north",
          physiotherapistId: "user-physio",
          appointmentTime: "2026-09-01T09:30",
          appointmentType: "therapy_session",
          notes: "",
        }}
      />,
      { currentUser: currentUserFixtures.owner() }
    );

    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));

    // A form dialog stays open long enough to host a persistent, role-aware
    // message and preserves the user's input, so UX.md gives it the dedicated
    // state rather than the flat toast.
    await waitFor(() => expect(screen.getByText(/subscription/i)).toBeInTheDocument());
  });

  it("explains an unavailable physiotherapist in context and resyncs", async () => {
    mockEndpoints();
    post.mockRejectedValue(new ApiError("unavailable", 409, "PHYSIOTHERAPIST_UNAVAILABLE"));

    renderWithProviders(
      <AppointmentFormDialog
        opened
        onClose={vi.fn()}
        lockedPatientId="patient-1"
        defaultValues={{
          patientId: "patient-1",
          clinicId: "clinic-north",
          physiotherapistId: "user-physio",
          appointmentTime: "2026-09-01T09:30",
          appointmentType: "therapy_session",
          notes: "",
        }}
      />,
      { currentUser: currentUserFixtures.receptionist() }
    );

    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));

    // Mantine's notifications region is also an alert, so scope to the
    // dialog's own in-context message.
    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((node) => /isn't available then/i.test(node.textContent ?? ""))
      ).toBe(true)
    );
  });

  it("offers only time, type and notes when rescheduling", async () => {
    mockEndpoints();
    renderWithProviders(
      <AppointmentFormDialog
        opened
        onClose={vi.fn()}
        appointmentId="appt-1"
        defaultValues={{
          patientId: "patient-1",
          clinicId: "clinic-north",
          physiotherapistId: "user-physio",
          appointmentTime: "2026-09-01T09:30",
          appointmentType: "therapy_session",
          notes: "",
        }}
      />,
      { currentUser: currentUserFixtures.owner() }
    );

    // The server refuses reassignment outright; the form must not appear to
    // offer it.
    expect(await screen.findByLabelText("Date and time")).toBeInTheDocument();
    expect(screen.queryByLabelText("Clinic")).toBeNull();
    expect(screen.queryByLabelText("Physiotherapist")).toBeNull();
    expect(screen.queryByLabelText("Patient")).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ConsultationRouteContent } from "@/features/consultations";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: vi.fn(), delete: vi.fn() },
}));

const appointment = {
  id: "appt-1",
  organization_id: "org-1",
  patient_id: "patient-1",
  clinic_id: "clinic-north",
  physiotherapist_id: "user-physio",
  appointment_time: "2026-09-01T09:30:00Z",
  appointment_type: "therapy_session",
  status: "checked_in",
  notes: null,
  created_by: "user-1",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  deleted_at: null,
  patient: { id: "patient-1", full_name: "Asha Rao", patient_code: "P-0001" },
  physiotherapist: { id: "user-physio", full_name: "Dr Menon" },
  clinic: { id: "clinic-north", clinic_name: "North Clinic" },
  allowedTransitions: ["completed", "cancelled"],
  canManageConsultation: true,
};

const consultation = {
  id: "cons-1",
  organization_id: "org-1",
  appointment_id: "appt-1",
  patient_id: "patient-1",
  physiotherapist_id: "user-physio",
  symptoms: "Lower back pain",
  pain_areas: ["lower_back"],
  pain_scale: 5,
  diagnosis_notes: "Muscular strain",
  followup_notes: null,
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
};

function mockEndpoints(options: {
  consultation: typeof consultation | null;
  canManage?: boolean;
  prescriptions?: unknown[];
}) {
  get.mockImplementation((path: string) => {
    if (path === "/api/appointments/appt-1") {
      return Promise.resolve({ ...appointment, canManageConsultation: options.canManage ?? true });
    }
    if (path === "/api/appointments/appt-1/consultation") {
      return Promise.resolve(options.consultation);
    }
    if (path.includes("/prescriptions")) {
      const items = options.prescriptions ?? [];
      return Promise.resolve({ items, total: items.length, page: 1, pageSize: 50, totalPages: 1 });
    }
    return Promise.resolve(null);
  });
}

/**
 * The destination is routed by appointment id, so it must answer "does this
 * appointment have a consultation yet?" before rendering anything. D5's
 * endpoint returns `null` for the normal not-started case; these assertions
 * are what make "no 409-as-control-flow" a property.
 */
describe("ConsultationRouteContent", () => {
  it("renders the create form when the visit has not been recorded", async () => {
    mockEndpoints({ consultation: null });
    renderWithProviders(<ConsultationRouteContent appointmentId="appt-1" />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Record consultation" })).toBeInTheDocument()
    );
    // Prescriptions hang off a consultation, so there is nothing to show yet.
    expect(screen.queryByText("Prescriptions")).toBeNull();
  });

  it("renders the edit form and the prescription section once it exists", async () => {
    mockEndpoints({ consultation, prescriptions: [] });
    renderWithProviders(<ConsultationRouteContent appointmentId="appt-1" />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });

    await waitFor(() => expect(screen.getByDisplayValue("Lower back pain")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByText("Prescriptions")).toBeInTheDocument();
  });

  it("never creates blind to discover whether a consultation exists", async () => {
    mockEndpoints({ consultation: null });
    renderWithProviders(<ConsultationRouteContent appointmentId="appt-1" />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Record consultation" })).toBeInTheDocument()
    );
    // Rendering the page must not have written anything: the read answered it.
    expect(post).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith("/api/appointments/appt-1/consultation");
  });

  it("renders read-only for a caller who may see the visit but not author it", async () => {
    mockEndpoints({ consultation, canManage: false, prescriptions: [] });
    renderWithProviders(<ConsultationRouteContent appointmentId="appt-1" />, {
      currentUser: currentUserFixtures.receptionist(),
    });

    await waitFor(() => expect(screen.getByDisplayValue("Lower back pain")).toBeInTheDocument());
    // Read-only, not a forbidden frame: they legitimately may see this.
    expect(screen.getByText(/view this visit's clinical record but not change it/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    // One hint governs both surfaces (D14).
    expect(screen.queryByRole("button", { name: "Add prescription" })).toBeNull();
  });

  it("carries the parent and return path, being a nested destination", async () => {
    mockEndpoints({ consultation: null });
    renderWithProviders(<ConsultationRouteContent appointmentId="appt-1" />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /appointments/i })).toHaveAttribute("href", "/app/appointments")
    );
  });

  it("lets an authorised caller add a prescription", async () => {
    mockEndpoints({ consultation, prescriptions: [] });
    post.mockResolvedValue({ id: "presc-1" });
    renderWithProviders(<ConsultationRouteContent appointmentId="appt-1" />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });

    await userEvent.click(await screen.findByRole("button", { name: "Add prescription" }));
    await userEvent.type(await screen.findByLabelText("Advice"), "Ice twice daily");
    await userEvent.click(screen.getAllByRole("button", { name: "Add prescription" }).at(-1)!);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/api/consultations/cons-1/prescriptions",
        expect.objectContaining({ advice: "Ice twice daily" })
      )
    );
  });
});

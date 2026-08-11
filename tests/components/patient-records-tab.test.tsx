import { describe, expect, it, vi } from "vitest";
import { PatientRecordsTab } from "@/features/patients";
import { ApiError } from "@/lib/api/api-error";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: vi.fn(),
    postForm: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const record = {
  id: "record-1",
  organization_id: "org-1",
  patient_id: "patient-1",
  uploaded_by: "user-1",
  record_type: "xray",
  title: "Knee X-Ray",
  file_url: "org-1/patient-1/knee.pdf",
  notes: null,
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
  deleted_at: null,
  downloadUrl: "https://storage.example.test/signed/knee.pdf",
};

describe("PatientRecordsTab", () => {
  it("renders the forbidden treatment inside the tab, not as a full-frame takeover", async () => {
    // A physiotherapist without an appointment for this patient. The tab
    // itself stays visible -- hiding it would need a per-patient signal the
    // detail response does not carry.
    get.mockRejectedValue(new ApiError("Forbidden: Insufficient privileges", 403, "FORBIDDEN"));
    renderWithProviders(<PatientRecordsTab patientId="patient-1" />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });

    expect(await screen.findByText("You can't see this patient's records")).toBeInTheDocument();
    // The forbidden *frame* has a back link; the in-tab treatment must not,
    // because the surrounding workspace is still perfectly usable.
    expect(screen.queryByRole("link", { name: /back/i })).toBeNull();
  });

  it("offers delete to Owner but not to Reception, which may still upload", async () => {
    get.mockResolvedValue({ items: [record], total: 1, page: 1, pageSize: 20, totalPages: 1 });

    // The desktop table and the mobile cards are both in the DOM -- the
    // breakpoint hiding is CSS-only -- so the affordance appears twice.
    const owner = renderWithProviders(<PatientRecordsTab patientId="patient-1" />, {
      currentUser: currentUserFixtures.owner(),
    });
    expect((await screen.findAllByRole("button", { name: "Delete Knee X-Ray" })).length).toBeGreaterThan(0);
    owner.unmount();

    renderWithProviders(<PatientRecordsTab patientId="patient-1" />, {
      currentUser: currentUserFixtures.receptionist(),
    });
    expect(await screen.findByRole("button", { name: "Upload record" })).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Delete Knee X-Ray" })).toEqual([]);
  });
});

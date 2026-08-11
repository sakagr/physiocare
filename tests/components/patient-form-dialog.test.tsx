import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { PatientFormDialog } from "@/features/patients";
import { ApiError } from "@/lib/api/api-error";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen } from "../helpers/render";

const post = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    postForm: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const NO_MATCHES = { items: [], total: 0, page: 1, pageSize: 5, totalPages: 0 };

/**
 * Create/edit patient (UX.md → Flow 4). A form dialog, so the F5 enforcement
 * split gives it the dedicated `LimitEnforcementState` rather than the flat
 * toast that the destructive confirms get.
 */
describe("PatientFormDialog", () => {
  it("creates a patient on success", async () => {
    get.mockResolvedValue(NO_MATCHES);
    post.mockResolvedValue({ id: "patient-1", full_name: "Asha Rao" });
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<PatientFormDialog opened onClose={onClose} />);

    await user.type(screen.getByLabelText("Full name"), "Asha Rao");
    await user.click(screen.getByRole("button", { name: "Create patient" }));

    expect(await screen.findByText("Patient created.")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the Owner enforcement copy on SUBSCRIPTION_REQUIRED and keeps input intact", async () => {
    get.mockResolvedValue(NO_MATCHES);
    post.mockRejectedValue(
      new ApiError("Organization does not have an active subscription", 402, "SUBSCRIPTION_REQUIRED")
    );
    const user = userEvent.setup();
    renderWithProviders(<PatientFormDialog opened onClose={vi.fn()} />, {
      currentUser: currentUserFixtures.owner(),
    });

    await user.type(screen.getByLabelText("Full name"), "Asha Rao");
    await user.click(screen.getByRole("button", { name: "Create patient" }));

    expect(
      await screen.findByText(
        "Your organization doesn't have an active subscription. Select or renew a plan to continue."
      )
    ).toBeInTheDocument();
    // The dialog stays open with the typed value: that is the whole point of
    // the dedicated state over a toast.
    expect(screen.getByLabelText("Full name")).toHaveValue("Asha Rao");
  });
});

describe("DuplicateWarning inside PatientFormDialog", () => {
  it("warns on a matching patient without ever blocking submission", async () => {
    get.mockResolvedValue({
      items: [
        {
          id: "patient-existing",
          patient_code: "PT-000001",
          full_name: "Asha Rao",
          phone: "9876543210",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    });
    post.mockResolvedValue({ id: "patient-2", full_name: "Asha Rao" });
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<PatientFormDialog opened onClose={onClose} />);

    await user.type(screen.getByLabelText("Full name"), "Asha Rao");
    await user.tab();

    expect(await screen.findByText("Possible duplicate")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PT-000001/ })).toBeInTheDocument();

    // Advisory only: a clinic legitimately has two patients with one name, so
    // the submit stays enabled and the create goes through.
    const submit = screen.getByRole("button", { name: "Create patient" });
    expect(submit).not.toBeDisabled();
    await user.click(submit);
    expect(await screen.findByText("Patient created.")).toBeInTheDocument();
  });

  it("is not shown in edit mode, where the patient would match itself", async () => {
    get.mockResolvedValue(NO_MATCHES);
    const user = userEvent.setup();
    renderWithProviders(
      <PatientFormDialog
        opened
        onClose={vi.fn()}
        patientId="patient-1"
        defaultValues={{
          fullName: "Asha Rao",
          gender: "",
          dob: "",
          phone: "",
          email: "",
          address: "",
          emergencyContact: "",
        }}
      />
    );

    await user.click(screen.getByLabelText("Full name"));
    await user.tab();

    expect(screen.queryByText("Possible duplicate")).toBeNull();
  });
});

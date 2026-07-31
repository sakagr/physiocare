import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ClinicsCollection } from "@/features/clinics";
import type { Clinic } from "@/types/contracts/clinic";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: (...args: unknown[]) => get(...args), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

function makeClinic(overrides: Partial<Clinic> = {}): Clinic {
  return {
    id: "clinic-1",
    organization_id: "org-1",
    clinic_name: "North Clinic",
    email: "north@example.test",
    phone: "9876543210",
    address: null,
    city: "Pune",
    state: null,
    pincode: null,
    gst_number: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function listResponse(items: Clinic[]) {
  return { items, total: items.length, page: 1, pageSize: 20, totalPages: 1 };
}

describe("ClinicsCollection", () => {
  it("shows a skeleton while loading", () => {
    get.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ClinicsCollection onSelectClinic={vi.fn()} canCreate onCreate={vi.fn()} />);

    expect(document.querySelectorAll(".mantine-Skeleton-root").length).toBeGreaterThan(0);
  });

  it("shows a purposeful empty state with the create action", async () => {
    get.mockResolvedValue(listResponse([]));
    const onCreate = vi.fn();
    renderWithProviders(<ClinicsCollection onSelectClinic={vi.fn()} canCreate onCreate={onCreate} />);

    expect(await screen.findByText("No clinics yet")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "New clinic" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders a scoped inline error with retry on load failure", async () => {
    get.mockRejectedValue(new Error("network down"));
    renderWithProviders(<ClinicsCollection onSelectClinic={vi.fn()} canCreate onCreate={vi.fn()} />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("lists clinics and opens the drawer on row click", async () => {
    get.mockResolvedValue(listResponse([makeClinic()]));
    const onSelectClinic = vi.fn();
    renderWithProviders(<ClinicsCollection onSelectClinic={onSelectClinic} canCreate onCreate={vi.fn()} />);

    expect((await screen.findAllByText("North Clinic")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);

    await userEvent.setup().click(screen.getAllByText("North Clinic")[0]);
    expect(onSelectClinic).toHaveBeenCalledWith("clinic-1");
  });

  it("debounces search input before refetching", async () => {
    get.mockResolvedValue(listResponse([makeClinic()]));
    renderWithProviders(<ClinicsCollection onSelectClinic={vi.fn()} canCreate onCreate={vi.fn()} />);
    await screen.findAllByText("North Clinic");
    get.mockClear();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Search by name/), "north");

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(expect.stringContaining("search=north"));
    });
  });
});

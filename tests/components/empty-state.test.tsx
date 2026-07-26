import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "@/components/ui";
import { renderWithProviders, screen } from "../helpers/render";

/**
 * An empty state names what would appear here and offers the primary create
 * action where permitted (UX.md → State model) — never a bare "No data".
 */
describe("EmptyState", () => {
  it("names what is absent and what would appear here", () => {
    renderWithProviders(
      <EmptyState
        title="No patients yet"
        description="Patients you add will be listed here."
      />
    );

    expect(screen.getByText("No patients yet")).toBeInTheDocument();
    expect(
      screen.getByText("Patients you add will be listed here.")
    ).toBeInTheDocument();
  });

  it("offers the primary create action when the caller supplies one", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <EmptyState title="No patients yet" action={{ label: "New patient", onClick }} />
    );

    await user.click(screen.getByRole("button", { name: "New patient" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders the action as a link when given a destination", () => {
    renderWithProviders(
      <EmptyState title="No clinics yet" action={{ label: "Add clinic", href: "/app/clinics" }} />
    );

    expect(screen.getByRole("link", { name: "Add clinic" })).toHaveAttribute(
      "href",
      "/app/clinics"
    );
  });

  it("omits the action entirely when the user may not create", () => {
    // Gating is the caller's: it simply does not pass an action.
    renderWithProviders(<EmptyState title="No invoices yet" />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

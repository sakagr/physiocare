import { describe, expect, it } from "vitest";
import { DestinationStub } from "@/components/shell/destination-stub";
import { renderWithProviders, screen } from "../helpers/render";

/**
 * The twelve stub destinations are `PageHeader`'s first real consumer,
 * closing the Increment 2 deviation that had them rendering an interim
 * `Title`/`Text` pair while the primitive did not yet exist.
 */
describe("DestinationStub", () => {
  it("renders its title through PageHeader, as the page heading", () => {
    renderWithProviders(
      <DestinationStub
        title="Patients"
        phase="F6"
        description="Browse patients and open a patient workspace."
      />
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Patients" })
    ).toBeInTheDocument();
  });

  it("keeps the destination's one line of context", () => {
    renderWithProviders(
      <DestinationStub
        title="Patients"
        phase="F6"
        description="Browse patients and open a patient workspace."
      />
    );

    expect(
      screen.getByText("Browse patients and open a patient workspace.")
    ).toBeInTheDocument();
  });

  it("says which phase builds the destination", () => {
    renderWithProviders(
      <DestinationStub title="Invoices" phase="F7" description="Browse invoices." />
    );

    expect(screen.getByText("Arriving in phase F7.")).toBeInTheDocument();
  });

  it("offers no primary action — a stub has nothing to do yet", () => {
    renderWithProviders(
      <DestinationStub title="Users" phase="F3" description="Browse the people in your organization." />
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});

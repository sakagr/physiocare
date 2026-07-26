import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ui";
import { SEMANTIC_ROLES } from "@/lib/theme";
import { renderWithProviders, screen } from "../helpers/render";

/**
 * A status is a semantic role carrying **both** color and text, never color
 * alone (UX.md → Accessibility: "color is never the only cue"). The primitive
 * knows no domain — the appointment/payment/package status mapping lives in
 * the feature that owns it.
 */
describe("StatusBadge", () => {
  it("always renders the label, so color is never the only cue", () => {
    renderWithProviders(<StatusBadge role="success" label="Paid" />);

    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("renders every semantic role the design system exposes", () => {
    // If a role is added to SEMANTIC_ROLES, it must render here too.
    for (const role of SEMANTIC_ROLES) {
      const { unmount } = renderWithProviders(
        <StatusBadge role={role} label={`Status ${role}`} />
      );
      expect(screen.getByText(`Status ${role}`)).toBeInTheDocument();
      unmount();
    }
  });

  it("maps each role onto its theme color", () => {
    const { container } = renderWithProviders(
      <StatusBadge role="danger" label="Overdue" />
    );

    const badge = container.querySelector(".mantine-Badge-root");
    expect(badge).toHaveAttribute("data-variant", "light");
    // The light variant is what the contrast audit measures.
    expect(badge?.getAttribute("style")).toContain("danger");
  });

  it("maps the neutral role onto gray rather than a semantic color", () => {
    const { container } = renderWithProviders(
      <StatusBadge role="neutral" label="Draft" />
    );

    expect(container.querySelector(".mantine-Badge-root")?.getAttribute("style")).toContain(
      "gray"
    );
  });

  it("accepts an optional icon alongside the text", () => {
    renderWithProviders(
      <StatusBadge
        role="warning"
        label="Expiring"
        icon={<span data-testid="badge-icon" />}
      />
    );

    expect(screen.getByTestId("badge-icon")).toBeInTheDocument();
    expect(screen.getByText("Expiring")).toBeInTheDocument();
  });
});

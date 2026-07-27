import { describe, expect, it } from "vitest";
import { ForbiddenState } from "@/components/ui";
import { renderWithProviders, screen } from "../helpers/render";

/**
 * The safety net behind capability gating: actions a user cannot perform are
 * already hidden, so reaching a forbidden surface is the exception. When it
 * happens it must explain itself and offer a way out, never a dead end
 * (UX.md → Error → default behavior).
 */
describe("ForbiddenState", () => {
  it("names what was refused and offers a way back", () => {
    renderWithProviders(
      <ForbiddenState
        title="You don't have access to reports"
        description="Ask your owner or administrator if you need it."
        backLabel="Back to dashboard"
        backHref="/app"
      />
    );

    expect(
      screen.getByRole("heading", { name: "You don't have access to reports" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ask your owner or administrator if you need it.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute(
      "href",
      "/app"
    );
  });

  it("falls back to copy that suits any surface", () => {
    renderWithProviders(<ForbiddenState backHref="/app" backLabel="Back" />);

    expect(
      screen.getByRole("heading", { name: "You don't have permission to view this" })
    ).toBeInTheDocument();
  });
});

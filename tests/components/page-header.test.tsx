import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { Button } from "@mantine/core";
import { PageHeader } from "@/components/ui";
import { renderWithProviders, screen } from "../helpers/render";

/**
 * The frame every destination shares (UX.md → Page structure): title, one
 * line of context, at most one primary action, and a return path when nested.
 */
describe("PageHeader", () => {
  it("renders the title as the page's heading", () => {
    renderWithProviders(<PageHeader title="Patients" />);

    expect(screen.getByRole("heading", { level: 1, name: "Patients" })).toBeInTheDocument();
  });

  it("renders one line of context when given one", () => {
    renderWithProviders(
      <PageHeader title="Patients" description="Everyone treated at your clinics." />
    );

    expect(screen.getByText("Everyone treated at your clinics.")).toBeInTheDocument();
  });

  it("offers a return path for a nested destination", () => {
    renderWithProviders(
      <PageHeader title="Dr. Menon" parent={{ label: "Users", href: "/app/users" }} />
    );

    expect(screen.getByRole("link", { name: /Users/ })).toHaveAttribute(
      "href",
      "/app/users"
    );
  });

  it("omits the return path on a top-level destination", () => {
    renderWithProviders(<PageHeader title="Patients" />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps one accessible name for the primary action across both renderings", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <PageHeader title="Patients" primaryAction={{ label: "New patient", onClick }} />
    );

    // The inline button and the narrow-width FAB are both in the DOM; the
    // viewport decides which is visible (CSS media queries, which jsdom does
    // not evaluate — visual behavior is verified in F10). Assistive tech sees
    // the same action either way, which is what matters here.
    const actions = screen.getAllByRole("button", { name: "New patient" });
    expect(actions).toHaveLength(2);

    await user.click(actions[0]);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders the primary action as a link when given a destination", () => {
    renderWithProviders(
      <PageHeader title="Clinics" primaryAction={{ label: "New clinic", href: "/app/clinics/new" }} />
    );

    const links = screen.getAllByRole("link", { name: "New clinic" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/app/clinics/new");
  });

  it("renders no action at all when the caller withholds it", () => {
    // How gating shows up here: a caller without the capability passes nothing.
    renderWithProviders(<PageHeader title="Users" />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("places secondary actions alongside the primary", () => {
    renderWithProviders(
      <PageHeader title="Reports" primaryAction={{ label: "Export", onClick: vi.fn() }}>
        <Button variant="default">Filters</Button>
      </PageHeader>
    );

    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Export" })).toHaveLength(2);
  });
});

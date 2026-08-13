import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { OrgShell } from "@/components/shell/org-shell";
import { renderWithProviders, screen, within } from "../helpers/render";
import { currentUserFixtures } from "../helpers/current-user";

const pathname = vi.hoisted(() => ({ current: "/app" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/**
 * The role-aware shell. These tests cover what the shell decides — which
 * destinations it offers, what state its controls are in, and whether the
 * keyboard path is intact.
 *
 * They deliberately do not assert visual responsiveness: `visibleFrom` /
 * `hiddenFrom` and the navbar breakpoint are CSS media queries, which jsdom
 * does not evaluate. Viewport-accurate checks are an F10 concern.
 */
describe("OrgShell", () => {
  beforeEach(() => {
    pathname.current = "/app";
    document.cookie = "pc-nav-collapsed=; path=/; max-age=0";
  });

  function nav() {
    return screen.getByRole("navigation", { name: "Primary" });
  }

  it("renders only the destinations the user's capabilities allow", () => {
    renderWithProviders(<OrgShell>content</OrgShell>, {
      currentUser: currentUserFixtures.receptionist(),
    });

    const links = within(nav()).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Patients",
      "Appointments",
      "Attendance",
      "Invoices",
      "Packages",
    ]);

    // A receptionist reaches no administration destination.
    expect(within(nav()).queryByRole("link", { name: "Users" })).toBeNull();
    expect(within(nav()).queryByText("Administration")).toBeNull();
  });

  it("marks the current destination for assistive technology", () => {
    pathname.current = "/app/patients";

    renderWithProviders(<OrgShell>content</OrgShell>);

    expect(within(nav()).getByRole("link", { name: "Patients" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      within(nav()).getByRole("link", { name: "Dashboard" })
    ).not.toHaveAttribute("aria-current");
  });

  it("treats a child route as its parent destination", () => {
    // A patient workspace is reached from Patients and keeps it highlighted.
    pathname.current = "/app/patients/patient-1";

    renderWithProviders(<OrgShell>content</OrgShell>);

    expect(within(nav()).getByRole("link", { name: "Patients" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("collapses the navigation to an icon rail and remembers the choice", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrgShell>content</OrgShell>);

    const collapse = screen.getByRole("button", { name: "Collapse navigation" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");

    await user.click(collapse);

    // The rail keeps every link reachable by its accessible name.
    expect(within(nav()).getByRole("link", { name: "Patients" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand navigation" })
    ).toHaveAttribute("aria-expanded", "false");
    // Persisted per device so the next server render paints the rail.
    expect(document.cookie).toContain("pc-nav-collapsed=true");
  });

  it("paints collapsed when the server render says the user left it that way", () => {
    renderWithProviders(<OrgShell initialNavCollapsed>content</OrgShell>);

    expect(
      screen.getByRole("button", { name: "Expand navigation" })
    ).toBeInTheDocument();
  });

  it("toggles the navigation on narrow widths through the burger", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrgShell>content</OrgShell>);

    const burger = screen.getByRole("button", { name: "Toggle navigation" });
    expect(burger).toHaveAttribute("aria-expanded", "false");

    await user.click(burger);
    expect(burger).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the working context and keeps the content region addressable", () => {
    renderWithProviders(<OrgShell>page content</OrgShell>);

    expect(screen.getByTestId("working-context")).toHaveTextContent(
      "Test Organization (North Clinic)"
    );

    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(document.querySelector("#main-content")).toHaveTextContent(
      "page content"
    );
  });
});

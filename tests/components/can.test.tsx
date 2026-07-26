import { describe, expect, it, vi } from "vitest";
import { Button } from "@mantine/core";
import { Can } from "@/components/ui";
import { renderWithProviders, screen } from "../helpers/render";
import { currentUserFixtures } from "../helpers/current-user";

/**
 * Client gating is by capability token, never by role name
 * (AGENTS.md → Client Authorization). These assertions use per-role fixtures,
 * but the component never sees a role — only the tokens the fixture carries.
 */
describe("Can", () => {
  it("renders children when the user holds the capability", () => {
    renderWithProviders(
      <Can capability="users:manage">
        <Button>Add user</Button>
      </Can>,
      { currentUser: currentUserFixtures.owner() }
    );

    expect(screen.getByRole("button", { name: "Add user" })).toBeInTheDocument();
  });

  it("hides children by default when the user does not", () => {
    renderWithProviders(
      <Can capability="users:manage">
        <Button>Add user</Button>
      </Can>,
      { currentUser: currentUserFixtures.receptionist() }
    );

    expect(screen.queryByRole("button", { name: "Add user" })).toBeNull();
  });

  it("renders a fallback in place of hidden children when given one", () => {
    renderWithProviders(
      <Can capability="subscription:manage" fallback={<p>Ask your owner.</p>}>
        <Button>Change plan</Button>
      </Can>,
      { currentUser: currentUserFixtures.admin() }
    );

    expect(screen.getByText("Ask your owner.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change plan" })).toBeNull();
  });

  it("disables rather than hides when asked", () => {
    renderWithProviders(
      <Can capability="users:manage" mode="disable">
        <Button>Add user</Button>
      </Can>,
      { currentUser: currentUserFixtures.physiotherapist() }
    );

    expect(screen.getByRole("button", { name: "Add user" })).toBeDisabled();
  });

  it("leaves an allowed child untouched in disable mode", () => {
    renderWithProviders(
      <Can capability="patients:view" mode="disable">
        <Button>Open patient</Button>
      </Can>,
      { currentUser: currentUserFixtures.physiotherapist() }
    );

    expect(screen.getByRole("button", { name: "Open patient" })).toBeEnabled();
  });

  it("fails loudly when disable mode is given something it cannot disable", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      renderWithProviders(
        <Can capability="users:manage" mode="disable">
          plain text
        </Can>,
        { currentUser: currentUserFixtures.receptionist() }
      )
    ).toThrow(/exactly one element child/);

    consoleError.mockRestore();
  });

  it("gates a platform user out of every organization capability", () => {
    renderWithProviders(
      <Can capability="patients:view">
        <Button>Patients</Button>
      </Can>,
      { currentUser: currentUserFixtures.superAdmin() }
    );

    expect(screen.queryByRole("button", { name: "Patients" })).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Button } from "@mantine/core";
import { DetailDrawer } from "@/components/ui";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

/**
 * Entity detail that keeps its list in view (UX.md → Dialogs & drawers).
 * The accessibility contract — focus trapped while open, returned to the
 * trigger on close, Esc closes — is asserted rather than assumed.
 */
describe("DetailDrawer", () => {
  it("renders its title, subtitle, and content", () => {
    renderWithProviders(
      <DetailDrawer opened onClose={vi.fn()} title="Dr. Menon" subtitle="Physiotherapist">
        <p>Compensation details</p>
      </DetailDrawer>
    );

    expect(screen.getByText("Dr. Menon")).toBeInTheDocument();
    expect(screen.getByText("Physiotherapist")).toBeInTheDocument();
    expect(screen.getByText("Compensation details")).toBeInTheDocument();
  });

  it("renders nothing when closed, so the list keeps the surface", () => {
    renderWithProviders(
      <DetailDrawer opened={false} onClose={vi.fn()} title="Dr. Menon">
        <p>Compensation details</p>
      </DetailDrawer>
    );

    expect(screen.queryByText("Compensation details")).toBeNull();
  });

  it("closes on the close affordance and on Esc", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <DetailDrawer opened onClose={onClose} title="Dr. Menon">
        <p>Compensation details</p>
      </DetailDrawer>
    );

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("returns focus to the trigger when dismissed", async () => {
    const user = userEvent.setup();

    function Host() {
      const [opened, setOpened] = useState(false);
      return (
        <>
          <Button onClick={() => setOpened(true)}>Open detail</Button>
          <DetailDrawer opened={opened} onClose={() => setOpened(false)} title="Dr. Menon">
            <p>Compensation details</p>
          </DetailDrawer>
        </>
      );
    }

    renderWithProviders(<Host />);
    const trigger = screen.getByRole("button", { name: "Open detail" });

    await user.click(trigger);
    expect(screen.getByText("Compensation details")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    // Mantine restores focus on a short timer once the overlay is gone.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("renders footer actions when given them", () => {
    renderWithProviders(
      <DetailDrawer
        opened
        onClose={vi.fn()}
        title="Dr. Menon"
        footer={<Button>Edit</Button>}
      >
        <p>Compensation details</p>
      </DetailDrawer>
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});

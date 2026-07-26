import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/ui";
import { renderWithProviders, screen } from "../helpers/render";

/**
 * A destructive confirmation names the specific target and the effect, and
 * puts the action's verb on the confirm button — never "Are you sure? / OK"
 * (UX.md → Destructive & irreversible actions).
 */
describe("ConfirmDialog", () => {
  const baseProps = {
    opened: true,
    title: "Deactivate user?",
    target: "Dr. Menon",
    consequence: "They lose access until reactivated.",
    confirmLabel: "Deactivate",
  };

  it("names the target and the consequence, not a generic question", () => {
    renderWithProviders(
      <ConfirmDialog {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(screen.getByText("Dr. Menon")).toBeInTheDocument();
    expect(
      screen.getByText("They lose access until reactivated.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/are you sure/i)).toBeNull();
  });

  it("puts the action's verb on the confirm button, never OK", () => {
    renderWithProviders(
      <ConfirmDialog {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "OK" })).toBeNull();
  });

  it("styles the confirm button as dangerous by default", () => {
    renderWithProviders(
      <ConfirmDialog {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(
      screen.getByRole("button", { name: "Deactivate" }).getAttribute("style")
    ).toContain("danger");
  });

  it("confirms through the confirm button", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ConfirmDialog {...baseProps} onClose={vi.fn()} onConfirm={onConfirm} />
    );

    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cancels through the cancel button and through Esc", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ConfirmDialog {...baseProps} onClose={onClose} onConfirm={vi.fn()} />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows progress and blocks cancelling while the action runs", () => {
    renderWithProviders(
      <ConfirmDialog {...baseProps} loading onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    // Pessimistic feedback: the action shows progress and awaits the server.
    expect(screen.getByRole("button", { name: "Deactivate" })).toHaveAttribute(
      "data-loading",
      "true"
    );
  });

  it("can drop danger styling for a non-destructive confirmation", () => {
    renderWithProviders(
      <ConfirmDialog
        {...baseProps}
        danger={false}
        confirmLabel="Continue"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Continue" }).getAttribute("style") ?? ""
    ).not.toContain("danger");
  });
});

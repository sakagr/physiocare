import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { RevealOnce } from "@/components/ui";
import { renderWithProviders, screen } from "../helpers/render";

/**
 * A secret shown once, then never again (F3's reveal-once surface — the
 * system-generated initial password). Masked by default, reveals and copies
 * on demand, and cannot be dismissed without an explicit, named confirm --
 * there is no undo once the value is gone.
 */
describe("RevealOnce", () => {
  const baseProps = {
    label: "Initial password",
    value: "Xk9!mPz2qwErTy1",
    warning: "This password is shown only once. If lost, it must be reset.",
    dismissConsequence: "You won't be able to see this password again.",
  };

  it("masks the value by default", () => {
    renderWithProviders(<RevealOnce {...baseProps} onDismiss={vi.fn()} />);

    const input = screen.getByLabelText("Initial password") as HTMLInputElement;
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue(baseProps.value);
    expect(screen.queryByText(baseProps.value)).toBeNull();
  });

  it("reveals the value through the visibility toggle", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RevealOnce {...baseProps} onDismiss={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /toggle password visibility/i }));

    expect(screen.getByLabelText("Initial password")).toHaveAttribute("type", "text");
  });

  it("copies the value via the copy button", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderWithProviders(<RevealOnce {...baseProps} onDismiss={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(baseProps.value);
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("shows the warning copy", () => {
    renderWithProviders(<RevealOnce {...baseProps} onDismiss={vi.fn()} />);

    expect(screen.getByText(baseProps.warning)).toBeInTheDocument();
  });

  it("cannot be dismissed without going through the named confirm", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<RevealOnce {...baseProps} onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText(baseProps.dismissConsequence)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "I've saved it" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("lets the user keep editing (cancel the dismissal) without losing the value", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<RevealOnce {...baseProps} onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Initial password")).toHaveValue(baseProps.value);
  });
});

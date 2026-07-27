import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { TextInput } from "@mantine/core";
import { FormDialog } from "@/components/ui";
import { renderWithProviders, screen } from "../helpers/render";

/**
 * The create/edit shell and, more importantly, the unsaved-changes guard
 * (UX.md → Unsaved changes): a dirty surface never loses edits silently,
 * whether the user closes it in-app or reloads the browser.
 */
describe("FormDialog", () => {
  const baseProps = {
    opened: true,
    title: "Edit patient",
  };

  function renderDialog(overrides: Partial<React.ComponentProps<typeof FormDialog>> = {}) {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const utils = renderWithProviders(
      <FormDialog {...baseProps} onClose={onClose} onSubmit={onSubmit} {...overrides}>
        <TextInput label="Full name" />
      </FormDialog>
    );
    return { onClose, onSubmit, ...utils };
  }

  it("renders the form fields inside a titled dialog", () => {
    renderDialog();

    expect(screen.getByText("Edit patient")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Full name" })).toBeInTheDocument();
  });

  it("submits through the primary action", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("shows progress and blocks cancelling while submitting", () => {
    renderDialog({ isSubmitting: true });

    expect(screen.getByRole("button", { name: "Save changes" })).toHaveAttribute(
      "data-loading",
      "true"
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("closes freely when nothing has changed", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ isDirty: false });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByText("Discard changes?")).toBeNull();
  });

  it("guards a dirty form instead of closing it", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ isDirty: true });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Discard changes?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("returns to the form with edits intact on Keep editing", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ isDirty: true });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Full name" })).toBeInTheDocument();
  });

  it("closes and drops the edits on Discard", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ isDirty: true });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("guards Esc as well, not just the footer", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ isDirty: true });

    await user.keyboard("{Escape}");

    expect(screen.getByText("Discard changes?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("backstops hard browser events while dirty, and cleans up after itself", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderWithProviders(
      <FormDialog {...baseProps} isDirty onClose={vi.fn()} onSubmit={vi.fn()}>
        <TextInput label="Full name" />
      </FormDialog>
    );

    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("removes every way out when the form is not dismissible", async () => {
    // The seam for a surface that must block the app until it is satisfied
    // (a forced password change). Dismissible remains the default.
    const onClose = vi.fn();
    renderWithProviders(
      <FormDialog {...baseProps} dismissible={false} onClose={onClose} onSubmit={vi.fn()}>
        <TextInput label="Full name" />
      </FormDialog>
    );

    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();

    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("registers no browser guard for a clean form", () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    renderWithProviders(
      <FormDialog {...baseProps} onClose={vi.fn()} onSubmit={vi.fn()}>
        <TextInput label="Full name" />
      </FormDialog>
    );

    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });
});

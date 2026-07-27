import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/api-error";
import { ErrorCodes } from "@/server/errors";
import { ChangePasswordDialog } from "@/features/auth/components/change-password-dialog";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const post = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({
  api: { post: (...args: unknown[]) => post(...args) },
}));

function renderDialog({ required = false, onClose = vi.fn() } = {}) {
  renderWithProviders(
    <ChangePasswordDialog opened onClose={onClose} required={required} />
  );
  return { onClose };
}

async function fillIn({
  current = "OldPass1!",
  next = "NewPass1!",
  confirm = next,
}: { current?: string; next?: string; confirm?: string } = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Current password"), current);
  await user.type(screen.getByLabelText("New password"), next);
  await user.type(screen.getByLabelText("Confirm new password"), confirm);
  return user;
}

/**
 * The reusable change-password surface (UX.md → Change-password dialog).
 * Voluntary mode is what ships; `required` is the seam the future forced
 * modes use, so only the dismissal behavior differs.
 *
 * Re-entering the current password is an application-level requirement: it is
 * what stops an unattended, unlocked workstation being used to take over an
 * account.
 */
describe("ChangePasswordDialog", () => {
  it("asks for the current password alongside the new one", () => {
    renderDialog();

    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("changes the password and closes", async () => {
    post.mockResolvedValueOnce(undefined);
    const { onClose } = renderDialog();
    const user = await fillIn();

    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/auth/change-password", {
        currentPassword: "OldPass1!",
        newPassword: "NewPass1!",
      })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("blames the current-password field when the server rejects it", async () => {
    post.mockRejectedValueOnce(
      new ApiError(
        "That current password isn't right.",
        400,
        ErrorCodes.INVALID_CURRENT_PASSWORD
      )
    );
    const { onClose } = renderDialog();
    const user = await fillIn();

    await user.click(screen.getByRole("button", { name: "Change password" }));

    // Inline on the offending field, and the dialog stays open so the user can
    // correct it (UX.md → Feedback channels).
    expect(
      await screen.findByText("That current password isn't right.")
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("enforces the password policy before submitting", async () => {
    renderDialog();
    const user = await fillIn({ next: "weak", confirm: "weak" });

    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("refuses a mismatched confirmation", async () => {
    renderDialog();
    const user = await fillIn({ next: "NewPass1!", confirm: "OtherPass1!" });

    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Both passwords must match.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("refuses to re-set the password the user already has", async () => {
    renderDialog();
    const user = await fillIn({ current: "SamePass1!", next: "SamePass1!" });

    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(
      await screen.findByText("Choose a password you haven't used here before.")
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("guards unsaved edits on dismissal", async () => {
    const { onClose } = renderDialog();
    const user = await fillIn();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByRole("heading", { name: "Discard changes?" })
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cannot be dismissed when the change is required", () => {
    renderDialog({ required: true });

    // The seam for the future forced modes: no way out of the dialog until the
    // password is changed.
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
  });
});

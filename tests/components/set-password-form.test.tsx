import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/api-error";
import { ErrorCodes } from "@/server/errors";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const post = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/api/client", () => ({
  api: { post: (...args: unknown[]) => post(...args) },
}));

function renderForm() {
  return renderWithProviders(
    <SetPasswordForm
      title="Set your password"
      description="Choose a password to finish setting up your account."
      submitLabel="Set password"
    />
  );
}

async function submit(newPassword: string, confirmPassword = newPassword) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("New password"), newPassword);
  await user.type(screen.getByLabelText("Confirm new password"), confirmPassword);
  await user.click(screen.getByRole("button", { name: "Set password" }));
  return user;
}

/**
 * The shared screen behind both the recovery and the invitation flows. The
 * user is already holding a session the callback exchanged for them, so this
 * only collects a password.
 */
describe("SetPasswordForm", () => {
  it("states the password policy before the user trips it", () => {
    renderForm();

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("sets the password and lands the user through the resolver", async () => {
    post.mockResolvedValueOnce(undefined);
    renderForm();
    await submit("ValidPass1!");

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/auth/set-password", {
        newPassword: "ValidPass1!",
      })
    );
    // "/" is the landing resolver — the user keeps the session they arrived
    // with rather than being sent back to sign in again.
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("refuses a password that misses a policy requirement", async () => {
    renderForm();
    await submit("alllowercase1!");

    expect(await screen.findByText("Include an uppercase letter.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("refuses a mismatched confirmation", async () => {
    renderForm();
    await submit("ValidPass1!", "ValidPass2!");

    expect(await screen.findByText("Both passwords must match.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("explains an expired link rather than a generic failure", async () => {
    post.mockRejectedValueOnce(
      new ApiError(
        "This link has expired. Request a new one to set your password.",
        401,
        ErrorCodes.PASSWORD_SETUP_SESSION_INVALID
      )
    );
    renderForm();
    await submit("ValidPass1!");

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/i);
    expect(router.push).not.toHaveBeenCalled();
  });
});

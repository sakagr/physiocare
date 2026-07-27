import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/api-error";
import { RequestResetForm } from "@/features/auth/components/request-reset-form";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const post = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({
  api: { post: (...args: unknown[]) => post(...args) },
}));

async function requestReset(username = "dr.menon") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), username);
  await user.click(screen.getByRole("button", { name: "Send reset link" }));
  return user;
}

/**
 * The request screen never reveals whether an account exists (settled
 * decision: the endpoint is uniform for every role). The steering for roles
 * whose email may be a placeholder is copy here, not a server rule
 * (UX.md → Flow 2).
 */
describe("RequestResetForm", () => {
  it("confirms generically without saying whether the account exists", async () => {
    post.mockResolvedValueOnce(undefined);
    renderWithProviders(<RequestResetForm />);
    await requestReset();

    const confirmation = await screen.findByRole("status");
    expect(confirmation).toHaveTextContent(/if an account exists/i);
    expect(confirmation.textContent).not.toMatch(/dr\.menon/i);
  });

  it("shows the same confirmation when the server reports nothing at all", async () => {
    // The endpoint answers identically for an unknown username, so the screen
    // must not have a second, different-looking outcome.
    post.mockResolvedValueOnce(undefined);
    renderWithProviders(<RequestResetForm />);
    await requestReset("nobody-here");

    expect(await screen.findByRole("status")).toHaveTextContent(
      /if an account exists/i
    );
  });

  it("tells staff without a usable email where to go instead", () => {
    renderWithProviders(<RequestResetForm />);

    expect(
      screen.getByText(/ask your owner or administrator/i)
    ).toBeInTheDocument();
  });

  it("asks for the username, the identifier people sign in with", async () => {
    post.mockResolvedValueOnce(undefined);
    renderWithProviders(<RequestResetForm />);
    await requestReset();

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/auth/request-password-reset", {
        username: "dr.menon",
      })
    );
  });

  it("validates before it submits", async () => {
    renderWithProviders(<RequestResetForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Enter your username.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("surfaces an unexpected failure instead of a false confirmation", async () => {
    post.mockRejectedValueOnce(new ApiError("Internal Server Error", 500));
    renderWithProviders(<RequestResetForm />);
    await requestReset();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offers the way back to sign-in", () => {
    renderWithProviders(<RequestResetForm />);

    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});

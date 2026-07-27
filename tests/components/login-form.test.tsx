import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/api-error";
import { ErrorCodes } from "@/server/errors";
import { LoginForm } from "@/features/auth/components/login-form";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }));
const post = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams.current,
}));

vi.mock("@/lib/api/client", () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
  },
}));

function renderLogin(search = "") {
  searchParams.current = new URLSearchParams(search);
  return renderWithProviders(<LoginForm />);
}

async function signIn(username = "dr.menon", password = "CorrectHorse1!") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), username);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
}

/**
 * The single front door for every role. Username — never email — is the login
 * identifier (AGENTS.md → User Identity), and the submission goes through
 * `/api`, not to Supabase directly (AGENTS.md → Backend Communication).
 */
describe("LoginForm", () => {
  it("asks for a username, not an email address", () => {
    renderLogin();

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("signs in through the API and lands on the resolver", async () => {
    post.mockResolvedValueOnce(undefined);
    renderLogin();
    await signIn();

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith("/api/auth/login", {
        username: "dr.menon",
        password: "CorrectHorse1!",
      });
    });
    // "/" is the landing resolver: sign-in stays role-agnostic.
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("resumes the path the user was bounced from", async () => {
    post.mockResolvedValueOnce(undefined);
    renderLogin("next=%2Fapp%2Fpatients");
    await signIn();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/app/patients"));
  });

  it("refuses to follow an off-site return path", async () => {
    post.mockResolvedValueOnce(undefined);
    renderLogin("next=https%3A%2F%2Fevil.example.com");
    await signIn();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
  });

  it("shows a failed sign-in in place instead of navigating", async () => {
    post.mockRejectedValueOnce(
      new ApiError(
        "We couldn't sign you in. Check your username and password.",
        401,
        ErrorCodes.INVALID_CREDENTIALS
      )
    );
    renderLogin();
    await signIn();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't sign you in. Check your username and password."
    );
    expect(router.push).not.toHaveBeenCalled();
    // The password is cleared so a retry starts from a known state.
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("explains a deactivated account rather than blaming the password", async () => {
    post.mockRejectedValueOnce(
      new ApiError(
        "This account is no longer active. Contact your administrator.",
        403,
        ErrorCodes.ACCOUNT_INACTIVE
      )
    );
    renderLogin();
    await signIn();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account is no longer active. Contact your administrator."
    );
  });

  it("validates before it submits", async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter your username.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("tells a bounced user why they are back here, and where they will return to", () => {
    renderLogin("reason=expired&next=%2Fapp%2Finvoices");

    expect(screen.getByRole("status")).toHaveTextContent(/session expired/i);
  });

  it("translates a broken sign-in link into human copy", () => {
    renderLogin("error=auth_callback_verify_failed");

    expect(screen.getByRole("alert")).toHaveTextContent(/link/i);
    expect(screen.queryByText(/auth_callback_verify_failed/)).toBeNull();
  });

  it("offers the way to recover a forgotten password", () => {
    renderLogin();

    expect(
      screen.getByRole("link", { name: "Forgot your password?" })
    ).toHaveAttribute("href", "/reset-password");
  });
});

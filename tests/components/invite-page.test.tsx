import { describe, expect, it, vi } from "vitest";
import InvitePage from "@/app/(auth)/invite/page";
import ResetPasswordConfirmPage from "@/app/(auth)/reset-password/confirm/page";
import { PASSWORD_SETUP_COOKIE } from "@/lib/auth/password-setup-ticket";
import { renderWithProviders, screen } from "../helpers/render";

const ticket = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === PASSWORD_SETUP_COOKIE && ticket.value !== undefined
        ? { name, value: ticket.value }
        : undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/api/client", () => ({ api: { post: vi.fn() } }));

/**
 * Both set-password screens are gated by the password-setup ticket rather
 * than by a token in the URL (ADR-0007). Its absence is what an expired or
 * already-used link looks like, and it is explained in place rather than
 * redirected away.
 */
describe("Invitation acceptance", () => {
  it("collects a password when the invitation link was just verified", async () => {
    ticket.value = "invite";
    renderWithProviders(await InvitePage());

    expect(
      screen.getByRole("heading", { name: "Set your password" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("explains a spent invitation instead of showing an unusable form", async () => {
    ticket.value = undefined;
    renderWithProviders(await InvitePage());

    expect(
      screen.getByRole("heading", { name: "This invitation has expired" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});

describe("Password reset confirmation", () => {
  it("collects a new password when the recovery link was just verified", async () => {
    ticket.value = "recovery";
    renderWithProviders(await ResetPasswordConfirmPage());

    expect(
      screen.getByRole("heading", { name: "Choose a new password" })
    ).toBeInTheDocument();
  });

  it("offers a fresh link when the recovery ticket is gone", async () => {
    ticket.value = undefined;
    renderWithProviders(await ResetPasswordConfirmPage());

    expect(
      screen.getByRole("heading", { name: "This link has expired" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new link" })
    ).toHaveAttribute("href", "/reset-password");
  });

  it("ignores a ticket value it did not issue", async () => {
    ticket.value = "magiclink";
    renderWithProviders(await ResetPasswordConfirmPage());

    expect(
      screen.getByRole("heading", { name: "This link has expired" })
    ).toBeInTheDocument();
  });
});

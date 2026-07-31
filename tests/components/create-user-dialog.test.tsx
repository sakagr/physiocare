import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { CreateUserDialog } from "@/features/users";
import { ApiError } from "@/lib/api/api-error";
import { renderWithProviders, screen } from "../helpers/render";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: (...args: unknown[]) => post(...args), patch: vi.fn(), delete: vi.fn() },
}));

const roleOptions = [{ name: "ORG_PHYSIOTHERAPIST", display_name: "Physiotherapist" }];

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Priya Physio");
  await user.type(screen.getByLabelText("Username"), "priya");
  await user.type(screen.getByLabelText("Email"), "priya@example.test");
  await user.click(screen.getByRole("combobox", { name: "Role" }));
  await user.click(await screen.findByRole("option", { name: "Physiotherapist" }));
}

/**
 * Create user (UX.md → Flow 9 step 1): on success, swaps the dialog into
 * the reveal-once success state (F3's reveal-once surface, first use) rather
 * than closing. D8's dedicated toast/stays-open behavior is proven generically
 * in `query-client-error-dispatch.test.tsx` (M3) -- this suite proves this
 * real consumer's field-error mapping instead.
 */
describe("CreateUserDialog", () => {
  it("creates a user and reveals the initial password exactly once", async () => {
    post.mockResolvedValue({ userId: "user-1", username: "priya", initialPassword: "Xk9!mPz2qwErTy1" });
    const user = userEvent.setup();
    renderWithProviders(<CreateUserDialog opened onClose={vi.fn()} roleOptions={roleOptions} />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("User created")).toBeInTheDocument();
    expect(screen.getByLabelText("Initial password")).toHaveValue("Xk9!mPz2qwErTy1");
    // The form is gone -- the dialog swapped body, not opened a second one.
    expect(screen.queryByLabelText("Full name")).toBeNull();
  });

  it("closes only after the reveal-once confirm, and toasts afterward", async () => {
    post.mockResolvedValue({ userId: "user-1", username: "priya", initialPassword: "Xk9!mPz2qwErTy1" });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<CreateUserDialog opened onClose={onClose} roleOptions={roleOptions} />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create user" }));
    await screen.findByText("User created");

    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: "I've saved it" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(await screen.findByText("priya was created.")).toBeInTheDocument();
  });

  it("blames the email field on EMAIL_ALREADY_EXISTS", async () => {
    post.mockRejectedValue(new ApiError("This email is already in use.", 409, "EMAIL_ALREADY_EXISTS"));
    const user = userEvent.setup();
    renderWithProviders(<CreateUserDialog opened onClose={vi.fn()} roleOptions={roleOptions} />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("This email is already in use.")).toBeInTheDocument();
    // The dialog stays open with input intact -- no onClose call on error.
    expect(screen.getByLabelText("Full name")).toHaveValue("Priya Physio");
  });

  it("blames the username field on USERNAME_ALREADY_EXISTS", async () => {
    post.mockRejectedValue(new ApiError("This username is already taken.", 409, "USERNAME_ALREADY_EXISTS"));
    const user = userEvent.setup();
    renderWithProviders(<CreateUserDialog opened onClose={vi.fn()} roleOptions={roleOptions} />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("This username is already taken.")).toBeInTheDocument();
  });
});

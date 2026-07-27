import { describe, expect, it } from "vitest";
import {
  PASSWORD_SETUP_COOKIE,
  PASSWORD_SETUP_TTL_SECONDS,
  isPasswordSetupFlow,
  passwordSetupCookieOptions,
} from "@/lib/auth/password-setup-ticket";

/**
 * The ticket is what authorizes setting a password *without* the current one
 * (ADR-0007). It says how a session was obtained, not who its owner is, so it
 * must be unreadable to scripts and short-lived.
 */
describe("password-setup ticket", () => {
  it("recognizes only the two flows that may issue one", () => {
    expect(isPasswordSetupFlow("recovery")).toBe(true);
    expect(isPasswordSetupFlow("invite")).toBe(true);

    for (const value of ["magiclink", "signup", "", null, undefined]) {
      expect(isPasswordSetupFlow(value)).toBe(false);
    }
  });

  it("is httpOnly, same-site, and short-lived", () => {
    const options = passwordSetupCookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(PASSWORD_SETUP_TTL_SECONDS);
    expect(PASSWORD_SETUP_TTL_SECONDS).toBeLessThanOrEqual(15 * 60);
  });

  it("names the cookie distinctly from the session cookies", () => {
    expect(PASSWORD_SETUP_COOKIE).toBe("pc_password_setup");
  });
});

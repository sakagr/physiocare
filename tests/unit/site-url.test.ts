import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAuthCallbackUrl, getSiteUrl } from "@/server/config/site-url";

const original = process.env.NEXT_PUBLIC_SITE_URL;

describe("site URL configuration", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3000";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it("tolerates a trailing slash in configuration", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3000/";

    expect(getSiteUrl()).toBe("http://127.0.0.1:3000");
  });

  it("fails loudly rather than emailing a broken link", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(() => getSiteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("builds the session-handoff URL a recovery link returns to", () => {
    expect(getAuthCallbackUrl()).toBe("http://127.0.0.1:3000/auth/callback");
  });

  it("steers an invitation to the set-password screen", () => {
    expect(getAuthCallbackUrl("/invite")).toBe(
      "http://127.0.0.1:3000/auth/callback?next=%2Finvite"
    );
  });
});

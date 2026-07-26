import { describe, expect, it } from "vitest";
import {
  isAuthCallback,
  isAuthRoute,
  isProtectedRoute,
} from "@/lib/auth/route-matchers";

/**
 * The proxy's path classification (Next 16 renamed middleware to Proxy). It
 * performs the optimistic session redirects only — the real authorization
 * gate is the route-group layout guard, so these matchers just need to name
 * the two namespaces and the front door correctly.
 */
describe("isProtectedRoute", () => {
  it("covers both application namespaces", () => {
    expect(isProtectedRoute("/app")).toBe(true);
    expect(isProtectedRoute("/app/patients")).toBe(true);
    expect(isProtectedRoute("/platform")).toBe(true);
    expect(isProtectedRoute("/platform/admin")).toBe(true);
  });

  it("leaves the front door and technical routes open", () => {
    expect(isProtectedRoute("/login")).toBe(false);
    expect(isProtectedRoute("/reset-password")).toBe(false);
    expect(isProtectedRoute("/auth/callback")).toBe(false);
    expect(isProtectedRoute("/")).toBe(false);
  });

  it("does not match a path that merely starts with a namespace name", () => {
    expect(isProtectedRoute("/applications")).toBe(false);
    expect(isProtectedRoute("/platforms")).toBe(false);
  });
});

describe("isAuthRoute", () => {
  it("matches the front-door destinations", () => {
    expect(isAuthRoute("/login")).toBe(true);
    expect(isAuthRoute("/reset-password")).toBe(true);
    expect(isAuthRoute("/reset-password/token-123")).toBe(true);
  });

  it("does not match application routes", () => {
    expect(isAuthRoute("/app")).toBe(false);
  });
});

describe("isAuthCallback", () => {
  it("matches the session handoff route so it is never redirected", () => {
    expect(isAuthCallback("/auth/callback")).toBe(true);
  });

  it("does not match the login page", () => {
    expect(isAuthCallback("/login")).toBe(false);
  });
});

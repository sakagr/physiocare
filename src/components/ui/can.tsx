"use client";

import { cloneElement, isValidElement } from "react";
import { useCan } from "@/lib/auth/current-user-context";
import type { Capability } from "@/types/contracts/me";

/**
 * Capability gating inside a surface: hides or disables an action rather than
 * showing it and letting the request fail (UX.md → State model, "Restricted").
 *
 * The gate is advisory UX. The route handlers' `withCapability` checks remain
 * the security boundary — this only decides what is worth offering.
 *
 * Depends on `src/lib/auth`, not on a feature: a shared primitive points down
 * at shared infrastructure.
 */
export interface CanProps {
  /** The capability token required to see or use the children. */
  capability: Capability;
  /**
   * `hide` (default) removes the action entirely — the right default, since
   * an action the user cannot take is noise. `disable` keeps it visible but
   * inert, for cases where its absence would be more confusing than its
   * presence; it requires exactly one element child.
   */
  mode?: "hide" | "disable";
  /** Rendered in place of hidden children, e.g. an explanatory note. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function Can({
  capability,
  mode = "hide",
  fallback = null,
  children,
}: CanProps) {
  const allowed = useCan(capability);

  if (allowed) {
    return <>{children}</>;
  }

  if (mode === "disable") {
    if (!isValidElement(children)) {
      throw new Error(
        'Can with mode="disable" requires exactly one element child to disable.'
      );
    }
    return cloneElement(
      children as React.ReactElement<{ disabled?: boolean }>,
      { disabled: true }
    );
  }

  return <>{fallback}</>;
}

export { useCan };

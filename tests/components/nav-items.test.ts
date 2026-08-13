import { describe, expect, it } from "vitest";
import { NAV_ITEMS, buildNavSections } from "@/components/shell/nav-items";
import type { Capability } from "@/types/contracts/me";
import { currentUserFixtures } from "../helpers/current-user";

/**
 * The primary navigation is capability-gated, never role-gated: items are
 * filtered by the capability map from `/me` and the client never compares
 * role names (AGENTS.md → Client Authorization).
 *
 * These assertions are the UX.md → "Primary navigation — organization app"
 * table, expressed as a test. The role names below describe the *expected
 * outcome* of capability gating, which is exactly how that table reads.
 */

function labelsFor(capabilities: Capability[]): string[] {
  return buildNavSections(capabilities).flatMap((section) =>
    section.items.map((item) => item.label)
  );
}

function sectionLabelsFor(capabilities: Capability[]): (string | null)[] {
  return buildNavSections(capabilities).map((section) => section.label);
}

describe("buildNavSections", () => {
  it("gives a manager every destination, grouped", () => {
    const owner = currentUserFixtures.owner();

    expect(labelsFor(owner.capabilities)).toEqual([
      "Dashboard",
      "Patients",
      "Appointments",
      "Attendance",
      "Invoices",
      "Packages",
      "Reports",
      "Users",
      "Clinics",
      "Settings",
      "Audit log",
    ]);
    expect(sectionLabelsFor(owner.capabilities)).toEqual([
      null, // Dashboard sits above the groups
      "Clinical",
      "Billing & catalog",
      "Administration",
    ]);
  });

  it("gives an administrator the same nav as an owner", () => {
    // Subscription is a tab within Settings, not a nav item, so the Owner-only
    // subscription capability makes no difference to the nav.
    const admin = currentUserFixtures.admin();
    const owner = currentUserFixtures.owner();

    expect(labelsFor(admin.capabilities)).toEqual(labelsFor(owner.capabilities));
  });

  it("gives a physiotherapist a shorter nav that still reaches their daily work", () => {
    const physio = currentUserFixtures.physiotherapist();

    expect(labelsFor(physio.capabilities)).toEqual([
      "Dashboard",
      "Patients",
      "Appointments",
      "Attendance",
      "Packages",
      "Reports",
    ]);
  });

  it("gives a receptionist their front-desk nav", () => {
    const reception = currentUserFixtures.receptionist();

    expect(labelsFor(reception.capabilities)).toEqual([
      "Dashboard",
      "Patients",
      "Appointments",
      "Attendance",
      "Invoices",
      "Packages",
    ]);
  });

  /**
   * Appointments and Attendance carry no capability at all (F6, D11), so they
   * survive an empty capability set exactly as Dashboard does. Their contents
   * are scoped per role by the service layer instead -- a physiotherapist's
   * appointment list is their own, a receptionist's is their accessible
   * clinics -- and the org-wide framing inside each stays gated on the
   * `:oversee` tokens.
   *
   * Ungating them was not a shortcut: `canViewAppointments` is "any active org
   * member", so a token for it would be granted to every org user and gate
   * nothing; and Attendance is reached through three different capabilities
   * (`attendance:record` for the physio, `attendance:manage` for reception,
   * either for management), which one capability field cannot express.
   */
  it("leaves the ungated clinical destinations reachable with no capabilities", () => {
    expect(labelsFor([])).toEqual(["Dashboard", "Appointments", "Attendance"]);
  });

  it("omits a group header when capability filtering empties the group", () => {
    const reception = currentUserFixtures.receptionist();

    // Reception reaches no Administration destination, so the header goes too.
    expect(sectionLabelsFor(reception.capabilities)).not.toContain(
      "Administration"
    );
    expect(sectionLabelsFor(reception.capabilities)).toEqual([
      null,
      "Clinical",
      "Billing & catalog",
    ]);
  });

  it("points every item at a destination under the org namespace", () => {
    for (const item of NAV_ITEMS) {
      expect(item.href.startsWith("/app")).toBe(true);
    }
  });
});

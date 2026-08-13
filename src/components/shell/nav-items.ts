import {
  IconBuildingHospital,
  IconCalendarEvent,
  IconClipboardList,
  IconFileInvoice,
  IconHistory,
  IconLayoutDashboard,
  IconPackages,
  IconReportAnalytics,
  IconSettings,
  IconUserHeart,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import type { Capability } from "@/types/contracts/me";

/**
 * The organization app's primary navigation, as data.
 *
 * Only top-level destinations appear here: child routes (patient workspace,
 * consultation) and contextual surfaces are reached from within a
 * destination, not from the nav (ADR-0001). Each item names the capability
 * that reveals it, so the nav is gated by the `/me` capability map and never
 * by a role name.
 *
 * Modelling the nav as data rather than JSX is what makes the gating
 * testable: `buildNavSections` is pure, and the rendered nav is a thin
 * projection of its output.
 */

export type NavGroup = "clinical" | "billing" | "administration";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: Icon;
  /** Group the item sits in; omitted for the ungrouped Dashboard. */
  group?: NavGroup;
  /** Capability that reveals the item; omitted when every role sees it. */
  capability?: Capability;
}

export interface NavSection {
  id: string;
  /** Group header, or `null` for the ungrouped items above the groups. */
  label: string | null;
  items: NavItem[];
}

const GROUP_LABELS: Record<NavGroup, string> = {
  clinical: "Clinical",
  billing: "Billing & catalog",
  administration: "Administration",
};

/** Declaration order is display order. */
export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/app",
    icon: IconLayoutDashboard,
  },
  {
    id: "patients",
    label: "Patients",
    href: "/app/patients",
    icon: IconUserHeart,
    group: "clinical",
    capability: "patients:view",
  },
  // Appointments and Attendance carry no capability (F6, D11): every org role
  // reaches both, and the service layer scopes what each one contains --
  // Owner/Admin organization-wide, a physiotherapist to their own, a
  // receptionist to their accessible clinics. The org-wide framing *inside*
  // each destination (the physiotherapist filter, the cross-staff columns and
  // user/clinic filters) stays gated on `appointments:oversee` /
  // `attendance:oversee`, which is what those two tokens now mean.
  //
  // Neither is ungated for convenience. `canViewAppointments` is "any active
  // org member", so a token for it would be granted to every org user and
  // gate nothing. Attendance is reached through three different capabilities
  // -- `attendance:record` (the physiotherapist marking themselves),
  // `attendance:manage` (reception recording for staff), either one for
  // management -- which a single `capability` field cannot express.
  {
    id: "appointments",
    label: "Appointments",
    href: "/app/appointments",
    icon: IconCalendarEvent,
    group: "clinical",
  },
  {
    id: "attendance",
    label: "Attendance",
    href: "/app/attendance",
    icon: IconClipboardList,
    group: "clinical",
  },
  {
    id: "invoices",
    label: "Invoices",
    href: "/app/invoices",
    icon: IconFileInvoice,
    group: "billing",
    capability: "invoices:access",
  },
  {
    id: "packages",
    label: "Packages",
    href: "/app/packages",
    icon: IconPackages,
    group: "billing",
    capability: "packages:view",
  },
  {
    id: "reports",
    label: "Reports",
    href: "/app/reports",
    icon: IconReportAnalytics,
    group: "administration",
    capability: "reports:view",
  },
  {
    id: "users",
    label: "Users",
    href: "/app/users",
    icon: IconUsers,
    group: "administration",
    capability: "users:manage",
  },
  {
    id: "clinics",
    label: "Clinics",
    href: "/app/clinics",
    icon: IconBuildingHospital,
    group: "administration",
    capability: "clinics:manage",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/app/settings",
    icon: IconSettings,
    group: "administration",
    capability: "settings:manage",
  },
  {
    id: "audit-logs",
    label: "Audit log",
    href: "/app/audit-logs",
    icon: IconHistory,
    group: "administration",
    capability: "auditLogs:view",
  },
];

const GROUP_ORDER: NavGroup[] = ["clinical", "billing", "administration"];

/**
 * Filters the nav by the granted capabilities and arranges what survives into
 * display sections. A group whose items are all filtered out loses its header
 * as well, rather than leaving an empty heading behind.
 */
export function buildNavSections(
  capabilities: readonly Capability[]
): NavSection[] {
  const granted = new Set(capabilities);
  const visible = NAV_ITEMS.filter(
    (item) => !item.capability || granted.has(item.capability)
  );

  const sections: NavSection[] = [];

  const ungrouped = visible.filter((item) => !item.group);
  if (ungrouped.length > 0) {
    sections.push({ id: "general", label: null, items: ungrouped });
  }

  for (const group of GROUP_ORDER) {
    const items = visible.filter((item) => item.group === group);
    if (items.length > 0) {
      sections.push({ id: group, label: GROUP_LABELS[group], items });
    }
  }

  return sections;
}

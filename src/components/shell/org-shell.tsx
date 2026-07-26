"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ActionIcon, AppShell, Burger, ScrollArea, Tooltip } from "@mantine/core";
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import { useCurrentUser } from "@/lib/auth/current-user-context";
import { PrimaryNav } from "./primary-nav";
import { TopBar } from "./top-bar";
import { NAV_COLLAPSED_COOKIE, writeShellPreference } from "./shell-preferences";

const NAV_WIDTH_EXPANDED = 260;
const NAV_WIDTH_RAIL = 72;

/**
 * The organization shell: persistent left navigation, a top bar, and the
 * content region (UX.md → App-shell regions).
 *
 * The shell is stable furniture — navigating between destinations swaps the
 * content region and never the shell. On desktop the nav is expanded by
 * default and collapses to an icon rail, with the choice remembered per
 * device; below the `sm` breakpoint it hides behind the burger instead.
 *
 * Collapsing to a rail changes the navbar's width rather than using
 * AppShell's `collapsed.desktop`, which would remove the navbar altogether.
 */
export function OrgShell({
  initialNavCollapsed = false,
  initialClinicId,
  children,
}: {
  initialNavCollapsed?: boolean;
  initialClinicId?: string | null;
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const pathname = usePathname() ?? "/app";
  const [mobileOpened, setMobileOpened] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(initialNavCollapsed);

  const currentClinic =
    user.clinics.find((clinic) => clinic.id === initialClinicId) ??
    user.clinics[0];

  function toggleRail() {
    const next = !railCollapsed;
    setRailCollapsed(next);
    writeShellPreference(NAV_COLLAPSED_COOKIE, String(next));
  }

  return (
    <AppShell
      padding="lg"
      header={{ height: 56 }}
      navbar={{
        width: railCollapsed ? NAV_WIDTH_RAIL : NAV_WIDTH_EXPANDED,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened },
      }}
    >
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <AppShell.Header>
        <TopBar
          currentClinicName={currentClinic?.name}
          initialClinicId={currentClinic?.id}
          leading={
            <>
              <Burger
                opened={mobileOpened}
                onClick={() => setMobileOpened((opened) => !opened)}
                hiddenFrom="sm"
                size="sm"
                aria-label="Toggle navigation"
                aria-expanded={mobileOpened}
                aria-controls="primary-navigation"
              />
              <Tooltip
                label={railCollapsed ? "Expand navigation" : "Collapse navigation"}
              >
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  visibleFrom="sm"
                  onClick={toggleRail}
                  aria-label={
                    railCollapsed ? "Expand navigation" : "Collapse navigation"
                  }
                  aria-expanded={!railCollapsed}
                >
                  {railCollapsed ? (
                    <IconLayoutSidebarLeftExpand size={20} stroke={1.5} />
                  ) : (
                    <IconLayoutSidebarLeftCollapse size={20} stroke={1.5} />
                  )}
                </ActionIcon>
              </Tooltip>
            </>
          }
        />
      </AppShell.Header>

      <AppShell.Navbar id="primary-navigation" component="nav" aria-label="Primary">
        <AppShell.Section grow component={ScrollArea}>
          <PrimaryNav
            capabilities={user.capabilities}
            pathname={pathname}
            collapsed={railCollapsed}
            onNavigate={() => setMobileOpened(false)}
          />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main id="main-content" bg="var(--mantine-color-page)">
        {children}
      </AppShell.Main>
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import { Box, NavLink, Stack, Text, Tooltip } from "@mantine/core";
import { buildNavSections } from "./nav-items";
import type { Capability } from "@/types/contracts/me";

/**
 * The capability-filtered primary navigation. It renders whatever
 * `buildNavSections` returns and nothing else — all gating decisions live in
 * that pure function.
 *
 * Collapsed, the nav becomes an icon rail: labels move into tooltips, but the
 * link keeps its accessible name so screen-reader users and keyboard users
 * lose nothing when the rail reclaims width.
 */
export function PrimaryNav({
  capabilities,
  pathname,
  collapsed,
  onNavigate,
}: {
  capabilities: readonly Capability[];
  pathname: string;
  collapsed: boolean;
  /** Closes the mobile navigation once a destination is chosen. */
  onNavigate?: () => void;
}) {
  const sections = buildNavSections(capabilities);

  return (
    <Stack gap="md" p="sm">
      {sections.map((section) => (
        <Box
          key={section.id}
          component="section"
          aria-label={section.label ?? undefined}
        >
          {section.label && !collapsed && (
            <Text
              size="xs"
              c="dimmed"
              fw={500}
              tt="uppercase"
              px="sm"
              pb="xs"
              id={`nav-group-${section.id}`}
            >
              {section.label}
            </Text>
          )}

          <Stack gap={2}>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/app" && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;

              const link = (
                <NavLink
                  component={Link}
                  href={item.href}
                  label={collapsed ? undefined : item.label}
                  aria-label={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  active={isActive}
                  onClick={onNavigate}
                  leftSection={<Icon size={20} stroke={1.5} />}
                  styles={
                    collapsed
                      ? { section: { marginInlineEnd: 0 }, body: { display: "none" } }
                      : undefined
                  }
                />
              );

              return collapsed ? (
                <Tooltip key={item.id} label={item.label} position="right">
                  {link}
                </Tooltip>
              ) : (
                <Box key={item.id}>{link}</Box>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

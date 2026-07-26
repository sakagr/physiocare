import { Center } from "@mantine/core";

/**
 * The shared front door. Auth flows are full-screen destinations by
 * necessity, so this group has no shell — a centered, single-column layout on
 * a plain background (UX.md → App-shell regions).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Center
      component="main"
      mih="100dvh"
      p="md"
      bg="var(--mantine-color-page)"
    >
      {children}
    </Center>
  );
}

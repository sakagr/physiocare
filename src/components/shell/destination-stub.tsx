import { Text } from "@mantine/core";
import { PageHeader } from "@/components/ui";

/**
 * A temporary placeholder for a destination whose content arrives in a later
 * phase. It exists so the shell, its capability-filtered navigation, and the
 * namespace guards are navigable and testable before any feature lands.
 *
 * It renders through the shared `PageHeader`, so every stub already carries
 * the page frame its real destination will keep — the title and its one line
 * of context stay put when the content underneath is filled in.
 */
export function DestinationStub({
  title,
  phase,
  description,
}: {
  title: string;
  /** The roadmap phase that builds this destination, e.g. "F6". */
  phase: string;
  description: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Text size="sm" c="dimmed">
        Arriving in phase {phase}.
      </Text>
    </>
  );
}

import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { ApiError } from "@/lib/api/api-error";
import { resolveErrorBehavior } from "@/lib/api/error-codes";

/**
 * The loading / empty / error triad every data-driven region moves through
 * (UX.md → State model), in one place so each surface does not re-invent it.
 *
 * Three deliberate choices:
 *
 * - `skeleton` is **required**. UX asks for "skeletons that match the eventual
 *   layout, not a bare spinner"; shipping a default spinner would make the
 *   wrong thing the easy thing. Requiring the node makes the caller supply a
 *   layout-shaped placeholder.
 * - The error is **scoped** — it replaces this region only, never the whole
 *   screen, and carries a retry when the caller can refetch.
 * - The message comes from the shared code→behavior map, so an `ApiError`
 *   reads the same here as anywhere else in the app.
 *
 * Precedence is error → loading → empty → content: a failed refetch shows its
 * error rather than an indefinite skeleton.
 */
export interface DataStateProps {
  /** Maps to TanStack Query's `isPending`. */
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
  /** Omit when the caller cannot refetch; the retry is hidden without it. */
  onRetry?: () => void;
  isEmpty?: boolean;
  /** Layout-matched placeholder shown while loading. Required by design. */
  skeleton: React.ReactNode;
  /** Usually an `<EmptyState />`. */
  empty?: React.ReactNode;
  children: React.ReactNode;
}

/** Human copy for a failure, reusing the single code→behavior mapping. */
function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return resolveErrorBehavior(error).message;
  }
  return "Something went wrong. Please try again.";
}

export function DataState({
  isLoading,
  isError = false,
  error,
  onRetry,
  isEmpty = false,
  skeleton,
  empty,
  children,
}: DataStateProps) {
  if (isError) {
    return (
      <Alert color="danger" variant="light" role="alert" title="Couldn't load this">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">{errorMessage(error)}</Text>
          {onRetry && (
            <Group>
              <Button size="xs" variant="default" onClick={onRetry}>
                Try again
              </Button>
            </Group>
          )}
        </Stack>
      </Alert>
    );
  }

  if (isLoading) {
    return <>{skeleton}</>;
  }

  if (isEmpty) {
    return <>{empty}</>;
  }

  return <>{children}</>;
}

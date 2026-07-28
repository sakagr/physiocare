"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid, Skeleton, Stack, Text } from "@mantine/core";
import { DataState, EmptyState } from "@/components/ui";
import { platformApiSpecQueryOptions } from "../queries";
import { filterOperations, groupByTag, listOperations, operationKey } from "../spec";
import { OperationDetail } from "./operation-detail";
import { OperationList } from "./operation-list";

/**
 * The API explorer (F2): a single self-contained page -- endpoint list,
 * operation detail, and try-it-out -- because `PlatformShell` has no nav
 * rail to host separate destinations for them (UX.md → Platform console).
 * Two panes side by side from `md` up; stacked on narrow widths via
 * `Grid.Col`'s responsive `span`.
 */
export function ApiExplorer() {
  const { data, isPending, isError, error, refetch } = useQuery(platformApiSpecQueryOptions());
  const [filter, setFilter] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const operations = useMemo(() => (data ? listOperations(data) : []), [data]);
  const filtered = useMemo(() => filterOperations(operations, filter), [operations, filter]);
  const grouped = useMemo(() => groupByTag(filtered), [filtered]);
  const selected = operations.find((op) => operationKey(op) === selectedKey) ?? null;

  function handleSelect(op: (typeof operations)[number]) {
    setSelectedKey(operationKey(op));
    // The heading is not mounted for the newly selected operation until this
    // render commits, so the focus move waits a frame rather than racing it.
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  return (
    <DataState
      isLoading={isPending}
      isError={isError}
      error={error}
      onRetry={refetch}
      skeleton={<Skeleton height={480} />}
      isEmpty={!isPending && !isError && operations.length === 0}
      empty={<EmptyState title="No operations documented yet" description="The OpenAPI spec has no operations to explore." />}
    >
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <OperationList groups={grouped} selectedKey={selectedKey} onSelect={handleSelect} filter={filter} onFilterChange={setFilter} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          {selected ? (
            <OperationDetail operation={selected} headingRef={headingRef} />
          ) : (
            <Stack justify="center" h="100%" py="xl">
              <Text c="dimmed" ta="center">
                Select an operation from the list to see its details and try it.
              </Text>
            </Stack>
          )}
        </Grid.Col>
      </Grid>
    </DataState>
  );
}

import { Badge, Box, Group, ScrollArea, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import type { Operation } from "../spec";
import { operationKey } from "../spec";

const METHOD_COLOR: Record<string, string> = {
  GET: "info",
  POST: "success",
  PATCH: "warning",
  PUT: "warning",
  DELETE: "danger",
};

/**
 * The operation list, grouped by tag with a filter above it (F2, decision
 * #4). A full keyboard user can Tab through the filter and every operation
 * button in document order -- no roving-tabindex machinery, which would
 * add complexity this list (dozens, not thousands, of items) does not need.
 */
export interface OperationListProps {
  groups: Map<string, Operation[]>;
  selectedKey: string | null;
  onSelect: (op: Operation) => void;
  filter: string;
  onFilterChange: (value: string) => void;
}

export function OperationList({ groups, selectedKey, onSelect, filter, onFilterChange }: OperationListProps) {
  const isEmpty = groups.size === 0;

  return (
    <Stack gap="sm" h="100%">
      <TextInput
        label="Filter operations"
        placeholder="method, path, or summary"
        value={filter}
        onChange={(event) => onFilterChange(event.currentTarget.value)}
      />

      <ScrollArea.Autosize mah={{ base: 320, md: 640 }}>
        <nav aria-label="API operations">
          <Stack gap="md">
            {isEmpty && (
              <Text size="sm" c="dimmed">
                No operations match &ldquo;{filter}&rdquo;.
              </Text>
            )}

            {[...groups.entries()].map(([tag, operations]) => (
              <Box key={tag} component="section" aria-labelledby={`tag-${tag}`}>
                <Text id={`tag-${tag}`} size="sm" fw={700} mb="xs">
                  {tag}
                </Text>
                <Stack gap={2} component="ul" p={0} m={0} style={{ listStyle: "none" }}>
                  {operations.map((op) => {
                    const key = operationKey(op);
                    const selected = key === selectedKey;
                    return (
                      <li key={key}>
                        <UnstyledButton
                          onClick={() => onSelect(op)}
                          aria-current={selected ? "true" : undefined}
                          px="sm"
                          py={6}
                          w="100%"
                          style={{
                            borderRadius: "var(--mantine-radius-sm)",
                            backgroundColor: selected ? "var(--mantine-color-primary-light)" : undefined,
                          }}
                        >
                          <Group gap="xs" wrap="nowrap" mb={2}>
                            <Badge size="sm" color={METHOD_COLOR[op.method] ?? "gray"} variant="light" w={64}>
                              {op.method}
                            </Badge>
                            <Text size="sm" ff="monospace" truncate>
                              {op.path}
                            </Text>
                          </Group>
                          <Text size="xs" c="dimmed" ta="left" truncate>
                            {op.operation.summary}
                          </Text>
                        </UnstyledButton>
                      </li>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        </nav>
      </ScrollArea.Autosize>
    </Stack>
  );
}

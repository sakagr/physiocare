import { Badge, Group, Stack, Table, Text } from "@mantine/core";
import type { JsonSchemaNode } from "../spec";

/**
 * A read-only rendering of a JSON Schema object's properties -- name, type,
 * required, description. Deliberately simple: an interactive schema
 * browser is more than a SUPER_ADMIN-only try-it-out tool needs, and
 * AGENTS.md's Architecture Philosophy favors the simplest design that
 * satisfies the current requirement.
 */
export interface SchemaViewProps {
  schema: JsonSchemaNode;
  /** Screen-reader label for the table; visually hidden by <Table> semantics. */
  caption: string;
}

function typeLabel(node: JsonSchemaNode): string {
  if (node.$ref) return "object (see components/schemas)";
  if (node.enum) return `enum: ${node.enum.map(String).join(" | ")}`;
  if (node.type === "array") return `array of ${node.items ? typeLabel(node.items) : "unknown"}`;
  if (node.anyOf) return node.anyOf.map(typeLabel).join(" | ");
  return node.type ?? "any";
}

export function SchemaView({ schema, caption }: SchemaViewProps) {
  const properties = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);

  if (properties.length === 0) {
    return <Text size="sm" c="dimmed">No fields.</Text>;
  }

  return (
    <Table striped withTableBorder aria-label={caption}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Field</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Description</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {properties.map(([name, node]) => (
          <Table.Tr key={name}>
            <Table.Td>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={500} ff="monospace">
                  {name}
                </Text>
                {required.has(name) && (
                  <Badge size="xs" color="danger" variant="light">
                    required
                  </Badge>
                )}
              </Group>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" ff="monospace">
                {typeLabel(node)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Stack gap={2}>
                {node.description && <Text size="sm">{node.description}</Text>}
                {node.default !== undefined && (
                  <Text size="xs" c="dimmed">
                    default: {JSON.stringify(node.default)}
                  </Text>
                )}
              </Stack>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

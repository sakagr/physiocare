import { Stack, Text } from "@mantine/core";
import type { Operation } from "../spec";
import { SchemaView } from "./schema-view";

/** The parameters and request-body schema for the selected operation. */
export function OperationDetailSchemas({ operation }: { operation: Operation }) {
  const parameters = operation.operation.parameters ?? [];
  const jsonSchema = operation.operation.requestBody?.content["application/json"]?.schema;
  const multipartSchema = operation.operation.requestBody?.content["multipart/form-data"]?.schema;

  if (parameters.length === 0 && !jsonSchema && !multipartSchema) {
    return null;
  }

  return (
    <Stack gap="md">
      {parameters.length > 0 && (
        <div>
          <Text fw={600} size="sm" mb="xs">
            Parameters
          </Text>
          <SchemaView
            caption="Parameters"
            schema={{
              type: "object",
              properties: Object.fromEntries(parameters.map((p) => [p.name, { ...p.schema, description: p.description ?? p.schema.description }])),
              required: parameters.filter((p) => p.required).map((p) => p.name),
            }}
          />
        </div>
      )}

      {(jsonSchema || multipartSchema) && (
        <div>
          <Text fw={600} size="sm" mb="xs">
            Request body
          </Text>
          <SchemaView caption="Request body" schema={jsonSchema ?? multipartSchema!} />
        </div>
      )}
    </Stack>
  );
}

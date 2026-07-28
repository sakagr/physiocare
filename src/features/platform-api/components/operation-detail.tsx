"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { Alert, Divider, Stack, Text, Title } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { ExecutionResult } from "../api";
import type { Operation } from "../spec";
import { OperationDetailSchemas } from "./operation-detail-schemas";
import { ResponsePanel } from "./response-panel";
import { TryItOutForm } from "./try-it-out-form";

/**
 * The selected operation's detail and try-it-out (F2). `headingRef` is the
 * focus target `ApiExplorer` moves to on selection, so a keyboard or
 * screen-reader user lands where the new content actually is rather than
 * staying on the list.
 */
export interface OperationDetailProps {
  operation: Operation;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function OperationDetail({ operation, headingRef }: OperationDetailProps) {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const warning = operation.operation["x-warning"];

  return (
    <Stack gap="md">
      <div>
        <Title order={2} fz="h3" ref={headingRef} tabIndex={-1}>
          {operation.method} {operation.path}
        </Title>
        <Text size="sm" mt={4}>
          {operation.operation.summary}
        </Text>
        {operation.operation.description && (
          <Text size="sm" c="dimmed" mt={4}>
            {operation.operation.description}
          </Text>
        )}
      </div>

      {warning && (
        <Alert color="danger" variant="light" role="alert" icon={<IconAlertTriangle size={18} />} title="This can replace your own session">
          {warning}
        </Alert>
      )}

      <OperationDetailSchemas operation={operation} />

      <Divider label="Try it out" labelPosition="left" />
      <TryItOutForm operation={operation} onResult={setResult} />

      <Divider label="Response" labelPosition="left" />
      <ResponsePanel result={result} />
    </Stack>
  );
}

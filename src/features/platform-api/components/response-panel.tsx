import { Anchor, Box, Code, Stack, Table, Text } from "@mantine/core";
import { StatusBadge } from "@/components/ui";
import type { ExecutionResult } from "../api";

/**
 * Renders a try-it-out result verbatim -- status line, headers, and body --
 * including the failure shapes the isomorphic API client normally hides:
 * a `{ error, code, details }` envelope with `code` sometimes absent
 * (FL5), a bodiless 204, and the three export routes' binary content
 * (offered as a download, never JSON-parsed).
 *
 * The whole panel carries `aria-live="polite"` so a screen reader announces
 * the outcome of a submission that replaced this same region's content.
 */
export interface ResponsePanelProps {
  result: ExecutionResult | null;
}

function statusRole(status: number): "success" | "warning" | "danger" | "neutral" {
  if (status === 0) return "danger";
  if (status >= 200 && status < 300) return "success";
  if (status >= 400 && status < 500) return "warning";
  if (status >= 500) return "danger";
  return "neutral";
}

function ErrorBody({ body }: { body: Record<string, unknown> }) {
  const details = body.details;
  return (
    <Stack gap="xs">
      <Text size="sm">{typeof body.error === "string" ? body.error : "Request failed."}</Text>
      {typeof body.code === "string" && (
        <Text size="sm" c="dimmed" ff="monospace">
          code: {body.code}
        </Text>
      )}
      {Array.isArray(details) && details.length > 0 && (
        <Stack gap={2} component="ul" pl="md">
          {details.map((issue, index) => (
            <Text component="li" size="sm" key={index} ff="monospace">
              {JSON.stringify(issue)}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function isErrorEnvelope(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && "error" in value;
}

export function ResponsePanel({ result }: ResponsePanelProps) {
  return (
    <Box aria-live="polite" aria-atomic="true">
      {!result && (
        <Text size="sm" c="dimmed">
          Send a request to see its response here.
        </Text>
      )}

      {result && (
        <Stack gap="sm">
          <StatusBadge
            label={result.status === 0 ? "Network error" : `${result.status} ${result.statusText}`}
            role={statusRole(result.status)}
          />

          {result.networkError && <Text size="sm">{result.networkError}</Text>}

          {!result.networkError && (
            <>
              {Object.keys(result.headers).length > 0 && (
                <Table withTableBorder aria-label="Response headers">
                  <Table.Tbody>
                    {Object.entries(result.headers).map(([name, value]) => (
                      <Table.Tr key={name}>
                        <Table.Td>
                          <Text size="xs" ff="monospace" fw={500}>
                            {name}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" ff="monospace">
                            {value}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}

              {result.isBinary && result.blobUrl && (
                <Anchor href={result.blobUrl} download={result.filename ?? "download"}>
                  Download {result.filename ?? "file"}
                </Anchor>
              )}

              {!result.isBinary && result.bodyJson !== undefined && isErrorEnvelope(result.bodyJson) && (
                <ErrorBody body={result.bodyJson} />
              )}

              {!result.isBinary && result.bodyJson !== undefined && !isErrorEnvelope(result.bodyJson) && (
                <Code block>{JSON.stringify(result.bodyJson, null, 2)}</Code>
              )}

              {!result.isBinary && result.bodyJson === undefined && result.bodyText && (
                <Code block>{result.bodyText}</Code>
              )}

              {!result.isBinary && result.bodyJson === undefined && !result.bodyText && (
                <Text size="sm" c="dimmed">
                  {result.status} · No content
                </Text>
              )}
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Button, FileInput, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { executeOperation, type ExecutionResult } from "../api";
import { buildExampleValue, type Operation } from "../spec";

/**
 * Builds the request and executes it -- same-origin, `credentials:
 * "include"`, every verb, no confirm step (decision #5). A raw JSON
 * textarea stands in for a generated form: this is SUPER_ADMIN tooling,
 * not an end-user form, and a full JSON-Schema-to-form generator is more
 * machinery than that warrants (AGENTS.md → Architecture Philosophy).
 */
export interface TryItOutFormProps {
  operation: Operation;
  onResult: (result: ExecutionResult) => void;
}

function jsonContentType(operation: Operation): string | undefined {
  return operation.operation.requestBody?.content["application/json"] ? "application/json" : undefined;
}

function multipartContentType(operation: Operation): boolean {
  return Boolean(operation.operation.requestBody?.content["multipart/form-data"]);
}

export function TryItOutForm({ operation, onResult }: TryItOutFormProps) {
  const pathParams = useMemo(
    () => (operation.operation.parameters ?? []).filter((p) => p.in === "path"),
    [operation]
  );
  const queryParams = useMemo(
    () => (operation.operation.parameters ?? []).filter((p) => p.in === "query"),
    [operation]
  );
  const isJson = Boolean(jsonContentType(operation));
  const isMultipart = multipartContentType(operation);
  const multipartSchema = operation.operation.requestBody?.content["multipart/form-data"]?.schema;
  const jsonSchema = operation.operation.requestBody?.content["application/json"]?.schema;

  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [jsonBody, setJsonBody] = useState(() => (jsonSchema ? JSON.stringify(buildExampleValue(jsonSchema), null, 2) : ""));
  const [multipartValues, setMultipartValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  function buildUrl(): string {
    let path = operation.path;
    for (const param of pathParams) {
      path = path.replace(`{${param.name}}`, encodeURIComponent(pathValues[param.name] ?? ""));
    }
    const search = new URLSearchParams();
    for (const param of queryParams) {
      const value = queryValues[param.name];
      if (value !== undefined && value !== "") {
        search.set(param.name, value);
      }
    }
    const query = search.toString();
    return query ? `${path}?${query}` : path;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setJsonError(null);

    if (isMultipart) {
      const formData = new FormData();
      for (const [name, value] of Object.entries(multipartValues)) {
        formData.set(name, value);
      }
      if (file) {
        formData.set("file", file);
      }
      setIsSubmitting(true);
      try {
        onResult(await executeOperation({ method: operation.method, url: buildUrl(), body: formData }));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    let body: string | undefined;
    if (isJson && jsonBody.trim()) {
      try {
        body = JSON.stringify(JSON.parse(jsonBody));
      } catch {
        setJsonError("This is not valid JSON.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      onResult(
        await executeOperation({
          method: operation.method,
          url: buildUrl(),
          body,
          contentType: body ? "application/json" : undefined,
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={`Try ${operation.method} ${operation.path}`}>
      <Stack gap="sm">
        {pathParams.map((param) => (
          <TextInput
            key={param.name}
            label={param.name}
            description={param.description}
            withAsterisk={param.required}
            value={pathValues[param.name] ?? ""}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setPathValues((prev) => ({ ...prev, [param.name]: value }));
            }}
          />
        ))}

        {queryParams.map((param) => (
          <TextInput
            key={param.name}
            label={param.name}
            description={param.description}
            withAsterisk={param.required}
            value={queryValues[param.name] ?? ""}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setQueryValues((prev) => ({ ...prev, [param.name]: value }));
            }}
          />
        ))}

        {isMultipart && (
          <>
            {Object.entries(multipartSchema?.properties ?? {})
              .filter(([name]) => name !== "file")
              .map(([name, node]) => (
                <TextInput
                  key={name}
                  label={name}
                  description={node.description}
                  withAsterisk={multipartSchema?.required?.includes(name)}
                  value={multipartValues[name] ?? ""}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setMultipartValues((prev) => ({ ...prev, [name]: value }));
                  }}
                />
              ))}
            <FileInput label="file" withAsterisk value={file} onChange={setFile} />
          </>
        )}

        {isJson && (
          <Textarea
            label="Request body (JSON)"
            minRows={4}
            ff="monospace"
            value={jsonBody}
            error={jsonError}
            onChange={(event) => setJsonBody(event.currentTarget.value)}
          />
        )}

        <Button type="submit" loading={isSubmitting} maw={200}>
          Send request
        </Button>
        {operation.method !== "GET" && (
          <Text size="xs" c="dimmed">
            This executes immediately against the live database.
          </Text>
        )}
      </Stack>
    </form>
  );
}

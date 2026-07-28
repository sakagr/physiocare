/**
 * Public surface of the `platform-api` feature (F2). Cross-feature imports
 * go through this barrel, never deep paths (AGENTS.md → Project Structure).
 * Explicit named exports only -- never `export *`.
 */
export {
  listOperations,
  groupByTag,
  filterOperations,
  operationKey,
  buildExampleValue,
  type OpenApiDocument,
  type OpenApiOperation,
  type OpenApiParameter,
  type OpenApiRequestBody,
  type OpenApiResponse,
  type JsonSchemaNode,
  type Operation,
} from "./spec";
export { platformApiQueryKeys, platformApiSpecQueryOptions } from "./queries";
export { executeOperation, type ExecuteOperationInput, type ExecutionResult } from "./api";
export { ApiExplorer } from "./components/api-explorer";
export { OperationList } from "./components/operation-list";
export { OperationDetail } from "./components/operation-detail";
export { TryItOutForm } from "./components/try-it-out-form";
export { ResponsePanel } from "./components/response-panel";
export { SchemaView } from "./components/schema-view";

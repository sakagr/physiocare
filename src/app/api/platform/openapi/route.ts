import { NextResponse, type NextRequest } from "next/server";
import { createRouteHandler, withCapability } from "@/lib/api/route-handler";
import { canExplorePlatformApi } from "@/server/services/authorization.service";
import { isApiExplorerEnabled } from "@/lib/env";
import openApiDocument from "@/server/openapi/openapi.json";

/**
 * Serves the platform API's OpenAPI 3.1 document for the API explorer
 * (F2, ADR-0008/ADR-0009). The document is generated at build time
 * (`npm run openapi:generate`) into a committed artifact and imported
 * statically here -- no `fs` access in a serverless function, and the
 * validator tree the registry touches never enters this route's bundle.
 */
const handleSpecRequest = createRouteHandler(
  withCapability(canExplorePlatformApi, async () => {
    return NextResponse.json(openApiDocument, { status: 200 });
  })
);

/**
 * Env is checked *before* authentication is ever consulted. A spec
 * enumerates the whole attack surface, so a disabled environment must 404
 * as if the route did not exist, rather than a 401/403 that would confirm
 * it does (ADR-0009). This is the one sanctioned exception to `createRouteHandler`
 * authenticating first by convention -- documented there rather than adding
 * an environment-aware variant to the shared wrapper.
 */
export async function GET(
  request: NextRequest,
  context?: { params: Promise<Record<string, never>> }
): Promise<NextResponse> {
  if (!isApiExplorerEnabled()) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  return handleSpecRequest(request, context);
}

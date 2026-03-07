/**
 * List Available Auth Providers API
 * Returns list of configured SSO providers for the login UI
 */

import { NextRequest } from "next/server";
import { getConfiguredProviders } from "@/lib/auth";
import { getApiContext, createSuccessResponse } from "@/lib/api-middleware";

export async function GET(request: NextRequest) {
  const ctx = getApiContext(request);
  try {
    const providers = getConfiguredProviders();
    return createSuccessResponse(ctx, { providers });
  } catch {
    return createSuccessResponse(ctx, { providers: ["credentials"] });
  }
}

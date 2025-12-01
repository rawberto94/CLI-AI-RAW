/**
 * Contracts List API - DEPRECATED
 * 
 * @deprecated Use /api/contracts directly instead.
 * This endpoint exists only for backward compatibility and will be removed in a future version.
 * All new code should use /api/contracts directly.
 */

import { NextRequest } from "next/server";
import { GET as ContractsHandler } from "../route";

export const dynamic = "force-dynamic";

/**
 * @deprecated Use GET /api/contracts instead
 */
export async function GET(request: NextRequest) {
  console.warn("DEPRECATED: /api/contracts/list is deprecated. Use /api/contracts instead.");
  // Directly call the new endpoint handler to avoid SSL issues with internal fetch
  return ContractsHandler(request);
}

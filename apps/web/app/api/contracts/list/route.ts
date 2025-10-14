/**
 * Contracts List API - REDIRECTS to /api/contracts
 * This endpoint exists for backward compatibility
 * All new code should use /api/contracts directly
 */

import { NextRequest, NextResponse } from "next/server";
import { GET as ContractsHandler } from "../route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Directly call the new endpoint handler to avoid SSL issues with internal fetch
  return ContractsHandler(request);
}

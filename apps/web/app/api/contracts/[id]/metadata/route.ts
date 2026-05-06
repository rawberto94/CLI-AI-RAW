/**
 * Contract Metadata API v2.0
 * Manages contract metadata, tags, and custom fields
 * Supports the new 24-field enterprise metadata schema
 * 
 * Now includes automatic RAG re-indexing when critical fields are updated
 */

import { NextRequest, NextResponse } from "next/server";
import cors from "@/lib/security/cors";
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractMetadata, putContractMetadata } from '@/lib/contracts/server/metadata';

/**
 * GET /api/contracts/[id]/metadata - Get contract metadata with enterprise schema
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractMetadata(ctx, contractId);
})

/**
 * PUT /api/contracts/[id]/metadata - Update contract metadata with enterprise schema
 */
export const PUT = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return putContractMetadata(request, ctx, contractId);
})

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return cors.optionsResponse(request, "GET, PUT, OPTIONS");
}
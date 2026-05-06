/**
 * Contract Upload API
 * POST /api/contracts/upload - Upload a contract file
 */

import { NextRequest, NextResponse } from 'next/server';

import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postContractUpload } from '@/lib/contracts/server/upload-single';
import cors from "@/lib/security/cors";
export const POST = withContractApiHandler(async (request, ctx) => {
  const response = await postContractUpload(request, ctx);
  return cors.addCorsHeaders(response, request, 'POST, OPTIONS');
});

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

/**
 * OPTIONS /api/contracts/upload
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return cors.optionsResponse(request, 'POST, OPTIONS');
}

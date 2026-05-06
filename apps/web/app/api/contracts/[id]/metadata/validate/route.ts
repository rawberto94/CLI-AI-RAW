/**
 * Metadata Validation API
 * 
 * Provides AI-assisted metadata validation and human verification workflow.
 * Returns confidence scores and suggestions for each field.
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  optionsContractMetadataValidation,
  postContractMetadataValidation,
  putContractMetadataValidation,
} from '@/lib/contracts/server/metadata';

/**
 * POST /api/contracts/[id]/metadata/validate - Validate metadata fields
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  return postContractMetadataValidation(request, ctx);
})

/**
 * PUT /api/contracts/[id]/metadata/validate - Confirm human validation
 */
export const PUT = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return putContractMetadataValidation(request, ctx, contractId);
})
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return optionsContractMetadataValidation(request);
}

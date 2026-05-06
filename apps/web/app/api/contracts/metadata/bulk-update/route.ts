import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postBulkContractMetadataUpdate } from '@/lib/contracts/server/metadata';

/**
 * POST /api/contracts/metadata/bulk-update
 * Bulk update metadata for multiple contracts
 */
export const POST = withContractApiHandler(async (request, ctx) => {
  return postBulkContractMetadataUpdate(request, ctx);
});

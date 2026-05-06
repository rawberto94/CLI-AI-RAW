/**
 * API Endpoint: Bulk Reprocess Metadata
 * 
 * POST /api/contracts/bulk-extract-metadata
 * Queues metadata extraction for multiple contracts
 */

import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getBulkContractMetadataExtractionStatus,
  postBulkContractMetadataExtraction,
} from '@/lib/contracts/server/metadata';

export const POST = withContractApiHandler(async (request, ctx) => {
  return postBulkContractMetadataExtraction(request, ctx);
});

/**
 * GET - Get bulk extraction status
 */
export const GET = withContractApiHandler(async (request, ctx) => {
  return getBulkContractMetadataExtractionStatus(ctx);
});

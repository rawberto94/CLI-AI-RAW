/**
 * Batch Operations API
 * POST /api/contracts/batch - Batch upload contracts
 * DELETE /api/contracts/batch - Batch delete contracts
 * PUT /api/contracts/batch - Batch update contracts
 */

import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  deleteContractBatch,
  postContractBatchUpload,
  putContractBatch,
} from '@/lib/contracts/server/batch';

/**
 * Batch upload contracts
 */
export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractBatchUpload(request, ctx);
});

/**
 * Batch delete contracts
 */
export const DELETE = withContractApiHandler(async (request, ctx) => {
  return deleteContractBatch(request, ctx);
});

/**
 * Batch update contracts
 */
export const PUT = withContractApiHandler(async (request, ctx) => {
  return putContractBatch(request, ctx);
});

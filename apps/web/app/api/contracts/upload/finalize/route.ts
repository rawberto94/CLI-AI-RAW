/**
 * Chunked Upload API - Finalize
 * POST /api/contracts/upload/finalize
 * 
 * Combine all chunks into final file and create contract.
 * Reads chunks via the storage abstraction layer, so chunks may live
 * on S3/MinIO, Azure Blob, or local filesystem depending on config.
 * Includes virus scanning before assembly for security.
 */

import { withContractApiHandler } from '@/lib/api-middleware';
import { postChunkedUploadFinalize } from '@/lib/contracts/server/chunked-upload';

export const POST = withContractApiHandler(async (req, ctx) => {
  return postChunkedUploadFinalize(req, ctx);
});

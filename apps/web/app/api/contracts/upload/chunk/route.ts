/**
 * Chunked Upload API - Upload Chunk
 * POST /api/contracts/upload/chunk
 * 
 * Upload a single chunk of a large file.
 * Uses the storage abstraction layer so chunks are stored via the
 * configured provider (S3/MinIO, Azure Blob, or local filesystem).
 */

import { withContractApiHandler } from '@/lib/api-middleware';
import { postChunkedUploadChunk } from '@/lib/contracts/server/chunked-upload';

export const POST = withContractApiHandler(async (req, ctx) => {
  return postChunkedUploadChunk(req, ctx);
});

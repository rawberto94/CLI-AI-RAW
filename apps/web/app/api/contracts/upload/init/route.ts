/**
 * Chunked Upload API - Initialize
 * POST /api/contracts/upload/init
 * 
 * Initialize a chunked upload session for large files
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/api-middleware';
import { postChunkedUploadInit } from '@/lib/contracts/server/chunked-upload';

export const POST = withContractApiHandler(async (req, ctx) => {
  return postChunkedUploadInit(req, ctx);
});

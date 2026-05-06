/**
 * Batch Upload API
 * POST /api/contracts/upload/batch
 *
 * Accepts multiple files in a single multipart/form-data request and
 * queues each for processing. Returns a batch result with per-file status
 * so the UI can track each upload independently.
 *
 * Limits:
 * - Maximum 10 files per batch (configurable via env)
 * - Per-file size limit: 50 MB (same as single upload)
 * - Total batch size limit: 200 MB
 * - Rate limited per tenant
 *
 * Each file goes through:
 * 1. Validation (type, size)
 * 2. Virus scan
 * 3. Content hash for dedup
 * 4. Storage (S3 or local)
 * 5. Contract record creation (transactional with outbox)
 * 6. Queue for processing
 */

import { NextRequest } from 'next/server';
import {
  withContractApiHandler,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';
import {
  postBatchUploadContracts,
} from '@/lib/contracts/server/upload-batch';

export const POST = withContractApiHandler(async (
  request: NextRequest,
  ctx: AuthenticatedApiContext
) => {
  return postBatchUploadContracts(request, ctx);
});

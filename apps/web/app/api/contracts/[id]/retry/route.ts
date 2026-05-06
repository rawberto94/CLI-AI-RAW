/**
 * Contract Processing Retry API
 * POST /api/contracts/:id/retry - Retry failed processing job and regenerate artifacts
 */

import { NextRequest } from "next/server";
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postContractProcessingRetry } from '@/lib/contracts/server/processing';

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return postContractProcessingRetry(request, ctx, contractId);
});

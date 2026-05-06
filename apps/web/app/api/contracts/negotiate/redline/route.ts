/**
 * Negotiation Copilot — Clause Redline API
 * POST /api/contracts/negotiate/redline — Generate redline for specific clause
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postNegotiationCopilotRedline } from '@/lib/contracts/server/negotiation';

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  return postNegotiationCopilotRedline(request, ctx);
});

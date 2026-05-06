/**
 * Negotiation Copilot API
 * 
 * POST /api/contracts/negotiate — Generate negotiation playbook
 * POST /api/contracts/negotiate/redline — Generate clause redline
 * POST /api/contracts/negotiate/advise — Stream negotiation advice
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postNegotiationCopilotPlaybook } from '@/lib/contracts/server/negotiation';

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  return postNegotiationCopilotPlaybook(request, ctx);
});

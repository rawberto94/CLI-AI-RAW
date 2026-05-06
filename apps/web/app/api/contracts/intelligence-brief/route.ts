/**
 * Contract Intelligence Brief API
 * 
 * GET  /api/contracts/intelligence-brief?contractId=xxx — Fetch existing brief
 * POST /api/contracts/intelligence-brief — Generate/regenerate brief
 */

import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractIntelligenceBrief,
  postContractIntelligenceBrief,
} from '@/lib/contracts/server/intelligence-brief';

export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractIntelligenceBrief(request, ctx);
});

export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractIntelligenceBrief(request, ctx);
});

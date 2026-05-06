/**
 * AI Report Generation API
 * 
 * POST /api/contracts/ai-report - Generate comprehensive AI report for multiple contracts
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractAiReportDescriptor,
  postContractAiReport,
} from '@/lib/contracts/server/ai-report';

export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractAiReport(request, ctx);
});

export const GET = withContractApiHandler(async (_request, ctx) => {
  return getContractAiReportDescriptor(ctx);
});

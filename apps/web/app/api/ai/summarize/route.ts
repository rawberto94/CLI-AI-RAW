import { NextRequest } from 'next/server';
import { aiContractSummarizationService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/ai/summarize
 * Generate AI-powered contract summaries at various levels
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { 
      contractId, 
      contractText, 
      level = 'executive',
      preset,
      options = {} 
    } = body;

    if (!contractId && !contractText) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Either contractId or contractText is required', 400);
    }

    // P0: Input length validation
    if (typeof contractText === 'string' && contractText.length > 200_000) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract text exceeds maximum length of 200000 characters', 400);
    }

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const summarizationService = (services as any).aiContractSummarizationService;

    if (!summarizationService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Contract summarization service not available', 503);
    }

    // Get contract text if only ID provided
    let text = contractText;
    if (!text && contractId) {
      const { prisma } = await import('@/lib/prisma');
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { rawText: true } });
      text = contract?.rawText || '';
    }

    if (!text) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract text not found', 404);
    }

    // Generate summary based on level or preset
    let summary;
    if (preset) {
      summary = await summarizationService.generateFromPreset(text, preset, options);
    } else {
      const request = {
        contractText: text,
        level,
        ...options };
      summary = await summarizationService.generateSummary(request);
    }

    return createSuccessResponse(ctx, {
      summary,
      level,
      preset });
  });

/**
 * GET /api/ai/summarize
 * Get available summary levels and presets
 */
export const GET = withAuthApiHandler(async (_request, ctx) => {
    const services = await import('data-orchestration/services');
    const summarizationService = (services as any).aiContractSummarizationService;

    if (!summarizationService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Contract summarization service not available', 503);
    }

    const presets = summarizationService.getPresets();
    const levels = ['executive', 'detailed', 'sections', 'risks', 'financial', 'complete'];

    return createSuccessResponse(ctx, {
      levels,
      presets: presets.map((p: any) => ({
        name: p.name,
        description: p.description,
        levels: p.levels })) });
  });

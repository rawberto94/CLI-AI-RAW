import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/ai/summarize
 * Generate AI-powered contract summaries at various levels
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      contractId, 
      contractText, 
      level = 'executive',
      preset,
      options = {} 
    } = body;

    if (!contractId && !contractText) {
      return NextResponse.json(
        { error: 'Either contractId or contractText is required' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const summarizationService = (services as any).aiContractSummarizationService;

    if (!summarizationService) {
      return NextResponse.json(
        { error: 'Contract summarization service not available' },
        { status: 503 }
      );
    }

    // Get contract text if only ID provided
    let text = contractText;
    if (!text && contractId) {
      const { prisma } = await import('@/lib/prisma');
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { rawText: true },
      });
      text = contract?.rawText || '';
    }

    if (!text) {
      return NextResponse.json(
        { error: 'Contract text not found' },
        { status: 404 }
      );
    }

    // Generate summary based on level or preset
    let summary;
    if (preset) {
      summary = await summarizationService.generateFromPreset(text, preset, options);
    } else {
      const request = {
        contractText: text,
        level,
        ...options,
      };
      summary = await summarizationService.generateSummary(request);
    }

    return NextResponse.json({
      success: true,
      summary,
      level,
      preset,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to generate contract summary', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/summarize
 * Get available summary levels and presets
 */
export async function GET() {
  try {
    const services = await import('@repo/data-orchestration/services');
    const summarizationService = (services as any).aiContractSummarizationService;

    if (!summarizationService) {
      return NextResponse.json(
        { error: 'Contract summarization service not available' },
        { status: 503 }
      );
    }

    const presets = summarizationService.getPresets();
    const levels = ['executive', 'detailed', 'sections', 'risks', 'financial', 'complete'];

    return NextResponse.json({
      levels,
      presets: presets.map((p: any) => ({
        name: p.name,
        description: p.description,
        levels: p.levels,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get summarization options' },
      { status: 500 }
    );
  }
}

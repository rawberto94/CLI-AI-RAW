/**
 * AI Contract Categorization API
 * 
 * POST /api/contracts/[id]/categorize
 * GET /api/contracts/[id]/categorize - Get categorization status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantIdFromRequest } from '@/lib/tenant-server';
import { optionalImport } from '@/lib/server/optional-module';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { queueRAGReindex } from '@/lib/rag/reindex-helper';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth check
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let tenantId: string;
    try {
      tenantId = await getTenantIdFromRequest(request);
    } catch {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: id, tenantId },
      select: {
        id: true,
        status: true,
        rawText: true,
        contractType: true,
        searchMetadata: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Parse options
    const body = await request.json().catch(() => ({}));
    const {
      autoApply = true,
      autoApplyThreshold = 0.75,
      forceRecategorize = false,
      synchronous = false,
      quick = false,
    } = body;

    // Check if already categorized
    if (!forceRecategorize && contract.contractType) {
      const metadata = contract.searchMetadata as Record<string, unknown> | null;
      const categorization = metadata?._categorization as Record<string, unknown> | undefined;

      return NextResponse.json({
        success: true,
        alreadyCategorized: true,
        contractType: contract.contractType,
        categorization: categorization || null,
        message: 'Contract already categorized. Use forceRecategorize: true to re-categorize.',
      });
    }

    // Check for text
    if (!contract.rawText || contract.rawText.length < 100) {
      return NextResponse.json(
        {
          error: 'Contract has insufficient text for categorization',
          textLength: contract.rawText?.length || 0,
        },
        { status: 400 }
      );
    }

    if (synchronous) {
      // Run categorization synchronously
      try {
        const { AIContractCategorizer } = await import('@/lib/ai/contract-categorizer');
        const categorizer = new AIContractCategorizer();

        let result;
        if (quick) {
          // Quick classification
          result = await categorizer.quickCategorize(contract.rawText);
          
          // Apply if requested
          if (autoApply && (result.confidence / 100) >= autoApplyThreshold) {
            await prisma.contract.update({
              where: { id: id },
              data: {
                contractType: result.contractType,
                // Store risk level in searchMetadata
                searchMetadata: {
                  ...(contract.searchMetadata as any || {}),
                  riskLevel: result.riskLevel,
                  riskScore: result.riskLevel === 'LOW' ? 20 : result.riskLevel === 'MEDIUM' ? 50 : result.riskLevel === 'HIGH' ? 75 : 95,
                } as any,
                updatedAt: new Date(),
              },
            });

            // Queue RAG re-indexing for categorization changes
            await queueRAGReindex({
              contractId: id,
              tenantId,
              reason: 'AI categorization applied',
            });

            void publishRealtimeEvent({
              event: 'contract:updated',
              data: { tenantId, contractId: id },
              source: 'api:contracts/ai-categorize',
            });
          }

          return NextResponse.json({
            success: true,
            quick: true,
            result: {
              contractType: result.contractType,
              riskLevel: result.riskLevel,
              confidence: result.confidence,
              processingTimeMs: result.processingTimeMs,
            },
            autoApplied: autoApply && (result.confidence / 100) >= autoApplyThreshold,
          });
        }

        // Full categorization
        result = await categorizer.categorize(contract.rawText, {
          contractId: id,
          includeReasoning: true,
          detectRegulatory: true,
          extractParties: true,
        });

        // Apply if requested and confidence is high enough
        const shouldApply = autoApply && (result.overallConfidence / 100) >= autoApplyThreshold;

        if (shouldApply) {
          const riskScoreMap: Record<string, number> = {
            LOW: 20, MEDIUM: 50, HIGH: 75, CRITICAL: 95,
          };

          await prisma.contract.update({
            where: { id: id },
            data: {
              contractType: result.contractType.value,
              keywords: result.subjectTags,
              searchMetadata: {
                ...(contract.searchMetadata as any || {}),
                _categorization: {
                  ...result,
                  categorizedAt: new Date().toISOString(),
                  riskLevel: result.riskLevel.value,
                },
              } as any,
              updatedAt: new Date(),
            },
          });

          // Queue RAG re-indexing for full categorization
          await queueRAGReindex({
            contractId: id,
            tenantId,
            reason: 'full AI categorization applied',
          });

          void publishRealtimeEvent({
            event: 'contract:updated',
            data: { tenantId, contractId: id },
            source: 'api:contracts/ai-categorize',
          });
        }

        return NextResponse.json({
          success: true,
          synchronous: true,
          result,
          autoApplied: shouldApply,
        });
      } catch (error: unknown) {
        return NextResponse.json(
          {
            error: 'Categorization failed',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    } else {
      // Queue for background processing
      try {
        const workerModule = await optionalImport<{ queueCategorizationJob: (args: any) => Promise<string> }>(
          '@workspace/workers/categorization-worker'
        );

        if (!workerModule?.queueCategorizationJob) {
          return NextResponse.json(
            {
              error: 'Background worker not available',
              message: 'Categorization worker is not installed/configured in this environment.',
            },
            { status: 503 }
          );
        }

        const { queueCategorizationJob } = workerModule;

        const jobId = await queueCategorizationJob({
          contractId: id,
          tenantId,
          autoApply,
          autoApplyThreshold,
          forceRecategorize,
          source: 'manual',
          priority: 'high',
        });

        return NextResponse.json({
          success: true,
          queued: true,
          jobId,
          message: 'Categorization queued for background processing',
        });
      } catch {
        return NextResponse.json(
          { error: 'Failed to queue categorization' },
          { status: 500 }
        );
      }
    }
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get categorization status and details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let tenantId: string;
    try {
      tenantId = await getTenantIdFromRequest(request);
    } catch {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const contract = await prisma.contract.findFirst({
      where: { id: id, tenantId },
      select: {
        id: true,
        contractType: true,
        category: true,
        categoryL1: true,
        categoryL2: true,
        keywords: true,
        searchMetadata: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    const metadata = contract.searchMetadata as Record<string, unknown> | null;
    const categorization = metadata?._categorization as Record<string, unknown> | undefined;
    const pendingCategorization = metadata?._pendingCategorization as Record<string, unknown> | undefined;

    return NextResponse.json({
      isCategorized: !!contract.contractType,
      contractType: contract.contractType,
      category: contract.category,
      categoryPath: contract.categoryL1 
        ? `/${contract.categoryL1}${contract.categoryL2 ? '/' + contract.categoryL2 : ''}`
        : null,
      riskLevel: categorization?.riskLevel || null,
      keywords: contract.keywords,
      categorization: categorization || null,
      pendingCategorization: pendingCategorization || null,
      needsReview: pendingCategorization?.needsReview || false,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

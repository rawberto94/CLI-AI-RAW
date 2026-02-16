/**
 * Contract Post-Processing API
 * POST /api/contracts/[id]/post-process - Trigger post-processing hooks
 * 
 * Called after artifact generation to:
 * - Auto-extract metadata using AI
 * - Auto-categorize contract
 * - Calculate health score
 * - Trigger notifications
 * - Index for RAG search
 */

import { NextRequest } from "next/server";
import cors from "@/lib/security/cors";
import { runPostProcessingHooks as _runPostProcessingHooks } from "@/lib/post-processing-hooks";
import { AutoPopulateService, type AutoPopulateConfig } from "@/lib/services/auto-populate.service";
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from "@/lib/tenant-server";
import { triggerContractReindex } from "@/lib/rag/reindex-trigger";
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Available post-processing hooks
type HookType = 
  | "metadata-extraction"  // AI-powered metadata extraction
  | "categorization"       // Auto-categorize contract type
  | "health-score"         // Calculate contract health
  | "notifications"        // Send relevant notifications
  | "rag-indexing";        // Index for RAG search

interface PostProcessRequest {
  hooks?: HookType[];
  metadataOptions?: {
    autoApplyThreshold?: number;      // Auto-approve above this (default 0.85)
    skipBelowThreshold?: number;      // Skip below this (default 0.4)
    forceReExtract?: boolean;         // Re-extract even if metadata exists
    onlyEmptyFields?: boolean;        // Only fill empty fields
  };
}

// ============================================================================
// POST - Trigger post-processing
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { id: contractId } = await params;
    const tenantId = await getApiTenantId(request);

    // Get options from body
    const body: PostProcessRequest = await request.json().catch(() => ({}));
    const { 
      hooks = ["metadata-extraction", "categorization", "rag-indexing"], 
      metadataOptions = {} 
    } = body;

    // Run selected hooks in order
    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // 1. Metadata Extraction (should run first)
    if (hooks.includes("metadata-extraction")) {
      try {
        const config: Partial<AutoPopulateConfig> = {
          autoApproveThreshold: metadataOptions.autoApplyThreshold ?? 0.85,
          requireReviewThreshold: metadataOptions.skipBelowThreshold ?? 0.6,
          overwriteExisting: !(metadataOptions.onlyEmptyFields ?? true),
        };
        
        // Get contract text for extraction — scoped to caller's tenant
        const contract = await prisma.contract.findFirst({
          where: { id: contractId, tenantId },
          select: { rawText: true },
        });
        
        const autoPopulateService = new AutoPopulateService(config);
        const extractionResult = await autoPopulateService.processContract(
          contractId,
          tenantId,
          contract?.rawText || ''
        );
        
        results.metadataExtraction = {
          success: true,
          ...extractionResult,
        };
      } catch (error: unknown) {
        errors.metadataExtraction = error instanceof Error ? error.message : "Unknown error";
        results.metadataExtraction = { success: false };
      }
    }

    // 2. Categorization
    if (hooks.includes("categorization")) {
      try {
        const { runPostProcessingHooks } = await import("@/lib/post-processing-hooks");
        const hookResults = await runPostProcessingHooks(contractId, tenantId);
        const { success: _, ...categorizationData } = hookResults.categorization || {};
        results.categorization = {
          success: true,
          ...categorizationData,
        };
      } catch (error: unknown) {
        errors.categorization = error instanceof Error ? error.message : "Unknown error";
        results.categorization = { success: false };
      }
    }

    // 3. Health Score Calculation
    if (hooks.includes("health-score")) {
      try {
        
        // Fetch contract data for health score calculation
        const contract = await prisma.contract.findFirst({
          where: { id: contractId, tenantId },
          select: {
            expirationDate: true,
            totalValue: true,
            status: true,
            autoRenewalEnabled: true,
            noticePeriodDays: true,
            metadata: true,
            artifacts: { select: { id: true } },
          },
        });

        if (contract) {
          // Calculate health score based on multiple factors
          let score = 100;
          const issues: string[] = [];

          // Check expiration (deduct points if expiring soon)
          if (contract.expirationDate) {
            const daysToExpiry = Math.floor((new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (daysToExpiry < 0) {
              score -= 30;
              issues.push('Contract has expired');
            } else if (daysToExpiry < 30) {
              score -= 20;
              issues.push('Contract expiring within 30 days');
            } else if (daysToExpiry < 90) {
              score -= 10;
              issues.push('Contract expiring within 90 days');
            }
          }

          // Check if auto-renewal is set for long-term contracts
          if (!contract.autoRenewalEnabled && contract.expirationDate) {
            score -= 5;
            issues.push('No auto-renewal configured');
          }

          // Check termination notice days
          if (!contract.noticePeriodDays) {
            score -= 5;
            issues.push('Termination notice period not set');
          }

          // Check if artifacts exist
          if (!contract.artifacts || contract.artifacts.length === 0) {
            score -= 10;
            issues.push('No document artifacts found');
          }

          // Check contract value
          if (!contract.totalValue || Number(contract.totalValue) === 0) {
            score -= 5;
            issues.push('Contract value not specified');
          }

          // Clamp score between 0-100
          score = Math.max(0, Math.min(100, score));

          // Update contract metadata with health score
          const existingMeta = (contract.metadata as Record<string, unknown>) || {};
          await prisma.contract.update({
            where: { id: contractId },
            data: {
              metadata: {
                ...existingMeta,
                _healthScore: {
                  score,
                  issues,
                  calculatedAt: new Date().toISOString(),
                },
              },
            },
          });

          results.healthScore = {
            success: true,
            score,
            issues,
          };
        } else {
          results.healthScore = {
            success: false,
            score: null,
            message: "Contract not found",
          };
        }
      } catch (error: unknown) {
        errors.healthScore = error instanceof Error ? error.message : "Unknown error";
      }
    }

    // 4. Notifications - Create notifications for relevant events
    if (hooks.includes("notifications")) {
      try {
        const contract = await prisma.contract.findFirst({
          where: { id: contractId, tenantId },
          select: {
            id: true,
            contractTitle: true,
            expirationDate: true,
            status: true,
            uploadedBy: true,
          },
        });

        const sentNotifications: Array<{ type: string; userId: string }> = [];

        if (contract && contract.uploadedBy) {
          // Check if contract is expiring soon and create notification
          if (contract.expirationDate) {
            const daysToExpiry = Math.floor((new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            
            if (daysToExpiry > 0 && daysToExpiry <= 30) {
              // Create expiration warning notification
              await prisma.notification.create({
                data: {
                  userId: contract.uploadedBy,
                  tenantId,
                  type: 'CONTRACT_EXPIRING',
                  title: 'Contract Expiring Soon',
                  message: `"${contract.contractTitle || 'Untitled Contract'}" expires in ${daysToExpiry} days`,
                  link: `/contracts/${contractId}`,
                  metadata: { contractId, daysToExpiry },
                },
              });
              sentNotifications.push({ type: 'CONTRACT_EXPIRING', userId: contract.uploadedBy });
            }
          }
        }

        results.notifications = {
          success: true,
          sent: sentNotifications,
        };
      } catch (error: unknown) {
        errors.notifications = error instanceof Error ? error.message : "Unknown error";
      }
    }

    // 5. RAG Indexing - Index contract text for semantic search
    if (hooks.includes("rag-indexing")) {
      try {
        const reindexResult = await triggerContractReindex(contractId, {
          tenantId,
          deleteExisting: true,
        });
        results.ragIndexing = {
          success: reindexResult.success,
          chunksCreated: reindexResult.chunksCreated,
          error: reindexResult.error,
        };
      } catch (error: unknown) {
        errors.ragIndexing = error instanceof Error ? error.message : "Unknown error";
        results.ragIndexing = { success: false };
      }
    }

    const hasErrors = Object.keys(errors).length > 0;
    const allFailed = Object.values(results).every(r => !r.success);

    return createSuccessResponse(ctx, {
      success: !allFailed,
      contractId,
      hooks: hooks,
      results,
      errors: hasErrors ? errors : undefined,
      message: allFailed 
        ? "All post-processing hooks failed" 
        : hasErrors 
          ? "Post-processing completed with some errors"
          : "Post-processing completed successfully",
    }, { status: allFailed ? 500 : 200 });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  return cors.optionsResponse(request, "POST, OPTIONS");
}

/**
 * AI Cost Optimization API
 * 
 * Manages AI costs and model selection:
 * - Get cost estimates
 * - View usage reports
 * - Set budgets
 * - Optimize batch requests
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { getCostSummary, getHistoricalCostSummary } from '@/lib/ai/model-router.service';

// Dynamic import helper with proper typing
async function getAiCostOptimizerService() {
  const services = await import('data-orchestration/services');
  return (services as any).aiCostOptimizerService;
}

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const aiCostOptimizerService = await getAiCostOptimizerService();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'budget';

    switch (action) {
      case 'budget': {
        const status = aiCostOptimizerService.getBudgetStatus(tenantId);
        return createSuccessResponse(ctx, status);
      }

      case 'report': {
        const period = (searchParams.get('period') || 'month') as 'day' | 'week' | 'month';
        const report = aiCostOptimizerService.generateUsageReport(tenantId, period);
        return createSuccessResponse(ctx, report);
      }

      case 'estimate': {
        const taskType = searchParams.get('taskType');
        const inputLength = parseInt(searchParams.get('inputLength') || '1000', 10);
        const preferredModel = searchParams.get('model') as any;
        
        if (!taskType) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'taskType is required', 400);
        }

        // Generate sample text of specified length for estimation
        const sampleText = 'x'.repeat(inputLength);
        const estimate = aiCostOptimizerService.estimateCost(taskType, sampleText, preferredModel);
        return createSuccessResponse(ctx, estimate);
      }

      case 'select-model': {
        const taskType = searchParams.get('taskType');
        const inputLength = parseInt(searchParams.get('inputLength') || '1000', 10);
        const qualityTier = searchParams.get('quality') as 'premium' | 'standard' | 'economy' | undefined;
        const maxCost = searchParams.get('maxCost') ? parseFloat(searchParams.get('maxCost')!) : undefined;

        if (!taskType) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'taskType is required', 400);
        }

        const sampleText = 'x'.repeat(inputLength);
        const selection = aiCostOptimizerService.selectOptimalModel(taskType, sampleText, {
          tenantId,
          qualityOverride: qualityTier,
          maxCost });
        return createSuccessResponse(ctx, selection);
      }

      case 'realtime': {
        const periodHours = parseInt(searchParams.get('hours') || '1', 10);
        const summary = getCostSummary(periodHours * 3600_000);
        return createSuccessResponse(ctx, summary);
      }

      case 'history': {
        const days = parseInt(searchParams.get('days') || '30', 10);
        const periodMs = days * 24 * 3600_000;
        const history = await getHistoricalCostSummary(tenantId, periodMs);
        return createSuccessResponse(ctx, history);
      }

      case 'di-costs': {
        // Fetch Document Intelligence cost data from the worker health server
        const workerHealthPort = process.env.WORKER_HEALTH_PORT || '9090';
        const workerHealthHost = process.env.WORKER_HEALTH_HOST || 'localhost';
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const metricsRes = await fetch(
            `http://${workerHealthHost}:${workerHealthPort}/metrics/json`,
            { signal: controller.signal }
          );
          clearTimeout(timeout);
          if (!metricsRes.ok) {
            return createSuccessResponse(ctx, { available: false, reason: 'Worker health server returned non-OK status' });
          }
          const metrics = await metricsRes.json();
          return createSuccessResponse(ctx, {
            available: true,
            documentIntelligence: metrics.documentIntelligence || null,
            diCost: metrics.diCost || null,
          });
        } catch (fetchErr) {
          return createSuccessResponse(ctx, {
            available: false,
            reason: 'Worker health server unreachable',
            error: fetchErr instanceof Error ? fetchErr.message : 'Unknown error',
          });
        }
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: budget, report, estimate, select-model, realtime, history, di-costs', 400);
    }
  });

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const aiCostOptimizerService = await getAiCostOptimizerService();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'set-budget': {
        const { config } = body;
        if (!config || !config.dailyLimit || !config.monthlyLimit) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'config with dailyLimit and monthlyLimit is required', 400);
        }
        aiCostOptimizerService.setBudget(tenantId, {
          dailyLimit: config.dailyLimit,
          monthlyLimit: config.monthlyLimit,
          warningThreshold: config.warningThreshold || 0.8,
          fallbackModel: config.fallbackModel || 'gpt-3.5-turbo',
          priorityTasks: config.priorityTasks || [] });
        return createSuccessResponse(ctx, {
          budget: aiCostOptimizerService.getBudgetStatus(tenantId) });
      }

      case 'record-usage': {
        const tenantId = ctx.tenantId || 'system';
        const { model, taskType, inputTokens, outputTokens } = body;
        if (!model || !taskType || inputTokens === undefined || outputTokens === undefined) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'model, taskType, inputTokens, and outputTokens are required', 400);
        }
        aiCostOptimizerService.recordUsage({
          model,
          taskType,
          inputTokens,
          outputTokens,
          tenantId });
        return createSuccessResponse(ctx, {});
      }

      case 'optimize-batch': {
        const { requests } = body;
        if (!requests || !Array.isArray(requests)) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'requests array is required', 400);
        }
        const result = aiCostOptimizerService.optimizeBatch(requests);
        
        // Convert Map to object for JSON serialization
        const groupedByModel: Record<string, typeof requests> = {};
        result.groupedByModel.forEach((value, key) => {
          groupedByModel[key] = value;
        });

        return createSuccessResponse(ctx, {
          groupedByModel,
          estimatedTotalCost: result.estimatedTotalCost,
          estimatedSavings: result.estimatedSavings,
          savingsPercent: result.estimatedSavings / (result.estimatedTotalCost + result.estimatedSavings) * 100 });
      }

      case 'record-cache-hit': {
        const { taskType } = body;
        if (!taskType) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'taskType is required', 400);
        }
        aiCostOptimizerService.recordCacheHit(taskType);
        return createSuccessResponse(ctx, {});
      }

      case 'record-cache-miss': {
        const { taskType } = body;
        if (!taskType) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'taskType is required', 400);
        }
        aiCostOptimizerService.recordCacheMiss(taskType);
        return createSuccessResponse(ctx, {});
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: set-budget, record-usage, optimize-batch, record-cache-hit, record-cache-miss', 400);
    }
  });

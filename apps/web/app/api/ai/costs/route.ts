/**
 * AI Cost Optimization API
 * 
 * Manages AI costs and model selection:
 * - Get cost estimates
 * - View usage reports
 * - Set budgets
 * - Optimize batch requests
 */

import { NextRequest, NextResponse } from 'next/server';

// Dynamic import helper with proper typing
async function getAiCostOptimizerService() {
  const services = await import('@repo/data-orchestration/services');
  return (services as any).aiCostOptimizerService;
}

export async function GET(request: NextRequest) {
  try {
    const aiCostOptimizerService = await getAiCostOptimizerService();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'budget';
    const tenantId = searchParams.get('tenantId') || 'default';

    switch (action) {
      case 'budget': {
        const status = aiCostOptimizerService.getBudgetStatus(tenantId);
        return NextResponse.json(status);
      }

      case 'report': {
        const period = (searchParams.get('period') || 'month') as 'day' | 'week' | 'month';
        const report = aiCostOptimizerService.generateUsageReport(tenantId, period);
        return NextResponse.json(report);
      }

      case 'estimate': {
        const taskType = searchParams.get('taskType');
        const inputLength = parseInt(searchParams.get('inputLength') || '1000', 10);
        const preferredModel = searchParams.get('model') as any;
        
        if (!taskType) {
          return NextResponse.json(
            { error: 'taskType is required' },
            { status: 400 }
          );
        }

        // Generate sample text of specified length for estimation
        const sampleText = 'x'.repeat(inputLength);
        const estimate = aiCostOptimizerService.estimateCost(taskType, sampleText, preferredModel);
        return NextResponse.json(estimate);
      }

      case 'select-model': {
        const taskType = searchParams.get('taskType');
        const inputLength = parseInt(searchParams.get('inputLength') || '1000', 10);
        const qualityTier = searchParams.get('quality') as 'premium' | 'standard' | 'economy' | undefined;
        const maxCost = searchParams.get('maxCost') ? parseFloat(searchParams.get('maxCost')!) : undefined;

        if (!taskType) {
          return NextResponse.json(
            { error: 'taskType is required' },
            { status: 400 }
          );
        }

        const sampleText = 'x'.repeat(inputLength);
        const selection = aiCostOptimizerService.selectOptimalModel(taskType, sampleText, {
          tenantId,
          qualityOverride: qualityTier,
          maxCost,
        });
        return NextResponse.json(selection);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: budget, report, estimate, select-model' },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const aiCostOptimizerService = await getAiCostOptimizerService();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'set-budget': {
        const { tenantId = 'default', config } = body;
        if (!config || !config.dailyLimit || !config.monthlyLimit) {
          return NextResponse.json(
            { error: 'config with dailyLimit and monthlyLimit is required' },
            { status: 400 }
          );
        }
        aiCostOptimizerService.setBudget(tenantId, {
          dailyLimit: config.dailyLimit,
          monthlyLimit: config.monthlyLimit,
          warningThreshold: config.warningThreshold || 0.8,
          fallbackModel: config.fallbackModel || 'gpt-3.5-turbo',
          priorityTasks: config.priorityTasks || [],
        });
        return NextResponse.json({ 
          success: true,
          budget: aiCostOptimizerService.getBudgetStatus(tenantId),
        });
      }

      case 'record-usage': {
        const { tenantId = 'default', model, taskType, inputTokens, outputTokens } = body;
        if (!model || !taskType || inputTokens === undefined || outputTokens === undefined) {
          return NextResponse.json(
            { error: 'model, taskType, inputTokens, and outputTokens are required' },
            { status: 400 }
          );
        }
        aiCostOptimizerService.recordUsage({
          model,
          taskType,
          inputTokens,
          outputTokens,
          tenantId,
        });
        return NextResponse.json({ success: true });
      }

      case 'optimize-batch': {
        const { requests } = body;
        if (!requests || !Array.isArray(requests)) {
          return NextResponse.json(
            { error: 'requests array is required' },
            { status: 400 }
          );
        }
        const result = aiCostOptimizerService.optimizeBatch(requests);
        
        // Convert Map to object for JSON serialization
        const groupedByModel: Record<string, typeof requests> = {};
        result.groupedByModel.forEach((value, key) => {
          groupedByModel[key] = value;
        });

        return NextResponse.json({
          groupedByModel,
          estimatedTotalCost: result.estimatedTotalCost,
          estimatedSavings: result.estimatedSavings,
          savingsPercent: result.estimatedSavings / (result.estimatedTotalCost + result.estimatedSavings) * 100,
        });
      }

      case 'record-cache-hit': {
        const { taskType } = body;
        if (!taskType) {
          return NextResponse.json(
            { error: 'taskType is required' },
            { status: 400 }
          );
        }
        aiCostOptimizerService.recordCacheHit(taskType);
        return NextResponse.json({ success: true });
      }

      case 'record-cache-miss': {
        const { taskType } = body;
        if (!taskType) {
          return NextResponse.json(
            { error: 'taskType is required' },
            { status: 400 }
          );
        }
        aiCostOptimizerService.recordCacheMiss(taskType);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: set-budget, record-usage, optimize-batch, record-cache-hit, record-cache-miss' },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

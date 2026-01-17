import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/ai/models
 * Get registered models, performance, or recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const modelId = searchParams.get('modelId');
    const tenantId = searchParams.get('tenantId');
    const capability = searchParams.get('capability');
    const provider = searchParams.get('provider');
    const status = searchParams.get('status');

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const modelRegistry = (services as any).aiModelRegistryService;

    if (!modelRegistry) {
      return NextResponse.json(
        { error: 'AI Model Registry service not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'list':
        result = await modelRegistry.listModels({
          provider,
          status,
          capability,
        });
        break;

      case 'detail':
        if (!modelId) {
          return NextResponse.json(
            { error: 'modelId is required' },
            { status: 400 }
          );
        }
        result = await modelRegistry.getModel(modelId);
        break;

      case 'versions':
        if (!modelId) {
          return NextResponse.json(
            { error: 'modelId is required' },
            { status: 400 }
          );
        }
        result = await modelRegistry.getModelVersions(modelId);
        break;

      case 'performance':
        if (!modelId) {
          return NextResponse.json(
            { error: 'modelId is required' },
            { status: 400 }
          );
        }
        result = await modelRegistry.getModelPerformance(modelId);
        break;

      case 'compare':
        const model1 = searchParams.get('model1');
        const model2 = searchParams.get('model2');
        
        if (!model1 || !model2) {
          return NextResponse.json(
            { error: 'model1 and model2 are required for comparison' },
            { status: 400 }
          );
        }
        result = await modelRegistry.compareModels(model1, model2);
        break;

      case 'recommend':
        if (!capability) {
          return NextResponse.json(
            { error: 'capability is required for recommendations' },
            { status: 400 }
          );
        }
        const constraints = {
          maxLatencyMs: searchParams.get('maxLatency') 
            ? parseInt(searchParams.get('maxLatency')!) 
            : undefined,
          maxCostPer1kTokens: searchParams.get('maxCost')
            ? parseFloat(searchParams.get('maxCost')!)
            : undefined,
          minAccuracy: searchParams.get('minAccuracy')
            ? parseFloat(searchParams.get('minAccuracy')!)
            : undefined,
        };
        result = await modelRegistry.recommendModel(capability, constraints);
        break;

      case 'usage':
        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId is required for usage stats' },
            { status: 400 }
          );
        }
        result = await modelRegistry.getUsageStats(tenantId, modelId);
        break;

      case 'quotas':
        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId is required for quota info' },
            { status: 400 }
          );
        }
        result = await modelRegistry.getQuotas(tenantId);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to query model registry', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/models
 * Register models, record performance, or manage versions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'register', ...data } = body;

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const modelRegistry = (services as any).aiModelRegistryService;

    if (!modelRegistry) {
      return NextResponse.json(
        { error: 'AI Model Registry service not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'register':
        const { model } = data;

        if (!model || !model.name || !model.provider) {
          return NextResponse.json(
            { error: 'Complete model object with name and provider is required' },
            { status: 400 }
          );
        }

        result = await modelRegistry.registerModel(model);
        break;

      case 'add-version':
        const { modelId, version } = data;

        if (!modelId || !version) {
          return NextResponse.json(
            { error: 'modelId and version are required' },
            { status: 400 }
          );
        }

        result = await modelRegistry.addModelVersion(modelId, version);
        break;

      case 'record-performance':
        const { 
          modelId: perfModelId, 
          versionId, 
          metrics 
        } = data;

        if (!perfModelId || !metrics) {
          return NextResponse.json(
            { error: 'modelId and metrics are required' },
            { status: 400 }
          );
        }

        result = await modelRegistry.recordPerformance(
          perfModelId,
          versionId,
          metrics
        );
        break;

      case 'ab-test':
        const { 
          experimentName, 
          modelA, 
          modelB, 
          trafficSplit = 0.5 
        } = data;

        if (!experimentName || !modelA || !modelB) {
          return NextResponse.json(
            { error: 'experimentName, modelA, and modelB are required' },
            { status: 400 }
          );
        }

        result = await modelRegistry.createABTest(
          experimentName,
          modelA,
          modelB,
          trafficSplit
        );
        break;

      case 'set-quota':
        const { 
          tenantId, 
          modelId: quotaModelId, 
          dailyLimit, 
          monthlyLimit 
        } = data;

        if (!tenantId || !quotaModelId) {
          return NextResponse.json(
            { error: 'tenantId and modelId are required' },
            { status: 400 }
          );
        }

        result = await modelRegistry.setQuota(
          tenantId,
          quotaModelId,
          { dailyLimit, monthlyLimit }
        );
        break;

      case 'record-usage':
        const { 
          tenantId: usageTenantId, 
          modelId: usageModelId, 
          tokens, 
          cost 
        } = data;

        if (!usageTenantId || !usageModelId || !tokens) {
          return NextResponse.json(
            { error: 'tenantId, modelId, and tokens are required' },
            { status: 400 }
          );
        }

        result = await modelRegistry.recordUsage(
          usageTenantId,
          usageModelId,
          tokens,
          cost
        );
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to update model registry', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ai/models
 * Update model status or configuration
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, action = 'update', ...data } = body;

    if (!modelId) {
      return NextResponse.json(
        { error: 'modelId is required' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const modelRegistry = (services as any).aiModelRegistryService;

    if (!modelRegistry) {
      return NextResponse.json(
        { error: 'AI Model Registry service not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'update':
        result = await modelRegistry.updateModel(modelId, data.updates);
        break;

      case 'activate':
        result = await modelRegistry.activateModel(modelId);
        break;

      case 'deprecate':
        const { reason, replacementId } = data;
        result = await modelRegistry.deprecateModel(modelId, reason, replacementId);
        break;

      case 'rollback':
        const { toVersion } = data;
        if (!toVersion) {
          return NextResponse.json(
            { error: 'toVersion is required for rollback' },
            { status: 400 }
          );
        }
        result = await modelRegistry.rollbackToVersion(modelId, toVersion);
        break;

      case 'set-default':
        const { capability } = data;
        if (!capability) {
          return NextResponse.json(
            { error: 'capability is required' },
            { status: 400 }
          );
        }
        result = await modelRegistry.setDefaultForCapability(modelId, capability);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to update model', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/models
 * Remove a model from registry
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const versionId = searchParams.get('versionId');

    if (!modelId) {
      return NextResponse.json(
        { error: 'modelId is required' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const modelRegistry = (services as any).aiModelRegistryService;

    if (!modelRegistry) {
      return NextResponse.json(
        { error: 'AI Model Registry service not available' },
        { status: 503 }
      );
    }

    if (versionId) {
      await modelRegistry.removeVersion(modelId, versionId);
      return NextResponse.json({
        success: true,
        message: `Version ${versionId} of model ${modelId} removed`,
      });
    }

    await modelRegistry.removeModel(modelId);
    return NextResponse.json({
      success: true,
      message: `Model ${modelId} removed from registry`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to remove model', details: String(error) },
      { status: 500 }
    );
  }
}

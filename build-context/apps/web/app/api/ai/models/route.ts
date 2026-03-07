import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/ai/models
 * Get registered models, performance, or recommendations
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const modelId = searchParams.get('modelId');
    const capability = searchParams.get('capability');
    const provider = searchParams.get('provider');
    const status = searchParams.get('status');

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const modelRegistry = (services as any).aiModelRegistryService;

    if (!modelRegistry) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI Model Registry service not available', 503);
    }

    let result;

    switch (action) {
      case 'list':
        result = await modelRegistry.listModels({
          provider,
          status,
          capability });
        break;

      case 'detail':
        if (!modelId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'modelId is required', 400);
        }
        result = await modelRegistry.getModel(modelId);
        break;

      case 'versions':
        if (!modelId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'modelId is required', 400);
        }
        result = await modelRegistry.getModelVersions(modelId);
        break;

      case 'performance':
        if (!modelId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'modelId is required', 400);
        }
        result = await modelRegistry.getModelPerformance(modelId);
        break;

      case 'compare':
        const model1 = searchParams.get('model1');
        const model2 = searchParams.get('model2');
        
        if (!model1 || !model2) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'model1 and model2 are required for comparison', 400);
        }
        result = await modelRegistry.compareModels(model1, model2);
        break;

      case 'recommend':
        if (!capability) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'capability is required for recommendations', 400);
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
            : undefined };
        result = await modelRegistry.recommendModel(capability, constraints);
        break;

      case 'usage':
        if (!tenantId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required for usage stats', 400);
        }
        result = await modelRegistry.getUsageStats(tenantId, modelId);
        break;

      case 'quotas':
        if (!tenantId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required for quota info', 400);
        }
        result = await modelRegistry.getQuotas(tenantId);
        break;

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }

    return createSuccessResponse(ctx, {
      action,
      data: result });
  });

/**
 * POST /api/ai/models
 * Register models, record performance, or manage versions
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    // Model registry modifications should be admin-only
    if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden - Admin access required', 403);
    }

    const body = await request.json();
    const { action = 'register', ...data } = body;

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const modelRegistry = (services as any).aiModelRegistryService;

    if (!modelRegistry) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI Model Registry service not available', 503);
    }

    let result;

    switch (action) {
      case 'register':
        const { model } = data;

        if (!model || !model.name || !model.provider) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Complete model object with name and provider is required', 400);
        }

        result = await modelRegistry.registerModel(model);
        break;

      case 'add-version':
        const { modelId, version } = data;

        if (!modelId || !version) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'modelId and version are required', 400);
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
          return createErrorResponse(ctx, 'BAD_REQUEST', 'modelId and metrics are required', 400);
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
          return createErrorResponse(ctx, 'BAD_REQUEST', 'experimentName, modelA, and modelB are required', 400);
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
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId and modelId are required', 400);
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
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId, modelId, and tokens are required', 400);
        }

        result = await modelRegistry.recordUsage(
          usageTenantId,
          usageModelId,
          tokens,
          cost
        );
        break;

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }

    return createSuccessResponse(ctx, {
      action,
      data: result });
  });

/**
 * PATCH /api/ai/models
 * Update model status or configuration
 */
export const PATCH = withAuthApiHandler(async (request, ctx) => {
    if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden - Admin access required', 403);
    }

    const body = await request.json();
    const { modelId, action = 'update', ...data } = body;

    if (!modelId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'modelId is required', 400);
    }

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const modelRegistry = (services as any).aiModelRegistryService;

    if (!modelRegistry) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI Model Registry service not available', 503);
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
          return createErrorResponse(ctx, 'BAD_REQUEST', 'toVersion is required for rollback', 400);
        }
        result = await modelRegistry.rollbackToVersion(modelId, toVersion);
        break;

      case 'set-default':
        const { capability } = data;
        if (!capability) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'capability is required', 400);
        }
        result = await modelRegistry.setDefaultForCapability(modelId, capability);
        break;

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }

    return createSuccessResponse(ctx, {
      action,
      data: result });
  });

/**
 * DELETE /api/ai/models
 * Remove a model from registry
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
    if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden - Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const versionId = searchParams.get('versionId');

    if (!modelId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'modelId is required', 400);
    }

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const modelRegistry = (services as any).aiModelRegistryService;

    if (!modelRegistry) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI Model Registry service not available', 503);
    }

    if (versionId) {
      await modelRegistry.removeVersion(modelId, versionId);
      return createSuccessResponse(ctx, {
        message: `Version ${versionId} of model ${modelId} removed` });
    }

    await modelRegistry.removeModel(modelId);
    return createSuccessResponse(ctx, {
      message: `Model ${modelId} removed from registry` });
  });

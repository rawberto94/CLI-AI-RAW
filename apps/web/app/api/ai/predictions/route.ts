import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { z } from 'zod';

const predictionsGetSchema = z.object({
  action: z.enum(['contract', 'portfolio', 'renewal-probability', 'risk-forecast', 'cost-projection', 'value-optimization', 'at-risk', 'high-value']).default('contract'),
  contractId: z.string().optional(),
  type: z.enum(['renewal', 'risk', 'cost', 'value']).optional(),
  horizon: z.enum(['short', 'medium', 'long']).default('medium'),
});

const predictionsPostSchema = z.object({
  action: z.enum(['generate', 'bulk-generate', 'update-features', 'record-outcome', 'calibrate', 'scenario']).default('generate'),
  contractId: z.string().optional(),
  contractFeatures: z.record(z.unknown()).optional(),
  horizon: z.enum(['short', 'medium', 'long']).default('medium'),
  contracts: z.array(z.object({
    contractId: z.string(),
    features: z.record(z.unknown()),
    horizon: z.string().optional(),
  })).optional(),
  predictionId: z.string().optional(),
  actualOutcome: z.unknown().optional(),
  outcomeDate: z.string().optional(),
  tenantId: z.string().optional(),
  scenarioName: z.string().optional(),
  modifications: z.record(z.unknown()).optional(),
});

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET /api/ai/predictions
 * Get predictions for contracts or portfolio
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const parsed = predictionsGetSchema.safeParse({
      action: searchParams.get('action') || undefined,
      contractId: searchParams.get('contractId') || undefined,
      type: searchParams.get('type') || undefined,
      horizon: searchParams.get('horizon') || undefined,
    });
    if (!parsed.success) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid parameters: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400);
    }
    const { action, contractId, type: predictionType, horizon } = parsed.data;

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const predictionEngine = (services as any).predictiveAnalyticsEngine;

    if (!predictionEngine) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Predictive Analytics Engine not available', 503);
    }

    let result;

    switch (action) {
      case 'contract':
        if (!contractId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
        }
        
        if (predictionType) {
          result = await predictionEngine.getPrediction(contractId, predictionType, horizon);
        } else {
          // Get all prediction types
          result = await predictionEngine.getAllPredictions(contractId, horizon);
        }
        break;

      case 'portfolio':
        result = await predictionEngine.getPortfolioPredictions(tenantId, horizon);
        break;

      case 'renewal-probability':
        if (!contractId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
        }
        result = await predictionEngine.predictRenewalProbability(contractId);
        break;

      case 'risk-forecast':
        if (!contractId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
        }
        result = await predictionEngine.forecastRiskTrend(contractId, horizon);
        break;

      case 'cost-projection':
        if (!contractId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
        }
        result = await predictionEngine.projectCosts(contractId, horizon);
        break;

      case 'value-optimization':
        if (!contractId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
        }
        result = await predictionEngine.optimizeValue(contractId);
        break;

      case 'at-risk':
        result = await predictionEngine.getAtRiskContracts(tenantId);
        break;

      case 'high-value':
        result = await predictionEngine.getHighValueOpportunities(tenantId);
        break;

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }

    return createSuccessResponse(ctx, {
      action,
      data: result });
  });

/**
 * POST /api/ai/predictions
 * Generate or update predictions
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const parsed = predictionsPostSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid body: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400);
    }
    const { action, ...data } = parsed.data;

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const predictionEngine = (services as any).predictiveAnalyticsEngine;

    if (!predictionEngine) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Predictive Analytics Engine not available', 503);
    }

    let result;

    switch (action) {
      case 'generate':
        const { contractId, contractFeatures, horizon = 'medium' } = data;

        if (!contractId || !contractFeatures) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId and contractFeatures are required', 400);
        }

        result = await predictionEngine.generatePredictions(
          contractId,
          contractFeatures,
          horizon
        );
        break;

      case 'bulk-generate':
        const { contracts } = data;

        if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contracts array is required with at least one contract', 400);
        }

        const results = [];
        for (const contract of contracts) {
          try {
            const predictions = await predictionEngine.generatePredictions(
              contract.contractId,
              contract.features,
              contract.horizon || 'medium'
            );
            results.push({ 
              contractId: contract.contractId, 
              success: true, 
              predictions 
            });
          } catch (err) {
            results.push({ 
              contractId: contract.contractId, 
              success: false, 
              error: String(err) 
            });
          }
        }
        result = results;
        break;

      case 'update-features':
        const { contractId: updateContractId, features } = data;

        if (!updateContractId || !features) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId and features are required', 400);
        }

        result = await predictionEngine.updateContractFeatures(
          updateContractId,
          features
        );
        break;

      case 'record-outcome':
        const { 
          predictionId, 
          actualOutcome, 
          outcomeDate 
        } = data;

        if (!predictionId || actualOutcome === undefined) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'predictionId and actualOutcome are required', 400);
        }

        result = await predictionEngine.recordActualOutcome(
          predictionId,
          actualOutcome,
          outcomeDate ? new Date(outcomeDate) : new Date()
        );
        break;

      case 'calibrate':
        const { tenantId } = data;

        if (!tenantId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required for calibration', 400);
        }

        result = await predictionEngine.calibrateModels(tenantId);
        break;

      case 'scenario':
        const { 
          contractId: scenarioContractId, 
          scenarioName,
          modifications 
        } = data;

        if (!scenarioContractId || !scenarioName || !modifications) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId, scenarioName, and modifications are required', 400);
        }

        result = await predictionEngine.runScenario(
          scenarioContractId,
          scenarioName,
          modifications
        );
        break;

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }

    return createSuccessResponse(ctx, {
      action,
      data: result });
  });

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET /api/ai/predictions
 * Get predictions for contracts or portfolio
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'contract';
    const contractId = searchParams.get('contractId');
    const predictionType = searchParams.get('type'); // renewal, risk, cost, value
    const horizon = searchParams.get('horizon') || 'medium'; // short, medium, long

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const predictionEngine = (services as any).predictiveAnalyticsEngine;

    if (!predictionEngine) {
      return NextResponse.json(
        { error: 'Predictive Analytics Engine not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'contract':
        if (!contractId) {
          return NextResponse.json(
            { error: 'contractId is required' },
            { status: 400 }
          );
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
          return NextResponse.json(
            { error: 'contractId is required' },
            { status: 400 }
          );
        }
        result = await predictionEngine.predictRenewalProbability(contractId);
        break;

      case 'risk-forecast':
        if (!contractId) {
          return NextResponse.json(
            { error: 'contractId is required' },
            { status: 400 }
          );
        }
        result = await predictionEngine.forecastRiskTrend(contractId, horizon);
        break;

      case 'cost-projection':
        if (!contractId) {
          return NextResponse.json(
            { error: 'contractId is required' },
            { status: 400 }
          );
        }
        result = await predictionEngine.projectCosts(contractId, horizon);
        break;

      case 'value-optimization':
        if (!contractId) {
          return NextResponse.json(
            { error: 'contractId is required' },
            { status: 400 }
          );
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
      { error: 'Failed to generate predictions', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/predictions
 * Generate or update predictions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action = 'generate', ...data } = body;

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const predictionEngine = (services as any).predictiveAnalyticsEngine;

    if (!predictionEngine) {
      return NextResponse.json(
        { error: 'Predictive Analytics Engine not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'generate':
        const { contractId, contractFeatures, horizon = 'medium' } = data;

        if (!contractId || !contractFeatures) {
          return NextResponse.json(
            { error: 'contractId and contractFeatures are required' },
            { status: 400 }
          );
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
          return NextResponse.json(
            { error: 'contracts array is required with at least one contract' },
            { status: 400 }
          );
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
          return NextResponse.json(
            { error: 'contractId and features are required' },
            { status: 400 }
          );
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
          return NextResponse.json(
            { error: 'predictionId and actualOutcome are required' },
            { status: 400 }
          );
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
          return NextResponse.json(
            { error: 'tenantId is required for calibration' },
            { status: 400 }
          );
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
          return NextResponse.json(
            { error: 'contractId, scenarioName, and modifications are required' },
            { status: 400 }
          );
        }

        result = await predictionEngine.runScenario(
          scenarioContractId,
          scenarioName,
          modifications
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
      { error: 'Failed to generate predictions', details: String(error) },
      { status: 500 }
    );
  }
}

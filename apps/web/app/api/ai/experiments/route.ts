/**
 * A/B Testing Experiment Management API
 * 
 * Manage AI experiments for optimizing extraction quality:
 * - Create/start/stop experiments
 * - Track metrics by variant
 * - Analyze results and determine winners
 * 
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';

type MetricType = 
  | 'quality_score'
  | 'confidence'
  | 'latency_ms'
  | 'cost'
  | 'tokens_used'
  | 'user_corrections'
  | 'field_accuracy'
  | 'extraction_completeness';

/**
 * GET - List experiments or get specific experiment
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const services = await import('@repo/data-orchestration/services');
    const abTestingService = services.abTestingService;
    const PRESET_EXPERIMENTS = services.PRESET_EXPERIMENTS;

    const { searchParams } = new URL(request.url);
    const experimentId = searchParams.get('id');
    const status = searchParams.get('status') as 'draft' | 'running' | 'paused' | 'completed' | null;
    const action = searchParams.get('action');

    // Get specific experiment
    if (experimentId) {
      const experiment = abTestingService.getExperiment(experimentId);
      if (!experiment) {
        return NextResponse.json(
          { error: 'Experiment not found' },
          { status: 404 }
        );
      }

      // Analyze experiment if requested
      if (action === 'analyze') {
        const results = await abTestingService.analyzeExperiment(experimentId);
        return NextResponse.json({
          experiment,
          results,
        });
      }

      return NextResponse.json({ experiment });
    }

    // List presets
    if (action === 'presets') {
      const presets = PRESET_EXPERIMENTS as Record<string, {
        name: string;
        description: string;
        primaryMetric: MetricType;
        treatmentVariants: Array<unknown>;
      }>;
      return NextResponse.json({
        presets: Object.entries(presets).map(([key, value]) => ({
          key,
          name: value.name,
          description: value.description,
          primaryMetric: value.primaryMetric,
          variantCount: 1 + value.treatmentVariants.length,
        })),
      });
    }

    // List experiments
    const experiments = abTestingService.listExperiments(status || undefined);
    return NextResponse.json({
      experiments: experiments.map((e: {
        id: string;
        name: string;
        status: string;
        startDate?: Date;
        endDate?: Date;
        targetPercentage: number;
        primaryMetric: MetricType;
        treatmentVariants: unknown[];
      }) => ({
        id: e.id,
        name: e.name,
        status: e.status,
        startDate: e.startDate,
        endDate: e.endDate,
        targetPercentage: e.targetPercentage,
        primaryMetric: e.primaryMetric,
        variantCount: 1 + e.treatmentVariants.length,
      })),
      total: experiments.length,
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch experiments' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new experiment or perform actions
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const services = await import('@repo/data-orchestration/services');
    const abTestingService = services.abTestingService;
    const PRESET_EXPERIMENTS = services.PRESET_EXPERIMENTS as Record<string, unknown>;

    const body = await request.json();
    const { action, experimentId, preset, ...experimentData } = body;

    // Handle experiment actions
    if (action && experimentId) {
      switch (action) {
        case 'start': {
          const started = await abTestingService.startExperiment(experimentId);
          if (!started) {
            return NextResponse.json(
              { error: 'Failed to start experiment' },
              { status: 400 }
            );
          }
          return NextResponse.json({
            message: 'Experiment started',
            experiment: abTestingService.getExperiment(experimentId),
          });
        }

        case 'pause': {
          const paused = await abTestingService.pauseExperiment(experimentId);
          if (!paused) {
            return NextResponse.json(
              { error: 'Failed to pause experiment' },
              { status: 400 }
            );
          }
          return NextResponse.json({
            message: 'Experiment paused',
            experiment: abTestingService.getExperiment(experimentId),
          });
        }

        case 'complete': {
          const results = await abTestingService.completeExperiment(experimentId);
          if (!results) {
            return NextResponse.json(
              { error: 'Failed to complete experiment' },
              { status: 400 }
            );
          }
          return NextResponse.json({
            message: 'Experiment completed',
            results,
          });
        }

        case 'record-event':
          await abTestingService.recordEvent({
            experimentId,
            variantId: body.variantId,
            contractId: body.contractId,
            artifactType: body.artifactType,
            tenantId: body.tenantId,
            metrics: body.metrics,
            metadata: body.metadata,
          });
          return NextResponse.json({
            message: 'Event recorded',
          });

        default:
          return NextResponse.json(
            { error: 'Unknown action' },
            { status: 400 }
          );
      }
    }

    // Create from preset
    if (preset && PRESET_EXPERIMENTS[preset]) {
      // Cast to any to avoid complex type assertions for preset configs
      const presetConfig = PRESET_EXPERIMENTS[preset] as unknown;
      const experiment = await abTestingService.createExperiment({
        ...(presetConfig as object),
        status: 'draft',
        targetPercentage: experimentData.targetPercentage || 10,
        targetTenants: experimentData.targetTenants,
        excludeTenants: experimentData.excludeTenants,
        targetArtifactTypes: experimentData.targetArtifactTypes,
        createdBy: 'system',
      } as Parameters<typeof abTestingService.createExperiment>[0]);
      return NextResponse.json({
        message: 'Experiment created from preset',
        experiment,
      });
    }

    // Create custom experiment
    if (!experimentData.name || !experimentData.controlVariant) {
      return NextResponse.json(
        { error: 'name and controlVariant are required' },
        { status: 400 }
      );
    }

    const experiment = await abTestingService.createExperiment({
      name: experimentData.name,
      description: experimentData.description || '',
      status: 'draft',
      controlVariant: experimentData.controlVariant,
      treatmentVariants: experimentData.treatmentVariants || [],
      targetPercentage: experimentData.targetPercentage || 10,
      targetTenants: experimentData.targetTenants,
      excludeTenants: experimentData.excludeTenants,
      targetArtifactTypes: experimentData.targetArtifactTypes,
      primaryMetric: experimentData.primaryMetric || 'quality_score' as MetricType,
      secondaryMetrics: experimentData.secondaryMetrics || [],
      createdBy: 'system',
    });

    return NextResponse.json({
      message: 'Experiment created',
      experiment,
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

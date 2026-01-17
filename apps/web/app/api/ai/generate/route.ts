/**
 * Next-Gen AI Artifact Generation API
 * 
 * Advanced artifact generation with:
 * - Contract-type intelligent classification
 * - Semantic chunking for long documents
 * - Structured output with JSON schemas
 * - Multi-model orchestration
 * - Cross-artifact validation
 * 
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';

interface GenerationRequest {
  contractId: string;
  contractText: string;
  artifactType: string | string[];
  tenantId: string;
  options?: {
    model?: string;
    useStructuredOutput?: boolean;
    validateConsistency?: boolean;
  };
}

interface GenerationResultType {
  success: boolean;
  artifact: unknown | null;
  metadata: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    cost: number;
    qualityScore: number;
    confidence: number;
    contractClassification?: unknown;
    chunksProcessed?: number;
  };
  validationIssues?: string[];
  suggestions?: string[];
}

interface BatchResultType {
  artifacts: Record<string, GenerationResultType>;
  consistencyResult: unknown;
  totalLatencyMs: number;
  totalCost: number;
  successRate: number;
}

/**
 * POST - Generate artifact using next-gen AI
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const services = await import('@repo/data-orchestration/services');
    const nextGenArtifactGenerator = services.nextGenArtifactGenerator;

    const body = await request.json() as GenerationRequest;

    // Validate required fields
    if (!body.contractId) {
      return NextResponse.json(
        { error: 'contractId is required' },
        { status: 400 }
      );
    }

    if (!body.contractText) {
      return NextResponse.json(
        { error: 'contractText is required' },
        { status: 400 }
      );
    }

    if (!body.artifactType) {
      return NextResponse.json(
        { error: 'artifactType is required' },
        { status: 400 }
      );
    }

    const tenantId = body.tenantId || 'default';

    // Handle batch generation
    if (Array.isArray(body.artifactType)) {
      const results = await nextGenArtifactGenerator.generateBatch(
        body.contractId,
        body.contractText,
        body.artifactType,
        tenantId
      ) as BatchResultType;

      return NextResponse.json({
        success: results.successRate === 1,
        batchResults: Object.entries(results.artifacts).map(([type, r]) => ({
          artifactType: type,
          success: r.success,
          artifact: r.artifact,
          error: r.validationIssues?.join(', '),
          metadata: {
            model: r.metadata.model,
            latencyMs: r.metadata.latencyMs,
            qualityScore: r.metadata.qualityScore,
            confidence: r.metadata.confidence,
          },
        })),
        consistencyResult: results.consistencyResult,
        totalCost: results.totalCost,
        totalLatencyMs: results.totalLatencyMs,
        successRate: results.successRate,
        generatedAt: new Date().toISOString(),
      });
    }

    // Single artifact generation
    const result = await nextGenArtifactGenerator.generateArtifact(
      body.contractId,
      body.contractText,
      body.artifactType,
      tenantId
    ) as GenerationResultType;

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.validationIssues?.join(', ') || 'Generation failed',
          validationIssues: result.validationIssues,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      artifact: result.artifact,
      metadata: {
        model: result.metadata.model,
        tokens: result.metadata.totalTokens,
        latencyMs: result.metadata.latencyMs,
        cost: result.metadata.cost,
        qualityScore: result.metadata.qualityScore,
        confidence: result.metadata.confidence,
        contractType: result.metadata.contractClassification,
        chunksProcessed: result.metadata.chunksProcessed,
      },
      validationIssues: result.validationIssues,
      suggestions: result.suggestions,
      generatedAt: new Date().toISOString(),
    });

  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get generation capabilities and stats
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    version: '2.0.0',
    capabilities: {
      contractClassification: true,
      semanticChunking: true,
      structuredOutput: true,
      multiModelOrchestration: true,
      crossArtifactValidation: true,
      aiLearning: true,
    },
    supportedArtifacts: [
      'overview',
      'financial',
      'parties',
      'terms',
      'risk',
      'compliance',
      'obligations',
      'metadata',
    ],
    supportedContractTypes: [
      'SERVICE_AGREEMENT',
      'PROCUREMENT',
      'EMPLOYMENT',
      'LICENSING',
      'REAL_ESTATE',
      'FINANCIAL',
      'PARTNERSHIP',
      'REGULATORY',
      'UNKNOWN',
    ],
    models: {
      complex: 'gpt-4o',
      standard: 'gpt-4o-mini',
      fallback: 'gpt-3.5-turbo',
    },
    features: {
      batchGeneration: 'Generate multiple artifacts in one request',
      consistencyValidation: 'Cross-validate data across artifacts',
      promptLearning: 'Improve from user corrections',
    },
    usage: {
      singleArtifact: {
        method: 'POST',
        body: {
          contractId: 'string (required)',
          contractText: 'string (required)',
          artifactType: 'string (required)',
          tenantId: 'string (optional)',
          options: {
            model: 'string (optional)',
            useStructuredOutput: 'boolean (default: true)',
            validateConsistency: 'boolean (default: true)',
            existingArtifacts: 'object (for consistency validation)',
          },
        },
      },
      batchArtifacts: {
        method: 'POST',
        body: {
          contractId: 'string (required)',
          contractText: 'string (required)',
          artifactType: 'string[] (array of types)',
          tenantId: 'string (optional)',
        },
      },
    },
  });
}

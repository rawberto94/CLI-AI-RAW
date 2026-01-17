/**
 * AI Explainability API
 * 
 * Get explanations for AI extraction decisions:
 * - Source evidence for extracted values
 * - Reasoning behind decisions
 * - Confidence breakdowns
 * - Alternative interpretations
 * 
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';

interface ExplainabilityRequest {
  contractText: string;
  artifactType: string;
  extractedData: Record<string, unknown>;
  maxExplanationsPerField?: number;
  includeAlternatives?: boolean;
  includeSourceHighlighting?: boolean;
}

/**
 * POST - Generate explanation for extraction
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const services = await import('@repo/data-orchestration/services');
    const aiExplainabilityService = services.aiExplainabilityService;

    const body = await request.json();
    const { 
      contractText, 
      contractId,
      artifactType, 
      extractedData,
      fieldName,
      format = 'json',
    } = body;

    // Validate required fields
    if (!contractText) {
      return NextResponse.json(
        { error: 'contractText is required' },
        { status: 400 }
      );
    }

    // Single field explanation
    if (fieldName && extractedData?.[fieldName] !== undefined) {
      const explanation = await aiExplainabilityService.explainField(
        contractText,
        fieldName,
        extractedData[fieldName]
      );

      return NextResponse.json({
        fieldName,
        explanation,
      });
    }

    // Full artifact explanation
    if (!extractedData || typeof extractedData !== 'object') {
      return NextResponse.json(
        { error: 'extractedData object is required for full explanation' },
        { status: 400 }
      );
    }

    const requestData: ExplainabilityRequest = {
      contractText,
      artifactType: artifactType || 'unknown',
      extractedData,
      maxExplanationsPerField: body.maxExplanationsPerField || 3,
      includeAlternatives: body.includeAlternatives !== false,
      includeSourceHighlighting: body.includeSourceHighlighting !== false,
    };

    const result = await aiExplainabilityService.explainExtraction(requestData);
    
    // Set contract ID if provided
    if (contractId) {
      (result as { contractId: string }).contractId = contractId;
    }

    // Return as markdown report if requested
    if (format === 'markdown') {
      const report = aiExplainabilityService.generateAuditReport(result);
      return new NextResponse(report, {
        headers: {
          'Content-Type': 'text/markdown',
        },
      });
    }

    return NextResponse.json({
      explanation: result,
      summary: {
        totalFields: Object.keys(result.fieldExplanations).length,
        averageConfidence: result.totalConfidence,
        fieldsWithWarnings: Object.values(result.fieldExplanations)
          .filter((e: { warnings?: unknown[] }) => e.warnings?.length).length,
        modelUsed: result.modelUsed,
      },
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to generate explanation' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get explanation capabilities and documentation
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    capabilities: {
      singleFieldExplanation: true,
      fullArtifactExplanation: true,
      sourceEvidence: true,
      alternativeInterpretations: true,
      confidenceBreakdown: true,
      auditReportGeneration: true,
    },
    supportedFormats: ['json', 'markdown'],
    warningTypes: [
      'ambiguous',
      'conflicting',
      'missing_source',
      'low_confidence',
      'format_uncertainty',
    ],
    matchTypes: [
      'exact',
      'semantic',
      'inferred',
    ],
    usage: {
      singleField: {
        method: 'POST',
        body: {
          contractText: 'string (required)',
          fieldName: 'string (required for single field)',
          extractedData: '{ [fieldName]: value }',
        },
      },
      fullExplanation: {
        method: 'POST',
        body: {
          contractText: 'string (required)',
          artifactType: 'string (e.g., "overview", "financial")',
          extractedData: 'object with all extracted fields',
          maxExplanationsPerField: 'number (default: 3)',
          includeAlternatives: 'boolean (default: true)',
          format: '"json" | "markdown" (default: json)',
        },
      },
    },
  });
}

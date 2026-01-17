/**
 * Artifact Validation API Route
 * 
 * Validates contract artifacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { artifactValidationService } from 'data-orchestration/services';

// Type for the validation service (mirrors artifact-validation.service.ts)
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues?: { field: string; message: string; severity: string; type?: string; suggestedFix?: string }[];
  criticalIssues?: number;
  canAutoFix?: boolean;
}

/**
 * POST /api/contracts/[id]/artifacts/validate
 * Validate all artifacts or specific artifact type
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const contractId = params.id;
    const body = await request.json();
    const { artifactType, artifactData, validateAll } = body;

    if (!artifactData && !validateAll) {
      return NextResponse.json(
        { error: 'Either artifactData or validateAll must be provided' },
        { status: 400 }
      );
    }

    if (artifactType && artifactData) {
      // Validate specific artifact
      const validation = await (artifactValidationService as any).validateArtifact(
        artifactType,
        artifactData
      ) as ValidationResult;

      // Try auto-fix if there are issues
      let autoFixResult = null;
      if (!validation.valid && validation.canAutoFix) {
        autoFixResult = await (artifactValidationService as any).autoFix(
          artifactData,
          validation.issues ?? []
        );
      }

      return NextResponse.json({
        success: true,
        contractId,
        artifactType,
        validation,
        autoFix: autoFixResult,
        message: validation.valid 
          ? 'Artifact is valid' 
          : `Found ${validation.criticalIssues} critical issues and ${validation.warnings} warnings`
      });
    }

    // Validate all artifacts (would fetch from database in production)
    return NextResponse.json({
      success: true,
      contractId,
      message: 'All artifacts validation would be performed here',
      validationResults: {}
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

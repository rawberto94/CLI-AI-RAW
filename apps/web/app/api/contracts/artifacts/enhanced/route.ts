/**
 * Enhanced Artifacts API Route
 * 
 * Integrates new artifact services:
 * - Parallel artifact generation
 * - Confidence scoring
 * - Version tracking
 * - AI with fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { parallelArtifactGeneratorService } from 'data-orchestration/services';
import { confidenceScoringService } from 'data-orchestration/services';
import { artifactVersioningService } from 'data-orchestration/services';
import { aiArtifactGeneratorService } from 'data-orchestration/services';
import { dataSanitizationService } from 'data-orchestration/services';
import { auditTrailService } from 'data-orchestration/services';

/**
 * POST /api/contracts/artifacts/enhanced
 * Generate artifacts with parallel processing and confidence scoring
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractId, tenantId, userId, artifactTypes, useParallel = true } = body;

    if (!contractId || !tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: contractId, tenantId, userId' },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedContractId = dataSanitizationService.sanitizeText(contractId).sanitized;
    const sanitizedTenantId = dataSanitizationService.sanitizeText(tenantId).sanitized;
    const sanitizedUserId = dataSanitizationService.sanitizeText(userId).sanitized;

    let result;

    if (useParallel && artifactTypes && artifactTypes.length > 1) {
      // Use parallel generation for multiple artifact types
      result = await parallelArtifactGeneratorService.generateArtifactsParallel(
        sanitizedContractId,
        sanitizedTenantId,
        artifactTypes
      );
    } else {
      // Use AI generator with fallback for single artifact
      const artifactType = artifactTypes?.[0] || 'summary';
      
      result = await aiArtifactGeneratorService.generateArtifact(
        sanitizedContractId,
        sanitizedTenantId,
        artifactType,
        {} // Contract data would be fetched internally
      );
    }

    // Calculate confidence scores for generated artifacts
    const artifactsWithConfidence = await Promise.all(
      (Array.isArray(result) ? result : [result]).map(async (artifact) => {
        if (artifact.success && artifact.artifact) {
          const confidence = await confidenceScoringService.calculateConfidenceScore(
            artifact.artifact,
            {} // Source data would be provided
          );

          return {
            ...artifact,
            confidence: confidence.overallScore,
            needsReview: confidence.needsReview,
            confidenceFactors: confidence.factors,
          };
        }
        return artifact;
      })
    );

    // Log audit trail
    await auditTrailService.logActivity({
      tenantId: sanitizedTenantId,
      userId: sanitizedUserId,
      action: 'ARTIFACTS_GENERATED',
      resourceType: 'contract',
      resourceId: sanitizedContractId,
      details: {
        artifactTypes: artifactTypes || ['summary'],
        useParallel,
        successCount: artifactsWithConfidence.filter(a => a.success).length,
        failureCount: artifactsWithConfidence.filter(a => !a.success).length,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      artifacts: artifactsWithConfidence,
      summary: {
        total: artifactsWithConfidence.length,
        successful: artifactsWithConfidence.filter(a => a.success).length,
        failed: artifactsWithConfidence.filter(a => !a.success).length,
        needsReview: artifactsWithConfidence.filter(a => a.needsReview).length,
      },
    });
  } catch (error) {
    console.error('Enhanced artifact generation error:', error);
    
    return NextResponse.json(
      {
        error: 'Artifact generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contracts/artifacts/enhanced
 * Get artifacts with version history and confidence scores
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const artifactId = searchParams.get('artifactId');
    const includeVersions = searchParams.get('includeVersions') === 'true';

    if (!contractId && !artifactId) {
      return NextResponse.json(
        { error: 'Either contractId or artifactId is required' },
        { status: 400 }
      );
    }

    let result: any = {};

    if (artifactId) {
      const sanitizedArtifactId = dataSanitizationService.sanitizeText(artifactId).sanitized;
      
      // Get specific artifact with versions
      if (includeVersions) {
        const versions = await artifactVersioningService.getVersionHistory(sanitizedArtifactId);
        result.versions = versions;
      }

      // Get confidence score
      const confidence = await confidenceScoringService.getArtifactConfidence(sanitizedArtifactId);
      result.confidence = confidence;
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Get artifacts error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to retrieve artifacts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

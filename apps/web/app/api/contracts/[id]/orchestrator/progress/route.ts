import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/security/tenant';
import {
  getContractProfile,
  getRelevantArtifacts,
  type ContractType,
} from '@repo/workers';

/**
 * GET /api/contracts/[id]/orchestrator/progress
 * 
 * Returns current orchestrator state and smart artifact suggestions
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const contractId = params.id;
  const tenantId = await getApiTenantId(request);

  try {
    // Get contract with type
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        contractType: true,
        status: true,
        rawText: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Get processing job with orchestrator state
    const processingJob = await prisma.processingJob.findFirst({
      where: { tenantId, contractId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        checkpointData: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const checkpoint = (processingJob?.checkpointData ?? {}) as any;
    const plan = checkpoint.plan ?? null;
    const steps = checkpoint.steps ?? {};
    const agent = checkpoint.agent ?? null;

    // Get artifacts
    const artifacts = await prisma.artifact.findMany({
      where: { contractId, tenantId },
      select: { type: true, validationStatus: true },
    });

    const artifactsCompleted = artifacts.filter(
      (a) => a.validationStatus === 'valid'
    ).length;

    // Determine contract type and get profile
    const contractType = (contract.contractType as ContractType) || 'OTHER';
    const profile = getContractProfile(contractType);
    const relevantArtifacts = getRelevantArtifacts(contractType);

    // Get required artifacts that are missing
    const existingTypes = new Set(artifacts.map((a) => String(a.type)));
    const requiredArtifacts = Object.entries(profile.artifactRelevance)
      .filter(([type, relevance]) => relevance === 'required' && relevantArtifacts.includes(type as any))
      .map(([type]) => type);
    
    const missingRequired = requiredArtifacts.filter(
      (type) => !existingTypes.has(type)
    );

    // Generate smart suggestions
    const suggestions = Object.entries(profile.artifactRelevance)
      .filter(([type, relevance]) => {
        return (
          relevantArtifacts.includes(type as any) &&
          !existingTypes.has(type) &&
          (relevance === 'required' || relevance === 'optional')
        );
      })
      .map(([type, relevance]) => ({
        type,
        relevance,
        reason: getArtifactReason(type, contractType, profile),
        canGenerate: !!contract.rawText && contract.rawText.length > 100,
      }));

    // Build progress response
    const progress = {
      contractId,
      tenantId,
      status: agent?.done
        ? 'completed'
        : processingJob?.status === 'RUNNING'
        ? 'running'
        : 'idle',
      iteration: agent?.iteration ?? 0,
      maxIterations: 20,
      plan,
      steps,
      agent,
      artifacts: {
        total: relevantArtifacts.length,
        completed: artifactsCompleted,
        required: requiredArtifacts,
        missing: missingRequired,
      },
      lastUpdated: processingJob?.updatedAt?.toISOString() ?? new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      progress,
      suggestions: suggestions.slice(0, 5), // Top 5 suggestions
    });
  } catch (error) {
    console.error('Error fetching orchestrator progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

function getArtifactReason(
  type: string,
  contractType: ContractType,
  profile: ReturnType<typeof getContractProfile>
): string {
  const reasons: Record<string, string> = {
    OVERVIEW: `Essential summary of this ${profile.displayName}`,
    CLAUSES: `Key clauses for ${contractType} contracts`,
    FINANCIAL: `Financial terms and payment details`,
    RISK: `Risk assessment for ${profile.displayName}`,
    COMPLIANCE: `Regulatory compliance check`,
    OBLIGATIONS: `Party obligations and responsibilities`,
    RENEWAL: `Renewal terms and auto-renewal status`,
    NEGOTIATION_POINTS: `Potential negotiation opportunities`,
    AMENDMENTS: `Track changes and amendments`,
    CONTACTS: `Key contacts and stakeholders`,
  };

  return reasons[type] || `Recommended for ${contractType} contracts`;
}

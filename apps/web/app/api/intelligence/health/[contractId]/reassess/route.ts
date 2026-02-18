/**
 * Per-contract Health Reassessment API
 *
 * POST /api/intelligence/health/:contractId/reassess — Recalculate health score for one contract
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { calculateContractHealth } from '@/lib/health/contract-health-score';

export const POST = withAuthApiHandler(
  async (
    request: NextRequest,
    ctx: AuthenticatedApiContext & { params: { contractId: string } }
  ) => {
    const { tenantId } = ctx;
    const contractId = ctx.params.contractId;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: 'contractId is required' },
        { status: 400 }
      );
    }

    // Verify contract belongs to tenant
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, contractTitle: true, metadata: true },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    try {
      const health = await calculateContractHealth(contractId);

      // Persist updated health score in contract metadata
      const existingMeta = (contract.metadata || {}) as Record<string, unknown>;
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          metadata: {
            ...existingMeta,
            previousHealthScore: existingMeta.healthScore ?? health.overallScore,
            healthScore: health.overallScore,
            lastHealthAssessment: new Date().toISOString(),
          },
          lastAnalyzedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          contractName: contract.contractTitle || 'Untitled',
          ...health,
          contractId,
          reassessedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Health reassess error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to reassess contract health' },
        { status: 500 }
      );
    }
  }
);

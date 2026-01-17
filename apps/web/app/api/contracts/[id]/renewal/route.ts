/**
 * Contract Renewal API
 * 
 * GET /api/contracts/[id]/renewal - Get renewal details for a contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts/[id]/renewal
 * Get renewal details for a specific contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractId } = await params;
    const tenantId = await getServerTenantId();

    // Verify contract belongs to tenant
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, contractTitle: true, expirationDate: true },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Get renewal artifact
    const artifact = await prisma.artifact.findFirst({
      where: {
        contractId,
        type: 'RENEWAL',
      },
    });

    if (!artifact) {
      // Return basic info from contract record if no artifact
      const today = new Date();
      const expirationDate = contract.expirationDate;
      let daysUntilExpiry = null;

      if (expirationDate) {
        daysUntilExpiry = Math.ceil(
          (new Date(expirationDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      return NextResponse.json({
        success: true,
        contractId,
        contractName: contract.contractTitle || 'Unnamed Contract',
        hasRenewalArtifact: false,
        expirationDate: expirationDate?.toISOString() || null,
        daysUntilExpiry,
        message: 'No renewal artifact found. Run AI analysis to extract renewal terms.',
      });
    }

    const data = artifact.data as any;
    const today = new Date();

    // Calculate days until key dates
    let daysUntilTermEnd = null;
    let daysUntilOptOut = null;

    if (data.currentTermEnd) {
      daysUntilTermEnd = Math.ceil(
        (new Date(data.currentTermEnd).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    if (data.renewalTerms?.optOutDeadline) {
      daysUntilOptOut = Math.ceil(
        (new Date(data.renewalTerms.optOutDeadline).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Generate alerts based on dates
    const alerts = [];

    if (daysUntilOptOut !== null && daysUntilOptOut > 0 && daysUntilOptOut <= 30) {
      alerts.push({
        type: daysUntilOptOut <= 7 ? 'critical' : daysUntilOptOut <= 14 ? 'warning' : 'info',
        message: `Opt-out deadline in ${daysUntilOptOut} days`,
        date: data.renewalTerms.optOutDeadline,
      });
    }

    if (daysUntilTermEnd !== null && daysUntilTermEnd > 0 && daysUntilTermEnd <= 60) {
      alerts.push({
        type: daysUntilTermEnd <= 14 ? 'critical' : daysUntilTermEnd <= 30 ? 'warning' : 'info',
        message: `Contract term ends in ${daysUntilTermEnd} days`,
        date: data.currentTermEnd,
      });
    }

    return NextResponse.json({
      success: true,
      contractId,
      contractName: contract.contractTitle || 'Unnamed Contract',
      hasRenewalArtifact: true,
      summary: data.summary,
      autoRenewal: data.autoRenewal,
      currentTermEnd: data.currentTermEnd,
      daysUntilTermEnd,
      renewalTerms: data.renewalTerms,
      daysUntilOptOut,
      terminationNotice: data.terminationNotice,
      priceEscalation: data.priceEscalation || [],
      optOutDeadlines: data.optOutDeadlines || [],
      renewalAlerts: data.renewalAlerts || [],
      alerts,
      renewalCount: data.renewalCount,
      certainty: data.certainty,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to get contract renewal details' },
      { status: 500 }
    );
  }
}

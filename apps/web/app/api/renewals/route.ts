/**
 * Renewals API - Fully Integrated with Real Contract Data
 * 
 * GET /api/renewals - Get upcoming contract renewals from database
 * POST /api/renewals - Manage renewal actions
 * PATCH /api/renewals - Update renewal status
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';
import { publishRealtimeEvent } from '@/lib/realtime/publish';

export const dynamic = 'force-dynamic';

interface RenewalContract {
  id: string;
  contractId: string;
  contractName: string;
  supplier: string | null;
  currentValue: number | null;
  startDate: string | null;
  expiryDate: string | null;
  daysUntilExpiry: number;
  status: 'urgent' | 'in-negotiation' | 'pending-review' | 'upcoming' | 'completed' | 'expired';
  priority: 'critical' | 'high' | 'medium' | 'low';
  autoRenewal: boolean;
  noticePeriod: number;
  noticeDeadline: string | null;
  noticeStatus: 'overdue' | 'sent' | 'pending' | 'not-due';
  healthScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  contractType: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
}

function calculatePriority(daysUntilExpiry: number): RenewalContract['priority'] {
  if (daysUntilExpiry <= 7) return 'critical';
  if (daysUntilExpiry <= 30) return 'high';
  if (daysUntilExpiry <= 60) return 'medium';
  return 'low';
}

function calculateStatus(daysUntilExpiry: number, hasRenewalRecord: boolean): RenewalContract['status'] {
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 7) return 'urgent';
  if (hasRenewalRecord) return 'in-negotiation';
  if (daysUntilExpiry <= 30) return 'pending-review';
  return 'upcoming';
}

function calculateNoticeStatus(daysUntilExpiry: number, noticePeriod: number): RenewalContract['noticeStatus'] {
  const daysUntilNoticeDeadline = daysUntilExpiry - noticePeriod;
  if (daysUntilNoticeDeadline < 0) return 'overdue';
  if (daysUntilNoticeDeadline <= 7) return 'pending';
  return 'not-due';
}

/**
 * Contract artifact types for renewals
 */
interface RiskArtifactData {
  overallScore?: number;
}

interface FinancialArtifactData {
  totalValue?: number;
  contractValue?: number;
}

interface OverviewParty {
  name?: string;
  role?: string;
}

interface OverviewArtifactData {
  parties?: OverviewParty[];
}

interface ContractArtifact {
  type: string;
  data: unknown;
}

interface ContractWithArtifacts {
  artifacts?: ContractArtifact[];
  renewalStatus?: string | null;
}

function calculateHealthScore(contract: ContractWithArtifacts): number {
  let score = 80; // Base score
  
  // Adjust based on artifacts
  if (contract.artifacts?.length > 0) {
    score += 5;
    
    // Check risk artifact
    const riskArtifact = contract.artifacts.find((a: ContractArtifact) => a.type === 'RISK');
    if (riskArtifact?.data) {
      const riskData = riskArtifact.data as RiskArtifactData;
      if (riskData.overallScore !== undefined) {
        // Invert risk score (low risk = high health)
        score = Math.max(20, 100 - riskData.overallScore);
      }
    }
  }
  
  return Math.min(100, Math.max(0, score));
}

function calculateRiskLevel(healthScore: number): RenewalContract['riskLevel'] {
  if (healthScore >= 80) return 'low';
  if (healthScore >= 60) return 'medium';
  if (healthScore >= 40) return 'high';
  return 'critical';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const daysFilter = searchParams.get('daysUntilExpiry');
    const assignedTo = searchParams.get('assignedTo');

    const tenantId = await getServerTenantId();
    const now = new Date();

    // Get contracts with end dates (upcoming renewals)
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        status: { in: ['COMPLETED', 'ACTIVE'] },
        OR: [
          { endDate: { not: null } },
          { expirationDate: { not: null } },
        ],
      },
      include: {
        artifacts: {
          where: { type: { in: ['RISK', 'OVERVIEW', 'FINANCIAL'] } },
          select: { type: true, data: true },
        },
        contractMetadata: true,
      },
      orderBy: [
        { endDate: 'asc' },
        { expirationDate: 'asc' },
      ],
    });

    // Transform to renewal records
    let renewals: RenewalContract[] = contracts.map((contract) => {
      // Use endDate or expirationDate
      const expiryDate = contract.endDate || contract.expirationDate;
      const daysUntilExpiry = expiryDate 
        ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 365; // Default to far future if no date

      // Extract value from contract or financial artifact
      let contractValue = contract.totalValue ? Number(contract.totalValue) : null;
      const financialArtifact = contract.artifacts.find(a => a.type === 'FINANCIAL');
      if (!contractValue && financialArtifact?.data) {
        const financialData = financialArtifact.data as FinancialArtifactData;
        contractValue = financialData.totalValue || financialData.contractValue || null;
      }

      // Extract supplier from contract or overview artifact
      let supplier = contract.supplierName || null;
      const overviewArtifact = contract.artifacts.find(a => a.type === 'OVERVIEW');
      if (!supplier && overviewArtifact?.data) {
        const overviewData = overviewArtifact.data as OverviewArtifactData;
        const vendorParty = overviewData.parties?.find((p: OverviewParty) => 
          p.role?.toLowerCase().includes('vendor') || 
          p.role?.toLowerCase().includes('provider') ||
          p.role?.toLowerCase().includes('supplier')
        );
        supplier = vendorParty?.name || null;
      }

      const noticePeriod = 60; // Default 60 days
      const healthScore = calculateHealthScore(contract);
      const hasRenewalRecord = contract.renewalStatus === 'INITIATED';

      return {
        id: `renewal-${contract.id}`,
        contractId: contract.id,
        contractName: contract.contractTitle || contract.originalName || contract.fileName,
        supplier,
        currentValue: contractValue,
        startDate: (contract.startDate || contract.effectiveDate)?.toISOString() || null,
        expiryDate: expiryDate?.toISOString() || null,
        daysUntilExpiry,
        status: calculateStatus(daysUntilExpiry, hasRenewalRecord),
        priority: calculatePriority(daysUntilExpiry),
        autoRenewal: contract.autoRenewalEnabled || false,
        noticePeriod,
        noticeDeadline: expiryDate 
          ? new Date(expiryDate.getTime() - noticePeriod * 24 * 60 * 60 * 1000).toISOString()
          : null,
        noticeStatus: calculateNoticeStatus(daysUntilExpiry, noticePeriod),
        healthScore,
        riskLevel: calculateRiskLevel(healthScore),
        contractType: contract.contractType || contract.category || null,
        assignedTo: null, // TODO: Link to user assignments
      };
    });

    // Deduplicate by contractId (keep the first occurrence)
    const seenContractIds = new Set<string>();
    const seenContractNames = new Set<string>();
    renewals = renewals.filter(renewal => {
      // Skip if we've seen this contract ID
      if (seenContractIds.has(renewal.contractId)) {
        return false;
      }
      // Also skip if we've seen this exact contract name (likely a duplicate upload)
      const normalizedName = renewal.contractName?.toLowerCase().trim();
      if (normalizedName && seenContractNames.has(normalizedName)) {
        return false;
      }
      seenContractIds.add(renewal.contractId);
      if (normalizedName) {
        seenContractNames.add(normalizedName);
      }
      return true;
    });

    // Apply filters
    if (status && status !== 'all') {
      renewals = renewals.filter(r => r.status === status);
    }
    if (priority && priority !== 'all') {
      renewals = renewals.filter(r => r.priority === priority);
    }
    if (daysFilter) {
      const days = parseInt(daysFilter);
      renewals = renewals.filter(r => r.daysUntilExpiry <= days);
    }
    if (assignedTo) {
      renewals = renewals.filter(r => r.assignedTo?.id === assignedTo);
    }

    // Sort by urgency (days until expiry)
    renewals.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    // Calculate stats
    const stats = {
      total: renewals.length,
      urgent: renewals.filter(r => r.daysUntilExpiry <= 30 && r.daysUntilExpiry >= 0).length,
      inNegotiation: renewals.filter(r => r.status === 'in-negotiation').length,
      autoRenewal: renewals.filter(r => r.autoRenewal).length,
      totalValue: renewals.reduce((sum, r) => sum + (r.currentValue || 0), 0),
      avgHealthScore: renewals.length > 0 
        ? Math.round(renewals.reduce((sum, r) => sum + r.healthScore, 0) / renewals.length)
        : 0,
      expiringThisMonth: renewals.filter(r => r.daysUntilExpiry <= 30 && r.daysUntilExpiry >= 0).length,
      expiringNext90Days: renewals.filter(r => r.daysUntilExpiry <= 90 && r.daysUntilExpiry >= 0).length,
      expired: renewals.filter(r => r.daysUntilExpiry < 0).length,
    };

    // Timeline data for visualization
    const timeline = renewals.slice(0, 20).map(r => ({
      id: r.id,
      contractId: r.contractId,
      name: r.contractName,
      expiryDate: r.expiryDate,
      daysUntilExpiry: r.daysUntilExpiry,
      status: r.status,
      value: r.currentValue,
      priority: r.priority,
    }));

    return NextResponse.json({
      success: true,
      data: {
        renewals,
        stats,
        timeline,
        filters: {
          statuses: ['urgent', 'pending-review', 'in-negotiation', 'upcoming', 'completed', 'expired'],
          priorities: ['critical', 'high', 'medium', 'low'],
        },
      },
      meta: {
        source: 'database',
        timestamp: now.toISOString(),
        tenantId,
      },
    });
  } catch (error) {
    console.error('Renewals API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch renewals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, renewalId, contractId, renewalData } = body;
    const tenantId = await getServerTenantId();

    // Extract contract ID from renewal ID if needed
    const actualContractId = contractId || renewalId?.replace('renewal-', '');

    // Verify contract belongs to tenant before any action
    const contract = await prisma.contract.findFirst({
      where: { id: actualContractId, tenantId },
      select: { id: true, autoRenewalEnabled: true },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    if (action === 'initiate') {
      // Update contract to track renewal initiation
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          renewalStatus: 'INITIATED',
          renewalInitiatedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      void publishRealtimeEvent({
        event: 'renewal:initiated',
        data: { tenantId, contractId: contract.id },
        source: 'api:renewals',
      });
      void publishRealtimeEvent({
        event: 'contract:updated',
        data: { tenantId, contractId: contract.id },
        source: 'api:renewals',
      });

      return NextResponse.json({
        success: true,
        message: 'Renewal process initiated',
        data: {
          renewalId: `renewal-${actualContractId}`,
          status: 'in-negotiation',
          initiatedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'send-notice') {
      // Track notice sent via renewal notes
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          renewalNotes: `Notice sent on ${new Date().toISOString()}`,
          updatedAt: new Date(),
        },
      });

      void publishRealtimeEvent({
        event: 'contract:updated',
        data: { tenantId, contractId: contract.id },
        source: 'api:renewals',
      });

      return NextResponse.json({
        success: true,
        message: 'Renewal notice sent to vendor',
        data: {
          renewalId,
          noticeSentAt: new Date().toISOString(),
          noticeStatus: 'sent',
        },
      });
    }

    if (action === 'toggle-auto-renewal') {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          autoRenewalEnabled: !contract.autoRenewalEnabled,
          updatedAt: new Date(),
        },
      });

      void publishRealtimeEvent({
        event: 'contract:updated',
        data: { tenantId, contractId: contract.id },
        source: 'api:renewals',
      });

      return NextResponse.json({
        success: true,
        message: `Auto-renewal ${contract.autoRenewalEnabled ? 'disabled' : 'enabled'}`,
        data: {
          renewalId,
          autoRenewal: !contract.autoRenewalEnabled,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'complete') {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          renewalStatus: 'COMPLETED',
          renewalCompletedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      void publishRealtimeEvent({
        event: 'renewal:completed',
        data: { tenantId, contractId: contract.id },
        source: 'api:renewals',
      });
      void publishRealtimeEvent({
        event: 'contract:updated',
        data: { tenantId, contractId: contract.id },
        source: 'api:renewals',
      });

      return NextResponse.json({
        success: true,
        message: 'Renewal completed successfully',
        data: {
          renewalId,
          status: 'completed',
          completedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'set-dates') {
      // Update contract dates
      const { startDate, endDate } = renewalData || {};
      
      if (startDate || endDate) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            ...(startDate && { startDate: new Date(startDate), effectiveDate: new Date(startDate) }),
            ...(endDate && { endDate: new Date(endDate), expirationDate: new Date(endDate) }),
            updatedAt: new Date(),
          },
        });

        void publishRealtimeEvent({
          event: 'contract:updated',
          data: { tenantId, contractId: contract.id },
          source: 'api:renewals',
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Contract dates updated',
        data: {
          contractId: actualContractId,
          startDate,
          endDate,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Renewals POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process renewal action' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { renewalId, contractId, updates } = body;
    const tenantId = await getServerTenantId();

    const actualContractId = contractId || renewalId?.replace('renewal-', '');

    if (!actualContractId) {
      return NextResponse.json(
        { success: false, error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    // Verify contract belongs to tenant before any updates
    const contract = await prisma.contract.findFirst({
      where: { id: actualContractId, tenantId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Update contract fields if provided
    if (updates.endDate || updates.startDate || updates.value) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          ...(updates.startDate && { 
            startDate: new Date(updates.startDate),
            effectiveDate: new Date(updates.startDate),
          }),
          ...(updates.endDate && { 
            endDate: new Date(updates.endDate),
            expirationDate: new Date(updates.endDate),
          }),
          ...(updates.value && { totalValue: updates.value }),
          updatedAt: new Date(),
        },
      });

      void publishRealtimeEvent({
        event: 'contract:updated',
        data: { tenantId, contractId: contract.id },
        source: 'api:renewals',
      });
    }

    // Update contract renewal fields if provided
    if (updates.autoRenewal !== undefined || updates.noticePeriod || updates.renewalStatus) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          ...(updates.autoRenewal !== undefined && { autoRenewalEnabled: updates.autoRenewal }),
          ...(updates.noticePeriod && { noticePeriodDays: updates.noticePeriod }),
          ...(updates.renewalStatus && { renewalStatus: updates.renewalStatus }),
          updatedAt: new Date(),
        },
      });

      void publishRealtimeEvent({
        event: 'contract:updated',
        data: { tenantId, contractId: contract.id },
        source: 'api:renewals',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Renewal updated',
      data: {
        renewalId,
        contractId: actualContractId,
        updates,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Renewals PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update renewal' },
      { status: 500 }
    );
  }
}

/**
 * Renewals API - Fully Integrated with Real Contract Data
 * 
 * GET /api/renewals - Get upcoming contract renewals from database
 * POST /api/renewals - Manage renewal actions
 * PATCH /api/renewals - Update renewal status
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, handleApiError, createErrorResponse } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';

const RenewalActionSchema = z.object({
  contractId: z.string().optional(),
  renewalId: z.string().optional(),
  action: z.enum(['initiate', 'send-notice', 'toggle-auto-renewal', 'complete', 'set-dates']),
  renewalData: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
});

const RenewalPatchSchema = z.object({
  contractId: z.string().optional(),
  renewalId: z.string().optional(),
  updates: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    value: z.number().optional(),
    autoRenewal: z.boolean().optional(),
    noticePeriod: z.number().optional(),
    renewalStatus: z.string().optional(),
  }),
});

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
  if ((contract.artifacts?.length ?? 0) > 0) {
    score += 5;
    
    // Check risk artifact
    const riskArtifact = contract.artifacts!.find((a: ContractArtifact) => a.type === 'RISK');
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
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
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
        status: { in: ['COMPLETED', 'ACTIVE', 'PENDING'] },
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
        workflowExecutions: {
          where: { 
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
          include: {
            stepExecutions: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
              select: { assignedTo: true, status: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { endDate: 'asc' },
        { expirationDate: 'asc' },
      ],
    });

    // Pre-fetch all assigned users to avoid N+1 queries
    const userIds = new Set<string>();
    for (const contract of contracts) {
      if (contract.workflowExecutions?.length) {
        for (const we of contract.workflowExecutions) {
          const steps = (we as { stepExecutions?: Array<{ assignedTo?: string | null }> }).stepExecutions;
          if (steps) {
            for (const se of steps) {
              if (se.assignedTo) userIds.add(se.assignedTo);
            }
          }
        }
      }
      if (contract.renewalInitiatedBy) userIds.add(contract.renewalInitiatedBy);
    }
    const userMap = new Map<string, { id: string; firstName: string | null; lastName: string | null; email: string }>();
    if (userIds.size > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      for (const u of users) userMap.set(u.id, u);
    }

    // Transform to renewal records
    let renewals: RenewalContract[] = await Promise.all(contracts.map(async (contract) => {
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

      const noticePeriod = contract.noticePeriodDays || 60;
      const healthScore = calculateHealthScore(contract);
      const hasRenewalRecord = contract.renewalStatus === 'INITIATED';

      // Get assigned user from workflow if available
      let assignedTo: RenewalContract['assignedTo'] = null;
      if (contract.workflowExecutions?.length > 0) {
        // Find active renewal workflow execution
        const activeExecution = contract.workflowExecutions.find(
          (we: { status: string; stepExecutions?: Array<{ assignedTo?: string | null; status: string }> }) => 
            we.status === 'IN_PROGRESS' || we.status === 'PENDING'
        );
        if ((activeExecution?.stepExecutions?.length ?? 0) > 0) {
          // Find current step with assigned user
          const currentStep = activeExecution!.stepExecutions!.find(
            (se: { assignedTo?: string | null; status: string }) => 
              se.assignedTo && (se.status === 'PENDING' || se.status === 'IN_PROGRESS')
          );
          if (currentStep?.assignedTo) {
            // Use pre-fetched user map
            const user = userMap.get(currentStep.assignedTo);
            if (user) {
              assignedTo = {
                id: user.id,
                name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.firstName || user.lastName || 'Unknown'),
                email: user.email,
              };
            }
          }
        }
      }

      // Fallback to renewalInitiatedBy user if no workflow assignment
      if (!assignedTo && contract.renewalInitiatedBy) {
        const user = userMap.get(contract.renewalInitiatedBy);
        if (user) {
          assignedTo = {
            id: user.id,
            name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.firstName || user.lastName || 'Unknown'),
            email: user.email,
          };
        }
      }

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
        assignedTo,
      };
    }));

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

    return createSuccessResponse(ctx, {
      renewals,
      stats,
      timeline,
      filters: {
        statuses: ['urgent', 'pending-review', 'in-negotiation', 'upcoming', 'completed', 'expired'],
        priorities: ['critical', 'high', 'medium', 'low'],
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export async function POST(request: NextRequest) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const body = await request.json();
    const parsed = RenewalActionSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid request body', 400);
    }
    const { contractId, renewalId, action, renewalData } = parsed.data;
    const tenantId = await getServerTenantId();

    // Extract contract ID from renewal ID if needed
    const actualContractId = contractId || renewalId?.replace('renewal-', '');

    // Verify contract belongs to tenant before any action
    const contract = await prisma.contract.findFirst({
      where: { id: actualContractId, tenantId },
      select: { id: true, autoRenewalEnabled: true },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
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

      return createSuccessResponse(ctx, {
        message: 'Renewal process initiated',
        renewalId: `renewal-${actualContractId}`,
        status: 'in-negotiation',
        initiatedAt: new Date().toISOString(),
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

      return createSuccessResponse(ctx, {
        message: 'Renewal notice sent to vendor',
        renewalId,
        noticeSentAt: new Date().toISOString(),
        noticeStatus: 'sent',
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

      return createSuccessResponse(ctx, {
        message: `Auto-renewal ${contract.autoRenewalEnabled ? 'disabled' : 'enabled'}`,
        renewalId,
        autoRenewal: !contract.autoRenewalEnabled,
        updatedAt: new Date().toISOString(),
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

      return createSuccessResponse(ctx, {
        message: 'Renewal completed successfully',
        renewalId,
        status: 'completed',
        completedAt: new Date().toISOString(),
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

      return createSuccessResponse(ctx, {
        message: 'Contract dates updated',
        contractId: actualContractId,
        startDate,
        endDate,
        updatedAt: new Date().toISOString(),
      });
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action', 400);
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to process renewal action', 500);
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const body = await request.json();
    const parsed = RenewalPatchSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid request body', 400);
    }
    const { contractId, renewalId, updates } = parsed.data;
    const tenantId = await getServerTenantId();

    const actualContractId = contractId || renewalId?.replace('renewal-', '');

    if (!actualContractId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Contract ID is required', 400);
    }

    // Verify contract belongs to tenant before any updates
    const contract = await prisma.contract.findFirst({
      where: { id: actualContractId, tenantId },
      select: { id: true },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
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

    return createSuccessResponse(ctx, {
      message: 'Renewal updated',
      renewalId,
      contractId: actualContractId,
      updates,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update renewal', 500);
  }
}

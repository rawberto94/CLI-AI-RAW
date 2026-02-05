import { NextRequest, NextResponse } from 'next/server';

/**
 * Dashboard Widgets API
 * GET /api/dashboard/widgets - Get aggregated stats for all dashboard widgets
 * This single endpoint reduces the number of API calls needed for the dashboard
 */

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    // In production, these would be parallel database queries
    // For now, we aggregate mock data from different sources
    
    const [approvals, renewals, intelligence, governance] = await Promise.all([
      getApprovalsStats(),
      getRenewalsStats(),
      getIntelligenceStats(),
      getGovernanceStats(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        approvals,
        renewals,
        intelligence,
        governance,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch widget stats' },
      { status: 500 }
    );
  }
}

async function getApprovalsStats() {
  // Mock data - in production, query from database
  return {
    pending: 4,
    urgent: 2,
    overdue: 0,
    avgProcessingTime: '2.3 days',
    recentItems: [
      { 
        id: 'appr1', 
        title: 'Master Agreement - Acme Corp', 
        priority: 'high', 
        dueDate: '2024-03-15',
        type: 'contract',
        value: 1200000,
      },
      { 
        id: 'appr2', 
        title: 'Cloud Services SLA Amendment', 
        priority: 'critical', 
        dueDate: '2024-03-14',
        type: 'amendment',
        value: 450000,
      },
    ],
  };
}

async function getRenewalsStats() {
  // Mock data - in production, query from database
  const _now = new Date();
  return {
    total: 5,
    urgentCount: 2,
    expiringThisMonth: 2,
    autoRenewalCount: 2,
    totalValue: 2450000,
    recentItems: [
      {
        id: 'ren1',
        contractName: 'Software License Agreement',
        daysUntil: 1,
        value: 180000,
        autoRenewal: false,
        status: 'urgent',
      },
      {
        id: 'ren2',
        contractName: 'Master Agreement - Acme Corp',
        daysUntil: 18,
        value: 1200000,
        autoRenewal: false,
        status: 'in-negotiation',
      },
      {
        id: 'ren3',
        contractName: 'Cloud Services SLA',
        daysUntil: 79,
        value: 450000,
        autoRenewal: true,
        status: 'pending-review',
      },
    ],
  };
}

async function getIntelligenceStats() {
  // Mock data - in production, query from database
  return {
    avgScore: 72,
    healthy: 18,
    atRisk: 4,
    critical: 2,
    improving: 8,
    declining: 3,
    recentInsights: [
      {
        id: 'ins1',
        type: 'risk',
        title: 'High-value contract expiring',
        severity: 'high',
      },
      {
        id: 'ins2',
        type: 'opportunity',
        title: 'Vendor consolidation savings',
        severity: 'medium',
      },
    ],
  };
}

async function getGovernanceStats() {
  // Mock data - in production, query from database
  return {
    complianceScore: 94,
    activePolicies: 12,
    openViolations: 3,
    pendingReviews: 7,
    criticalFlags: 1,
    recentFlags: [
      {
        id: 'flg1',
        type: 'deviation',
        title: 'Unlimited Liability Clause',
        severity: 'critical',
        contract: 'MSA - Acme Corp',
      },
      {
        id: 'flg2',
        type: 'compliance',
        title: 'Missing DPA Clause',
        severity: 'high',
        contract: 'SLA - CloudTech',
      },
    ],
  };
}

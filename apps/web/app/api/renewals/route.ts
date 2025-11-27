import { NextRequest, NextResponse } from 'next/server';

// Mock renewal data
const mockRenewals = [
  {
    id: 'ren1',
    contractId: 'contract-1',
    contractName: 'Master Agreement - Acme Corp',
    supplier: 'Acme Corporation',
    currentValue: 1200000,
    proposedValue: 1260000,
    startDate: '2023-04-01',
    expiryDate: '2024-04-01',
    renewalDate: '2024-04-01',
    daysUntilExpiry: 18,
    status: 'in-negotiation',
    priority: 'high',
    autoRenewal: false,
    noticePeriod: 60,
    noticeDeadline: '2024-02-01',
    noticeStatus: 'sent',
    healthScore: 78,
    riskLevel: 'medium',
    assignedTo: {
      id: 'user1',
      name: 'Sarah Chen',
      email: 'sarah.chen@company.com',
    },
    history: [
      { date: '2024-01-15', action: 'Renewal process initiated', by: 'System' },
      { date: '2024-01-20', action: 'Notice sent to vendor', by: 'Sarah Chen' },
      { date: '2024-02-01', action: 'Vendor responded with proposal', by: 'Acme Corp' },
      { date: '2024-02-15', action: 'Counter-proposal sent', by: 'Sarah Chen' },
    ],
    terms: {
      currentTermLength: 12,
      proposedTermLength: 24,
      priceChange: '+5%',
      newClauses: ['Extended SLA guarantees', 'Enhanced support tier'],
      removedClauses: [],
    },
    recommendations: [
      { type: 'action', text: 'Review vendor pricing against market benchmarks' },
      { type: 'caution', text: 'Consider negotiating longer term for better pricing' },
      { type: 'info', text: 'Vendor has history of 3% average annual increases' },
    ],
  },
  {
    id: 'ren2',
    contractId: 'contract-2',
    contractName: 'Cloud Services SLA',
    supplier: 'CloudTech Solutions',
    currentValue: 450000,
    proposedValue: 450000,
    startDate: '2023-06-01',
    expiryDate: '2024-06-01',
    renewalDate: '2024-06-01',
    daysUntilExpiry: 79,
    status: 'pending-review',
    priority: 'medium',
    autoRenewal: true,
    noticePeriod: 30,
    noticeDeadline: '2024-05-01',
    noticeStatus: 'pending',
    healthScore: 92,
    riskLevel: 'low',
    assignedTo: {
      id: 'user2',
      name: 'Mike Johnson',
      email: 'mike.johnson@company.com',
    },
    history: [
      { date: '2024-03-01', action: 'Auto-renewal reminder triggered', by: 'System' },
    ],
    terms: {
      currentTermLength: 12,
      proposedTermLength: 12,
      priceChange: '0%',
      newClauses: [],
      removedClauses: [],
    },
    recommendations: [
      { type: 'success', text: 'Contract performance has been excellent' },
      { type: 'info', text: 'Consider multi-year commitment for discount' },
    ],
  },
  {
    id: 'ren3',
    contractId: 'contract-3',
    contractName: 'Software License Agreement',
    supplier: 'SoftCorp Inc',
    currentValue: 180000,
    proposedValue: 210000,
    startDate: '2022-03-15',
    expiryDate: '2024-03-15',
    renewalDate: '2024-03-15',
    daysUntilExpiry: 1,
    status: 'urgent',
    priority: 'critical',
    autoRenewal: false,
    noticePeriod: 90,
    noticeDeadline: '2023-12-15',
    noticeStatus: 'overdue',
    healthScore: 45,
    riskLevel: 'critical',
    assignedTo: {
      id: 'user3',
      name: 'Tom Wilson',
      email: 'tom.wilson@company.com',
    },
    history: [
      { date: '2023-11-01', action: 'Renewal reminder sent', by: 'System' },
      { date: '2024-01-10', action: 'Escalation to manager', by: 'System' },
      { date: '2024-02-20', action: 'Emergency review initiated', by: 'Tom Wilson' },
    ],
    terms: {
      currentTermLength: 24,
      proposedTermLength: 12,
      priceChange: '+17%',
      newClauses: ['New licensing model', 'Usage-based pricing'],
      removedClauses: ['Unlimited users'],
    },
    recommendations: [
      { type: 'warning', text: 'Critical: Contract expires in 1 day' },
      { type: 'action', text: 'Execute emergency renewal or bridge agreement' },
      { type: 'caution', text: 'Significant price increase proposed' },
    ],
  },
  {
    id: 'ren4',
    contractId: 'contract-4',
    contractName: 'Professional Services Agreement',
    supplier: 'ConsultPro Ltd',
    currentValue: 320000,
    proposedValue: null,
    startDate: '2023-09-01',
    expiryDate: '2024-09-01',
    renewalDate: '2024-09-01',
    daysUntilExpiry: 171,
    status: 'upcoming',
    priority: 'low',
    autoRenewal: false,
    noticePeriod: 60,
    noticeDeadline: '2024-07-01',
    noticeStatus: 'not-due',
    healthScore: 85,
    riskLevel: 'low',
    assignedTo: null,
    history: [],
    terms: {
      currentTermLength: 12,
      proposedTermLength: null,
      priceChange: null,
      newClauses: [],
      removedClauses: [],
    },
    recommendations: [
      { type: 'info', text: 'Begin renewal planning 90 days before expiry' },
      { type: 'info', text: 'Current vendor performance is satisfactory' },
    ],
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const daysUntilExpiry = searchParams.get('daysUntilExpiry');
  const assignedTo = searchParams.get('assignedTo');

  let renewals = [...mockRenewals];

  if (status && status !== 'all') {
    renewals = renewals.filter(r => r.status === status);
  }
  if (priority && priority !== 'all') {
    renewals = renewals.filter(r => r.priority === priority);
  }
  if (daysUntilExpiry) {
    const days = parseInt(daysUntilExpiry);
    renewals = renewals.filter(r => r.daysUntilExpiry <= days);
  }
  if (assignedTo) {
    renewals = renewals.filter(r => r.assignedTo?.id === assignedTo);
  }

  // Sort by urgency (days until expiry)
  renewals.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  // Calculate stats
  const stats = {
    total: mockRenewals.length,
    urgent: mockRenewals.filter(r => r.daysUntilExpiry <= 30).length,
    inNegotiation: mockRenewals.filter(r => r.status === 'in-negotiation').length,
    autoRenewal: mockRenewals.filter(r => r.autoRenewal).length,
    totalValue: mockRenewals.reduce((sum, r) => sum + r.currentValue, 0),
    avgHealthScore: Math.round(mockRenewals.reduce((sum, r) => sum + r.healthScore, 0) / mockRenewals.length),
    expiringThisMonth: mockRenewals.filter(r => r.daysUntilExpiry <= 30).length,
    expiringNext90Days: mockRenewals.filter(r => r.daysUntilExpiry <= 90).length,
  };

  // Timeline data for visualization
  const timeline = mockRenewals.map(r => ({
    id: r.id,
    name: r.contractName,
    expiryDate: r.expiryDate,
    daysUntilExpiry: r.daysUntilExpiry,
    status: r.status,
    value: r.currentValue,
  }));

  return NextResponse.json({
    success: true,
    data: {
      renewals,
      stats,
      timeline,
      filters: {
        statuses: ['upcoming', 'pending-review', 'in-negotiation', 'completed', 'urgent'],
        priorities: ['critical', 'high', 'medium', 'low'],
      },
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, renewalId, renewalData } = body;

    if (action === 'initiate') {
      return NextResponse.json({
        success: true,
        message: 'Renewal process initiated',
        data: {
          renewalId: renewalId || `ren-${Date.now()}`,
          status: 'pending-review',
          initiatedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'send-notice') {
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

    if (action === 'update-terms') {
      return NextResponse.json({
        success: true,
        message: 'Renewal terms updated',
        data: {
          renewalId,
          terms: renewalData?.terms,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'toggle-auto-renewal') {
      const renewal = mockRenewals.find(r => r.id === renewalId);
      return NextResponse.json({
        success: true,
        message: `Auto-renewal ${renewal?.autoRenewal ? 'disabled' : 'enabled'}`,
        data: {
          renewalId,
          autoRenewal: !renewal?.autoRenewal,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'complete') {
      return NextResponse.json({
        success: true,
        message: 'Renewal completed successfully',
        data: {
          renewalId,
          status: 'completed',
          completedAt: new Date().toISOString(),
          newContractId: `contract-${Date.now()}`,
        },
      });
    }

    if (action === 'assign') {
      const { assigneeId, assigneeName } = renewalData;
      return NextResponse.json({
        success: true,
        message: `Assigned to ${assigneeName}`,
        data: {
          renewalId,
          assignedTo: {
            id: assigneeId,
            name: assigneeName,
          },
          assignedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { renewalId, updates } = body;

    if (!renewalId) {
      return NextResponse.json(
        { success: false, error: 'Renewal ID is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Renewal updated',
      data: {
        renewalId,
        updates,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

// Mock governance data
const mockPolicies = [
  {
    id: 'p1',
    name: 'Liability Cap Policy',
    description: 'Ensures liability limitations meet company standards',
    category: 'risk',
    status: 'active',
    severity: 'critical',
    rules: 5,
    violations: 2,
    enforcement: 'block',
  },
  {
    id: 'p2',
    name: 'GDPR Compliance',
    description: 'Data protection and privacy requirements',
    category: 'compliance',
    status: 'active',
    severity: 'critical',
    rules: 12,
    violations: 0,
    enforcement: 'block',
  },
];

const mockRiskFlags = [
  {
    id: 'rf1',
    type: 'deviation',
    severity: 'critical',
    title: 'Unlimited Liability Clause',
    contract: 'MSA - Acme Corp',
    status: 'open',
  },
  {
    id: 'rf2',
    type: 'compliance',
    severity: 'high',
    title: 'Missing DPA Clause',
    contract: 'SLA - CloudTech',
    status: 'acknowledged',
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');

  if (section === 'policies') {
    return NextResponse.json({
      success: true,
      data: { policies: mockPolicies },
    });
  }

  if (section === 'flags') {
    return NextResponse.json({
      success: true,
      data: { flags: mockRiskFlags },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      policies: mockPolicies,
      flags: mockRiskFlags,
      stats: {
        activePolicies: mockPolicies.filter(p => p.status === 'active').length,
        openFlags: mockRiskFlags.filter(f => f.status === 'open').length,
        criticalFlags: mockRiskFlags.filter(f => f.severity === 'critical').length,
        totalViolations: mockPolicies.reduce((sum, p) => sum + p.violations, 0),
      },
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, policyId, flagId, reason } = body;

    if (action === 'create-policy') {
      return NextResponse.json({
        success: true,
        data: {
          policyId: `p-${Date.now()}`,
          createdAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'update-policy') {
      return NextResponse.json({
        success: true,
        message: 'Policy updated',
        data: {
          policyId,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'toggle-policy') {
      return NextResponse.json({
        success: true,
        message: 'Policy status toggled',
        data: {
          policyId,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'resolve-flag') {
      return NextResponse.json({
        success: true,
        message: 'Flag resolved',
        data: {
          flagId,
          resolvedAt: new Date().toISOString(),
          resolution: reason,
        },
      });
    }

    if (action === 'acknowledge-flag') {
      return NextResponse.json({
        success: true,
        message: 'Flag acknowledged',
        data: {
          flagId,
          acknowledgedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'dismiss-flag') {
      return NextResponse.json({
        success: true,
        message: 'Flag dismissed as false positive',
        data: {
          flagId,
          dismissedAt: new Date().toISOString(),
          reason,
        },
      });
    }

    if (action === 'check-compliance') {
      // Run compliance check on a contract
      return NextResponse.json({
        success: true,
        data: {
          contractId: body.contractId,
          checkId: `check-${Date.now()}`,
          result: {
            compliant: false,
            violations: 2,
            warnings: 3,
            details: [
              { policy: 'Liability Cap Policy', status: 'violation' },
              { policy: 'GDPR Compliance', status: 'pass' },
            ],
          },
          checkedAt: new Date().toISOString(),
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

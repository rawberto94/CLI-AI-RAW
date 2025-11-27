import { NextRequest, NextResponse } from 'next/server';

// Mock data for contract health scores
const mockHealthData = [
  {
    contractId: 'c1',
    contractName: 'Master Agreement - Acme Corp',
    supplierName: 'Acme Corporation',
    overallScore: 78,
    previousScore: 72,
    trend: 'improving',
    status: 'healthy',
    factors: {
      risk: 72,
      compliance: 95,
      financial: 85,
      operational: 68,
      relationship: 82,
    },
  },
  {
    contractId: 'c2',
    contractName: 'SLA - Cloud Services',
    supplierName: 'Acme Corporation',
    overallScore: 62,
    previousScore: 68,
    trend: 'declining',
    status: 'at-risk',
    factors: {
      risk: 45,
      compliance: 88,
      financial: 55,
      operational: 72,
      relationship: 65,
    },
  },
  {
    contractId: 'c3',
    contractName: 'Procurement Agreement - GlobalSupply',
    supplierName: 'GlobalSupply Ltd',
    overallScore: 42,
    previousScore: 55,
    trend: 'declining',
    status: 'critical',
    factors: {
      risk: 35,
      compliance: 52,
      financial: 38,
      operational: 45,
      relationship: 40,
    },
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const status = searchParams.get('status');

  let results = [...mockHealthData];

  if (contractId) {
    results = results.filter(h => h.contractId === contractId);
  }

  if (status) {
    results = results.filter(h => h.status === status);
  }

  // Calculate portfolio stats
  const stats = {
    averageScore: Math.round(results.reduce((sum, h) => sum + h.overallScore, 0) / results.length),
    healthy: results.filter(h => h.status === 'healthy').length,
    atRisk: results.filter(h => h.status === 'at-risk').length,
    critical: results.filter(h => h.status === 'critical').length,
    improving: results.filter(h => h.trend === 'improving').length,
    declining: results.filter(h => h.trend === 'declining').length,
  };

  return NextResponse.json({
    success: true,
    data: {
      contracts: results,
      stats,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractId, reassess } = body;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    // Simulate reassessment
    const contract = mockHealthData.find(h => h.contractId === contractId);
    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Return updated health score (simulated)
    return NextResponse.json({
      success: true,
      data: {
        ...contract,
        lastAssessed: new Date().toISOString(),
        reassessmentTriggered: reassess,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

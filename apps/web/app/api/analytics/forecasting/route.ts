import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock data for fallback
const mockForecastData = [
  { month: 'Apr 2024', renewalValue: 780000, newContractValue: 0, terminationValue: 35000, netChange: 745000, cumulative: 2545000 },
  { month: 'May 2024', renewalValue: 0, newContractValue: 150000, terminationValue: 0, netChange: 150000, cumulative: 2695000 },
  { month: 'Jun 2024', renewalValue: 1200000, newContractValue: 0, terminationValue: 0, netChange: 1200000, cumulative: 3895000 },
  { month: 'Jul 2024', renewalValue: 0, newContractValue: 200000, terminationValue: 120000, netChange: 80000, cumulative: 3975000 },
  { month: 'Aug 2024', renewalValue: 450000, newContractValue: 0, terminationValue: 0, netChange: 450000, cumulative: 4425000 },
  { month: 'Sep 2024', renewalValue: 120000, newContractValue: 300000, terminationValue: 0, netChange: 420000, cumulative: 4845000 },
];

const mockScenarios = [
  {
    id: 's1',
    name: 'Baseline',
    description: 'Current trajectory with no changes',
    assumptions: ['All contracts renew at projected rates', 'No new negotiations', 'Standard escalators apply'],
    projectedSavings: 0,
    projectedCost: 5145000,
    riskLevel: 'medium',
    probability: 60,
  },
  {
    id: 's2',
    name: 'Aggressive Renegotiation',
    description: 'Proactive renegotiation of top 5 contracts',
    assumptions: ['15% average discount on renewals', 'GlobalSupply terminated', 'Consolidation with Acme'],
    projectedSavings: 425000,
    projectedCost: 4720000,
    riskLevel: 'high',
    probability: 35,
  },
  {
    id: 's3',
    name: 'Conservative Optimization',
    description: 'Targeted improvements on at-risk contracts',
    assumptions: ['5% discount on high-value renewals', 'Terminate underperforming contracts', 'Maintain relationships'],
    projectedSavings: 180000,
    projectedCost: 4965000,
    riskLevel: 'low',
    probability: 75,
  },
];

const mockOpportunities = [
  {
    id: 'o1',
    type: 'termination',
    title: 'Exit GlobalSupply Agreement',
    description: 'Terminate underperforming procurement agreement and source alternatives',
    contracts: ['Procurement Agreement - GlobalSupply'],
    potentialSavings: 171600,
    effort: 'high',
    timeframe: '60-90 days',
    confidence: 85,
  },
  {
    id: 'o2',
    type: 'consolidation',
    title: 'Consolidate Acme Contracts',
    description: 'Merge 3 Acme agreements into single master agreement for volume discount',
    contracts: ['Master Agreement', 'Cloud Services SLA', 'Maintenance Contract'],
    potentialSavings: 120000,
    effort: 'medium',
    timeframe: '30-60 days',
    confidence: 70,
  },
  {
    id: 'o3',
    type: 'renegotiation',
    title: 'Renegotiate Cloud SLA Terms',
    description: 'Address SLA performance issues and renegotiate penalties',
    contracts: ['Cloud Services SLA'],
    potentialSavings: 45000,
    effort: 'low',
    timeframe: '14-30 days',
    confidence: 90,
  },
  {
    id: 'o4',
    type: 'optimization',
    title: 'Right-size Cloud Resources',
    description: 'Optimize cloud resource allocation based on actual usage patterns',
    contracts: ['Cloud Services SLA'],
    potentialSavings: 67500,
    effort: 'low',
    timeframe: '7-14 days',
    confidence: 95,
  },
];

const mockSupplierSpend = [
  { supplier: 'Acme Corporation', currentSpend: 1770000, projectedSpend: 1848000, changePercent: 4.4, contractCount: 3, riskLevel: 'low' },
  { supplier: 'GlobalSupply Ltd', currentSpend: 780000, projectedSpend: 842400, changePercent: 8.0, contractCount: 1, riskLevel: 'high' },
  { supplier: 'TechFlow Inc', currentSpend: 0, projectedSpend: 0, changePercent: 0, contractCount: 1, riskLevel: 'low' },
];

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') || 'tenant_demo_001';
  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('timeRange') || '12m';

  try {
    // Try to calculate real forecasting data from contracts
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      select: {
        id: true,
        totalValue: true,
        supplierName: true,
        startDate: true,
        endDate: true,
        expirationDate: true,
        status: true,
      },
    });

    if (contracts.length > 0) {
      // Calculate supplier spend from real contracts
      const supplierSpendMap = new Map<string, { currentSpend: number; contractCount: number }>();
      
      contracts.forEach(c => {
        if (c.supplierName && c.totalValue) {
          const existing = supplierSpendMap.get(c.supplierName) || { currentSpend: 0, contractCount: 0 };
          supplierSpendMap.set(c.supplierName, {
            currentSpend: existing.currentSpend + Number(c.totalValue),
            contractCount: existing.contractCount + 1,
          });
        }
      });

      const realSupplierSpend = Array.from(supplierSpendMap.entries()).map(([supplier, data]) => ({
        supplier,
        currentSpend: data.currentSpend,
        projectedSpend: data.currentSpend * 1.05, // 5% growth projection
        changePercent: 5.0,
        contractCount: data.contractCount,
        riskLevel: data.currentSpend > 500000 ? 'medium' : 'low',
      }));

      return NextResponse.json({
        success: true,
        forecastData: mockForecastData, // Keep mock for now as complex calculation
        scenarios: mockScenarios,
        opportunities: mockOpportunities,
        supplierSpend: realSupplierSpend.length > 0 ? realSupplierSpend : mockSupplierSpend,
        metadata: {
          contractCount: contracts.length,
          timeRange,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // Return mock data
    return NextResponse.json({
      success: true,
      forecastData: mockForecastData,
      scenarios: mockScenarios,
      opportunities: mockOpportunities,
      supplierSpend: mockSupplierSpend,
      metadata: {
        contractCount: 0,
        timeRange,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching forecasting data:', error);
    
    return NextResponse.json({
      success: true,
      forecastData: mockForecastData,
      scenarios: mockScenarios,
      opportunities: mockOpportunities,
      supplierSpend: mockSupplierSpend,
      metadata: {
        error: 'Using mock data',
        generatedAt: new Date().toISOString(),
      },
    });
  }
}

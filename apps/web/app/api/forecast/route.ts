import { NextRequest, NextResponse } from 'next/server';

// Generate historical and forecast data
function generateTimeSeriesData(months: number, baseValue: number, growthRate: number, volatility: number) {
  const data = [];
  let value = baseValue;
  const now = new Date();
  
  for (let i = -12; i < months; i++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() + i);
    
    const isHistorical = i < 0;
    const randomFactor = 1 + (Math.random() - 0.5) * volatility;
    const growth = 1 + (growthRate / 12);
    
    value = value * growth * randomFactor;
    
    data.push({
      date: date.toISOString().slice(0, 7), // YYYY-MM format
      value: Math.round(value),
      isHistorical,
      confidence: isHistorical ? 1 : Math.max(0.5, 1 - (i * 0.05)),
    });
  }
  
  return data;
}

// Mock forecast data
const mockForecasts = {
  costForecast: {
    title: 'Contract Spend Forecast',
    currentMonthly: 285000,
    projectedMonthly: 312000,
    yearOverYearChange: '+9.5%',
    data: generateTimeSeriesData(12, 250000, 0.08, 0.1),
    drivers: [
      { factor: 'Inflation adjustments', impact: '+4.2%' },
      { factor: 'New vendor contracts', impact: '+3.8%' },
      { factor: 'Consolidation savings', impact: '-2.1%' },
      { factor: 'Volume discounts', impact: '-1.5%' },
    ],
    scenarios: [
      { name: 'Conservative', value: 295000, probability: 0.3 },
      { name: 'Base Case', value: 312000, probability: 0.5 },
      { name: 'Aggressive', value: 335000, probability: 0.2 },
    ],
  },
  renewalForecast: {
    title: 'Renewal Volume Forecast',
    currentQuarter: 12,
    nextQuarter: 18,
    yearTotal: 65,
    data: [
      { quarter: 'Q1 2024', actual: 12, forecast: null, value: 2800000 },
      { quarter: 'Q2 2024', actual: null, forecast: 18, value: 4200000 },
      { quarter: 'Q3 2024', actual: null, forecast: 15, value: 3100000 },
      { quarter: 'Q4 2024', actual: null, forecast: 20, value: 5500000 },
    ],
    riskBreakdown: {
      low: 35,
      medium: 20,
      high: 10,
    },
    autoRenewalRate: 0.42,
  },
  riskForecast: {
    title: 'Risk Trajectory',
    currentScore: 72,
    projectedScore: 78,
    trend: 'improving',
    riskFactors: [
      { 
        name: 'Contract Compliance', 
        current: 85, 
        projected: 88, 
        trend: 'up',
        data: generateTimeSeriesData(6, 80, 0.03, 0.05),
      },
      { 
        name: 'Vendor Performance', 
        current: 78, 
        projected: 82, 
        trend: 'up',
        data: generateTimeSeriesData(6, 75, 0.04, 0.08),
      },
      { 
        name: 'Financial Exposure', 
        current: 65, 
        projected: 70, 
        trend: 'up',
        data: generateTimeSeriesData(6, 60, 0.05, 0.1),
      },
      { 
        name: 'Regulatory Compliance', 
        current: 92, 
        projected: 90, 
        trend: 'down',
        data: generateTimeSeriesData(6, 95, -0.02, 0.03),
      },
    ],
    alerts: [
      { severity: 'warning', message: '3 contracts approaching compliance deadline' },
      { severity: 'info', message: 'New GDPR requirements effective Q2' },
    ],
  },
  savingsOpportunities: {
    title: 'Savings Opportunities',
    totalPotential: 485000,
    identified: 12,
    opportunities: [
      {
        id: 'opp1',
        type: 'consolidation',
        description: 'Consolidate cloud storage vendors',
        potentialSavings: 180000,
        effort: 'medium',
        timeline: '3-6 months',
        affectedContracts: 4,
      },
      {
        id: 'opp2',
        type: 'renegotiation',
        description: 'Renegotiate software licenses at renewal',
        potentialSavings: 125000,
        effort: 'low',
        timeline: '1-3 months',
        affectedContracts: 2,
      },
      {
        id: 'opp3',
        type: 'elimination',
        description: 'Eliminate duplicate SaaS subscriptions',
        potentialSavings: 95000,
        effort: 'low',
        timeline: '1 month',
        affectedContracts: 6,
      },
      {
        id: 'opp4',
        type: 'optimization',
        description: 'Optimize usage-based contracts',
        potentialSavings: 85000,
        effort: 'high',
        timeline: '6-12 months',
        affectedContracts: 3,
      },
    ],
  },
  aiInsights: [
    {
      id: 'insight1',
      type: 'prediction',
      confidence: 0.87,
      title: 'Q2 Spend Increase Expected',
      description: 'Based on historical patterns and current pipeline, expect 12% spend increase in Q2 due to seasonal vendor renewals.',
      recommendation: 'Begin early negotiations with top 5 vendors by value.',
      impact: 'high',
    },
    {
      id: 'insight2',
      type: 'anomaly',
      confidence: 0.92,
      title: 'Unusual Price Variance Detected',
      description: 'Software vendor pricing 23% above market benchmark for similar services.',
      recommendation: 'Request competitive quotes and leverage market data in negotiation.',
      impact: 'medium',
    },
    {
      id: 'insight3',
      type: 'opportunity',
      confidence: 0.78,
      title: 'Multi-Year Discount Available',
      description: '3 vendors offer 15-20% discount for multi-year commitments based on historical data.',
      recommendation: 'Evaluate multi-year options for stable, strategic vendors.',
      impact: 'medium',
    },
    {
      id: 'insight4',
      type: 'risk',
      confidence: 0.85,
      title: 'Concentration Risk Identified',
      description: '45% of IT spend concentrated with single vendor, above recommended 30% threshold.',
      recommendation: 'Develop vendor diversification strategy over next 18 months.',
      impact: 'high',
    },
  ],
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // cost, renewal, risk, savings, insights
  const timeframe = searchParams.get('timeframe') || '12'; // months

  let data: Record<string, unknown> = {};

  if (type) {
    switch (type) {
      case 'cost':
        data = { costForecast: mockForecasts.costForecast };
        break;
      case 'renewal':
        data = { renewalForecast: mockForecasts.renewalForecast };
        break;
      case 'risk':
        data = { riskForecast: mockForecasts.riskForecast };
        break;
      case 'savings':
        data = { savingsOpportunities: mockForecasts.savingsOpportunities };
        break;
      case 'insights':
        data = { aiInsights: mockForecasts.aiInsights };
        break;
      default:
        data = mockForecasts;
    }
  } else {
    data = mockForecasts;
  }

  // Summary stats
  const summary = {
    totalContractValue: 15200000,
    projectedAnnualSpend: 3744000,
    potentialSavings: 485000,
    riskScore: 72,
    upcomingRenewals: 18,
    criticalAlerts: 2,
    forecastConfidence: 0.85,
    lastUpdated: new Date().toISOString(),
  };

  return NextResponse.json({
    success: true,
    data: {
      ...data,
      summary,
      timeframe: parseInt(timeframe),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, parameters } = body;

    if (action === 'run-scenario') {
      const { scenarioType, adjustments } = parameters || {};
      
      // Mock scenario analysis
      const baseValue = 312000;
      const adjustedValue = baseValue * (1 + (adjustments?.growthRate || 0) / 100);
      
      return NextResponse.json({
        success: true,
        data: {
          scenario: scenarioType || 'custom',
          baselineValue: baseValue,
          adjustedValue: Math.round(adjustedValue),
          difference: Math.round(adjustedValue - baseValue),
          percentChange: ((adjustedValue - baseValue) / baseValue * 100).toFixed(1) + '%',
          assumptions: adjustments,
          confidence: 0.75,
        },
      });
    }

    if (action === 'generate-report') {
      return NextResponse.json({
        success: true,
        data: {
          reportId: `report-${Date.now()}`,
          status: 'generating',
          estimatedTime: '30 seconds',
          type: parameters?.reportType || 'comprehensive',
        },
      });
    }

    if (action === 'export') {
      return NextResponse.json({
        success: true,
        data: {
          downloadUrl: `/api/forecast/export/${Date.now()}`,
          format: parameters?.format || 'xlsx',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });
    }

    if (action === 'refresh-predictions') {
      return NextResponse.json({
        success: true,
        message: 'Predictions refresh initiated',
        data: {
          refreshId: `refresh-${Date.now()}`,
          status: 'processing',
          estimatedCompletion: '2 minutes',
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

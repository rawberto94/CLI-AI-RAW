/**
 * Mock Data for Negotiation Prep
 * 
 * This module provides realistic mock data for negotiation preparation functionality.
 */

import { NegotiationPrepData, NegotiationPrepRequest } from '../../../../packages/data-orchestration/src/types/data-provider.types';

/**
 * Generate mock negotiation prep data
 */
export function generateNegotiationPrepMock(
  request?: NegotiationPrepRequest
): NegotiationPrepData {
  const contractId = request?.contractId || `CNT${Math.floor(Math.random() * 1000)}`;
  const supplierId = request?.supplierId || `SUP${Math.floor(Math.random() * 100)}`;
  const category = request?.category || getRandomCategory();
  
  return {
    leveragePoints: generateLeveragePoints(category),
    marketPosition: generateMarketPosition(),
    historicalPerformance: generateHistoricalPerformance(),
    recommendations: generateRecommendations(category)
  };
}

/**
 * Generate leverage points
 */
function generateLeveragePoints(category: string): Array<{
  type: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}> {
  const leveragePoints = [
    {
      type: 'Volume Commitment',
      description: 'Increasing contract volume by 30% could justify 12-15% rate reduction',
      impact: 'high' as const
    },
    {
      type: 'Market Competition',
      description: '3 alternative suppliers offering similar services at 8-10% lower rates',
      impact: 'high' as const
    },
    {
      type: 'Performance Issues',
      description: 'Supplier missed 15% of delivery deadlines in past 6 months',
      impact: 'medium' as const
    },
    {
      type: 'Contract Duration',
      description: 'Extending contract from 12 to 36 months provides negotiation leverage',
      impact: 'medium' as const
    },
    {
      type: 'Payment Terms',
      description: 'Current 30-day payment terms; supplier prefers 15-day for cash flow',
      impact: 'low' as const
    },
    {
      type: 'Scope Consolidation',
      description: 'Consolidating 3 separate contracts into single MSA',
      impact: 'high' as const
    },
    {
      type: 'Industry Trends',
      description: 'Market rates for this category declining 5% year-over-year',
      impact: 'medium' as const
    },
    {
      type: 'Relationship History',
      description: '5-year partnership with consistent growth trajectory',
      impact: 'low' as const
    }
  ];
  
  // Return 4-6 random leverage points
  const count = Math.floor(Math.random() * 3) + 4;
  return shuffleArray(leveragePoints).slice(0, count);
}

/**
 * Generate market position data
 */
function generateMarketPosition(): {
  supplierRank: number;
  totalSuppliers: number;
  marketShare: number;
} {
  const totalSuppliers = Math.floor(Math.random() * 20) + 10;
  const supplierRank = Math.floor(Math.random() * totalSuppliers) + 1;
  const marketShare = Math.random() * 0.3 + 0.05; // 5-35%
  
  return {
    supplierRank,
    totalSuppliers,
    marketShare: Math.round(marketShare * 1000) / 10 // Percentage with 1 decimal
  };
}

/**
 * Generate historical performance data
 */
function generateHistoricalPerformance(): Array<{
  metric: string;
  current: number;
  benchmark: number;
  trend: 'improving' | 'stable' | 'declining';
}> {
  const metrics = [
    { name: 'On-Time Delivery', current: 85, benchmark: 90 },
    { name: 'Quality Score', current: 92, benchmark: 88 },
    { name: 'Cost per Unit', current: 105, benchmark: 100 },
    { name: 'Response Time (hours)', current: 4, benchmark: 6 },
    { name: 'Customer Satisfaction', current: 4.2, benchmark: 4.0 },
    { name: 'Innovation Index', current: 78, benchmark: 75 }
  ];
  
  return metrics.map(metric => ({
    metric: metric.name,
    current: metric.current,
    benchmark: metric.benchmark,
    trend: determineTrend(metric.current, metric.benchmark)
  }));
}

/**
 * Determine trend based on current vs benchmark
 */
function determineTrend(current: number, benchmark: number): 'improving' | 'stable' | 'declining' {
  const diff = ((current - benchmark) / benchmark) * 100;
  
  if (Math.abs(diff) < 3) return 'stable';
  return diff > 0 ? 'improving' : 'declining';
}

/**
 * Generate recommendations
 */
function generateRecommendations(category: string): Array<{
  action: string;
  rationale: string;
  expectedSavings: number;
}> {
  const recommendations = [
    {
      action: 'Negotiate volume-based tiered pricing',
      rationale: 'Historical data shows 25% volume increase over next 12 months',
      expectedSavings: 150000
    },
    {
      action: 'Request performance-based pricing adjustments',
      rationale: 'Supplier missed 15% of SLA targets in past 6 months',
      expectedSavings: 75000
    },
    {
      action: 'Extend contract term for rate reduction',
      rationale: 'Market analysis shows 8-12% savings for 3-year commitments',
      expectedSavings: 200000
    },
    {
      action: 'Consolidate multiple contracts',
      rationale: 'Administrative overhead reduction and volume leverage',
      expectedSavings: 50000
    },
    {
      action: 'Benchmark against market rates',
      rationale: 'Current rates 10% above market average for similar services',
      expectedSavings: 180000
    },
    {
      action: 'Introduce competitive bidding clause',
      rationale: 'Creates ongoing pressure for competitive pricing',
      expectedSavings: 100000
    }
  ];
  
  // Return 3-5 recommendations
  const count = Math.floor(Math.random() * 3) + 3;
  return shuffleArray(recommendations).slice(0, count);
}

/**
 * Get random category
 */
function getRandomCategory(): string {
  const categories = [
    'Software Development',
    'IT Services',
    'Consulting',
    'Cloud Services',
    'Professional Services',
    'Managed Services'
  ];
  return categories[Math.floor(Math.random() * categories.length)];
}

/**
 * Shuffle array utility
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Predefined scenarios
 */
export const negotiationPrepScenarios = {
  strongPosition: (): NegotiationPrepData => ({
    leveragePoints: [
      {
        type: 'Volume Commitment',
        description: 'Doubling contract volume provides significant leverage',
        impact: 'high'
      },
      {
        type: 'Market Competition',
        description: 'Multiple competitive alternatives available',
        impact: 'high'
      },
      {
        type: 'Performance Issues',
        description: 'Supplier has consistent delivery problems',
        impact: 'high'
      }
    ],
    marketPosition: {
      supplierRank: 8,
      totalSuppliers: 15,
      marketShare: 12.5
    },
    historicalPerformance: [
      {
        metric: 'On-Time Delivery',
        current: 75,
        benchmark: 90,
        trend: 'declining'
      },
      {
        metric: 'Quality Score',
        current: 82,
        benchmark: 88,
        trend: 'declining'
      }
    ],
    recommendations: [
      {
        action: 'Demand 15% rate reduction',
        rationale: 'Performance issues and competitive market',
        expectedSavings: 300000
      },
      {
        action: 'Include performance penalties',
        rationale: 'Protect against continued poor performance',
        expectedSavings: 0
      }
    ]
  }),
  
  weakPosition: (): NegotiationPrepData => ({
    leveragePoints: [
      {
        type: 'Relationship History',
        description: 'Long-term partnership with mutual benefits',
        impact: 'low'
      },
      {
        type: 'Specialized Services',
        description: 'Supplier has unique capabilities',
        impact: 'low'
      }
    ],
    marketPosition: {
      supplierRank: 1,
      totalSuppliers: 5,
      marketShare: 45.0
    },
    historicalPerformance: [
      {
        metric: 'On-Time Delivery',
        current: 98,
        benchmark: 90,
        trend: 'improving'
      },
      {
        metric: 'Quality Score',
        current: 95,
        benchmark: 88,
        trend: 'improving'
      }
    ],
    recommendations: [
      {
        action: 'Focus on value-added services',
        rationale: 'Limited pricing leverage due to supplier dominance',
        expectedSavings: 25000
      },
      {
        action: 'Negotiate improved payment terms',
        rationale: 'Non-price concessions may be more achievable',
        expectedSavings: 15000
      }
    ]
  }),
  
  balanced: (): NegotiationPrepData => generateNegotiationPrepMock()
};

export const sampleNegotiationPrepRequests: NegotiationPrepRequest[] = [
  { contractId: 'CNT001', supplierId: 'SUP001', category: 'Software Development' },
  { contractId: 'CNT002', category: 'IT Services' },
  { supplierId: 'SUP003' }
];

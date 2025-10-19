/**
 * Mock Data for Savings Pipeline
 * 
 * This module provides realistic mock data for savings pipeline functionality.
 */

import { SavingsPipelineData, SavingsPipelineRequest } from '../../../../packages/data-orchestration/src/types/data-provider.types';

/**
 * Generate mock savings pipeline data
 */
export function generateSavingsPipelineMock(
  request?: SavingsPipelineRequest
): SavingsPipelineData {
  const opportunities = generateOpportunities(request);
  
  return {
    opportunities,
    pipeline: calculatePipeline(opportunities),
    trends: generateTrends()
  };
}

/**
 * Generate savings opportunities
 */
function generateOpportunities(request?: SavingsPipelineRequest): Array<{
  id: string;
  title: string;
  category: string;
  potentialSavings: number;
  probability: number;
  timeToRealize: number;
  status: 'identified' | 'in_progress' | 'realized' | 'closed';
}> {
  const categories = [
    'Rate Optimization',
    'Contract Consolidation',
    'Volume Discounts',
    'Process Improvement',
    'Supplier Rationalization',
    'Technology Optimization',
    'Payment Terms',
    'Scope Reduction'
  ];
  
  const statuses: Array<'identified' | 'in_progress' | 'realized' | 'closed'> = [
    'identified',
    'in_progress',
    'realized',
    'closed'
  ];
  
  const opportunityTemplates = [
    {
      title: 'Renegotiate software development rates',
      category: 'Rate Optimization',
      savingsRange: [100000, 500000],
      probabilityRange: [0.6, 0.9],
      timeRange: [3, 6]
    },
    {
      title: 'Consolidate cloud service providers',
      category: 'Contract Consolidation',
      savingsRange: [200000, 800000],
      probabilityRange: [0.5, 0.8],
      timeRange: [6, 12]
    },
    {
      title: 'Implement volume-based pricing tiers',
      category: 'Volume Discounts',
      savingsRange: [50000, 300000],
      probabilityRange: [0.7, 0.95],
      timeRange: [2, 4]
    },
    {
      title: 'Automate manual procurement processes',
      category: 'Process Improvement',
      savingsRange: [75000, 250000],
      probabilityRange: [0.6, 0.85],
      timeRange: [4, 8]
    },
    {
      title: 'Reduce supplier base by 30%',
      category: 'Supplier Rationalization',
      savingsRange: [150000, 600000],
      probabilityRange: [0.5, 0.75],
      timeRange: [6, 12]
    },
    {
      title: 'Migrate to cloud-native architecture',
      category: 'Technology Optimization',
      savingsRange: [300000, 1000000],
      probabilityRange: [0.4, 0.7],
      timeRange: [12, 24]
    },
    {
      title: 'Negotiate extended payment terms',
      category: 'Payment Terms',
      savingsRange: [25000, 100000],
      probabilityRange: [0.8, 0.95],
      timeRange: [1, 3]
    },
    {
      title: 'Eliminate redundant service contracts',
      category: 'Scope Reduction',
      savingsRange: [80000, 350000],
      probabilityRange: [0.7, 0.9],
      timeRange: [3, 6]
    },
    {
      title: 'Benchmark and adjust consulting rates',
      category: 'Rate Optimization',
      savingsRange: [120000, 450000],
      probabilityRange: [0.6, 0.85],
      timeRange: [2, 5]
    },
    {
      title: 'Implement shared services model',
      category: 'Process Improvement',
      savingsRange: [200000, 700000],
      probabilityRange: [0.5, 0.75],
      timeRange: [8, 16]
    }
  ];
  
  // Filter by category if specified
  let filteredTemplates = opportunityTemplates;
  if (request?.category) {
    filteredTemplates = opportunityTemplates.filter(t => t.category === request.category);
  }
  
  // Generate 8-15 opportunities
  const count = Math.floor(Math.random() * 8) + 8;
  const opportunities = [];
  
  for (let i = 0; i < count; i++) {
    const template = filteredTemplates[i % filteredTemplates.length];
    const status = request?.status as typeof statuses[number] || 
                   statuses[Math.floor(Math.random() * statuses.length)];
    
    opportunities.push({
      id: `OPP${String(i + 1).padStart(3, '0')}`,
      title: template.title,
      category: template.category,
      potentialSavings: Math.floor(
        Math.random() * (template.savingsRange[1] - template.savingsRange[0]) + 
        template.savingsRange[0]
      ),
      probability: Math.round(
        (Math.random() * (template.probabilityRange[1] - template.probabilityRange[0]) + 
        template.probabilityRange[0]) * 100
      ) / 100,
      timeToRealize: Math.floor(
        Math.random() * (template.timeRange[1] - template.timeRange[0]) + 
        template.timeRange[0]
      ),
      status
    });
  }
  
  return opportunities;
}

/**
 * Calculate pipeline summary
 */
function calculatePipeline(opportunities: Array<{
  category: string;
  potentialSavings: number;
  probability: number;
  status: string;
}>): {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
} {
  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let total = 0;
  
  opportunities.forEach(opp => {
    const weightedSavings = opp.potentialSavings * opp.probability;
    total += weightedSavings;
    
    byStatus[opp.status] = (byStatus[opp.status] || 0) + weightedSavings;
    byCategory[opp.category] = (byCategory[opp.category] || 0) + weightedSavings;
  });
  
  return {
    total: Math.round(total),
    byStatus,
    byCategory
  };
}

/**
 * Generate trend data
 */
function generateTrends(): Array<{
  period: string;
  identified: number;
  realized: number;
}> {
  const trends = [];
  let cumulativeIdentified = 0;
  let cumulativeRealized = 0;
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const period = date.toISOString().substring(0, 7);
    
    // Simulate growing pipeline
    const newIdentified = Math.floor(Math.random() * 500000) + 200000;
    const newRealized = Math.floor(Math.random() * 300000) + 100000;
    
    cumulativeIdentified += newIdentified;
    cumulativeRealized += newRealized;
    
    trends.push({
      period,
      identified: cumulativeIdentified,
      realized: cumulativeRealized
    });
  }
  
  return trends;
}

/**
 * Predefined scenarios
 */
export const savingsPipelineScenarios = {
  healthy: (): SavingsPipelineData => {
    const opportunities = [
      {
        id: 'OPP001',
        title: 'Renegotiate top supplier contracts',
        category: 'Rate Optimization',
        potentialSavings: 500000,
        probability: 0.85,
        timeToRealize: 3,
        status: 'in_progress' as const
      },
      {
        id: 'OPP002',
        title: 'Implement volume discounts',
        category: 'Volume Discounts',
        potentialSavings: 300000,
        probability: 0.90,
        timeToRealize: 2,
        status: 'in_progress' as const
      },
      {
        id: 'OPP003',
        title: 'Consolidate suppliers',
        category: 'Supplier Rationalization',
        potentialSavings: 400000,
        probability: 0.70,
        timeToRealize: 6,
        status: 'identified' as const
      }
    ];
    
    return {
      opportunities,
      pipeline: calculatePipeline(opportunities),
      trends: generateTrends()
    };
  },
  
  struggling: (): SavingsPipelineData => {
    const opportunities = [
      {
        id: 'OPP001',
        title: 'Minor process improvements',
        category: 'Process Improvement',
        potentialSavings: 50000,
        probability: 0.60,
        timeToRealize: 6,
        status: 'identified' as const
      },
      {
        id: 'OPP002',
        title: 'Payment terms adjustment',
        category: 'Payment Terms',
        potentialSavings: 25000,
        probability: 0.50,
        timeToRealize: 4,
        status: 'identified' as const
      }
    ];
    
    return {
      opportunities,
      pipeline: calculatePipeline(opportunities),
      trends: generateTrends()
    };
  },
  
  aggressive: (): SavingsPipelineData => generateSavingsPipelineMock()
};

export const sampleSavingsPipelineRequests: SavingsPipelineRequest[] = [
  { timeframe: '12months' },
  { category: 'Rate Optimization', status: 'in_progress' },
  { timeframe: '6months', status: 'identified' }
];

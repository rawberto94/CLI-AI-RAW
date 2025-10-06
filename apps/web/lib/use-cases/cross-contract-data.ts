/**
 * Mock data for Cross-Contract Intelligence use case
 */

export const mockCrossContractData = {
  portfolioOverview: {
    totalContracts: 47,
    totalValue: 12400000,
    suppliers: 23,
    categories: 8,
    averageContractValue: 263830
  },
  supplierAnalysis: [
    {
      supplier: 'Deloitte',
      contracts: 8,
      totalValue: 3200000,
      categories: ['Professional Services', 'Advisory', 'Tax'],
      averageRate: 165,
      marketRate: 156,
      variance: 5.8,
      leverage: 'High' as const,
      consolidationOpportunity: 384000
    },
    {
      supplier: 'Accenture',
      contracts: 6,
      totalValue: 2800000,
      categories: ['Professional Services', 'Technology'],
      averageRate: 158,
      marketRate: 152,
      variance: 3.9,
      leverage: 'High' as const,
      consolidationOpportunity: 280000
    },
    {
      supplier: 'KPMG',
      contracts: 5,
      totalValue: 1900000,
      categories: ['Advisory', 'Audit', 'Tax'],
      averageRate: 152,
      marketRate: 145,
      variance: 4.8,
      leverage: 'Medium' as const,
      consolidationOpportunity: 190000
    },
    {
      supplier: 'PwC',
      contracts: 4,
      totalValue: 1600000,
      categories: ['Advisory', 'Tax'],
      averageRate: 148,
      marketRate: 142,
      variance: 4.2,
      leverage: 'Medium' as const,
      consolidationOpportunity: 128000
    }
  ],
  bundlingOpportunities: [
    {
      type: 'Supplier Consolidation' as const,
      description: 'Consolidate Deloitte contracts into master agreement',
      contracts: 8,
      currentValue: 3200000,
      potentialSavings: 384000,
      savingsPercentage: 12,
      implementation: '6-9 months',
      confidence: 85
    },
    {
      type: 'Volume Discount' as const,
      description: 'Leverage combined Accenture volume for better rates',
      contracts: 6,
      currentValue: 2800000,
      potentialSavings: 280000,
      savingsPercentage: 10,
      implementation: '3-6 months',
      confidence: 90
    },
    {
      type: 'Category Bundling' as const,
      description: 'Bundle all tax services across suppliers',
      contracts: 12,
      currentValue: 1800000,
      potentialSavings: 216000,
      savingsPercentage: 12,
      implementation: '6-12 months',
      confidence: 75
    }
  ],
  marketIntelligence: {
    industryTrends: [
      'Professional services rates declining 3-5% YoY',
      'Increased adoption of outcome-based pricing models',
      'Growing preference for hybrid onshore/offshore delivery',
      'Rising demand for specialized AI/ML expertise'
    ],
    competitiveInsights: [
      'Top 3 suppliers control 65% of market share',
      'Average contract length trending toward 2-3 years',
      'Volume discounts typically 8-15% for multi-year deals',
      'Performance-based pricing gaining traction'
    ],
    recommendations: [
      'Consolidate to 2-3 strategic suppliers for maximum leverage',
      'Negotiate master agreements with volume commitments',
      'Implement performance-based pricing where possible',
      'Consider offshore/nearshore options for cost optimization',
      'Standardize contract terms across similar engagements'
    ]
  },
  relationshipMap: {
    nodes: [
      { id: 'deloitte', label: 'Deloitte', type: 'supplier', value: 3200000, contracts: 8 },
      { id: 'accenture', label: 'Accenture', type: 'supplier', value: 2800000, contracts: 6 },
      { id: 'kpmg', label: 'KPMG', type: 'supplier', value: 1900000, contracts: 5 },
      { id: 'pwc', label: 'PwC', type: 'supplier', value: 1600000, contracts: 4 },
      { id: 'prof-services', label: 'Professional Services', type: 'category', value: 6800000 },
      { id: 'advisory', label: 'Advisory', type: 'category', value: 3200000 },
      { id: 'tax', label: 'Tax Services', type: 'category', value: 1800000 }
    ],
    edges: [
      { from: 'deloitte', to: 'prof-services', value: 2400000 },
      { from: 'deloitte', to: 'advisory', value: 600000 },
      { from: 'deloitte', to: 'tax', value: 200000 },
      { from: 'accenture', to: 'prof-services', value: 2200000 },
      { from: 'accenture', to: 'advisory', value: 600000 },
      { from: 'kpmg', to: 'advisory', value: 1000000 },
      { from: 'kpmg', to: 'tax', value: 900000 },
      { from: 'pwc', to: 'advisory', value: 1000000 },
      { from: 'pwc', to: 'tax', value: 600000 }
    ]
  }
}

export const queryExamples = [
  'Show all contracts with Deloitte',
  'What are our highest value contracts?',
  'Which suppliers have auto-renewal clauses?',
  'Find contracts expiring in the next 90 days',
  'Compare rates across all professional services contracts',
  'Show me contracts with compliance issues'
]

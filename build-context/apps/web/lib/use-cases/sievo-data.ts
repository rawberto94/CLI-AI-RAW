/**
 * Mock data for Sievo Integration use case
 */

export const mockSievoData = {
  categories: [
    {
      name: 'Professional Services',
      spend: 4200000,
      contractedRate: 165,
      actualRate: 178,
      variance: 7.9,
      opportunity: 520000,
      suppliers: 8,
      transactions: 1247
    },
    {
      name: 'Software Licenses',
      spend: 1800000,
      contractedRate: null,
      actualRate: null,
      variance: 0,
      opportunity: 270000,
      suppliers: 12,
      transactions: 48
    },
    {
      name: 'Cloud Services',
      spend: 980000,
      contractedRate: null,
      actualRate: null,
      variance: 0,
      opportunity: 147000,
      suppliers: 3,
      transactions: 365
    },
    {
      name: 'Marketing Services',
      spend: 720000,
      contractedRate: 125,
      actualRate: 138,
      variance: 10.4,
      opportunity: 93600,
      suppliers: 15,
      transactions: 284
    }
  ],
  totalOpportunity: 1030600,
  spendVsContract: {
    aligned: 5900000,
    unaligned: 1800000,
    coverage: 76.6
  },
  topPriorities: [
    {
      priority: 1,
      category: 'Professional Services',
      issue: 'Actual rates 7.9% above contracted rates',
      action: 'Enforce rate card compliance and investigate overages',
      savings: 520000
    },
    {
      priority: 2,
      category: 'Software Licenses',
      issue: 'No contract coverage for $1.8M in software spend',
      action: 'Negotiate enterprise agreements for top software vendors',
      savings: 270000
    },
    {
      priority: 3,
      category: 'Cloud Services',
      issue: 'Fragmented spend across multiple providers',
      action: 'Consolidate cloud services and negotiate volume discounts',
      savings: 147000
    }
  ],
  supplierSpend: [
    { supplier: 'Deloitte', spend: 1850000, contracts: 8, variance: 8.2 },
    { supplier: 'Accenture', spend: 1420000, contracts: 6, variance: 6.5 },
    { supplier: 'Microsoft', spend: 890000, contracts: 3, variance: 0 },
    { supplier: 'AWS', spend: 680000, contracts: 2, variance: 0 },
    { supplier: 'KPMG', spend: 620000, contracts: 5, variance: 7.1 }
  ]
}

export const integrationSteps = [
  { step: 1, title: 'Connect to Sievo', description: 'Authenticate and establish data connection', duration: '2 min' },
  { step: 2, title: 'Import Spend Data', description: 'Pull category spend and transaction data', duration: '5 min' },
  { step: 3, title: 'Map to Contracts', description: 'Match spend data with contract terms', duration: '3 min' },
  { step: 4, title: 'Analyze Variances', description: 'Identify spend vs contract discrepancies', duration: '2 min' },
  { step: 5, title: 'Generate Insights', description: 'Create actionable recommendations', duration: '1 min' }
]

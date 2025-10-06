/**
 * Mock data for Supplier Snapshot Packs use case
 */

export const mockSupplierData = {
  supplier: 'Deloitte Consulting LLP',
  contracts: 8,
  totalValue: 3200000,
  snapshot: {
    rateAnalysis: {
      average: 165,
      market: 156,
      variance: 5.8,
      roles: [
        { role: 'Partner', current: 295, market: 275, variance: 7.3 },
        { role: 'Senior Manager', current: 225, market: 210, variance: 7.1 },
        { role: 'Manager', current: 185, market: 175, variance: 5.7 },
        { role: 'Senior Consultant', current: 165, market: 156, variance: 5.8 },
        { role: 'Consultant', current: 135, market: 128, variance: 5.5 },
        { role: 'Analyst', current: 105, market: 98, variance: 7.1 }
      ]
    },
    performance: {
      slaCompliance: 94,
      deliveryOnTime: 89,
      qualityScore: 4.2,
      clientSatisfaction: 87,
      responsiveness: 92
    },
    terms: {
      paymentTerms: 'Net 45 days',
      noticePeriod: '60 days',
      autoRenewal: true,
      priceEscalation: '3% annually',
      volumeDiscount: 'None',
      performanceIncentives: 'None'
    },
    leverage: {
      level: 'High' as const,
      factors: [
        'Multiple active contracts ($3.2M total)',
        'Significant annual spend',
        'Long-term relationship (5+ years)',
        'Alternative suppliers available',
        'Market rates trending down'
      ]
    },
    spend: {
      lastYear: 2800000,
      thisYear: 3200000,
      growth: 14.3,
      forecast: 3400000
    }
  },
  negotiationTalkingPoints: [
    {
      category: 'Pricing' as const,
      point: 'Rates 5.8% above market median',
      data: 'Market analysis shows median rate of $156/hr vs current $165/hr',
      target: 'Reduce rates to market median for 5.8% savings ($186K annually)',
      leverage: 'High - multiple alternative suppliers available'
    },
    {
      category: 'Volume' as const,
      point: 'No volume discount despite $3.2M annual spend',
      data: 'Industry standard: 8-12% discount for $3M+ annual commitments',
      target: 'Negotiate 10% volume discount ($320K savings)',
      leverage: 'High - can consolidate spend with single supplier'
    },
    {
      category: 'Terms' as const,
      point: 'Payment terms less favorable than market',
      data: 'Current Net 45 vs market standard Net 60',
      target: 'Extend payment terms to Net 60 (cash flow benefit)',
      leverage: 'Medium - standard market practice'
    },
    {
      category: 'Performance' as const,
      point: 'No performance incentives in current contract',
      data: 'SLA compliance at 94%, on-time delivery at 89%',
      target: 'Add performance bonuses/penalties tied to SLAs',
      leverage: 'Medium - aligns interests and improves outcomes'
    }
  ],
  recommendations: [
    'Target 8-10% rate reduction to align with market',
    'Negotiate volume discount for multi-year commitment',
    'Improve payment terms from Net 45 to Net 60',
    'Add performance incentives tied to SLA compliance',
    'Include quarterly rate reviews based on market conditions',
    'Consolidate contracts into single master agreement',
    'Add termination for convenience clause',
    'Negotiate IP ownership terms'
  ],
  alternativeSuppliers: [
    {
      name: 'Accenture',
      averageRate: 158,
      strengths: ['Technology expertise', 'Global delivery'],
      weaknesses: ['Higher rates for specialized roles']
    },
    {
      name: 'KPMG',
      averageRate: 152,
      strengths: ['Competitive pricing', 'Industry knowledge'],
      weaknesses: ['Smaller team size']
    },
    {
      name: 'PwC',
      averageRate: 148,
      strengths: ['Strong advisory practice', 'Good rates'],
      weaknesses: ['Limited technology capabilities']
    }
  ]
}

export const snapshotSections = [
  { id: 'executive-summary', label: 'Executive Summary', icon: 'FileText' },
  { id: 'rate-analysis', label: 'Rate Analysis', icon: 'DollarSign' },
  { id: 'performance', label: 'Performance Metrics', icon: 'TrendingUp' },
  { id: 'contract-terms', label: 'Contract Terms', icon: 'FileCheck' },
  { id: 'negotiation', label: 'Negotiation Strategy', icon: 'Target' },
  { id: 'alternatives', label: 'Alternative Suppliers', icon: 'Users' }
]

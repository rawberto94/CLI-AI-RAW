/**
 * Mock data for Contract Renewal Radar use case
 */

export const mockRenewalData = {
  upcomingRenewals: [
    {
      id: 'REN-001',
      contract: 'Deloitte Master Service Agreement',
      supplier: 'Deloitte Consulting LLP',
      expiryDate: '2024-06-30',
      value: 750000,
      daysRemaining: 45,
      autoRenewal: true,
      riskLevel: 'High' as const,
      savingsOpportunity: 112500,
      currentRate: 175,
      marketRate: 156,
      category: 'Professional Services'
    },
    {
      id: 'REN-002',
      contract: 'Accenture SOW - Digital Transformation',
      supplier: 'Accenture',
      expiryDate: '2024-08-15',
      value: 520000,
      daysRemaining: 90,
      autoRenewal: false,
      riskLevel: 'Medium' as const,
      savingsOpportunity: 62400,
      currentRate: 165,
      marketRate: 152,
      category: 'Professional Services'
    },
    {
      id: 'REN-003',
      contract: 'KPMG Advisory Services',
      supplier: 'KPMG',
      expiryDate: '2024-09-30',
      value: 380000,
      daysRemaining: 135,
      autoRenewal: true,
      riskLevel: 'Medium' as const,
      savingsOpportunity: 45600,
      currentRate: 158,
      marketRate: 145,
      category: 'Professional Services'
    },
    {
      id: 'REN-004',
      contract: 'PwC Tax Compliance',
      supplier: 'PwC',
      expiryDate: '2024-12-31',
      value: 290000,
      daysRemaining: 227,
      autoRenewal: false,
      riskLevel: 'Low' as const,
      savingsOpportunity: 23200,
      currentRate: 142,
      marketRate: 135,
      category: 'Professional Services'
    }
  ],
  totalAtRisk: 4200000,
  averageSavings: 18,
  alerts: [
    {
      type: 'Critical' as const,
      message: 'Deloitte MSA auto-renews in 45 days - immediate action required',
      action: 'Submit termination notice or begin renegotiation',
      deadline: '2024-05-15'
    },
    {
      type: 'High' as const,
      message: 'Accenture SOW expires in 90 days - negotiation window closing',
      action: 'Prepare negotiation strategy and benchmark data',
      deadline: '2024-06-01'
    },
    {
      type: 'Medium' as const,
      message: 'KPMG contract has auto-renewal clause - review terms',
      action: 'Assess performance and market alternatives',
      deadline: '2024-07-01'
    }
  ],
  negotiationPack: {
    benchmarkData: {
      seniorConsultant: { current: 175, market: 156, variance: 12.2 },
      consultant: { current: 145, market: 135, variance: 7.4 },
      analyst: { current: 115, market: 108, variance: 6.5 }
    },
    performanceMetrics: {
      slaCompliance: 94,
      deliveryOnTime: 89,
      qualityScore: 4.2,
      clientSatisfaction: 87
    },
    recommendations: [
      'Target 12% rate reduction to align with market median',
      'Negotiate volume discount for multi-year commitment',
      'Add performance incentives tied to SLA compliance',
      'Improve payment terms from Net 45 to Net 60',
      'Include quarterly rate reviews based on market conditions'
    ]
  }
}

export const renewalTimeline = [
  { week: 1, milestone: 'Gather contract data and performance metrics', status: 'completed' as const },
  { week: 2, milestone: 'Conduct market research and benchmarking', status: 'completed' as const },
  { week: 3, milestone: 'Develop negotiation strategy', status: 'in-progress' as const },
  { week: 4, milestone: 'Prepare negotiation materials', status: 'pending' as const },
  { week: 5, milestone: 'Engage supplier for renewal discussions', status: 'pending' as const },
  { week: 6, milestone: 'Negotiate terms and finalize agreement', status: 'pending' as const }
]

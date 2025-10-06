/**
 * Mock data for Savings Pipeline Tracker use case
 */

export const mockSavingsPipelineData = {
  summary: {
    identified: 3200000,
    inProgress: 1800000,
    realized: 890000,
    totalOpportunities: 24,
    averageOpportunitySize: 133333,
    expectedValue: 2560000 // Probability-weighted
  },
  opportunities: [
    {
      id: 'SAV-001',
      title: 'Deloitte Rate Optimization',
      category: 'Rate Negotiation' as const,
      value: 890000,
      probability: 85,
      expectedValue: 756500,
      status: 'In Negotiation' as const,
      owner: 'Sarah Chen',
      startDate: '2024-02-01',
      targetDate: '2024-05-15',
      progress: 65,
      nextSteps: ['Finalize rate card', 'Review contract amendments', 'Obtain approvals']
    },
    {
      id: 'SAV-002',
      title: 'Accenture Volume Discount',
      category: 'Volume Bundling' as const,
      value: 520000,
      probability: 90,
      expectedValue: 468000,
      status: 'In Negotiation' as const,
      owner: 'Michael Torres',
      startDate: '2024-01-15',
      targetDate: '2024-04-30',
      progress: 75,
      nextSteps: ['Sign master agreement', 'Consolidate SOWs']
    },
    {
      id: 'SAV-003',
      title: 'KPMG Contract Consolidation',
      category: 'Supplier Consolidation' as const,
      value: 380000,
      probability: 75,
      expectedValue: 285000,
      status: 'Analysis' as const,
      owner: 'Jennifer Liu',
      startDate: '2024-03-01',
      targetDate: '2024-08-31',
      progress: 30,
      nextSteps: ['Complete spend analysis', 'Develop consolidation strategy', 'Engage supplier']
    },
    {
      id: 'SAV-004',
      title: 'PwC Payment Terms Improvement',
      category: 'Terms Optimization' as const,
      value: 290000,
      probability: 80,
      expectedValue: 232000,
      status: 'In Negotiation' as const,
      owner: 'David Park',
      startDate: '2024-02-15',
      targetDate: '2024-05-30',
      progress: 50,
      nextSteps: ['Negotiate payment terms', 'Update contract']
    },
    {
      id: 'SAV-005',
      title: 'Software License Optimization',
      category: 'License Optimization' as const,
      value: 450000,
      probability: 70,
      expectedValue: 315000,
      status: 'Identified' as const,
      owner: 'Emily Rodriguez',
      startDate: '2024-03-15',
      targetDate: '2024-09-30',
      progress: 15,
      nextSteps: ['Conduct usage analysis', 'Identify unused licenses', 'Negotiate reduction']
    },
    {
      id: 'SAV-006',
      title: 'Cloud Services Right-Sizing',
      category: 'Spend Optimization' as const,
      value: 320000,
      probability: 85,
      expectedValue: 272000,
      status: 'In Progress' as const,
      owner: 'Alex Kumar',
      startDate: '2024-01-01',
      targetDate: '2024-06-30',
      progress: 60,
      nextSteps: ['Implement recommendations', 'Monitor savings']
    },
    {
      id: 'SAV-007',
      title: 'Supplier Diversity Initiative',
      category: 'Alternative Sourcing' as const,
      value: 280000,
      probability: 65,
      expectedValue: 182000,
      status: 'Identified' as const,
      owner: 'Maria Santos',
      startDate: '2024-04-01',
      targetDate: '2024-12-31',
      progress: 10,
      nextSteps: ['Identify alternative suppliers', 'Conduct RFP', 'Evaluate proposals']
    },
    {
      id: 'SAV-008',
      title: 'Contract Auto-Renewal Prevention',
      category: 'Risk Mitigation' as const,
      value: 180000,
      probability: 95,
      expectedValue: 171000,
      status: 'Realized' as const,
      owner: 'James Wilson',
      startDate: '2024-01-01',
      targetDate: '2024-03-31',
      progress: 100,
      nextSteps: ['Document lessons learned']
    }
  ],
  categoryBreakdown: [
    { category: 'Rate Negotiation', value: 1340000, percentage: 41.9, opportunities: 6 },
    { category: 'Volume Bundling', value: 820000, percentage: 25.6, opportunities: 4 },
    { category: 'Supplier Consolidation', value: 580000, percentage: 18.1, opportunities: 3 },
    { category: 'License Optimization', value: 450000, percentage: 14.1, opportunities: 2 },
    { category: 'Terms Optimization', value: 290000, percentage: 9.1, opportunities: 3 },
    { category: 'Spend Optimization', value: 320000, percentage: 10.0, opportunities: 2 },
    { category: 'Alternative Sourcing', value: 280000, percentage: 8.8, opportunities: 2 },
    { category: 'Risk Mitigation', value: 180000, percentage: 5.6, opportunities: 2 }
  ],
  timeline: [
    { month: 'Jan', identified: 800000, inProgress: 400000, realized: 150000 },
    { month: 'Feb', identified: 1200000, inProgress: 800000, realized: 320000 },
    { month: 'Mar', identified: 1800000, inProgress: 1200000, realized: 580000 },
    { month: 'Apr', identified: 2400000, inProgress: 1500000, realized: 890000 },
    { month: 'May', identified: 2800000, inProgress: 1800000, realized: 1200000 },
    { month: 'Jun', identified: 3200000, inProgress: 2000000, realized: 1600000 }
  ],
  clientROI: {
    investment: 250000, // Cost of procurement intelligence platform
    realizedSavings: 890000,
    projectedAnnualSavings: 2560000,
    roi: 8.4,
    paybackPeriod: 1.4 // months
  }
}

export const savingsCategories = [
  { value: 'rate-negotiation', label: 'Rate Negotiation', color: '#10B981' },
  { value: 'volume-bundling', label: 'Volume Bundling', color: '#3B82F6' },
  { value: 'supplier-consolidation', label: 'Supplier Consolidation', color: '#8B5CF6' },
  { value: 'license-optimization', label: 'License Optimization', color: '#F59E0B' },
  { value: 'terms-optimization', label: 'Terms Optimization', color: '#EC4899' },
  { value: 'spend-optimization', label: 'Spend Optimization', color: '#14B8A6' },
  { value: 'alternative-sourcing', label: 'Alternative Sourcing', color: '#F97316' },
  { value: 'risk-mitigation', label: 'Risk Mitigation', color: '#6366F1' }
]

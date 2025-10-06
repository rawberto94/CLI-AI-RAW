// Mock database for demo purposes
export interface RateCard {
  id: string;
  supplier: string;
  contractId: string;
  services: {
    name: string;
    currentRate: number;
    marketRate: number;
    savings: number;
    unit: string;
    category: string;
  }[];
  totalSavings: number;
  extractedAt: Date;
  confidence: number;
}

export interface SupplierBenchmark {
  id: string;
  supplier: string;
  category: string;
  avgRate: number;
  marketPosition: 'below' | 'at' | 'above';
  percentile: number;
  contracts: number;
  totalValue: number;
  riskScore: number;
  performanceScore: number;
}

export interface ContractMetrics {
  totalContracts: number;
  totalValue: number;
  avgProcessingTime: number;
  riskReduction: number;
  complianceScore: number;
  costSavingsYTD: number;
}

// Mock data
export const mockRateCards: RateCard[] = [
  {
    id: 'rc-001',
    supplier: 'TechServices Inc.',
    contractId: 'contract-001',
    services: [
      { name: 'Senior Developer', currentRate: 175, marketRate: 150, savings: 25, unit: '/hour', category: 'Development' },
      { name: 'DevOps Engineer', currentRate: 165, marketRate: 140, savings: 25, unit: '/hour', category: 'Infrastructure' },
      { name: 'Project Manager', currentRate: 145, marketRate: 125, savings: 20, unit: '/hour', category: 'Management' },
      { name: 'QA Engineer', currentRate: 125, marketRate: 110, savings: 15, unit: '/hour', category: 'Quality Assurance' }
    ],
    totalSavings: 85,
    extractedAt: new Date('2024-01-15'),
    confidence: 94
  },
  {
    id: 'rc-002',
    supplier: 'CloudSolutions LLC',
    contractId: 'contract-002',
    services: [
      { name: 'Cloud Architect', currentRate: 195, marketRate: 180, savings: 15, unit: '/hour', category: 'Architecture' },
      { name: 'Security Engineer', currentRate: 185, marketRate: 170, savings: 15, unit: '/hour', category: 'Security' },
      { name: 'Data Engineer', currentRate: 155, marketRate: 145, savings: 10, unit: '/hour', category: 'Data' }
    ],
    totalSavings: 40,
    extractedAt: new Date('2024-01-20'),
    confidence: 89
  },
  {
    id: 'rc-003',
    supplier: 'DataPro Systems',
    contractId: 'contract-003',
    services: [
      { name: 'Data Scientist', currentRate: 165, marketRate: 155, savings: 10, unit: '/hour', category: 'Analytics' },
      { name: 'ML Engineer', currentRate: 175, marketRate: 160, savings: 15, unit: '/hour', category: 'Machine Learning' },
      { name: 'Analytics Consultant', currentRate: 145, marketRate: 135, savings: 10, unit: '/hour', category: 'Consulting' }
    ],
    totalSavings: 35,
    extractedAt: new Date('2024-01-25'),
    confidence: 91
  }
];

export const mockSupplierBenchmarks: SupplierBenchmark[] = [
  {
    id: 'sb-001',
    supplier: 'TechServices Inc.',
    category: 'Software Development',
    avgRate: 152.5,
    marketPosition: 'above',
    percentile: 78,
    contracts: 23,
    totalValue: 2400000,
    riskScore: 25,
    performanceScore: 87
  },
  {
    id: 'sb-002',
    supplier: 'CloudSolutions LLC',
    category: 'Infrastructure',
    avgRate: 178.3,
    marketPosition: 'above',
    percentile: 82,
    contracts: 18,
    totalValue: 1800000,
    riskScore: 30,
    performanceScore: 92
  },
  {
    id: 'sb-003',
    supplier: 'DataPro Systems',
    category: 'Analytics',
    avgRate: 161.7,
    marketPosition: 'at',
    percentile: 52,
    contracts: 15,
    totalValue: 1200000,
    riskScore: 20,
    performanceScore: 89
  },
  {
    id: 'sb-004',
    supplier: 'Efficient Solutions',
    category: 'Software Development',
    avgRate: 125.0,
    marketPosition: 'below',
    percentile: 25,
    contracts: 34,
    totalValue: 3200000,
    riskScore: 15,
    performanceScore: 85
  },
  {
    id: 'sb-005',
    supplier: 'Premium Tech Corp',
    category: 'Software Development',
    avgRate: 185.0,
    marketPosition: 'above',
    percentile: 89,
    contracts: 12,
    totalValue: 1500000,
    riskScore: 35,
    performanceScore: 94
  },
  {
    id: 'sb-006',
    supplier: 'Market Leaders Inc',
    category: 'Consulting',
    avgRate: 275.0,
    marketPosition: 'above',
    percentile: 92,
    contracts: 8,
    totalValue: 2800000,
    riskScore: 40,
    performanceScore: 96
  },
  {
    id: 'sb-007',
    supplier: 'Value Partners',
    category: 'Consulting',
    avgRate: 195.0,
    marketPosition: 'at',
    percentile: 48,
    contracts: 28,
    totalValue: 4200000,
    riskScore: 22,
    performanceScore: 88
  }
];

export const mockContractMetrics: ContractMetrics = {
  totalContracts: 1247,
  totalValue: 47200000,
  avgProcessingTime: 2.3,
  riskReduction: 87,
  complianceScore: 98.7,
  costSavingsYTD: 3800000
};

// Helper functions
export function getRateCardsBySupplier(supplier?: string): RateCard[] {
  if (!supplier) return mockRateCards;
  return mockRateCards.filter(rc => rc.supplier.toLowerCase().includes(supplier.toLowerCase()));
}

export function getSupplierBenchmarks(category?: string): SupplierBenchmark[] {
  if (!category) return mockSupplierBenchmarks;
  return mockSupplierBenchmarks.filter(sb => sb.category.toLowerCase().includes(category.toLowerCase()));
}

export function calculateTotalSavingsOpportunity(): number {
  return mockRateCards.reduce((total, rc) => total + (rc.totalSavings * 2000), 0); // Assuming 2000 hours/year
}

export function getTopSavingsOpportunities(limit: number = 5): Array<{supplier: string, savings: number, confidence: number}> {
  return mockRateCards
    .map(rc => ({
      supplier: rc.supplier,
      savings: rc.totalSavings * 2000,
      confidence: rc.confidence
    }))
    .sort((a, b) => b.savings - a.savings)
    .slice(0, limit);
}

export function getSupplierRiskDistribution(): {low: number, medium: number, high: number} {
  const distribution = {low: 0, medium: 0, high: 0};
  mockSupplierBenchmarks.forEach(sb => {
    if (sb.riskScore <= 25) distribution.low++;
    else if (sb.riskScore <= 50) distribution.medium++;
    else distribution.high++;
  });
  return distribution;
}

// Mock contracts data for API compatibility
export interface Contract {
  id: string;
  name: string;
  status: string;
  uploadDate: Date;
  parties: string[];
  contractType: string;
  totalValue?: number;
  riskScore?: number;
  complianceScore?: number;
}

export interface Artifact {
  id: string;
  contractId: string;
  type: string;
  data: any;
  confidence: number;
  createdAt: Date;
}

export interface BusinessInsight {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  value?: number;
}

// Mock contracts
const mockContracts: Contract[] = [
  {
    id: 'contract-001',
    name: 'TechServices Development Agreement',
    status: 'active',
    uploadDate: new Date('2024-01-15'),
    parties: ['TechServices Inc.', 'Your Company'],
    contractType: 'Service Agreement',
    totalValue: 2400000,
    riskScore: 25,
    complianceScore: 94
  },
  {
    id: 'contract-002',
    name: 'CloudSolutions Infrastructure Contract',
    status: 'active',
    uploadDate: new Date('2024-01-20'),
    parties: ['CloudSolutions LLC', 'Your Company'],
    contractType: 'Infrastructure Agreement',
    totalValue: 1800000,
    riskScore: 30,
    complianceScore: 92
  },
  {
    id: 'contract-003',
    name: 'DataPro Analytics Services',
    status: 'active',
    uploadDate: new Date('2024-01-25'),
    parties: ['DataPro Systems', 'Your Company'],
    contractType: 'Analytics Agreement',
    totalValue: 1200000,
    riskScore: 20,
    complianceScore: 89
  }
];

const mockArtifacts: Artifact[] = [
  {
    id: 'artifact-001',
    contractId: 'contract-001',
    type: 'financial',
    data: { totalValue: 2400000, paymentTerms: 'Net 30', currency: 'USD' },
    confidence: 94,
    createdAt: new Date('2024-01-15')
  },
  {
    id: 'artifact-002',
    contractId: 'contract-001',
    type: 'risk',
    data: { riskScore: 25, riskFactors: ['Payment terms', 'Termination clauses'] },
    confidence: 89,
    createdAt: new Date('2024-01-15')
  }
];

const mockBusinessInsights: BusinessInsight[] = [
  {
    id: 'insight-001',
    title: 'Cost Optimization Opportunity',
    description: 'Identified $380K annual savings through rate optimization',
    impact: 'high',
    category: 'Cost Savings',
    value: 380000
  },
  {
    id: 'insight-002',
    title: 'Risk Mitigation Success',
    description: '87% reduction in contract risk through AI analysis',
    impact: 'high',
    category: 'Risk Management'
  },
  {
    id: 'insight-003',
    title: 'Compliance Improvement',
    description: '98.7% compliance score achieved across portfolio',
    impact: 'medium',
    category: 'Compliance'
  }
];

// Mock database object for API compatibility
export const mockDatabase = {
  async getPortfolioMetrics() {
    return mockContractMetrics;
  },

  async getBusinessInsights() {
    return mockBusinessInsights;
  },

  async searchContracts(query: string = '', filters: any = {}) {
    let results = mockContracts;
    
    if (query) {
      results = results.filter(contract => 
        contract.name.toLowerCase().includes(query.toLowerCase()) ||
        contract.parties.some(party => party.toLowerCase().includes(query.toLowerCase()))
      );
    }
    
    return results;
  },

  async getContract(id: string) {
    return mockContracts.find(contract => contract.id === id);
  },

  async createContract(data: Partial<Contract>) {
    const newContract: Contract = {
      id: `contract-${Date.now()}`,
      name: data.name || 'Untitled Contract',
      status: data.status || 'uploaded',
      uploadDate: new Date(),
      parties: data.parties || [],
      contractType: data.contractType || 'Unknown',
      totalValue: data.totalValue,
      riskScore: data.riskScore,
      complianceScore: data.complianceScore
    };
    
    mockContracts.push(newContract);
    return newContract;
  },

  async processContract(id: string) {
    const contract = mockContracts.find(c => c.id === id);
    if (contract) {
      contract.status = 'processed';
      contract.riskScore = Math.floor(Math.random() * 50) + 10;
      contract.complianceScore = Math.floor(Math.random() * 20) + 80;
    }
    return contract;
  },

  async getArtifacts(contractId: string) {
    return mockArtifacts.filter(artifact => artifact.contractId === contractId);
  }
};
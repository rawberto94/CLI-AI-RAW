/**
 * Type definitions for mock data registry
 */

// Rate Card Types
export interface RoleRateData {
  role: string;
  level: string;
  location: string;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  average: number;
  sampleSize: number;
}

export interface TrendData {
  period: string;
  value: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
}

export interface GeographicData {
  region: string;
  country: string;
  averageRate: number;
  sampleSize: number;
  confidence: number;
  costOfLiving: number;
  skillAvailability: 'high' | 'medium' | 'low';
  marketMaturity: 'mature' | 'developing' | 'emerging';
}

// Supplier Types
export interface SupplierOverview {
  supplierId: string;
  supplierName: string;
  tier: 'Big 4' | 'Tier 2' | 'Boutique' | 'Offshore';
  activeContracts: number;
  totalValue: number;
  overallScore: number;
}

export interface SupplierMetrics {
  supplierId: string;
  supplierName: string;
  financialHealth: {
    score: number;
    creditRating: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  performance: {
    deliveryScore: number;
    qualityScore: number;
    responsivenessScore: number;
    overallScore: number;
  };
  contractMetrics: {
    totalValue: number;
    activeContracts: number;
    averageContractValue: number;
    relationshipDuration: number;
  };
}

export interface PerformanceTrendData {
  supplierId: string;
  trends: Array<{
    period: string;
    deliveryScore: number;
    qualityScore: number;
    overallScore: number;
  }>;
}

// Negotiation Types
export interface NegotiationScenario {
  name: string;
  targetReduction: number;
  probability: number;
  implementationRisk: 'low' | 'medium' | 'high';
  timeline: number;
  description: string;
}

export interface LeverageData {
  volumeAdvantage: number;
  relationshipScore: number;
  competitiveAlternatives: number;
  marketPosition: 'strong' | 'moderate' | 'weak';
}

// Savings Types
export interface SavingsOpportunity {
  id: string;
  title: string;
  category: string;
  value: number;
  probability: number;
  expectedValue: number;
  status: 'identified' | 'in_progress' | 'realized';
  progress: number;
  targetDate: Date;
  owner: string;
  nextSteps: string[];
}

export interface SavingsPipelineOverview {
  summary: {
    totalIdentified: number;
    totalInProgress: number;
    totalRealized: number;
    conversionRate: number;
  };
  byCategory: Array<{
    category: string;
    value: number;
    opportunities: number;
  }>;
  timeline: Array<{
    month: string;
    identified: number;
    inProgress: number;
    realized: number;
  }>;
}

export interface ROIMetrics {
  roi: number;
  realizedSavings: number;
  projectedAnnualSavings: number;
  paybackPeriod: number;
}

// Renewal Types
export interface RenewalContract {
  contractId: string;
  contractName: string;
  supplier: string;
  value: number;
  endDate: Date;
  daysRemaining: number;
  autoRenewal: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  savingsOpportunity: number;
}

export interface RenewalAlert {
  type: 'Critical' | 'High' | 'Medium';
  message: string;
  action: string;
  deadline: string;
}

export interface RenewalPack {
  contractId: string;
  summary: {
    currentRate: number;
    marketRate: number;
    potentialSavings: number;
  };
  benchmarkData: Record<string, any>;
  performanceMetrics: Record<string, any>;
  recommendations: string[];
}

// Mock Data Registry
export interface MockDataRegistry {
  rateCards: {
    roles: RoleRateData[];
    trends: TrendData[];
    geographic: GeographicData[];
  };
  suppliers: {
    overview: SupplierOverview[];
    metrics: Record<string, SupplierMetrics>;
    performance: Record<string, PerformanceTrendData>;
  };
  negotiations: {
    scenarios: NegotiationScenario[];
    leverage: LeverageData[];
    talkingPoints: Record<string, string[]>;
  };
  savings: {
    opportunities: SavingsOpportunity[];
    pipeline: SavingsPipelineOverview;
    roi: ROIMetrics;
  };
  renewals: {
    contracts: RenewalContract[];
    alerts: RenewalAlert[];
    packs: Record<string, RenewalPack>;
  };
}

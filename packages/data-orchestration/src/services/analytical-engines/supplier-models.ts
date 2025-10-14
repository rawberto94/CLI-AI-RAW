// Supplier Snapshot Data Models
export interface SupplierProfile {
  supplierId: string;
  basicInfo: SupplierBasicInfo;
  contracts: ContractSummary[];
  financialMetrics: FinancialMetrics;
  performanceMetrics: PerformanceMetrics;
  riskAssessment: RiskAssessment;
  complianceStatus: ComplianceStatus;
  lastUpdated: Date;
}

export interface SupplierBasicInfo {
  name: string;
  tier: 'Big 4' | 'Tier 2' | 'Boutique' | 'Offshore' | 'Unknown';
  categories: string[];
  regions: string[];
  relationshipDuration: number; // months
  primaryContact?: string;
  website?: string;
  headquarters?: string;
}

export interface ContractSummary {
  contractId: string;
  title: string;
  value: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  status: string;
  category: string;
  renewalType: string;
}

export interface FinancialMetrics {
  totalContractValue: number;
  averageContractValue: number;
  blendedDailyRate: number;
  benchmarkVariance: number; // percentage
  paymentTerms: number; // days
  currency: string;
  spendTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface PerformanceMetrics {
  deliveryScore: number; // 0-100
  qualityScore: number; // 0-100
  responsiveness: number; // 0-100
  innovation: number; // 0-100
  overallScore: number; // 0-100
  onTimeDelivery: number; // percentage
  budgetAdherence: number; // percentage
  clientSatisfaction: number; // 1-5
}

export interface RiskAssessment {
  overallRiskScore: number; // 0-100
  financialRisk: number; // 0-100
  operationalRisk: number; // 0-100
  complianceRisk: number; // 0-100
  concentrationRisk: number; // 0-100
  geopoliticalRisk: number; // 0-100
  riskTrend: 'improving' | 'stable' | 'deteriorating';
  lastAssessed: Date;
}

export interface ComplianceStatus {
  overallScore: number; // 0-100
  criticalIssues: number;
  lastAssessment: Date;
  certifications: string[];
  auditStatus: 'passed' | 'failed' | 'pending' | 'overdue';
}

export interface ExternalSupplierData {
  spendData?: SpendMetrics;
  riskData?: ExternalRiskData;
  esgScore?: ESGMetrics;
  marketData?: MarketData;
  lastSync: Date;
  sources: string[];
}

export interface SpendMetrics {
  totalSpend: number;
  categories: Record<string, number>;
  trends: Array<{ 
    period: string; 
    amount: number; 
    change: number; 
  }>;
  topCategories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

export interface ExternalRiskData {
  creditRating: string;
  financialHealth: number; // 0-100
  marketPosition: number; // 0-100
  industryRisk: number; // 0-100
  countryRisk: number; // 0-100
  source: string;
  lastUpdated: Date;
}

export interface ESGMetrics {
  environmentalScore: number; // 0-100
  socialScore: number; // 0-100
  governanceScore: number; // 0-100
  overallScore: number; // 0-100
  certifications: string[];
  initiatives: string[];
  source: string;
  lastUpdated: Date;
}

export interface MarketData {
  marketShare: number; // percentage
  competitivePosition: 'leader' | 'challenger' | 'follower' | 'niche';
  growthRate: number; // percentage
  marketTrends: string[];
  competitors: string[];
}

export interface SupplierMetrics {
  efficiency: number; // 0-100
  costCompetitiveness: number; // 0-100
  riskAdjustedValue: number; // 0-100
  strategicImportance: number; // 0-100
  relationshipHealth: number; // 0-100
  futureViability: number; // 0-100
}

export interface ExecutiveSummary {
  supplierId: string;
  supplierName: string;
  summary: string;
  keyMetrics: Record<string, number>;
  strengths: string[];
  concerns: string[];
  opportunities: string[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  strategicValue: 'low' | 'medium' | 'high' | 'critical';
  generatedAt: Date;
  confidence: number; // 0-1
}

export interface SupplierComparison {
  suppliers: Array<{
    supplierId: string;
    name: string;
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    ranking: number;
  }>;
  criteria: string[];
  generatedAt: Date;
}

export interface SupplierAlert {
  id: string;
  supplierId: string;
  type: 'performance' | 'risk' | 'compliance' | 'financial' | 'contract';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: string;
  recommendations: string[];
  createdAt: Date;
  status: 'active' | 'acknowledged' | 'resolved';
}
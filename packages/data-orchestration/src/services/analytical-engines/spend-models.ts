// Spend Overlay Data Models
export interface SpendDataSource {
  type: 'sievo' | 'ariba' | 'csv' | 'api' | 'manual';
  tenantId?: string;
  apiKey?: string;
  apiUrl?: string;
  filePath?: string;
  refreshInterval?: number; // minutes
  lastSync?: Date;
  isActive: boolean;
}

export interface SpendRecord {
  id: string;
  supplier: string;
  category: string;
  amount: number;
  currency: string;
  period: string; // YYYY-MM format
  costCenter?: string;
  poReference?: string;
  description?: string;
  transactionDate: Date;
  source: string;
  metadata?: Record<string, any>;
}

export interface SpendMapping {
  spendRecordId: string;
  contractId?: string;
  mappingConfidence: number; // 0-1
  mappingMethod: 'supplier_name' | 'po_reference' | 'category' | 'manual' | 'none';
  supplierMatch: boolean;
  categoryMatch: boolean;
  poMatch: boolean;
  reasons: string[];
  reviewRequired?: boolean;
}

export interface SpendIntegrationResult {
  source: string;
  recordsImported: number;
  recordsSkipped: number;
  recordsRejected: number;
  errors: string[];
  warnings: string[];
  dataQualityScore: number; // 0-100
  lastSync: Date;
  success: boolean;
}

export interface MappingResult {
  totalRecords: number;
  mappedRecords: number;
  unmappedRecords: number;
  mappings: SpendMapping[];
  confidence: number; // 0-1
  processingTime: number; // milliseconds
}

export interface VarianceAnalysis {
  supplierId: string;
  tenantId: string;
  period: string;
  contractedAmount: number;
  actualSpend: number;
  variance: number;
  variancePercentage: number;
  offContractSpend: number;
  rateCreep: Array<{
    category: string;
    contractedRate: number;
    actualRate: number;
    variance: number;
    volumeImpact?: number;
  }>;
  volumeVariance?: {
    planned: number;
    actual: number;
    variance: number;
  };
  totalVariancePercentage?: number;
  analyzedAt: Date;
}

export interface EfficiencyMetrics {
  supplierId: string;
  tenantId: string;
  period: string;
  utilizationRate: number; // percentage
  costEfficiency: number; // 0-100
  contractCompliance: number; // percentage
  savingsRealization: number; // percentage
  leakageAmount: number;
  leakagePercentage: number;
  volumeCommitmentUtilization: number; // percentage
  rateVariance: number; // percentage
  calculatedAt: Date;
}

export interface UtilizationAnalysis {
  overallUtilization: number; // percentage
  volumeUtilization: number; // percentage
  rateUtilization: number; // percentage
  commitmentUtilization: number; // percentage
}

export interface LeakageAnalysis {
  totalLeakage: number;
  leakagePercentage: number;
  offContractSpend: number;
  rateCreep: number;
}

export interface SpendFilters {
  tenantId: string;
  supplierId?: string;
  category?: string;
  period?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  minAmount?: number;
  maxAmount?: number;
  source?: string;
  costCenter?: string;
}

export interface SpendReport {
  tenantId: string;
  period: string;
  filters: SpendFilters;
  summary: {
    totalSpend: number;
    mappedSpend: number;
    unmappedSpend: number;
    totalVariance: number;
    variancePercentage: number;
    supplierCount: number;
    categoryCount: number;
  };
  topSuppliers: Array<{
    supplier: string;
    amount: number;
    percentage: number;
  }>;
  topCategories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  variances: VarianceAnalysis[];
  trends: Array<{
    period: string;
    amount: number;
    change: number;
  }>;
  recommendations: string[];
  generatedAt: Date;
}

export interface SpendAlert {
  id: string;
  type: 'variance' | 'leakage' | 'compliance' | 'threshold';
  severity: 'low' | 'medium' | 'high' | 'critical';
  supplierId?: string;
  category?: string;
  message: string;
  details: string;
  threshold?: number;
  actualValue?: number;
  recommendations: string[];
  createdAt: Date;
  status: 'active' | 'acknowledged' | 'resolved';
}

export interface SpendBenchmark {
  category: string;
  region: string;
  benchmarkRate: number;
  currency: string;
  sampleSize: number;
  confidence: number;
  lastUpdated: Date;
  source: string;
}
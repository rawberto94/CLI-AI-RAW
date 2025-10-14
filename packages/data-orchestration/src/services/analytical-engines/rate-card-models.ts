// Rate Card Benchmarking Data Models

export interface RateCard {
  id: string;
  contractId: string;
  supplierId: string;
  effectiveDate: Date;
  currency: string;
  region: string;
  deliveryModel: 'onshore' | 'nearshore' | 'offshore';
  rates?: RateCardEntry[];
  metadata?: Record<string, any>;
}

export interface RateCardEntry {
  role: string;
  level: string;
  rate: number;
  currency: string;
  rateType: 'hourly' | 'daily' | 'monthly' | 'fixed';
  billableHours?: number;
  category?: string;
  location?: string;
  volume?: number;
  annualVolume?: number;
  supplier?: string;
  contractId?: string;
  tenantId?: string;
}

export interface NormalizedRate {
  role: string;
  level: string;
  rate: number;
  currency: string;
  region: string;
  deliveryModel: 'onshore' | 'nearshore' | 'offshore';
  supplier: string;
  effectiveDate: Date;
  rateType: 'hourly' | 'daily' | 'monthly' | 'fixed';
  billableHours: number;
  category?: string;
  skills?: string[];
  experience?: number;
}

export interface RateCohort {
  role: string;
  level: string;
  region: string;
  deliveryModel: 'onshore' | 'nearshore' | 'offshore';
  category?: string;
  tenantId?: string;
}

export interface BenchmarkResult {
  cohort: RateCohort;
  statistics: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean: number;
    stdDev: number;
  };
  sampleSize: number;
  confidence: number;
  lastUpdated: Date;
  variance?: number;
}

export interface SavingsOpportunity {
  id: string;
  supplierId: string;
  category: string;
  role: string;
  level: string;
  currentRate: number;
  benchmarkRate: number;
  potentialSavings: number;
  confidence: number;
  recommendations: string[];
  annualVolume?: number;
  priority?: 'high' | 'medium' | 'low';
  effort?: 'low' | 'medium' | 'high';
  timeline?: string;
}

export interface SavingsEstimation {
  opportunities: SavingsOpportunity[];
  totalPotentialSavings: number;
  highConfidenceOpportunities: number;
  averageConfidence: number;
  estimatedAt: Date;
}

export interface RateCardReport {
  supplierId: string;
  supplierName: string;
  totalRates: number;
  benchmarkedRates: number;
  averageVariance: number;
  savingsOpportunities: SavingsOpportunity[];
  generatedAt: Date;
  summary: {
    totalPotentialSavings: number;
    highConfidenceOpportunities: number;
    averageRateVsBenchmark: number;
  };
}

export interface RateParsingResult {
  success: boolean;
  rateCard: RateCard;
  rates: NormalizedRate[];
  errors: string[];
  warnings: string[];
  metadata?: {
    sourceFormat: string;
    parsingMethod: string;
    confidence: number;
  };
}

export interface CurrencyConversionRate {
  from: string;
  to: string;
  rate: number;
  date: Date;
  source?: string;
}

export interface RoleMappingRule {
  sourceRole: string;
  targetRole: string;
  level: string;
  confidence: number;
  aliases?: string[];
}

// Advanced Analysis Models
export interface AdvancedRateAnalysis {
  contractId: string;
  supplier: string;
  category: string;
  analysisDate: Date;
  benchmarkAnalysis: BenchmarkAnalysisResult;
  trendAnalysis: TrendAnalysisResult;
  competitiveAnalysis: CompetitiveAnalysisResult;
  riskAnalysis: RiskAnalysisResult;
  optimizationAnalysis: OptimizationAnalysisResult;
  overallScore: number;
  recommendations: string[];
}

export interface BenchmarkAnalysisResult {
  benchmarks: BenchmarkResult[];
  averageVariance: number;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  sampleSize: number;
  variance: number;
}

export interface TrendAnalysisResult {
  trends: Array<{
    role: string;
    category: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    changeRate: number;
    confidence: number;
  }>;
  overallTrend: 'increasing' | 'decreasing' | 'stable';
  averageChangeRate: number;
  score: number;
  forecastAccuracy: number;
}

export interface CompetitiveAnalysisResult {
  competitorRates: Array<{
    competitor: string;
    averageRate: number;
    marketShare: number;
    strengthAreas: string[];
    weaknessAreas: string[];
  }>;
  marketPosition: 'advantageous' | 'competitive' | 'disadvantageous';
  competitiveGap: number;
  score: number;
  recommendations: string[];
}

export interface RiskAnalysisResult {
  risks: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    impact: string;
    mitigation: string;
  }>;
  overallRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  score: number;
  mitigationPlan: string[];
}

export interface OptimizationAnalysisResult {
  opportunities: Array<{
    type: string;
    description: string;
    currentValue?: number;
    targetValue?: number;
    potentialSavings: number;
    effort: 'low' | 'medium' | 'high';
    timeline: string;
  }>;
  totalPotentialSavings: number;
  prioritizedActions: any[];
  score: number;
  implementationRoadmap: any[];
}

// Market Intelligence Models
export interface MarketIntelligenceResult {
  category: string;
  region: string;
  analysisDate: Date;
  industryBenchmarks: IndustryBenchmark[];
  trendAnalysis: MarketTrendAnalysis;
  marketPositioning: MarketPositioning;
  insights: MarketInsight[];
  confidence: number;
  lastUpdated: Date;
}

export interface IndustryBenchmark {
  role: string;
  category: string;
  region: string;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sampleSize: number;
  lastUpdated: Date;
  source?: string;
}

export interface SalaryData {
  role: string;
  category: string;
  region: string;
  baseSalary: number;
  totalCompensation: number;
  benefits: number;
  source: string;
  lastUpdated: Date;
}

export interface EconomicIndicators {
  region: string;
  inflationRate: number;
  unemploymentRate: number;
  gdpGrowth: number;
  currencyStrength: number;
  laborCostIndex: number;
  lastUpdated: Date;
}

export interface CompetitorRate {
  competitor: string;
  category: string;
  region: string;
  averageRate: number;
  rateRange: {
    min: number;
    max: number;
  };
  marketShare: number;
  lastUpdated: Date;
}

export interface MarketTrendAnalysis {
  overallTrend: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number;
  seasonalPatterns: number[];
  volatility: number;
  keyInfluencers: string[];
}

export interface MarketPositioning {
  quartile: number;
  percentile: number;
  competitiveAdvantage: 'strong' | 'moderate' | 'weak';
  marketShare: number;
  priceLeadership: boolean;
}

export interface MarketInsight {
  type: 'trend' | 'opportunity' | 'risk' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  actionable?: boolean;
  timeline?: string;
}

// Predictive Modeling Models
export interface PredictiveRateModel {
  supplierId: string;
  category: string;
  modelType: string;
  accuracy: number;
  keyDrivers: Array<{
    factor: string;
    impact: number;
    direction: 'positive' | 'negative' | 'cyclical';
  }>;
  predictions: RatePrediction[];
  confidence: 'high' | 'medium' | 'low';
  modelMetadata: {
    trainingDataPoints: number;
    features: number;
    algorithm: string;
    lastTrained: Date;
  };
  createdAt: Date;
}

export interface RatePrediction {
  month: number;
  predictedRate: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
  factors?: Record<string, number>;
}

// Rate Card Validation Models
export interface RateCardValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  confidence: number;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
  code: string;
}

export interface ValidationSuggestion {
  field: string;
  message: string;
  improvement: string;
  code: string;
}

// Rate Card Analytics Models
export interface RateCardAnalytics {
  supplierId: string;
  category: string;
  timeframe: string;
  metrics: {
    totalRates: number;
    averageRate: number;
    rateVariance: number;
    benchmarkComparison: number;
    savingsOpportunities: number;
    riskScore: number;
  };
  trends: {
    rateGrowth: number;
    volumeGrowth: number;
    efficiencyImprovement: number;
  };
  comparisons: {
    peerSuppliers: string[];
    marketPosition: number;
    competitiveGap: number;
  };
  generatedAt: Date;
}

// Rate Card Optimization Models
export interface RateOptimizationPlan {
  supplierId: string;
  category: string;
  currentState: {
    totalSpend: number;
    averageRate: number;
    rateCount: number;
  };
  targetState: {
    projectedSpend: number;
    targetRate: number;
    optimizedRateCount: number;
  };
  optimizations: RateOptimization[];
  implementation: {
    phases: OptimizationPhase[];
    timeline: string;
    effort: 'low' | 'medium' | 'high';
    risk: 'low' | 'medium' | 'high';
  };
  expectedOutcomes: {
    costSavings: number;
    efficiencyGains: number;
    riskReduction: number;
  };
  createdAt: Date;
}

export interface RateOptimization {
  type: 'rate_reduction' | 'volume_consolidation' | 'contract_restructure' | 'supplier_change';
  description: string;
  impact: {
    costSavings: number;
    riskChange: number;
    efficiencyGain: number;
  };
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  dependencies: string[];
  success_criteria: string[];
}

export interface OptimizationPhase {
  phase: number;
  name: string;
  duration: string;
  optimizations: string[];
  milestones: string[];
  risks: string[];
  success_metrics: string[];
}

// Rate Card Monitoring Models
export interface RateCardMonitoring {
  supplierId: string;
  category: string;
  monitoringPeriod: {
    start: Date;
    end: Date;
  };
  alerts: RateAlert[];
  thresholds: RateThreshold[];
  performance: {
    rateStability: number;
    benchmarkAlignment: number;
    savingsRealization: number;
  };
  recommendations: string[];
  nextReview: Date;
}

export interface RateAlert {
  id: string;
  type: 'rate_increase' | 'benchmark_deviation' | 'volume_change' | 'market_shift';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
  actionRequired: boolean;
  relatedRates: string[];
}

export interface RateThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  alertLevel: 'warning' | 'critical';
  enabled: boolean;
}
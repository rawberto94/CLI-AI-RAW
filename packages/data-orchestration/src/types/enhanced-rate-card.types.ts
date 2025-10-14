/**
 * Enhanced Rate Card Types
 * 
 * Comprehensive type definitions for the enhanced rate card system
 * including all new fields for line of service, seniority, geography, skills, and contract terms.
 */

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface EnhancedRateCard {
  id: string;
  contractId: string;
  supplierId: string;
  tenantId: string;
  effectiveDate: Date;
  currency: string;
  region: string;
  deliveryModel: string;
  
  // New enhanced fields
  lineOfService?: string;
  country?: string;
  stateProvince?: string;
  city?: string;
  costOfLivingIndex?: number;
  businessUnit?: string;
  costCenter?: string;
  projectType?: string;
  engagementModel: EngagementModel;
  paymentTerms?: string;
  minimumCommitmentHours?: number;
  volumeDiscountTiers?: VolumeDiscount[];
  escalationPercentage?: number;
  escalationFrequency?: EscalationFrequency;
  reviewCycleMonths?: number;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface EnhancedRate {
  id: string;
  rateCardId: string;
  role: string;
  level?: string;
  seniorityLevel: SeniorityLevel;
  
  // Rate structures
  hourlyRate?: number;
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  annualRate?: number;
  billableHours: number;
  overtimeMultiplier: number;
  
  // Requirements and qualifications
  requiredSkills: Skill[];
  requiredCertifications: Certification[];
  minimumExperienceYears?: number;
  securityClearanceRequired: boolean;
  remoteWorkAllowed: boolean;
  travelPercentage: number;
  
  // Rate metadata
  rateType: RateType;
  effectiveStartDate?: Date;
  effectiveEndDate?: Date;
  markupPercentage?: number;
  costRate?: number;
  
  // Timestamps
  createdAt: Date;
}

// ============================================================================
// SUPPORTING DATA STRUCTURES
// ============================================================================

export interface VolumeDiscount {
  minimumHours: number;
  discountPercentage: number;
  description?: string;
}

export interface Skill {
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  required: boolean;
  premiumFactor?: number;
  certifyingBodies?: string[];
  relatedSkills?: string[];
}

export interface Certification {
  name: string;
  issuingOrganization: string;
  level?: string;
  required: boolean;
  validityPeriodMonths?: number;
  renewalRequirements?: string;
  premiumFactor?: number;
  relatedSkills?: string[];
}

export interface Location {
  country: string;
  stateProvince?: string;
  city?: string;
  costOfLivingIndex?: number;
  currencyCode?: string;
}

export interface ContractTerms {
  paymentTerms: string;
  minimumCommitment?: number;
  volumeDiscounts?: VolumeDiscount[];
  penaltyClauses?: string[];
  performanceBonuses?: string[];
  escalationPercentage?: number;
  escalationFrequency?: EscalationFrequency;
}

// ============================================================================
// TAXONOMY INTERFACES
// ============================================================================

export interface LineOfServiceTaxonomy {
  id: string;
  tenantId: string;
  serviceName: string;
  serviceCategory: ServiceCategory;
  subcategory?: string;
  description?: string;
  typicalRoles: string[];
  skillDomains: string[];
  marketSegment: MarketSegment;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeniorityDefinition {
  id: string;
  tenantId: string;
  levelName: SeniorityLevel;
  levelOrder: number;
  minExperienceYears?: number;
  maxExperienceYears?: number;
  typicalResponsibilities: string[];
  skillExpectations: string[];
  leadershipScope?: string;
  decisionAuthority?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeographicAdjustment {
  id: string;
  country: string;
  stateProvince?: string;
  city?: string;
  costOfLivingIndex: number;
  currencyCode: string;
  taxImplications?: Record<string, any>;
  laborMarketConditions?: Record<string, any>;
  updatedAt: Date;
  dataSource?: string;
}

export interface SkillsRegistry {
  id: string;
  skillName: string;
  skillCategory: SkillCategory;
  skillLevel?: SkillLevel;
  marketDemand: MarketDemand;
  premiumFactor: number;
  certifyingBodies?: string[];
  relatedSkills?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CertificationsRegistry {
  id: string;
  certificationName: string;
  issuingOrganization: string;
  certificationLevel?: string;
  validityPeriodMonths?: number;
  renewalRequirements?: string;
  marketValue: MarketValue;
  premiumFactor: number;
  relatedSkills?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// WORKFLOW AND AUDIT INTERFACES
// ============================================================================

export interface RateApprovalWorkflow {
  id: string;
  rateCardId: string;
  workflowStep: number;
  approverRole: string;
  requiredApprover?: string;
  approvalThreshold?: number;
  status: WorkflowStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
}

export interface RateChangeHistory {
  id: string;
  rateId: string;
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  changeReason?: string;
  changedBy: string;
  changedAt: Date;
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

// ============================================================================
// ANALYTICS INTERFACES
// ============================================================================

export interface LineOfServiceAnalytics {
  serviceBreakdown: Array<{
    service: string;
    serviceCategory: ServiceCategory;
    averageRate: number;
    rateCount: number;
    marketPosition: number;
    trendDirection: TrendDirection;
    topRoles: string[];
  }>;
  crossServiceComparison: ServiceComparison[];
  recommendations: string[];
  totalServices: number;
  avgRateAcrossServices: number;
}

export interface SeniorityAnalytics {
  seniorityProgression: Array<{
    level: SeniorityLevel;
    levelOrder: number;
    averageRate: number;
    rateRange: { min: number; max: number };
    marketBenchmark: number;
    progressionGap?: number;
    roleCount: number;
  }>;
  careerPathAnalysis: CareerPath[];
  gapAnalysis: SeniorityGap[];
  totalLevels: number;
  avgProgressionIncrease: number;
}

export interface GeographicAnalytics {
  locationBreakdown: Array<{
    location: Location;
    averageRate: number;
    adjustedRate: number;
    marketCompetitiveness: number;
    costAdvantage: number;
    rateCount: number;
  }>;
  heatMapData: GeoHeatMapPoint[];
  arbitrageOpportunities: ArbitrageOpportunity[];
  totalLocations: number;
  avgCostOfLiving: number;
}

export interface SkillPremiumAnalytics {
  skillBreakdown: Array<{
    skill: string;
    category: SkillCategory;
    averagePremium: number;
    marketDemand: MarketDemand;
    rateCount: number;
    topRoles: string[];
  }>;
  certificationValue: Array<{
    certification: string;
    averagePremium: number;
    marketValue: MarketValue;
    rateCount: number;
  }>;
  recommendations: string[];
}

// ============================================================================
// SUPPORTING ANALYTICS TYPES
// ============================================================================

export interface ServiceComparison {
  serviceA: string;
  serviceB: string;
  rateDifference: number;
  percentageDifference: number;
  recommendation: string;
}

export interface CareerPath {
  fromLevel: SeniorityLevel;
  toLevel: SeniorityLevel;
  averageRateIncrease: number;
  percentageIncrease: number;
  typicalTimeframe: string;
}

export interface SeniorityGap {
  level: SeniorityLevel;
  expectedRate: number;
  actualRate: number;
  gap: number;
  recommendation: string;
}

export interface GeoHeatMapPoint {
  location: Location;
  value: number;
  rateCount: number;
  competitiveness: number;
}

export interface ArbitrageOpportunity {
  highCostLocation: Location;
  lowCostLocation: Location;
  costSavings: number;
  percentageSavings: number;
  feasibilityScore: number;
}

// ============================================================================
// CALCULATION INTERFACES
// ============================================================================

export interface RateStructure {
  hourlyRate: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  annualRate: number;
  conversionFactors: {
    hoursPerDay: number;
    daysPerWeek: number;
    weeksPerMonth: number;
    monthsPerYear: number;
  };
}

export interface CostAnalysis {
  baseCost: number;
  adjustedCost: number;
  totalCost: number;
  adjustments: {
    geographic: number;
    skills: number;
    certifications: number;
    volumeDiscounts: number;
    escalations: number;
  };
  breakdown: CostBreakdown[];
}

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
  description: string;
}

export interface MarketBenchmark {
  role: string;
  seniority: SeniorityLevel;
  location: Location;
  benchmarkRate: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  sampleSize: number;
  confidence: number;
  lastUpdated: Date;
}

// ============================================================================
// FILTER AND QUERY INTERFACES
// ============================================================================

export interface EnhancedRateCardFilters {
  tenantId?: string;
  supplierId?: string;
  lineOfService?: string;
  serviceCategory?: ServiceCategory;
  country?: string;
  stateProvince?: string;
  city?: string;
  engagementModel?: EngagementModel;
  businessUnit?: string;
  approvalStatus?: ApprovalStatus;
  effectiveDateFrom?: Date;
  effectiveDateTo?: Date;
  minRate?: number;
  maxRate?: number;
}

export interface EnhancedRateFilters extends EnhancedRateCardFilters {
  role?: string;
  seniorityLevel?: SeniorityLevel;
  rateType?: RateType;
  requiredSkills?: string[];
  requiredCertifications?: string[];
  minExperience?: number;
  maxExperience?: number;
  remoteWorkAllowed?: boolean;
  securityClearanceRequired?: boolean;
  maxTravelPercentage?: number;
}

// ============================================================================
// ENUM TYPES
// ============================================================================

export type EngagementModel = 'Staff Augmentation' | 'Project' | 'Outcome';

export type EscalationFrequency = 'Annual' | 'Quarterly' | 'Semi-Annual';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'under_review';

export type SeniorityLevel = 'Junior' | 'Mid-Level' | 'Senior' | 'Lead' | 'Principal' | 'Director';

export type RateType = 'standard' | 'premium' | 'discount' | 'negotiated';

export type SkillCategory = 'Technical' | 'Soft' | 'Domain' | 'Leadership' | 'Certification';

export type SkillLevel = 'Basic' | 'Intermediate' | 'Advanced' | 'Expert';

export type MarketDemand = 'Low' | 'Medium' | 'High' | 'Critical';

export type MarketValue = 'Low' | 'Medium' | 'High' | 'Premium';

export type ServiceCategory = 'Technology' | 'Consulting' | 'Creative' | 'Operations' | 'Finance' | 'Legal' | 'Marketing';

export type MarketSegment = 'Enterprise' | 'SMB' | 'Government' | 'Startup' | 'Non-Profit';

export type WorkflowStatus = 'pending' | 'approved' | 'rejected' | 'escalated';

export type TrendDirection = 'up' | 'down' | 'stable' | 'volatile';

// ============================================================================
// VALIDATION INTERFACES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: CorrectionSuggestion[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationWarning {
  field: string;
  message: string;
  recommendation: string;
}

export interface CorrectionSuggestion {
  field: string;
  currentValue: any;
  suggestedValue: any;
  reason: string;
  confidence: number;
}

// ============================================================================
// API RESPONSE INTERFACES
// ============================================================================

export interface EnhancedRateCardResponse {
  rateCard: EnhancedRateCard;
  rates: EnhancedRate[];
  analytics?: {
    totalRates: number;
    averageRate: number;
    rateRange: { min: number; max: number };
    seniorityDistribution: Record<SeniorityLevel, number>;
    skillBreakdown: Record<string, number>;
  };
}

export interface EnhancedAnalyticsResponse {
  lineOfServiceAnalytics?: LineOfServiceAnalytics;
  seniorityAnalytics?: SeniorityAnalytics;
  geographicAnalytics?: GeographicAnalytics;
  skillPremiumAnalytics?: SkillPremiumAnalytics;
  summary: {
    totalRateCards: number;
    totalRates: number;
    averageRate: number;
    topPerformingServices: string[];
    highestPaidRoles: string[];
    mostInDemandSkills: string[];
  };
}

export interface TaxonomyResponse {
  lineOfService: LineOfServiceTaxonomy[];
  seniority: SeniorityDefinition[];
  skills: SkillsRegistry[];
  certifications: CertificationsRegistry[];
  geographic: GeographicAdjustment[];
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export interface BulkRateCardUpload {
  rateCards: Partial<EnhancedRateCard>[];
  rates: Partial<EnhancedRate>[];
  validationOptions: {
    skipValidation: boolean;
    autoCorrect: boolean;
    requireApproval: boolean;
  };
}

export interface BulkUploadResult {
  successful: number;
  failed: number;
  warnings: number;
  errors: ValidationError[];
  createdRateCards: string[];
  createdRates: string[];
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export * from './enhanced-rate-card.types';
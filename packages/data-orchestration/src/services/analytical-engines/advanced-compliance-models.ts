// Advanced Compliance Analysis Models

export interface AdvancedComplianceResult {
  contractId: string;
  analysisDate: Date;
  overallScore: number;
  clauseAnalysis: ClauseAnalysisResult;
  riskAssessment: ComplianceRiskAssessment;
  regulatoryCompliance: RegulatoryComplianceResult;
  industryStandards: IndustryStandardsResult;
  bestPractices: BestPracticesResult;
  semanticAnalysis: SemanticAnalysisResult;
  insights: ComplianceInsight[];
  recommendations: string[];
  priorityActions: PriorityAction[];
  complianceGaps: ComplianceGap[];
}

export interface ClauseAnalysisResult {
  identifiedClauses: IdentifiedClause[];
  missingClauses: MissingClause[];
  clauseQuality: ClauseQuality;
  overallAnalysis: string;
}

export interface IdentifiedClause {
  type: string;
  content: string;
  confidence: number;
  position: {
    start: number;
    end: number;
  };
  analysis: string;
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
  risks?: string[];
  suggestions?: string[];
}

export interface MissingClause {
  type: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  template?: string;
  riskImpact?: number;
}

export interface ClauseQuality {
  clarity: number;
  completeness: number;
  enforceability: number;
  consistency?: number;
  specificity?: number;
}

export interface ComplianceRiskAssessment {
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  riskScore: number;
  mitigationStrategies: string[];
  riskMatrix?: RiskMatrix;
}

export interface RiskFactor {
  type: 'legal' | 'operational' | 'financial' | 'regulatory' | 'reputational';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: number;
  impact: number;
  riskScore?: number;
  mitigation?: string;
}

export interface RiskMatrix {
  categories: string[];
  likelihood: number[];
  impact: number[];
  riskLevels: string[][];
}

export interface RegulatoryComplianceResult {
  regulations: RegulationCompliance[];
  overallCompliance: 'compliant' | 'partial' | 'non-compliant';
  complianceScore: number;
  recommendations: string[];
  auditTrail?: ComplianceAuditEntry[];
}

export interface RegulationCompliance {
  name: string;
  applicable: boolean;
  compliance: 'compliant' | 'partial' | 'non-compliant' | 'n/a';
  issues: string[];
  requirements: string[];
  score?: number;
  lastAssessed?: Date;
}

export interface ComplianceAuditEntry {
  timestamp: Date;
  regulation: string;
  status: string;
  assessor: string;
  notes?: string;
}

export interface IndustryStandardsResult {
  standards: IndustryStandard[];
  overallScore: number;
  recommendations: string[];
  benchmarkComparison?: BenchmarkComparison;
}

export interface IndustryStandard {
  name: string;
  applicable: boolean;
  compliance: 'compliant' | 'partial' | 'non-compliant';
  score: number;
  gaps?: string[];
  requirements?: string[];
}

export interface BenchmarkComparison {
  industryAverage: number;
  peerComparison: number;
  ranking: string;
  percentile: number;
}

export interface BestPracticesResult {
  bestPractices: BestPractice[];
  overallScore: number;
  improvements: string[];
  maturityLevel?: 'basic' | 'developing' | 'advanced' | 'optimized';
}

export interface BestPractice {
  practice: string;
  present: boolean;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'missing';
  score: number;
  recommendation?: string;
  examples?: string[];
}

export interface SemanticAnalysisResult {
  readabilityScore: number;
  complexityScore: number;
  ambiguityScore: number;
  consistencyScore: number;
  semanticIssues: SemanticIssue[];
  overallScore: number;
  languageMetrics?: LanguageMetrics;
}

export interface SemanticIssue {
  type: 'ambiguity' | 'inconsistency' | 'complexity' | 'readability';
  description: string;
  location: string;
  suggestion: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface LanguageMetrics {
  averageSentenceLength: number;
  vocabularyComplexity: number;
  passiveVoicePercentage: number;
  technicalTermDensity: number;
}

export interface ComplianceInsight {
  type: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  actionable?: boolean;
  category?: string;
}

export interface PriorityAction {
  id: string;
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  dependencies?: string[];
  expectedOutcome?: string;
}

export interface ComplianceGap {
  type: string;
  description: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  effort?: 'low' | 'medium' | 'high';
  cost?: number;
}

// Policy Management Models
export interface PolicyManagementResult {
  tenantId: string;
  analysisDate: Date;
  currentPolicies: CompliancePolicy[];
  policyAnalysis: PolicyAnalysis;
  policyGaps: PolicyGap[];
  policyRecommendations: PolicyRecommendation[];
  updatePlan: PolicyUpdatePlan;
  implementationTimeline: ImplementationTimeline;
  expectedImpact: PolicyImpact;
}

export interface PolicyAnalysis {
  overallEffectiveness: number;
  policyPerformance: PolicyPerformance[];
  recommendations: string[];
  trends?: PolicyTrend[];
}

export interface PolicyPerformance {
  policyId: string;
  effectiveness: number;
  usage: number;
  issues: number;
  lastUpdated?: Date;
  userFeedback?: number;
}

export interface PolicyTrend {
  period: string;
  effectiveness: number;
  usage: number;
  issues: number;
}

export interface PolicyGap {
  area: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  currentCoverage?: number;
  requiredCoverage?: number;
}

export interface PolicyRecommendation {
  type: 'new_policy' | 'policy_update' | 'policy_retirement';
  area?: string;
  policyId?: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  effort: 'low' | 'medium' | 'high';
  expectedBenefit?: string;
}

export interface PolicyUpdatePlan {
  phases: PolicyPhase[];
  totalEffort: number;
  estimatedCost: number;
  riskAssessment?: string[];
}

export interface PolicyPhase {
  phase: number;
  name: string;
  duration: string;
  policies: PolicyRecommendation[];
  dependencies?: string[];
  milestones?: string[];
}

export interface ImplementationTimeline {
  startDate: Date;
  phases: TimedPhase[];
  totalDuration: number;
  criticalPath?: string[];
}

export interface TimedPhase extends PolicyPhase {
  startDate: Date;
  endDate: Date;
  status?: 'planned' | 'in_progress' | 'completed' | 'delayed';
}

export interface PolicyImpact {
  riskReduction: number;
  complianceImprovement: number;
  costSavings: number;
  efficiencyGains?: number;
  qualityImprovement?: number;
}

// Continuous Monitoring Models
export interface ComplianceMonitoringSetup {
  contractId: string;
  setupDate: Date;
  monitoringRequirements: MonitoringRequirement[];
  monitoringRules: MonitoringRule[];
  automatedChecks: AutomatedCheck[];
  alertConfig: AlertConfiguration;
  dashboardConfig: DashboardConfiguration;
  monitoringSchedule: MonitoringSchedule;
  expectedCoverage: number;
}

export interface MonitoringRequirement {
  type: string;
  description: string;
  frequency: 'real-time' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  criticality: 'low' | 'medium' | 'high' | 'critical';
  dataSource?: string;
}

export interface MonitoringRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  frequency: string;
  enabled: boolean;
  parameters?: Record<string, any>;
}

export interface AutomatedCheck {
  id: string;
  name: string;
  type: 'clause_presence' | 'value_validation' | 'date_monitoring' | 'compliance_status';
  schedule: string;
  parameters: Record<string, any>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface AlertConfiguration {
  channels: AlertChannel[];
  escalationRules: EscalationRule[];
  suppressionRules: SuppressionRule[];
  templates: AlertTemplate[];
}

export interface AlertChannel {
  type: 'email' | 'sms' | 'webhook' | 'dashboard';
  configuration: Record<string, any>;
  enabled: boolean;
}

export interface EscalationRule {
  condition: string;
  delay: number;
  action: string;
  recipients: string[];
}

export interface SuppressionRule {
  condition: string;
  duration: number;
  reason: string;
}

export interface AlertTemplate {
  type: string;
  subject: string;
  body: string;
  variables: string[];
}

export interface DashboardConfiguration {
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  refreshInterval: number;
  permissions: DashboardPermission[];
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'alert';
  title: string;
  configuration: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  responsive: boolean;
}

export interface DashboardPermission {
  role: string;
  permissions: string[];
}

export interface MonitoringSchedule {
  checks: ScheduledCheck[];
  reports: ScheduledReport[];
  reviews: ScheduledReview[];
}

export interface ScheduledCheck {
  name: string;
  frequency: string;
  nextRun: Date;
  enabled: boolean;
}

export interface ScheduledReport {
  name: string;
  frequency: string;
  recipients: string[];
  nextRun: Date;
}

export interface ScheduledReview {
  name: string;
  frequency: string;
  reviewers: string[];
  nextRun: Date;
}

// Benchmarking Models
export interface ComplianceBenchmarkResult {
  contractId: string;
  industry: string;
  benchmarkDate: Date;
  contractCompliance: ContractComplianceData;
  industryBenchmarks: IndustryBenchmarks;
  benchmarkComparison: BenchmarkComparison;
  bestPractices: IndustryBestPractice[];
  improvements: ImprovementOpportunity[];
  competitivePosition: CompetitivePosition;
  actionPlan: ComplianceActionPlan;
}

export interface ContractComplianceData {
  overallScore: number;
  categoryScores: Record<string, number>;
  clauseCoverage: number;
  riskLevel: string;
  maturityLevel: string;
}

export interface IndustryBenchmarks {
  averageScore: number;
  percentiles: Record<string, number>;
  commonClauses: string[];
  emergingTrends: string[];
  riskPatterns: string[];
}

export interface IndustryBestPractice {
  practice: string;
  description: string;
  adoptionRate: number;
  benefits: string[];
  implementation: string;
}

export interface ImprovementOpportunity {
  area: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  expectedBenefit: string;
}

export interface CompetitivePosition {
  ranking: number;
  percentile: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
}

export interface ComplianceActionPlan {
  phases: ActionPhase[];
  timeline: string;
  budget: number;
  resources: string[];
  successMetrics: string[];
}

export interface ActionPhase {
  phase: number;
  name: string;
  duration: string;
  actions: string[];
  deliverables: string[];
  dependencies: string[];
}

// Monitoring and Alerting Models
export interface SupplierIntelligenceReport {
  supplierId: string;
  supplierName: string;
  reportDate: Date;
  overallScore: number;
  basicProfile: any;
  performanceMetrics: any;
  riskAssessment: any;
  marketPosition: any;
  relationshipAnalysis: any;
  financialHealth: any;
  innovationCapability: any;
  sustainabilityScore: any;
  strategicInsights: any[];
  recommendations: string[];
  nextReviewDate: Date;
}

export interface SupplierBenchmarkResult {
  supplierId: string;
  category: string;
  benchmarkDate: Date;
  peerCount: number;
  benchmarks: any;
  positioning: any;
  insights: any[];
  recommendations: string[];
}

export interface RelationshipOptimizationPlan {
  supplierId: string;
  currentState: any;
  opportunities: any[];
  roadmap: any[];
  expectedOutcomes: any;
  implementation: {
    timeline: string;
    resources: string[];
    risks: string[];
    successMetrics: string[];
  };
  createdAt: Date;
}

export interface SupplierRiskMonitoring {
  supplierId: string;
  monitoringDate: Date;
  riskProfile: any;
  riskIndicators: any[];
  alerts: any[];
  trends: any[];
  mitigations: string[];
  overallRiskLevel: string;
  nextMonitoringDate: Date;
}

// Validation and Quality Models
export interface ComplianceValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  confidence: number;
  validationDate: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  code: string;
  location?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
  code: string;
  suggestion?: string;
}

export interface ValidationSuggestion {
  field: string;
  message: string;
  improvement: string;
  code: string;
  priority?: 'high' | 'medium' | 'low';
}

// Analytics and Reporting Models
export interface ComplianceAnalytics {
  tenantId: string;
  timeframe: string;
  metrics: ComplianceMetrics;
  trends: ComplianceTrend[];
  comparisons: ComplianceComparison[];
  insights: AnalyticsInsight[];
  generatedAt: Date;
}

export interface ComplianceMetrics {
  totalContracts: number;
  averageScore: number;
  complianceRate: number;
  riskDistribution: Record<string, number>;
  topIssues: string[];
  improvementRate: number;
}

export interface ComplianceTrend {
  period: string;
  score: number;
  contractCount: number;
  issueCount: number;
  changeRate: number;
}

export interface ComplianceComparison {
  dimension: string;
  current: number;
  previous: number;
  benchmark: number;
  variance: number;
}

export interface AnalyticsInsight {
  type: string;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  actionable: boolean;
}
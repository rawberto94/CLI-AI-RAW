/**
 * Comprehensive type definitions for agentic AI system
 * Supports autonomous decision-making, learning, and self-healing
 */

import type { Contract, Artifact } from '@prisma/client';

// Local type aliases for contract types (not in Prisma schema)
export type ContractType = 'SOW' | 'MSA' | 'NDA' | 'AMENDMENT' | 'ADDENDUM' | 'PO' | 'LICENSE' | 'OTHER';
export type ArtifactData = Record<string, unknown>;

// ============================================================================
// Base Agent Types
// ============================================================================

export interface BaseAgent {
  name: string;
  version: string;
  capabilities: AgentCapability[];
  execute(input: AgentInput): Promise<AgentOutput>;
}

export type AgentCapability =
  | 'validation'
  | 'gap-filling'
  | 'retry-strategy'
  | 'health-monitoring'
  | 'workflow-suggestion'
  | 'deadline-management'
  | 'opportunity-discovery'
  | 'learning'
  | 'search-intent';

export interface AgentInput {
  contractId: string;
  tenantId: string;
  context: Record<string, any>;
  metadata?: AgentMetadata;
  // Shorthand - will be moved to metadata.triggeredBy
  triggeredBy?: 'user' | 'system' | 'agent' | 'ocr_pipeline';
}

export interface AgentOutput {
  success: boolean;
  data?: any;
  output?: any; // Alias for data for backwards compatibility
  actions?: AgentAction[];
  recommendations?: AgentRecommendation[];
  confidence: number;
  reasoning: string;
  metadata?: AgentOutputMetadata;
}

export interface AgentMetadata {
  triggeredBy: 'user' | 'system' | 'agent' | 'ocr_pipeline';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  parentJobId?: string;
}

export interface AgentOutputMetadata {
  processingTime: number;
  modelUsed?: string;
  tokensUsed?: number;
  costEstimate?: number;
}

// ============================================================================
// Agent Actions & Recommendations
// ============================================================================

export interface AgentAction {
  id: string;
  type: AgentActionType;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  automated: boolean;
  targetEntity: {
    type: 'contract' | 'artifact' | 'workflow' | 'user';
    id: string;
  };
  payload?: Record<string, any>;
  estimatedImpact?: string;
  requiredApprovals?: string[];
}

export type AgentActionType =
  | 'retry'
  | 'escalate'
  | 'validate'
  | 'fill-gap'
  | 'create-workflow'
  | 'send-notification'
  | 'schedule-review'
  | 'update-metadata'
  | 'initiate-renewal'
  | 'flag-opportunity'
  | 'request-human-review';

export interface AgentRecommendation {
  id: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  potentialValue?: number;
  effort: 'low' | 'medium' | 'high';
  timeframe?: string;
  actions: AgentAction[];
  reasoning: string;
}

export type RecommendationCategory =
  | 'cost-savings'
  | 'risk-mitigation'
  | 'process-improvement'
  | 'compliance'
  | 'data-quality'
  | 'opportunity';

// ============================================================================
// Validation Agent Types
// ============================================================================

export interface ValidationInput {
  partialData: Partial<ArtifactData>;
  contractText: string;
  artifactType: string;
  confidence: number;
  ocrQuality?: number;
}

export interface ValidationIssue {
  type: ValidationIssueType;
  field: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedAction: 'ignore' | 'retry' | 'flag' | 'auto-fix';
  autoFixable: boolean;
}

export type ValidationIssueType =
  | 'placeholder_detected'
  | 'party_mismatch'
  | 'date_inconsistency'
  | 'missing_required_field'
  | 'low_confidence'
  | 'format_error'
  | 'value_out_of_range';

export interface ValidationDecision {
  decision: 'continue' | 'retry_immediately' | 'flag_for_review' | 'auto_fix';
  reason: string;
  confidence: number;
  issues: ValidationIssue[];
  useAlternativeStrategy?: boolean;
  suggestedStrategy?: string;
}

// ============================================================================
// Gap Filling Agent Types
// ============================================================================

export interface GapFillingInput {
  artifact: ArtifactData;
  allArtifacts: ArtifactData[];
  contractText: string;
  contractMetadata?: any;
  /** Enable aggressive gap filling with lower confidence thresholds */
  aggressiveMode?: boolean;
  /** Target completeness threshold (0.0-1.0), default 0.85 */
  minimumCompleteness?: number;
}

export interface IdentifiedGap {
  field: string;
  artifactType: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  fillability: 'easy' | 'medium' | 'hard' | 'impossible';
  suggestions: string[];
}

export interface FilledGap {
  field: string;
  value: any;
  source: GapFillSource;
  confidence: number;
  reasoning: string;
}

export type GapFillSource =
  | 'cross_artifact_inference'
  | 'targeted_ai_extraction'
  | 'metadata_lookup'
  | 'default_value'
  | 'user_provided'
  | 'context_inference';

export interface GapFillingResult {
  originalCompleteness: number;
  newCompleteness: number;
  filledGaps: FilledGap[];
  remainingGaps: IdentifiedGap[];
  confidence: number;
  /** Whether the result meets the target completeness threshold */
  meetsTargetCompleteness?: boolean;
  /** The target completeness that was used */
  targetCompleteness?: number;
}

// ============================================================================
// Retry Strategy Types
// ============================================================================

export interface FailureEvent {
  timestamp: Date;
  error: string;
  errorType: string;
  context: Record<string, any>;
  attemptNumber: number;
  modelUsed?: string;
}

export interface FailurePattern {
  hallucinationRate: number;
  tokenLimitErrors: number;
  timeoutErrors: number;
  apiErrors: number;
  dataQualityIssues: number;
  commonErrorMessages: string[];
}

export interface RetryStrategy {
  attempt: number;
  strategy: RetryStrategyType;
  reason: string;
  estimatedSuccess: number;
  modelToUse?: string;
  promptModifications?: string[];
  maxRetries?: number;
  backoffMultiplier?: number;
}

export type RetryStrategyType =
  | 'standard'
  | 'exponential_backoff'
  | 'alternative-model'
  | 'simplified-prompt'
  | 'human-intervention'
  | 'split-and-retry';

// ============================================================================
// Health Monitoring Types
// ============================================================================

export interface ContractHealthReport {
  contractId: string;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  score: number;
  issues: HealthIssue[];
  predictions: HealthPrediction[];
  recommendations: HealthRecommendation[];
  lastAssessed: Date;
  nextAssessment: Date;
}

export interface HealthIssue {
  type: HealthIssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  affectedFields?: string[];
  detectedAt: Date;
  details?: Record<string, any>;
}

export type HealthIssueType =
  | 'data_completeness'
  | 'compliance_drift'
  | 'risk_escalation'
  | 'approaching_deadline'
  | 'quality_degradation'
  | 'missing_obligations'
  | 'unmonitored_renewal';

export interface HealthPrediction {
  type: string;
  probability: number;
  timeframe: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  preventable: boolean;
}

export interface HealthRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  automatable: boolean;
  description: string;
  estimatedImpact?: string;
  requiredResources?: string[];
}

// ============================================================================
// Workflow Suggestion Types
// ============================================================================

export interface WorkflowSuggestion {
  workflowName: string;
  confidence: number;
  reasoning: string;
  steps: ApprovalStep[];
  estimatedDuration: number;
  basedOnContracts: string[];
  alternatives: WorkflowSuggestion[];
}

export interface ApprovalStep {
  name: string;
  assignee: string;
  deadline: number;
  required: boolean;
  reason: string;
  parallelWith?: string[];
  conditions?: StepCondition[];
}

export interface StepCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
  description: string;
}

export interface WorkflowHistory {
  contractId: string;
  contractType: ContractType;
  value: number;
  steps: CompletedStep[];
  totalDuration: number;
  success: boolean;
}

export interface CompletedStep {
  name: string;
  assignee: string;
  completedAt: Date;
  duration: number;
  approved: boolean;
}

// ============================================================================
// Deadline Management Types
// ============================================================================

export interface DeadlineAssessment {
  contractId: string;
  type: 'approval' | 'renewal' | 'obligation' | 'milestone';
  deadline: Date;
  currentStatus: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  prediction: CompletionPrediction;
  recommendedActions: DeadlineAction[];
}

export interface CompletionPrediction {
  estimatedCompletionDate: Date;
  confidence: number;
  factors: PredictionFactor[];
  atRisk: boolean;
}

export interface PredictionFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface DeadlineAction {
  type: 'escalate' | 'reassign' | 'extend_deadline' | 'add_resources' | 'notify';
  description: string;
  automated: boolean;
  estimatedImpact: string;
  urgency: 'low' | 'medium' | 'high' | 'immediate';
}

// ============================================================================
// Opportunity Discovery Types
// ============================================================================

export interface DiscoveredOpportunity {
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  potentialValue: number;
  confidence: number;
  effort: 'low' | 'medium' | 'high';
  timeframe: string;
  relatedContracts: string[];
  actionPlan: OpportunityAction[];
  discoveredAt: Date;
  status: 'new' | 'reviewing' | 'in-progress' | 'completed' | 'dismissed';
}

export type OpportunityType =
  | 'cost_savings'
  | 'consolidation'
  | 'renegotiation'
  | 'optimization'
  | 'risk_reduction'
  | 'process_improvement';

export interface OpportunityAction {
  step: number;
  action: string;
  owner: string;
  automated: boolean;
  estimatedDuration?: string;
  dependencies?: number[];
}

export interface MarketData {
  serviceType: string;
  region: string;
  averageRate: number;
  medianRate: number;
  percentile25: number;
  percentile75: number;
  sampleSize: number;
  lastUpdated: Date;
}

// ============================================================================
// Learning System Types
// ============================================================================

export interface FieldCorrection {
  field: string;
  originalValue: any;
  correctedValue: any;
  aiConfidence: number;
  correctedAt: Date;
  correctedBy: string;
}

export interface LearningRecord {
  id: string;
  artifactType: string;
  contractType: ContractType;
  field: string;
  aiExtracted: any;
  userCorrected: any;
  context: LearningContext;
  timestamp: Date;
}

export interface LearningContext {
  confidence: number;
  contractLength: number;
  ocrQuality: number;
  modelUsed: string;
  promptVersion: string;
}

export interface CorrectionPattern {
  field: string;
  commonMistake: string;
  correctPattern: string;
  occurrences: number;
  confidence: number;
  examples: CorrectionExample[];
}

export interface CorrectionExample {
  aiValue: any;
  correctValue: any;
  context: string;
}

// ============================================================================
// Search Intent Types
// ============================================================================

export interface SearchIntent {
  type: SearchIntentType;
  confidence: number;
  filters: SearchFilter[];
  sortBy?: string;
  includeAnalysis?: boolean;
}

export type SearchIntentType =
  | 'find_expiring'
  | 'find_high_risk'
  | 'find_by_person'
  | 'find_by_value'
  | 'analyze_costs'
  | 'compare_suppliers'
  | 'general_search';

export interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: any;
  derived: boolean;
}

export interface SearchResult {
  results: any[];
  intent: SearchIntentType;
  summary: string;
  suggestedFilters: SearchFilter[];
  relatedQueries: string[];
  totalResults: number;
  confidence: number;
}

// ============================================================================
// Agent Event Types
// ============================================================================

export interface AgentEvent {
  id: string;
  agentName: string;
  eventType: AgentEventType;
  timestamp: Date;
  contractId?: string;
  tenantId: string;
  payload: Record<string, any>;
  outcome: 'success' | 'failure' | 'partial' | 'pending';
  metadata?: {
    duration: number;
    cost?: number;
    confidence?: number;
  };
}

export type AgentEventType =
  | 'validation_performed'
  | 'gap_filled'
  | 'retry_attempted'
  | 'health_assessed'
  | 'workflow_suggested'
  | 'deadline_managed'
  | 'opportunity_discovered'
  | 'learning_recorded'
  | 'search_executed'
  | 'compliance_checked'
  | 'obligation_tracked'
  | 'contract_summarized';

// ============================================================================
// Configuration Types
// ============================================================================

export interface AgentConfig {
  enabled: boolean;
  autoExecute: boolean;
  confidenceThreshold: number;
  maxRetries?: number;
  notificationChannels?: string[];
  customRules?: CustomRule[];
}

export interface CustomRule {
  id: string;
  name: string;
  condition: string;
  action: AgentActionType;
  enabled: boolean;
}

export interface AgentPerformanceMetrics {
  agentName: string;
  totalExecutions: number;
  successRate: number;
  averageConfidence: number;
  averageExecutionTime: number;
  totalCost: number;
  lastExecuted: Date;
}

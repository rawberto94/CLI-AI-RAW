// Export service instances only
// For types, import directly from specific service files to avoid conflicts

// Core services
export { contractService } from './contract.service';
// export { processingJobService } from './processing-job.service'; // Excluded in tsconfig
export { auditTrailService } from './audit-trail.service';
export { chunkedUploadService } from './chunked-upload.service';
export { validationService } from './validation.service';

// Artifact services
export { artifactVersioningService } from './artifact-versioning.service';
export { confidenceScoringService } from './confidence-scoring.service';
export { aiArtifactGeneratorService } from './ai-artifact-generator.service';
export { parallelArtifactGeneratorService } from './parallel-artifact-generator.service';
// export { enhancedArtifactService } from './enhanced-artifact.service'; // Excluded in tsconfig
export { artifactPromptTemplatesService } from './artifact-prompt-templates.service';
export { artifactContextEnrichmentService } from './artifact-context-enrichment.service';
// export { hybridArtifactStorageService } from './hybrid-artifact-storage.service'; // Excluded in tsconfig
export { editableArtifactService } from './editable-artifact.service';
export { artifactChangePropagationService } from './artifact-change-propagation.service';
export { 
  artifactConfigService,
  getTenantArtifactConfig,
  getEnabledArtifactTypes,
  getArtifactGenerationConfig,
  DEFAULT_ARTIFACT_TYPES,
  DEFAULT_GENERATION_CONFIG,
  type ArtifactType,
  type ArtifactTypeConfig,
  type ArtifactGenerationConfig,
  type TenantArtifactConfig,
  type CustomArtifactType,
} from './artifact-config.service';

// Next-Gen AI Services
export {
  ContractTypeClassifier,
  SemanticChunker,
  aiLearningService,
  validateCrossArtifactConsistency,
  selectOptimalModel,
  type ContractCategory,
  type ContractClassification,
  type DocumentChunk,
  type ChunkingResult,
  type ConsistencyResult,
  type ModelCapability,
} from './advanced-ai-intelligence.service';

export {
  IntelligentPromptRouter,
  type RoutedPrompt,
} from './intelligent-prompt-router.service';

export {
  ARTIFACT_SCHEMAS,
  getSchemaForArtifact,
  createStructuredOutputFormat,
} from './structured-output-schemas.service';

export {
  NextGenArtifactGenerator,
  getNextGenArtifactGenerator,
  nextGenArtifactGenerator,
  type NextGenConfig,
  type GenerationResult,
  type BatchGenerationResult,
} from './next-gen-artifact-generator.service';

// Advanced AI Enhancement Services
export {
  ABTestingService,
  abTestingService,
  PRESET_EXPERIMENTS,
  type Experiment,
  type ExperimentVariant,
  type VariantConfig,
  type MetricType,
  type ExperimentResults,
  type ExperimentEvent,
} from './ab-testing-framework.service';

export {
  AIExplainabilityService,
  aiExplainabilityService,
  type ExtractionExplanation,
  type SourceEvidence,
  type AlternativeInterpretation,
  type ExtractionWarning,
  type ExplainableArtifact,
} from './ai-explainability.service';

export {
  ContractSimilarityService,
  contractSimilarityService,
  type ContractEmbedding,
  type ContractMetadata,
  type SimilarContract,
  type SimilaritySearchOptions,
  type RecommendedTemplate,
} from './contract-similarity.service';

export {
  AutoPromptOptimizerService,
  autoPromptOptimizerService,
  type PromptVersion,
  type PromptMetrics,
  type OptimizationSuggestion,
} from './auto-prompt-optimizer.service';

export {
  ConfidenceCalibrationService,
  confidenceCalibrationService,
  type CalibrationBucket,
  type CalibrationCurve,
  type CalibrationDataPoint,
  type CalibratedConfidence,
} from './confidence-calibration.service';

export {
  MultiLanguageContractService,
  multiLanguageContractService,
  type SupportedLanguage,
  type LanguageDetectionResult,
  type LocaleConfig,
  type TranslationResult,
  type LanguageAwareExtraction,
} from './multi-language-contract.service';

export {
  AICostOptimizerService,
  aiCostOptimizerService,
  type AIModel,
  type ModelPricing,
  type TokenUsage,
  type CostEstimate,
  type BudgetConfig,
  type UsageReport,
} from './ai-cost-optimizer.service';

// Savings and compliance services
export { costSavingsAnalyzerService } from './cost-savings-analyzer.service';
export { complianceReportingService } from './compliance-reporting.service';
export { enhancedSavingsOpportunitiesService } from './enhanced-savings-opportunities.service';
export { SavingsOpportunityService, savingsOpportunityService } from './savings-opportunity.service';

// Currency services
export { CurrencyAdvancedService, currencyAdvancedService } from './currency-advanced.service';
export { PPPAdjustmentService, pppAdjustmentService } from './ppp-adjustment.service';

// Generator and standardization
export { multiPassGeneratorService } from './multi-pass-generator.service';
export { dataStandardizationService } from './data-standardization.service';

// Rate card services
export { rateCardIntelligenceService } from './rate-card-intelligence.service';
export { rateCardManagementService } from './rate-card-management.service';
export { enhancedRateAnalyticsService } from './enhanced-rate-analytics.service';
export { rateCalculationEngine } from './rate-calculation.engine';
export { RateCardBenchmarkingEngine, RateCardBenchmarkingEngine as rateCardBenchmarkingService } from './rate-card-benchmarking.service';
export { RateCardEntryService, RateCardEntryService as rateCardEntryService } from './rate-card-entry.service';
export { roleStandardizationService } from './role-standardization.service';
export { rateCardClusteringService } from './rate-card-clustering.service';

// Cache services
export { smartCacheService } from './smart-cache.service';
export { databaseOptimizationService } from './database-optimization.service';
export { MultiLevelCacheService, multiLevelCache } from './multi-level-cache.service';
export { cacheInvalidationService } from './cache-invalidation.service';

// Indexing and taxonomy
export { contractIndexingService } from './contract-indexing.service';
export { taxonomyService } from './taxonomy.service';

// Workflow and events
export { workflowService } from './workflow.service';
export { 
  WorkflowManagementService,
  workflowManagementService,
  getWorkflowManagementService,
  WORKFLOW_TEMPLATES,
  type WorkflowTemplateKey,
  type WorkflowDefinition,
  type WorkflowStepDefinition,
  type WorkflowConfig,
  type StepConfig,
  type StepCondition,
  type WorkflowExecutionRequest,
  type StepActionRequest,
  type WorkflowProgress,
  type StepProgress,
  type WorkflowEvent,
  type WorkflowType,
  type WorkflowStatus,
  type StepStatus,
} from './workflow-management.service';
export { eventOrchestratorService } from './event-orchestrator.service';
export { rateCardEvents, emitWithSideEffects, contractEvents, artifactEvents, benchmarkEvents } from './event-integration.helper';

// Analytics services
export { analyticsService } from './analytics.service';
export { analyticalIntelligenceService } from './analytical-intelligence.service';
export { analyticalSyncService } from './analytical-sync.service';

// Reporting services
export { reportGeneratorService } from './report-generator.service';
export { reportExportService } from './report-export.service';

// Metadata and locking
export { metadataEditorService } from './metadata-editor.service';
export { optimisticLockingService, OptimisticLockError } from './optimistic-locking.service';

// Data integrity
export { dataIntegrityService } from './data-integrity.service';
export { transactionManager, transactionManager as transactionManagerService } from './transaction-manager.service';
export { dataConsistencyAuditService } from './data-consistency-audit.service';

// Monitoring services
export { monitoringService } from './monitoring.service';
export { alertingService } from './alerting.service';
export { alertChecker } from './alert-checker';
export { healthCheckService } from './health-check.service';

// Import services
export { csvImportService } from './csv-import.service';

// Supplier services
export { SupplierBenchmarkService, SupplierBenchmarkService as supplierBenchmarkService } from './supplier-benchmark.service';
export { supplierAlertService } from './supplier-alert.service';

// Performance services
export { PerformanceOptimizationService, PerformanceOptimizationService as performanceOptimizationService } from './performance-optimization.service';
export { QueryOptimizerService, QueryOptimizerService as queryOptimizerService } from './query-optimizer.service';

// Analytics
export { PredictiveAnalyticsService, PredictiveAnalyticsService as predictiveAnalyticsService } from './predictive-analytics.service';

// Quality services
export { DataQualityScorerService, DataQualityScorerService as dataQualityScorerService } from './data-quality-scorer.service';
export { OutlierDetectorService, OutlierDetectorService as outlierDetectorService } from './outlier-detector.service';

// Opportunity services
export { consolidationOpportunityService } from './consolidation-opportunity.service';
export { geographicArbitrageService } from './geographic-arbitrage.service';

// Benchmark services
export { RealTimeBenchmarkService, RealTimeBenchmarkService as realTimeBenchmarkService } from './real-time-benchmark.service';
export { BenchmarkInvalidationService, BenchmarkInvalidationService as benchmarkInvalidationService } from './benchmark-invalidation.service';
export { RealTimeBenchmarkOrchestrator, RealTimeBenchmarkOrchestrator as realTimeBenchmarkOrchestratorService } from './real-time-benchmark-orchestrator.service';
export { BenchmarkNotificationService, BenchmarkNotificationService as benchmarkNotificationService } from './benchmark-notification.service';

// Filter and segment
export { AdvancedFilterService, AdvancedFilterService as advancedFilterService } from './advanced-filter.service';
export { SegmentManagementService, SegmentManagementService as segmentManagementService } from './segment-management.service';

// Notification services
export { notificationService } from './notification.service';
export { automatedReportingService } from './automated-reporting.service';

// SSE services
export { SSEReconnectionService, SSEReconnectionService as sseReconnectionService } from './sse-reconnection.service';
export { connectionCleanupScheduler, connectionCleanupScheduler as connectionCleanupSchedulerService } from './connection-cleanup-scheduler.service';

// Memory management
export { memoryManager, memoryManager as memoryManagerService } from './memory-manager.service';
export { resourceMonitor, resourceMonitor as resourceMonitorService } from './resource-monitor.service';

// Retention
export { dataRetentionService } from './data-retention.service';

// Negotiation
export { NegotiationAssistantService, NegotiationAssistantService as negotiationAssistantService } from './negotiation-assistant.service';
export { negotiationAssistantEnhancedService } from './negotiation-assistant-enhanced.service';
export { negotiationScenarioService } from './negotiation-scenario.service';

// Intelligence services
export { AlertManagementService, AlertManagementService as alertManagementService } from './alert-management.service';
export { CompetitiveIntelligenceService, CompetitiveIntelligenceService as competitiveIntelligenceService } from './competitive-intelligence.service';
export { SupplierIntelligenceService, supplierIntelligenceService } from './supplier-intelligence.service';
export { SupplierRecommenderService, supplierRecommenderService } from './supplier-recommender.service';
export { SupplierTrendAnalyzerService, supplierTrendAnalyzerService } from './supplier-trend-analyzer.service';
export { MarketIntelligenceService, MarketIntelligenceService as marketIntelligenceService } from './market-intelligence.service';
export { StrategicRecommendationsService, StrategicRecommendationsService as strategicRecommendationsService } from './strategic-recommendations.service';
export { AnomalyExplainerService, AnomalyExplainerService as anomalyExplainerService } from './anomaly-explainer.service';
export { AIInsightsGeneratorService, AIInsightsGeneratorService as aiInsightsGeneratorService } from './ai-insights-generator.service';
// export { ragIntegrationService } from './rag-integration.service'; // Excluded in tsconfig

// Extraction services
export { rateCardExtractionService } from './rate-card-extraction.service';
export { tableExtractionService } from './table-extraction.service';
export { advancedExtractionIntelligence } from './advanced-extraction-intelligence.service';
export { smartFallbackChain } from './smart-fallback-chain.service';
export { extractionLearning } from './extraction-learning.service';
export { ClauseLevelExtractionService, ClauseLevelExtractionService as clauseLevelExtractionService } from './clause-level-extraction.service';
export { templateDetectionService } from './template-detection.service';
export { smartAutoCorrectionService } from './smart-auto-correction.service';

// Other services
export { BaselineManagementService, BaselineManagementService as baselineManagementService } from './baseline-management.service';
export { fileIntegrityService } from './file-integrity.service';
export { artifactService } from './artifact.service';
export { webhookService } from './webhook.service';
export { sseConnectionManager, sseConnectionManager as sseConnectionManagerService } from './sse-connection-manager.service';
export { dataSanitizationService } from './data-sanitization.service';
export { artifactValidationService } from './artifact-validation.service';
export { conversationMemoryService } from './conversation-memory.service';

// Real-time Extraction Streaming Services
export {
  ExtractionStreamingService,
  extractionStreamingService,
  type ExtractionPhase,
  type ExtractionProgress,
  type ExtractionEvent,
  type ExtractionSession,
  type StreamingConfig,
} from './extraction-streaming.service';

// Webhook Notification Services
export {
  ExtractionWebhookService,
  extractionWebhookService,
  type WebhookEventType,
  type WebhookConfig,
  type WebhookPayload,
  type WebhookDelivery,
  type RetryConfig,
} from './extraction-webhook.service';

// Quality Dashboard Services
export {
  ExtractionQualityDashboardService,
  extractionQualityDashboardService,
  type QualityGrade,
  type QualityDashboard,
  type QualityScore,
  type FieldAnalytics,
  type TrendDataPoint,
  type QualityAlert,
} from './extraction-quality-dashboard.service';

// Contract Template Learning Services
export {
  ContractTemplateLearningService,
  contractTemplateLearningService,
  type LearnedTemplate,
  type TemplateStructure,
  type FieldMapping,
  type TemplateLearningSession,
  type DiscoveredPattern,
  type TemplateMatchResult,
} from './contract-template-learning.service';

// Anomaly Detection Services
export {
  ExtractionAnomalyDetectionService,
  extractionAnomalyDetectionService,
  type AnomalyType,
  type AnomalySeverity,
  type DetectedAnomaly,
  type AnomalyRule,
  type FieldStatistics,
  type AnomalyDetectionResult,
} from './extraction-anomaly-detection.service';

// Re-export commonly used types from validation service (the canonical source)
export type { ValidationResult, SanitizationOptions } from './validation.service';

// AI Contract Summarization Services
export {
  AIContractSummarizationService,
  aiContractSummarizationService,
  type SummaryLevel,
  type SummaryRequest,
  type ExecutiveSummary,
  type KeyPoint,
  type SectionSummary,
  type RiskHighlight,
  type FinancialSummary,
  type ContractSummary,
  type SummaryTemplate,
} from './ai-contract-summarization.service';

// Smart Field Validation Services
export {
  SmartFieldValidationService,
  smartFieldValidationService,
  type FieldType,
  type ValidationSeverity,
  type FieldDefinition,
  type ValidationIssue,
  type CrossFieldValidation,
  type ValidationResult as SmartValidationResult,
  type ValidationConfig,
} from './smart-field-validation.service';

// AI Contract Comparison Services
export {
  AIContractComparisonService,
  aiContractComparisonService,
  type ComparisonType,
  type ContractData,
  type FieldComparison,
  type ClauseComparison,
  type RiskDifferential,
  type FinancialComparison,
  type TermsComparison,
  type ComparisonSummary,
  type ContractComparisonResult,
} from './ai-contract-comparison.service';

// Extraction Confidence Boosting Services
export {
  ExtractionConfidenceBoostingService,
  extractionConfidenceBoostingService,
  type BoostingStrategy,
  type ExtractionResult,
  type EvidenceItem,
  type BoostedExtraction,
  type ModelVote,
  type ConsensusResult,
  type HistoricalAccuracy,
  type BoostingConfig,
} from './extraction-confidence-boosting.service';

// Context-Aware Prompt Builder Services
export {
  ContextAwarePromptBuilderService,
  contextAwarePromptBuilderService,
  type PromptStyle,
  type ExtractionMode,
  type PromptContext,
  type FieldPromptConfig,
  type PromptTemplate,
  type GeneratedPrompt,
  type PromptPerformance,
  type LearningFeedback,
} from './context-aware-prompt-builder.service';

// Enterprise AI Governance & Analytics Services

// AI Decision Audit Service - Complete AI decision tracking and compliance
export {
  AIDecisionAuditService,
  aiDecisionAuditService,
  type AIFeature,
  type DecisionOutcome,
  type AIDecision,
  type Citation,
  type EvidenceItem as AuditEvidenceItem,
  type UserFeedback,
  type AIUsageStats,
  type ComplianceReport,
  type RiskFlag,
} from './ai-decision-audit.service';

// Contract Knowledge Graph Service - Semantic entity and relationship mapping
export {
  ContractKnowledgeGraphService,
  contractKnowledgeGraphService,
  type EntityType,
  type RelationType,
  type GraphEntity,
  type GraphRelation,
  type SubGraph,
  type PathResult,
  type GraphStats,
} from './contract-knowledge-graph.service';

// AI Obligation Tracker Service - Intelligent obligation extraction and tracking
export {
  AIObligationTrackerService,
  aiObligationTrackerService,
  type ObligationType,
  type ObligationStatus,
  type ObligationPriority,
  type Obligation,
  type ObligationAlert,
  type ObligationSummary,
  type ComplianceSnapshot,
} from './ai-obligation-tracker.service';

// Predictive Analytics Engine - AI-powered contract predictions
export {
  PredictiveAnalyticsEngine,
  predictiveAnalyticsEngine,
  type PredictionType,
  type TimeHorizon,
  type Prediction,
  type PredictionFactor,
  type ContractFeatures,
  type RiskForecast,
  type ValueOptimization,
  type PortfolioPrediction,
} from './predictive-analytics-engine.service';

// AI Model Registry Service - Enterprise model governance and versioning
export {
  AIModelRegistryService,
  aiModelRegistryService,
  type ModelProvider,
  type ModelStatus,
  type ModelCapability as RegistryModelCapability,
  type ModelVersion,
  type RegisteredModel,
  type ModelPerformance,
  type ModelComparison,
  type ModelRecommendation,
} from './ai-model-registry.service';

// Self-Critique Service - Automatic quality validation
export {
  SelfCritiqueService,
  selfCritiqueService,
  getSelfCritiqueService,
  withSelfCritique,
  ArtifactValidationSchemas,
  type CritiqueResult,
  type CritiqueIssue,
  type CritiqueConfig,
  type CritiqueCheck,
  type ArtifactContext as CritiqueArtifactContext,
} from './self-critique.service';

// Episodic Memory Service - Long-term AI interaction memory
export {
  EpisodicMemoryService,
  episodicMemoryService,
  getEpisodicMemoryService,
  withMemory,
  type EpisodicMemory,
  type MemoryType,
  type MemoryContext,
  type MemoryQuery,
  type MemorySearchResult,
  type MemoryStats,
} from './episodic-memory.service';

// Multi-Agent Debate Service - Adversarial validation through agent debate
export {
  MultiAgentDebateService,
  getMultiAgentDebateService,
  conductDebate,
  quickDebate,
  DEBATE_PRESETS,
  type DebateAgent,
  type DebateRole,
  type DebateTurn,
  type DebateArgument,
  type DebateResult,
  type DebateConfig,
  type DebateContext,
} from './multi-agent-debate.service';

// ============================================================================
// PREMIUM ADD-ON MODULES
// ============================================================================

// AI Copilot Service - Real-time drafting assistance
export {
  AICopilotService,
  getAICopilotService,
  aiCopilotService,
  type CopilotContext,
  type RealtimeSuggestion,
  type RiskHighlight as CopilotRiskHighlight,
  type AutoCompleteResult,
  type CopilotResponse,
} from './ai-copilot.service';

// Legal Review Service - Playbook management and redlining
export {
  LegalReviewService,
  getLegalReviewService,
  legalReviewService,
  type Playbook,
  type PlaybookClause,
  type FallbackPosition,
  type RedlineChange,
  type ClauseRiskAssessment,
  type LegalReviewResult,
} from './legal-review.service';

// Contract Generation Service - NL to contract generation
export {
  ContractGenerationService,
  getContractGenerationService,
  contractGenerationService,
  type ContractTemplateType,
  type GenerationLanguage,
  type GenerationRequest,
  type ContractVariables,
  type GenerationOptions,
  type GeneratedContract,
  type GeneratedClause,
  type ExtractedVariables,
  type GenerationMetadata,
  type ComplianceCheck,
  type AlternativeVersion,
} from './contract-generation.service';

// Workflow Auto-Start Service - Automatic workflow triggering
export {
  WorkflowAutoStartService,
  getWorkflowAutoStartService,
  workflowAutoStartService,
  type WorkflowTemplateKey as AutoStartWorkflowTemplateKey,
  type AutoStartRule,
  type AutoStartCondition,
} from './workflow-auto-start.service';

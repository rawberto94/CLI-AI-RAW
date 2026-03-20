// Export service instances only
// For types, import directly from specific service files to avoid conflicts

// Core services
export { contractService } from './contract.service';
export { auditTrailService } from './audit-trail.service';
export { validationService } from './validation.service';

// Artifact services
export { artifactVersioningService } from './artifact-versioning.service';
export { confidenceScoringService } from './confidence-scoring.service';
export {
  aiArtifactGeneratorService,
  type GenerationMethod,
  type GenerationOptions,
  type GenerationResult,
  type GeneratorConfig,
  type AdvancedGenerationResult,
  type BatchGenerationResult,
  type ParallelProgress,
  type ParallelOptions,
  type ParallelGenerationResult,
} from './ai-artifact-generator.service';
export { artifactPromptTemplatesService } from './artifact-prompt-templates.service';
export { artifactValidationService } from './artifact-validation.service';

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

// Savings services
export { costSavingsAnalyzerService } from './cost-savings-analyzer.service';
export { SavingsOpportunityService, savingsOpportunityService } from './savings-opportunity.service';

// Rate card services
export { RateCardBenchmarkingEngine, RateCardBenchmarkingEngine as rateCardBenchmarkingService } from './rate-card-benchmarking.service';
export { RateCardEntryService, RateCardEntryService as rateCardEntryService } from './rate-card-entry.service';
export { rateCardClusteringService } from './rate-card-clustering.service';
export { rateCardExtractionService } from './rate-card-extraction.service';

// Cache services
export { smartCacheService } from './smart-cache.service';
export { MultiLevelCacheService, multiLevelCache } from './multi-level-cache.service';
export { cacheInvalidationService } from './cache-invalidation.service';

// Indexing and taxonomy
export { contractIndexingService } from './contract-indexing.service';
export { taxonomyService } from './taxonomy.service';
export { taxonomyRagIntegrationService } from './taxonomy-rag-integration.service';

// Events
export { rateCardEvents, emitWithSideEffects, contractEvents, artifactEvents, benchmarkEvents } from './event-integration.helper';

// Analytics services
export { analyticsService } from './analytics.service';
export { analyticalIntelligenceService } from './analytical-intelligence.service';

// Metadata and locking
export { optimisticLockingService, OptimisticLockError } from './optimistic-locking.service';

// Monitoring services
export { monitoringService } from './monitoring.service';
export { alertingService } from './alerting.service';
export { healthCheckService } from './health-check.service';

// Import services
export { csvImportService } from './csv-import.service';

// Supplier services
export { SupplierBenchmarkService, SupplierBenchmarkService as supplierBenchmarkService } from './supplier-benchmark.service';
export { SupplierIntelligenceService, supplierIntelligenceService } from './supplier-intelligence.service';
export { SupplierTrendAnalyzerService, supplierTrendAnalyzerService } from './supplier-trend-analyzer.service';

// Performance services
export { PerformanceOptimizationService, PerformanceOptimizationService as performanceOptimizationService } from './performance-optimization.service';

// Analytics
export { PredictiveAnalyticsService, PredictiveAnalyticsService as predictiveAnalyticsService } from './predictive-analytics.service';
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

// Benchmark services
export { RealTimeBenchmarkService, RealTimeBenchmarkService as realTimeBenchmarkService } from './real-time-benchmark.service';
export { BenchmarkInvalidationService, BenchmarkInvalidationService as benchmarkInvalidationService } from './benchmark-invalidation.service';

// Notification services
export { notificationService } from './notification.service';

// SSE services
export { sseConnectionManager, sseConnectionManager as sseConnectionManagerService } from './sse-connection-manager.service';

// Memory management
export { memoryManager, memoryManager as memoryManagerService } from './memory-manager.service';

// Negotiation
export { NegotiationAssistantService, NegotiationAssistantService as negotiationAssistantService } from './negotiation-assistant.service';

// Intelligence services
export { MarketIntelligenceService, MarketIntelligenceService as marketIntelligenceService } from './market-intelligence.service';

// Other services
export { fileIntegrityService } from './file-integrity.service';
export { artifactService } from './artifact.service';
export { webhookService } from './webhook.service';
export { knowledgeGraphService } from './knowledge-graph.service';
export { inputValidationService } from './input-validation.service';
export { similarityCalculatorService } from './similarity-calculator.service';

// AI Decision & Compliance
export {
  AIDecisionAuditService,
  aiDecisionAuditService,
  type AIFeature,
  type DecisionOutcome,
  type AIDecision,
  type Citation,
  type EvidenceItem,
  type UserFeedback,
  type AIUsageStats,
  type ComplianceReport,
  type RiskFlag,
} from './ai-decision-audit.service';

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

// Relationship detection
export {
  RelationshipDetectionService,
  relationshipDetectionService,
  type RelationshipType,
  type RelationshipDirection,
  type DetectedRelationship,
  type RelationshipEvidence,
  type RelationshipQuery,
  type RelationshipGraph,
  type ContractNode,
  type RelationshipEdge,
  type ContractCluster,
  type NavigationSuggestion,
} from './relationship-detection.service';

// Workflow
export {
  WorkflowAutoStartService,
  getWorkflowAutoStartService,
  workflowAutoStartService,
  type AutoStartRule,
  type AutoStartCondition,
} from './workflow-auto-start.service';

// Artifact editing
export { EditableArtifactService, editableArtifactService } from './editable-artifact.service';

// Metadata editing
export { MetadataEditorService, metadataEditorService } from './metadata-editor.service';

// Contract hierarchy
export { ContractHierarchyService, contractHierarchyService } from './contract-hierarchy.service';

// Agent context enrichment
export {
  AgentContextEnrichmentService,
  agentContextEnrichmentService,
  type EnrichedAgentContext,
  type ContractArtifacts,
  type GraphInsights,
} from './agent-context-enrichment.service';

// Re-export commonly used types from validation service (the canonical source)
export type { ValidationResult, SanitizationOptions } from './validation.service';

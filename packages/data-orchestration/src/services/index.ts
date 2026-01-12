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
export { eventOrchestratorService } from './event-orchestrator.service';
export { rateCardEvents, emitWithSideEffects, contractEvents, artifactEvents, benchmarkEvents } from './event-integration.helper';

// Analytics services
export { analyticsService } from './analytics.service';
export { analyticalIntelligenceService } from './analytical-intelligence.service';
export { analyticalSyncService } from './analytical-sync.service';

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

// Re-export commonly used types from validation service (the canonical source)
export type { ValidationResult, SanitizationOptions } from './validation.service';

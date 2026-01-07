// Export service instances only
// For types, import directly from specific service files to avoid conflicts

// Core services
export { contractService } from './contract.service';
export { processingJobService } from './processing-job.service';
export { auditTrailService } from './audit-trail.service';
export { chunkedUploadService } from './chunked-upload.service';
export { validationService } from './validation.service';

// Artifact services
export { artifactVersioningService } from './artifact-versioning.service';
export { confidenceScoringService } from './confidence-scoring.service';
export { aiArtifactGeneratorService } from './ai-artifact-generator.service';
export { parallelArtifactGeneratorService } from './parallel-artifact-generator.service';
export { enhancedArtifactService } from './enhanced-artifact.service';
export { artifactPromptTemplatesService } from './artifact-prompt-templates.service';
export { artifactContextEnrichmentService } from './artifact-context-enrichment.service';
export { hybridArtifactStorageService } from './hybrid-artifact-storage.service';
export { editableArtifactService } from './editable-artifact.service';
export { artifactChangePropagationService } from './artifact-change-propagation.service';

// Savings and compliance services
export { costSavingsAnalyzerService } from './cost-savings-analyzer.service';
export { complianceReportingService } from './compliance-reporting.service';
export { enhancedSavingsOpportunitiesService } from './enhanced-savings-opportunities.service';
export { savingsOpportunityService } from './savings-opportunity.service';

// Currency services
export { currencyAdvancedService } from './currency-advanced.service';
export { pppAdjustmentService } from './ppp-adjustment.service';

// Generator and standardization
export { multiPassGeneratorService } from './multi-pass-generator.service';
export { dataStandardizationService } from './data-standardization.service';

// Rate card services
export { rateCardIntelligenceService } from './rate-card-intelligence.service';
export { rateCardManagementService } from './rate-card-management.service';
export { enhancedRateAnalyticsService } from './enhanced-rate-analytics.service';
export { rateCalculationEngine } from './rate-calculation.engine';
export { rateCardBenchmarkingService } from './rate-card-benchmarking.service';
export { rateCardEntryService } from './rate-card-entry.service';
export { roleStandardizationService } from './role-standardization.service';
export { rateCardClusteringService } from './rate-card-clustering.service';

// Cache services
export { smartCacheService } from './smart-cache.service';
export { databaseOptimizationService } from './database-optimization.service';
export { multiLevelCacheService } from './multi-level-cache.service';
export { cacheInvalidationService } from './cache-invalidation.service';

// Indexing and taxonomy
export { contractIndexingService } from './contract-indexing.service';
export { taxonomyService } from './taxonomy.service';

// Workflow and events
export { workflowService } from './workflow.service';
export { eventOrchestratorService } from './event-orchestrator.service';
export { eventIntegrationHelper } from './event-integration.helper';

// Analytics services
export { analyticsService } from './analytics.service';
export { analyticalIntelligenceService } from './analytical-intelligence.service';
export { analyticalSyncService } from './analytical-sync.service';

// Metadata and locking
export { metadataEditorService } from './metadata-editor.service';
export { optimisticLockingService } from './optimistic-locking.service';

// Data integrity
export { dataIntegrityService } from './data-integrity.service';
export { transactionManagerService } from './transaction-manager.service';
export { dataConsistencyAuditService } from './data-consistency-audit.service';

// Monitoring services
export { monitoringService } from './monitoring.service';
export { alertingService } from './alerting.service';
export { alertChecker } from './alert-checker';
export { healthCheckService } from './health-check.service';

// Import services
export { csvImportService } from './csv-import.service';

// Supplier services
export { supplierBenchmarkService } from './supplier-benchmark.service';
export { supplierAlertService } from './supplier-alert.service';

// Performance services
export { performanceOptimizationService } from './performance-optimization.service';
export { queryOptimizerService } from './query-optimizer.service';

// Analytics
export { predictiveAnalyticsService } from './predictive-analytics.service';

// Quality services
export { dataQualityScorerService } from './data-quality-scorer.service';
export { outlierDetectorService } from './outlier-detector.service';

// Opportunity services
export { consolidationOpportunityService } from './consolidation-opportunity.service';
export { geographicArbitrageService } from './geographic-arbitrage.service';

// Benchmark services
export { realTimeBenchmarkService } from './real-time-benchmark.service';
export { benchmarkInvalidationService } from './benchmark-invalidation.service';
export { realTimeBenchmarkOrchestratorService } from './real-time-benchmark-orchestrator.service';
export { benchmarkNotificationService } from './benchmark-notification.service';

// Filter and segment
export { advancedFilterService } from './advanced-filter.service';
export { segmentManagementService } from './segment-management.service';

// Notification services
export { notificationService } from './notification.service';
export { automatedReportingService } from './automated-reporting.service';

// SSE services
export { sseReconnectionService } from './sse-reconnection.service';
export { connectionCleanupSchedulerService } from './connection-cleanup-scheduler.service';

// Memory management
export { memoryManagerService } from './memory-manager.service';
export { resourceMonitorService } from './resource-monitor.service';

// Retention
export { dataRetentionService } from './data-retention.service';

// Negotiation
export { negotiationAssistantService } from './negotiation-assistant.service';
export { negotiationAssistantEnhancedService } from './negotiation-assistant-enhanced.service';
export { negotiationScenarioService } from './negotiation-scenario.service';

// Intelligence services
export { alertManagementService } from './alert-management.service';
export { competitiveIntelligenceService } from './competitive-intelligence.service';
export { supplierIntelligenceService } from './supplier-intelligence.service';
export { supplierRecommenderService } from './supplier-recommender.service';
export { supplierTrendAnalyzerService } from './supplier-trend-analyzer.service';
export { marketIntelligenceService } from './market-intelligence.service';
export { strategicRecommendationsService } from './strategic-recommendations.service';
export { anomalyExplainerService } from './anomaly-explainer.service';
export { aiInsightsGeneratorService } from './ai-insights-generator.service';
export { ragIntegrationService } from './rag-integration.service';

// Extraction services
export { rateCardExtractionService } from './rate-card-extraction.service';
export { tableExtractionService } from './table-extraction.service';

// Other services
export { baselineManagementService } from './baseline-management.service';
export { fileIntegrityService } from './file-integrity.service';
export { artifactService } from './artifact.service';
export { webhookService } from './webhook.service';
export { sseConnectionManagerService } from './sse-connection-manager.service';
export { dataSanitizationService } from './data-sanitization.service';
export { artifactValidationService } from './artifact-validation.service';
export { conversationMemoryService } from './conversation-memory.service';

// Re-export commonly used types from validation service (the canonical source)
export type { ValidationResult, SanitizationOptions } from './validation.service';

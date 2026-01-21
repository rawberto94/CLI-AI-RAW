/**
 * AI Services Index
 * 
 * Central export point for all AI-related services.
 */

// Secure AI Processing (with anonymization)
export {
  analyzeContractSecurely,
  processDocumentSecurely,
} from './secure-ai-processor';

// Custom AI Analysis
export {
  customContractAnalysis,
  continueConversation,
  getAnalysisTemplates,
  getTemplateDetails,
  type CustomAnalysisRequest,
  type CustomAnalysisResponse,
  type ConversationMessage,
  type AnalysisTemplate,
} from './custom-analysis';

// Metadata Extraction
export {
  SchemaAwareMetadataExtractor,
  extractMetadataWithSchema,
  extractSpecificFields,
  reExtractLowConfidenceFields,
  type ExtractionResult,
  type ExtractionSummary,
  type MetadataExtractionResult,
  type ExtractionOptions,
} from './metadata-extractor';

// Field Type Extractors
export {
  getExtractorForFieldType,
  extractField,
  extractFieldsBatch,
  extractFieldsSmart,
  prioritizeFields,
  analyzeDocumentForExtraction,
  DateFieldExtractor,
  CurrencyFieldExtractor,
  SelectFieldExtractor,
  PartyFieldExtractor,
  DurationFieldExtractor,
  EmailFieldExtractor,
  PercentageFieldExtractor,
  TextFieldExtractor,
  type FieldExtractionContext,
  type ExtractionResponse,
  type BatchExtractionRequest as FieldBatchRequest,
  type BatchExtractionResult as FieldBatchResult,
  type PrioritizedField,
} from './field-extractors';

// Contract Type Templates
export {
  CONTRACT_TEMPLATES,
  detectContractType,
  getExtractionHintsForType,
  getTemplateById,
  getAllTemplates,
  getTemplatesByCategory,
  mergeTemplateWithSchema,
  validateAgainstTemplate,
  type ContractTypeTemplate,
  type TemplateField,
  type TemplateValidationRule,
} from './contract-templates';

// Confidence Calibration (learning from feedback)
export {
  ConfidenceCalibrationService,
  getCalibrationService,
  recordExtractionFeedback,
  calibrateConfidence,
  type ExtractionFeedback,
  type FieldAccuracyStats,
  type CalibrationConfig,
  type ConfidenceAdjustment,
} from './confidence-calibration';

// Extraction Queue (background processing)
export {
  ExtractionQueueService,
  getExtractionQueue,
  resetExtractionQueue,
  queueMetadataExtraction,
  queueBulkMetadataExtraction,
  waitForJob,
  type ExtractionJob,
  type ExtractionJobOptions,
  type JobStatus,
  type QueueStats,
  type BatchExtractionRequest,
  type BatchExtractionResult,
} from './extraction-queue';

// Field Value Validation
export {
  FieldValueValidator,
  validateField,
  validateDateRange,
  validateCurrencyMatch,
  type ValidationResult,
  type ValidationIssue,
  type ValidationIssueType,
  type FieldSuggestion,
  type CrossValidationResult,
  type ValidationRules,
} from './field-validator';

// Extraction Analytics
export {
  ExtractionAnalyticsService,
  getExtractionAnalytics,
  type ExtractionEvent,
  type ExtractionEventType,
  type FieldTypeMetrics,
  type TenantAnalytics,
  type GlobalAnalytics,
} from './extraction-analytics';

// Adaptive Prompt Builder
export {
  AdaptivePromptBuilder,
  promptBuilder,
  buildExtractionPrompt,
  buildReExtractionPrompt,
  buildFieldPrompt,
  type PromptContext,
  type DocumentCharacteristics,
  type GeneratedPrompt,
  type FieldPrompt,
} from './adaptive-prompt-builder';

// Extraction Presets
export {
  EXTRACTION_PRESETS,
  getPreset,
  getAllPresets,
  getPresetsForContractType,
  applyPreset,
  estimateExtractionTime,
  createCustomPreset,
  type PresetId,
  type ExtractionPreset,
  type PresetSettings,
  type PostProcessingOptions,
} from './extraction-presets';

// Enhanced Secure Processing
export {
  analyzeContractIntelligently,
  processDocumentAdvanced,
  isEUCompliantOCRConfigured,
  getRecommendedProvider,
  type IntelligentAnalysisResult,
  type AdvancedAnalysisResult,
  type AdvancedProcessingOptions,
  type ProcessingStage,
  type ProgressCallback,
  type StreamingOptions,
} from './secure-ai-processor';

// Data Anonymization
export {
  ContractAnonymizer,
  anonymizer,
  storeMappings,
  retrieveMappings,
  cleanupExpiredMappings,
  processWithAnonymization,
  type AnonymizationMapping,
  type EntityType,
  type AnonymizationResult,
  type SecureAIOptions,
} from './anonymizer';

// EU-Compliant OCR
export {
  performAzureSwitzerlandOCR,
  performAzureEUOCR,
  performGoogleEUOCR,
  performOVHCloudOCR,
  getAvailableProviders,
  logProviderStatus,
  type OCRResult,
  type PageResult,
  type TextBlock,
  type TableResult,
  type BoundingBox,
  type OCROptions,
} from './eu-compliant-ocr';

// AWS Textract Client (State-of-the-art table extraction)
export {
  AWSTextractClient,
  analyzeWithTextract,
  extractTablesWithTextract,
  extractFormsWithTextract,
  queryTextract,
  getTextractClient,
  type TextractConfig,
  type TextractResult,
  type TextractTable,
  type TextractTableRow,
  type TextractTableCell,
  type TextractFormField,
  type TextractSignature,
  type TextractHandwriting,
  type TextractOptions,
  type TextractQuery,
} from './aws-textract-client';

// Vision Document Analyzer (Multi-pass GPT-4o Vision)
export {
  VisionDocumentAnalyzer,
  analyzeDocumentWithVision,
  extractTextWithVision,
  extractTablesWithVision,
  detectSignaturesWithVision,
  getVisionAnalyzer,
  type VisionAnalysisResult,
  type VisionPage,
  type VisionTable,
  type VisionSignature,
  type VisionHandwriting,
  type DocumentStructure,
  type VisionAnalysisOptions,
} from './vision-document-analyzer';

// Hybrid OCR Orchestrator (Combines all engines)
export {
  HybridOCROrchestrator,
  getHybridOCR,
  processDocumentHybrid,
  processDocumentFast,
  processDocumentHighAccuracy,
  processDocumentMax,
  type OCRMode,
  type HybridOCRResult,
  type UnifiedTable,
  type FormField,
  type SignatureInfo,
  type HandwritingInfo,
  type DocumentStructureInfo,
  type ProcessingMetadata,
  type DocumentComplexity,
  type HybridOCROptions,
} from './hybrid-ocr-orchestrator';

// Document Preprocessing
export {
  DocumentPreprocessor,
  documentPreprocessor,
  preprocessForOCR,
  smartPreprocessForOCR,
  analyzeDocumentQuality,
  shouldPreprocess,
  type PreprocessingOptions,
  type PreprocessingResult,
  type PagePreprocessingResult,
  type ImageQualityMetrics,
} from './document-preprocessor';

// Contract Categorization
export {
  AIContractCategorizer,
  type ContractCategorizationResult,
  type CategorizationOptions,
  type ContractTypeCategory,
  type IndustrySector,
  type RiskLevel,
  type RegulatoryDomain,
  type CategorizationDimension,
} from './contract-categorizer';

// Semantic Cache Service
export {
  SemanticCacheService,
  semanticCache,
  DEFAULT_CACHE_CONFIG,
  type CacheEntry,
  type CachedResponse,
  type CacheConfig,
  type CacheStats,
} from './semantic-cache.service';

// Agentic Chat Service (OpenAI Function Calling)
export {
  agenticChat,
  CHAT_TOOLS,
  TOOL_EXECUTORS,
  type AgenticToolResult,
  type AgenticResponse,
} from './agentic-chat.service';

// Episodic Memory Integration
export {
  retrieveRelevantMemories,
  storeMemory,
  formatMemoriesForPrompt,
  extractMemoriesFromConversation,
  applyMemoryDecay,
  consolidateMemories,
  type Memory,
  type MemoryRetrievalOptions,
  type MemoryStorageInput,
} from './episodic-memory-integration';

// Multi-Modal Document Analysis (GPT-4o Vision)
export {
  analyzeDocumentImage,
  analyzeMultiPageDocument,
  ocrDocument,
  extractDocumentTables,
  detectDocumentSignatures,
  compareDocumentVersions,
  storeDocumentAnalysis,
  type DocumentImage,
  type AnalysisOptions as MultiModalAnalysisOptions,
  type DocumentAnalysisResult,
  type ExtractedTable as MultiModalTable,
  type SignatureInfo as MultiModalSignature,
  type DocumentLayout,
  type ExtractedEntity,
} from './multimodal-analysis.service';

// ============================================
// New Services (Session 2)
// ============================================

// AI Response Caching
export { aiCache, withCache } from './cache.service';
export type { CacheEntry, CacheConfig, CacheStats } from './cache.service';

// Prompt Templates Library
export { promptTemplates, buildPrompt } from './prompt-templates';
export type {
  PromptTemplate,
  TemplateCategory,
  TemplateVariable,
  BuiltPrompt,
} from './prompt-templates';

// Scheduled Analysis Service
export { scheduledAnalysis } from './scheduled-analysis.service';
export type {
  ScheduledJob,
  JobRun,
  JobRunResults,
  ScheduleType,
  CronSchedule,
  JobConfig,
  JobStatus,
} from './scheduled-analysis.service';

// Offline Queue Service
export {
  offlineQueue,
  useOfflineQueue,
  offlineFetch,
} from './offline-queue.service';
export type {
  QueuedRequest,
  OfflineQueueConfig,
  SyncResult,
} from './offline-queue.service';

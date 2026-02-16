/**
 * OCR Enhancement Suite - Complete Index
 * 
 * This module exports all OCR enhancement components for the Contigo platform.
 * 
 * Components:
 * - OCR Enhancements: Local correction pipeline (deskew, dictionary, validation)
 * - LLM Enhancement: AI-powered spell correction with Swiss data protection
 * - Human Review Queue: Route low-confidence docs for manual review
 * - Legal NER: Named entity recognition for legal documents
 * - Document Pre-classification: Route documents to optimal OCR model
 * - Batch Processor: Parallel processing for multiple documents
 * - Handwriting Detection: Detect and handle handwritten content
 * - Multi-language OCR: Support for DE/FR/IT/EN
 */

// ============================================================================
// CORE OCR ENHANCEMENTS
// ============================================================================

export {
  runOCREnhancementPipeline,
  type OCREnhancementPipelineResult,
  type OCREnhancementResult,
  type OCRCorrection,
  type ValidationResult,
  type EnhancementMetrics,
} from '../ocr-enhancements';

export {
  runHybridEnhancement,
  llmSpellCorrection,
  anonymizePII,
  restorePII,
  type HybridEnhancementResult,
  type HybridEnhancementOptions,
  type DataProtectionConfig,
  type AIProviderConfig,
} from '../ocr-llm-enhancement';

// ============================================================================
// HUMAN REVIEW SYSTEM
// ============================================================================

export {
  HumanReviewQueue,
  addToReviewQueue,
  getReviewQueue,
  getReviewItem,
  assignReview,
  submitReviewCorrections,
  escalateReview,
  getQueueStats,
  getNextReviewItem,
  needsHumanReview,
  calculateReviewPriority,
  type ReviewItem,
  type ReviewPriority,
  type ReviewStatus,
  type ReviewType,
  type ReviewQueueFilters,
  type ReviewQueueStats,
  type CreateReviewRequest,
} from '../human-review-queue';

// ============================================================================
// LEGAL NER
// ============================================================================

export {
  LegalNER,
  extractLegalEntities,
  extractContractMetadata,
  type ExtractedEntity,
  type EntityType,
  type NERResult,
  type NEROptions,
} from '../legal-ner';

// ============================================================================
// DOCUMENT PRE-CLASSIFICATION
// ============================================================================

export {
  DocumentPreClassifier,
  classifyDocument,
  quickClassify,
  type DocumentClassification,
  type DocumentCategory,
  type ContractType,
  type DocumentQuality,
  type OCRModel,
  type DocumentCharacteristics,
  type PreprocessingStep,
  type ClassificationOptions,
} from '../document-preclassification';

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export {
  OCRBatchProcessor,
  BatchProcessor,
  getDefaultBatchProcessor,
  createBatchFromPaths,
  createBatchFromBuffers,
  type BatchJob,
  type BatchPriority,
  type JobStatus,
  type DocumentInput,
  type DocumentResult,
  type BatchProgress,
  type BatchError,
  type BatchOptions,
  type ProcessorConfig,
} from '../ocr-batch-processor';

// ============================================================================
// HANDWRITING DETECTION
// ============================================================================

export {
  HandwritingDetector,
  analyzeHandwriting,
  detectSignaturesOnly,
  hasHandwriting,
  type HandwritingAnalysisResult,
  type HandwrittenRegion,
  type SignatureInfo,
  type HandwritingType,
  type ProcessingRecommendation,
  type HandwritingSummary,
  type DetectionOptions,
  type BoundingBox,
} from '../handwriting-detection';

// ============================================================================
// MULTI-LANGUAGE SUPPORT
// ============================================================================

export {
  MultiLangOCR,
  detectLanguage,
  processMultiLangOCR,
  applySpellCorrections,
  getTesseractLanguageString,
  containsSwissContent,
  LANG_TO_TESSERACT,
  TESSERACT_TO_LANG,
  LANGUAGE_NAMES,
  type SupportedLanguage,
  type TesseractLangCode,
  type LanguageDetectionResult,
  type MultiLangOCROptions,
  type MultiLangOCRResult,
  type LanguageSpecificCorrection,
} from '../multilang-ocr';

// ============================================================================
// UNIFIED PIPELINE
// ============================================================================

import { runOCREnhancementPipeline as runLocalEnhancements } from '../ocr-enhancements';
import { runHybridEnhancement as runLLMEnhancement } from '../ocr-llm-enhancement';
import { classifyDocument, DocumentPreClassifier } from '../document-preclassification';
import { analyzeHandwriting, HandwritingDetector } from '../handwriting-detection';
import { processMultiLangOCR, MultiLangOCR } from '../multilang-ocr';
import { extractLegalEntities, LegalNER } from '../legal-ner';
import { HumanReviewQueue, needsHumanReview } from '../human-review-queue';
import { BatchProcessor } from '../ocr-batch-processor';

export interface UnifiedOCRPipelineOptions {
  // Pre-processing
  enablePreClassification?: boolean;
  enableHandwritingDetection?: boolean;
  
  // OCR Enhancement
  enableLocalEnhancements?: boolean;
  enableLLMCorrection?: boolean;
  
  // Post-processing
  enableNER?: boolean;
  enableMultiLang?: boolean;
  preferredLanguages?: ('en' | 'de' | 'fr' | 'it')[];
  
  // Review routing
  autoRouteToReview?: boolean;
  reviewConfidenceThreshold?: number;
  
  // Data protection
  anonymizePII?: boolean;
  dataResidency?: 'CH' | 'EU' | 'ANY';
}

export interface UnifiedOCRPipelineResult {
  // Core results
  text: string;
  confidence: number;
  
  // Classification
  documentCategory?: string;
  contractType?: string;
  
  // Language
  detectedLanguage?: string;
  isMixedLanguage?: boolean;
  
  // Handwriting
  hasHandwriting?: boolean;
  handwritingPercentage?: number;
  
  // Entities
  entities?: unknown[];
  
  // Review
  needsReview: boolean;
  reviewId?: string;
  
  // Processing info
  processingSteps: string[];
  totalTime: number;
  warnings: string[];
}

/**
 * Run the complete unified OCR pipeline
 */
export async function runUnifiedOCRPipeline(
  text: string,
  options: UnifiedOCRPipelineOptions = {}
): Promise<UnifiedOCRPipelineResult> {
  const startTime = Date.now();
  const processingSteps: string[] = [];
  const warnings: string[] = [];
  let processedText = text;
  let confidence = 0.7; // Default confidence

  const {
    enablePreClassification = true,
    enableHandwritingDetection = true,
    enableLocalEnhancements = true,
    enableLLMCorrection = true,
    enableNER = true,
    enableMultiLang = true,
    preferredLanguages = ['en', 'de', 'fr', 'it'],
    autoRouteToReview = true,
    reviewConfidenceThreshold = 0.7,
    anonymizePII = true,
    dataResidency = 'CH',
  } = options;

  let documentCategory: string | undefined;
  let contractType: string | undefined;
  let detectedLanguage: string | undefined;
  let isMixedLanguage = false;
  let hasHandwritingFlag = false;
  let handwritingPercentage = 0;
  let entities: unknown[] = [];

  // Step 1: Pre-classification
  if (enablePreClassification) {
    try {
      const classification = await classifyDocument(text, { quickMode: true });
      documentCategory = classification.category;
      contractType = classification.contractType;
      processingSteps.push('pre-classification');
    } catch (error) {
      warnings.push(`Pre-classification failed: ${error}`);
    }
  }

  // Step 2: Handwriting detection
  if (enableHandwritingDetection) {
    try {
      const handwriting = await analyzeHandwriting(text);
      hasHandwritingFlag = handwriting.hasHandwriting;
      handwritingPercentage = handwriting.handwritingPercentage;
      if (handwriting.needsManualReview) {
        warnings.push('Document contains handwriting that may need manual review');
      }
      processingSteps.push('handwriting-detection');
    } catch (error) {
      warnings.push(`Handwriting detection failed: ${error}`);
    }
  }

  // Step 3: Multi-language processing
  if (enableMultiLang) {
    try {
      const langResult = await processMultiLangOCR(processedText, {
        preferredLanguages: preferredLanguages as ('en' | 'de' | 'fr' | 'it')[],
        autoDetect: true,
        enableSpellCheck: true,
        enableSpecializedDictionaries: true,
      });
      processedText = langResult.text;
      detectedLanguage = langResult.detectedLanguages.primaryLanguage;
      isMixedLanguage = langResult.detectedLanguages.isMixedLanguage;
      processingSteps.push('multi-lang-ocr');
    } catch (error) {
      warnings.push(`Multi-language processing failed: ${error}`);
    }
  }

  // Step 4: Local OCR enhancements (skipped - requires image buffer, not text)
  // The local enhancement pipeline needs original image buffer
  // This unified pipeline works on pre-OCR'd text for post-processing
  if (enableLocalEnhancements) {
    processingSteps.push('local-enhancements-skipped');
    warnings.push('Local enhancements require image buffer - skipped for text-only pipeline');
  }

  // Step 5: LLM-based correction
  if (enableLLMCorrection) {
    try {
      const llmResult = await runLLMEnhancement(processedText, {
        enableLLMCorrection: true,
        enableLocalCorrection: false,
        dataProtection: {
          dataResidencyRegion: dataResidency,
          anonymizePII,
          auditLogging: true,
          blockNonCompliant: dataResidency === 'CH',
        },
      });
      processedText = llmResult.enhancedText;
      processingSteps.push('llm-enhancement');
    } catch (error) {
      warnings.push(`LLM enhancement failed: ${error}`);
    }
  }

  // Step 6: Named Entity Recognition
  if (enableNER) {
    try {
      const nerResult = await extractLegalEntities(processedText, {
        language: (detectedLanguage as 'en' | 'de' | 'fr' | 'it') || 'auto',
        minConfidence: 0.6,
      });
      entities = nerResult.entities;
      processingSteps.push('ner-extraction');
    } catch (error) {
      warnings.push(`NER extraction failed: ${error}`);
    }
  }

  // Step 7: Review routing
  let needsReview = false;
  let reviewId: string | undefined;

  if (autoRouteToReview) {
    const reviewCheck = needsHumanReview(confidence, warnings.length, {
      confidenceThreshold: reviewConfidenceThreshold,
      documentType: contractType,
    });
    needsReview = reviewCheck.needsReview;

    if (needsReview) {
      try {
        const reviewItem = await HumanReviewQueue.add({
          contractId: `contract_${Date.now()}`,
          tenantId: 'default',
          type: 'ocr_quality',
          ocrConfidence: confidence,
          lowConfidenceRegions: [], // Would be populated from actual OCR regions
          documentName: 'document',
          documentType: contractType,
          notes: reviewCheck.reason,
        });
        reviewId = reviewItem.id;
        processingSteps.push('review-routing');
      } catch (error) {
        warnings.push(`Review routing failed: ${error}`);
      }
    }
  }

  return {
    text: processedText,
    confidence,
    documentCategory,
    contractType,
    detectedLanguage,
    isMixedLanguage,
    hasHandwriting: hasHandwritingFlag,
    handwritingPercentage,
    entities,
    needsReview,
    reviewId,
    processingSteps,
    totalTime: Date.now() - startTime,
    warnings,
  };
}

// Default export
export default {
  runUnifiedOCRPipeline,
  OCREnhancements: {
    runLocalEnhancements,
    runLLMEnhancement,
  },
  HumanReview: HumanReviewQueue,
  LegalNER,
  DocumentPreClassifier,
  BatchProcessor,
  HandwritingDetector,
  MultiLangOCR,
};

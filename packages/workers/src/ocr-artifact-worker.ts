import dotenv from 'dotenv';
// Load environment variables FIRST, before any other imports that need them
dotenv.config();

// Use local type definition for cross-package compatibility
type Job<T = any> = { id?: string; name: string; data: T; attemptsMade: number; opts: any };
import clientsDb from 'clients-db';
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
import { buildPersistedContractTextFields } from '@repo/utils';
import {
  getQueueService,
  ocrCache,
  publishJobProgress,
  QUEUE_NAMES,
  redisEventBus,
  RedisEvents,
  retry,
  retryOpenAI,
  retryStorage,
  type IndexContractJobData,
  type JobType,
  type ProcessContractJobData,
} from './compat/repo-utils';
import * as circuitBreakerExports from '../../utils/src/patterns/circuit-breaker.ts';
import pino from 'pino';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import {
  ContractType,
  ArtifactType,
  detectContractType,
  detectContractTypeWithAI,
  getContractProfile,
  getRelevantArtifacts,
  isArtifactApplicable,
  getEnhancedPromptHints,
  getContractTypeInsights,
  getSmartSuggestions,
  getMissingMandatoryFields,
  getTabPriorityOrder,
} from './contract-type-profiles';

// Import OCR enhancements module
import {
  deskewImage,
  postOCRValidation,
  selectAdaptiveModel,
  runOCREnhancementPipeline,
  collectTrainingData,
  analyzeCharacterConfidence,
  getLowConfidenceRegions,
  type OCREnhancementPipelineResult,
  type AdaptiveModelConfig,
} from './ocr-enhancements';

// Import LLM-enhanced OCR module (Swiss data protection compliant)
import {
  runHybridEnhancement,
  type HybridEnhancementResult,
} from './ocr-llm-enhancement';

import { getTraceContextFromJobData } from './observability/trace';
import { buildProcessingPlan } from './workflow/planner';
import { ensureProcessingJob, setProcessingPlan } from './workflow/processing-job';
import { logAIUsage } from './utils/ai-usage-logger';

// Unified artifact prompts, types, and helpers from shared module
import {
  DEFAULT_ARTIFACT_TYPES as SHARED_ARTIFACT_TYPES,
  buildArtifactPrompt,
  getSystemPrompt,
  getFallbackTemplate,
  truncateTextForType,
  estimateTokenCost as sharedEstimateTokenCost,
  safeParseJSON as sharedSafeParseJSON,
  ArtifactCostTracker,
  PROMPT_VERSION,
  UNIFIED_QUALITY_THRESHOLDS,
  type ArtifactTypeConfig as SharedArtifactTypeConfig,
  type PromptContext,
} from './utils/artifact-prompts';

// Type-only imports for Azure Document Intelligence
import type {
  DIAnalyzeResult,
  DITable,
  DIKeyValuePair,
  DIParagraph,
  DIPage,
  DIStyle,
  DILanguage,
  DIBarcode,
  DIFormula,
  DISelectionMark,
  ContractExtractionResult,
  InvoiceExtractionResult,
} from './azure-document-intelligence';
import { ArtifactQualityValidator, selfCritiqueArtifact } from './utils/artifact-quality-validator';
import { WorkerCache } from './worker-cache';

// ============================================================================
// Structured OCR Result — preserves DI structured data alongside flat text
// ============================================================================

export interface StructuredOCRResult {
  /** Flat text content (backward-compatible) */
  text: string;
  /** OCR provider that produced this result */
  source: 'azure-di-layout' | 'azure-di-contract' | 'azure-di-invoice' | 'openai' | 'azure-ch' | 'mistral' | 'fallback';
  /** Full DI analysis result when available */
  diResult: DIAnalyzeResult | null;
  /** Pre-extracted contract fields from DI prebuilt-contract model */
  contractFields: ContractExtractionResult | null;
  /** Pre-extracted invoice fields from DI prebuilt-invoice model */
  invoiceFields: InvoiceExtractionResult | null;
  /** Structured tables extracted by DI */
  tables: DITable[];
  /** Key-value pairs extracted by DI */
  keyValuePairs: DIKeyValuePair[];
  /** Paragraphs with semantic roles from DI */
  paragraphs: DIParagraph[];
  /** Per-page data from DI (word-level confidence) */
  pages: DIPage[];
  /** Text styles with handwriting detection from DI */
  styles: DIStyle[];
  /** Handwritten text spans extracted from DI styles */
  handwrittenText: string[];
  /** Detected document languages from DI (BCP-47 locale codes) */
  detectedLanguages: string[];
  /** Selection marks (checkboxes) from DI */
  selectionMarks: Array<{ state: 'selected' | 'unselected'; confidence: number; page: number }>;
  /** Barcodes detected by DI */
  barcodes: DIBarcode[];
  /** Formulas detected by DI (LaTeX) */
  formulas: DIFormula[];
  /** Lightweight page info (dimensions only, no word data) */
  pageInfo: Array<{ pageNumber: number; width: number; height: number; unit: string }>;
  /** Aggregate OCR confidence (0-1) computed from DI word confidence */
  confidence: number;
  /** Whether the source is DI (trusted, skip enhancement) */
  isDISource: boolean;
}

/** Create a minimal StructuredOCRResult for non-DI providers */
function makeNonDIResult(text: string, source: StructuredOCRResult['source']): StructuredOCRResult {
  return {
    text,
    source,
    diResult: null,
    contractFields: null,
    invoiceFields: null,
    tables: [],
    keyValuePairs: [],
    paragraphs: [],
    pages: [],
    styles: [],
    handwrittenText: [],
    detectedLanguages: [],
    selectionMarks: [],
    barcodes: [],
    formulas: [],
    pageInfo: [],
    confidence: 0,
    isDISource: false,
  };
}

/** Compute aggregate confidence from DI page word-level data */
function computeDIConfidence(pages: DIPage[]): number {
  if (!pages || pages.length === 0) return 0;
  let totalConf = 0;
  let wordCount = 0;
  for (const page of pages) {
    for (const word of page.words || []) {
      totalConf += word.confidence;
      wordCount++;
    }
  }
  return wordCount > 0 ? totalConf / wordCount : 0;
}

/** Extract handwritten text spans from DI styles data */
function extractHandwrittenSpans(content: string, styles: DIStyle[]): string[] {
  if (!content || !styles || styles.length === 0) return [];
  const handwritten: string[] = [];
  for (const style of styles) {
    if (!style.isHandwritten || style.confidence < 0.5) continue;
    for (const span of style.spans) {
      const text = content.substring(span.offset, span.offset + span.length).trim();
      if (text.length > 0) {
        handwritten.push(text);
      }
    }
  }
  return handwritten;
}

// ============================================================================
// Preprocessing Cache (P3.3)
// ============================================================================

let preprocessingCache: WorkerCache | null = null;

function getPreprocessingCache(): WorkerCache | null {
  if (preprocessingCache) return preprocessingCache;
  try {
    const host = process.env.REDIS_HOST;
    if (!host) return null;
    preprocessingCache = new WorkerCache({
      host,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: 'worker:preprocess:',
      defaultTTL: 86400, // 24 hours
    });
    return preprocessingCache;
  } catch {
    return null;
  }
}

/**
 * Cache key for preprocessing results, derived from a hash of the raw text.
 */
function preprocessingCacheKey(rawText: string): string {
  return createHash('sha256').update(rawText).digest('hex');
}

interface CachedPreprocessResult {
  cleanedText: string;
  tables: string[];
  metrics: TextMetrics;
  cachedAt: number;
}

/**
 * Preprocessing with cache — returns cached result if available,
 * otherwise runs preprocessText and caches the result.
 */
async function preprocessTextCached(
  rawText: string,
  jobLogger: pino.Logger
): Promise<{ cleanedText: string; tables: string[]; metrics: TextMetrics; fromCache: boolean }> {
  const cache = getPreprocessingCache();
  const cacheKey = preprocessingCacheKey(rawText);

  // Try cache first
  if (cache) {
    try {
      const cached = await cache.getAIResponse(cacheKey);
      if (cached && cached.response) {
        const parsed = cached.response as CachedPreprocessResult;
        if (parsed.cleanedText && parsed.metrics) {
          jobLogger.info({ cacheKey: cacheKey.substring(0, 12) }, 'Preprocessing cache HIT');
          return { cleanedText: parsed.cleanedText, tables: parsed.tables || [], metrics: parsed.metrics, fromCache: true };
        }
      }
    } catch (err) {
      jobLogger.warn({ error: err }, 'Preprocessing cache read failed, falling back to compute');
    }
  }

  // Cache miss — compute
  const result = preprocessText(rawText);

  // Store in cache (fire-and-forget)
  if (cache) {
    const toCache: CachedPreprocessResult = { ...result, cachedAt: Date.now() };
    cache.setAIResponse(cacheKey, { response: toCache, model: 'preprocess', tokens: 0 }, 86400).catch((e) => {
      logger.debug({ error: (e as Error).message, cacheKey }, 'Cache write failed (non-critical)');
    });
  }

  return { ...result, fromCache: false };
}

// Check if we're in build mode - skip worker initialization
const isBuildTime = process.env.NEXT_BUILD === 'true';

const logger = pino({ 
  name: 'ocr-artifact-worker',
  level: isBuildTime ? 'silent' : (process.env.LOG_LEVEL || 'info')
});

// Module-level OpenAI client singleton — avoids re-instantiation per call
// Supports both Azure OpenAI and standard OpenAI via env vars
let _ocrOpenAISingleton: any = null;
async function getOCROpenAIClient(): Promise<any> {
  if (_ocrOpenAISingleton) return _ocrOpenAISingleton;

  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const standardKey = process.env.OPENAI_API_KEY;

  // Prefer Azure OpenAI when configured
  if (azureEndpoint && azureKey) {
    const { AzureOpenAI } = await import('openai');
    _ocrOpenAISingleton = new AzureOpenAI({
      endpoint: azureEndpoint,
      apiKey: azureKey,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01',
    });
    return _ocrOpenAISingleton;
  }

  // Fall back to standard OpenAI
  if (!standardKey) return null;
  const OpenAI = (await import('openai')).default;
  _ocrOpenAISingleton = new OpenAI({ apiKey: standardKey });
  return _ocrOpenAISingleton;
}

// ============ ENHANCED CONFIGURATION ============
// Worker configuration for improved accuracy and coverage
const WORKER_CONFIG = {
  // OCR Enhancement
  ocr: {
    enableMultiPassExtraction: true,      // Run multiple OCR passes for better accuracy
    minTextLengthForAI: 100,               // Minimum text length to trigger AI enhancement
    maxTextForAI: 30000,                   // Maximum text to send to AI (increased)
    enableImageOCR: true,                  // Enable OCR for images in PDFs
    enableTableExtraction: true,           // Enhanced table extraction
    confidenceThreshold: 0.7,              // Minimum confidence for extracted data
    enablePreprocessing: true,             // Enable image preprocessing before OCR
    preprocessingPreset: 'balanced' as const, // 'fast' | 'balanced' | 'quality'
    minQualityScoreForSkip: 80,            // Skip preprocessing if quality > this
    // NEW: OCR accuracy enhancements
    enableDeskew: true,                    // Enable automatic image deskewing
    enableLegalSpellCheck: true,           // Enable legal dictionary spell-check
    enableDateValidation: true,            // Validate and correct date formats
    enableAmountValidation: true,          // Validate and correct currency amounts
    enablePostOCRCorrection: true,         // Apply post-OCR corrections
    enableAdaptiveModelSelection: true,    // Auto-select best model based on document
    enableCharacterConfidenceAnalysis: true, // Analyze character-level confidence
    collectTrainingData: true,             // Collect corrections for training
    lowConfidenceThreshold: 0.6,           // Threshold for flagging low confidence
    // LLM-enhanced correction (Swiss data protection compliant)
    enableLLMCorrection: true,             // Use LLM for intelligent spell correction
    // Data residency: 'CH' (Switzerland only), 'EU' (EU regions), 'ANY' (dev mode)
    llmDataResidency: (process.env.NODE_ENV === 'production' ? 'CH' : 'ANY') as 'CH' | 'EU' | 'ANY',
    llmAnonymizePII: true,                 // Anonymize PII before sending to LLM
    llmAuditLogging: true,                 // Log all LLM operations for compliance
    llmBlockNonCompliant: process.env.NODE_ENV === 'production', // Block in prod only
  },
  // AI Extraction Enhancement
  ai: {
    temperature: 0.1,                      // Lower temperature for more accurate extraction
    maxRetries: 3,                         // Increased retries for reliability
    enableContextWindow: true,             // Use full context for better understanding
    enablePartyNameValidation: true,       // Validate extracted party names
    enableFinancialValidation: true,       // Validate financial values
    enableDateValidation: true,            // Validate dates
    model: process.env.OPENAI_MODEL || 'gpt-4o', // Use GPT-4o by default for best OCR quality
    visionModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o', // Use GPT-4o for Vision (NOT gpt-4o-mini)
    enableMultiPassVision: true,           // Multi-pass extraction for complex documents
  },
  // Worker Settings
  worker: {
    concurrency: parseInt(process.env.OCR_WORKER_CONCURRENCY || '5'),
    maxJobsPerMinute: parseInt(process.env.OCR_MAX_JOBS_PER_MINUTE || '30'),
    progressUpdateInterval: 5,             // Update progress every 5%
  },
  // Text Preprocessing
  preprocessing: {
    removeExtraWhitespace: true,
    normalizeLineBreaks: true,
    detectAndPreserveTables: true,
    removeHeaders: false,                  // Don't remove - might be important
    removeFooters: false,
    removePageNumbers: true,
    maxConsecutiveNewlines: 3,
  },
  // Quality Metrics
  quality: {
    trackExtractionMetrics: true,
    minCharactersForValidDoc: 50,
    warnOnLowConfidence: true,
    confidenceWarningThreshold: 0.6,
  }
};

if (!isBuildTime) {
  logger.info({ config: WORKER_CONFIG }, 'Worker configuration loaded');
}

// ============ TEXT PREPROCESSING UTILITIES ============

/**
 * Preprocess extracted text for better AI analysis
 */
function preprocessText(rawText: string): { cleanedText: string; tables: string[]; metrics: TextMetrics } {
  const metrics: TextMetrics = {
    originalLength: rawText.length,
    cleanedLength: 0,
    tablesDetected: 0,
    linesRemoved: 0,
    confidenceScore: 1.0,
  };
  
  let text = rawText;
  
  // 1. Normalize line breaks
  if (WORKER_CONFIG.preprocessing.normalizeLineBreaks) {
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }
  
  // 2. Detect and extract tables before other processing
  const tables: string[] = [];
  if (WORKER_CONFIG.preprocessing.detectAndPreserveTables) {
    const tablePatterns = [
      // Markdown-style tables
      /\|[^\n]+\|[\s\S]*?(?=\n\n|\n[^|]|$)/g,
      // Tab-separated tables (3+ columns)
      /(?:^|\n)(?:[^\t\n]+\t){2,}[^\t\n]+(?:\n(?:[^\t\n]+\t){2,}[^\t\n]+)+/g,
      // Pipe-separated data
      /(?:^|\n)(?:[^|\n]+\|){2,}[^|\n]+(?:\n(?:[^|\n]+\|){2,}[^|\n]+)+/g,
    ];
    
    for (const pattern of tablePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        tables.push(...matches);
        metrics.tablesDetected += matches.length;
      }
    }
  }
  
  // 3. Remove page numbers (common patterns)
  if (WORKER_CONFIG.preprocessing.removePageNumbers) {
    // "Page 1 of 10", "1 / 10", "Page 1", "- 1 -", etc.
    text = text.replace(/(?:^|\n)\s*(?:Page\s+)?(\d+)\s*(?:of\s+\d+|\/\s*\d+)?\s*(?:\n|$)/gi, '\n');
    text = text.replace(/(?:^|\n)\s*-\s*\d+\s*-\s*(?:\n|$)/g, '\n');
  }
  
  // 4. Remove excessive whitespace
  if (WORKER_CONFIG.preprocessing.removeExtraWhitespace) {
    // Replace multiple spaces with single space (but preserve intentional indentation)
    text = text.replace(/[^\S\n]{3,}/g, '  ');
  }
  
  // 5. Limit consecutive newlines
  if (WORKER_CONFIG.preprocessing.maxConsecutiveNewlines > 0) {
    const maxNewlines = WORKER_CONFIG.preprocessing.maxConsecutiveNewlines;
    const pattern = new RegExp(`\\n{${maxNewlines + 1},}`, 'g');
    text = text.replace(pattern, '\n'.repeat(maxNewlines));
  }
  
  // 6. Trim
  text = text.trim();
  
  metrics.cleanedLength = text.length;
  metrics.linesRemoved = rawText.split('\n').length - text.split('\n').length;
  
  // Calculate confidence based on text quality
  if (text.length < WORKER_CONFIG.quality.minCharactersForValidDoc) {
    metrics.confidenceScore = 0.3;
  } else if (text.length < 500) {
    metrics.confidenceScore = 0.6;
  } else if (metrics.tablesDetected > 0) {
    metrics.confidenceScore = 0.95; // Tables indicate structured document
  }
  
  return { cleanedText: text, tables, metrics };
}

interface TextMetrics {
  originalLength: number;
  cleanedLength: number;
  tablesDetected: number;
  linesRemoved: number;
  confidenceScore: number;
}

/**
 * Detect if text contains rate/pricing tables
 */
function detectRateTables(text: string): { hasRateTables: boolean; tableHints: string[] } {
  const hints: string[] = [];
  
  // Keywords that indicate rate tables
  const rateKeywords = [
    /rate\s*card/i,
    /pricing\s*schedule/i,
    /fee\s*schedule/i,
    /hourly\s*rate/i,
    /daily\s*rate/i,
    /resource\s*type.*rate/i,
    /\$\d+[,\d]*(?:\.\d{2})?\s*\/?\s*(?:hr|hour|day|month|year)/i,
    /per\s*(?:hour|day|month|year)/i,
    /blended\s*rate/i,
    /role.*rate/i,
  ];
  
  for (const pattern of rateKeywords) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) hints.push(match[0]);
    }
  }
  
  return {
    hasRateTables: hints.length > 0,
    tableHints: hints,
  };
}

/**
 * Enhanced financial value extraction
 */
function extractFinancialIndicators(text: string): FinancialIndicators {
  const indicators: FinancialIndicators = {
    hasCurrency: false,
    currencies: [],
    hasPercentages: false,
    hasPaymentTerms: false,
    estimatedTotalValue: null,
    confidence: 0.5,
  };
  
  // Currency detection
  const currencyPatterns = [
    { pattern: /\$[\d,]+(?:\.\d{2})?/g, currency: 'USD' },
    { pattern: /€[\d,]+(?:\.\d{2})?/g, currency: 'EUR' },
    { pattern: /£[\d,]+(?:\.\d{2})?/g, currency: 'GBP' },
    { pattern: /USD\s*[\d,]+(?:\.\d{2})?/gi, currency: 'USD' },
    { pattern: /EUR\s*[\d,]+(?:\.\d{2})?/gi, currency: 'EUR' },
  ];
  
  const currencies = new Set<string>();
  let maxValue = 0;
  
  for (const { pattern, currency } of currencyPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      currencies.add(currency);
      indicators.hasCurrency = true;
      
      // Extract numeric values to estimate total
      for (const match of matches) {
        const numStr = match.replace(/[^\d.]/g, '');
        const num = parseFloat(numStr);
        if (!isNaN(num) && num > maxValue) {
          maxValue = num;
        }
      }
    }
  }
  
  indicators.currencies = Array.from(currencies);
  if (maxValue > 0) {
    indicators.estimatedTotalValue = maxValue;
  }
  
  // Percentage detection
  indicators.hasPercentages = /\d+(?:\.\d+)?%/.test(text);
  
  // Payment terms detection
  const paymentTermPatterns = [
    /net\s*\d+/i,
    /payment\s*(?:due|terms)/i,
    /\d+\s*days?\s*(?:from|after)/i,
    /upon\s*(?:receipt|completion|delivery|signing)/i,
  ];
  indicators.hasPaymentTerms = paymentTermPatterns.some(p => p.test(text));
  
  // Confidence based on financial content
  if (indicators.hasCurrency && indicators.hasPaymentTerms) {
    indicators.confidence = 0.9;
  } else if (indicators.hasCurrency) {
    indicators.confidence = 0.7;
  }
  
  return indicators;
}

interface FinancialIndicators {
  hasCurrency: boolean;
  currencies: string[];
  hasPercentages: boolean;
  hasPaymentTerms: boolean;
  estimatedTotalValue: number | null;
  confidence: number;
}

/**
 * Quality metrics for extraction tracking
 */
interface ExtractionQualityMetrics {
  contractId: string;
  startTime: number;
  endTime?: number;
  ocrDuration?: number;
  artifactDuration?: number;
  textLength: number;
  artifactsGenerated: number;
  failedArtifacts: string[];
  textConfidence: number;
  tablesDetected: number;
  financialIndicators: FinancialIndicators;
  errors: string[];
  warnings: string[];
}

/**
 * Track and log quality metrics
 */
function logQualityMetrics(metrics: ExtractionQualityMetrics): void {
  if (!WORKER_CONFIG.quality.trackExtractionMetrics) return;
  
  const duration = metrics.endTime ? metrics.endTime - metrics.startTime : 0;
  
  logger.info({
    contractId: metrics.contractId,
    duration: `${duration}ms`,
    textLength: metrics.textLength,
    artifactsGenerated: metrics.artifactsGenerated,
    failedArtifacts: metrics.failedArtifacts.length,
    textConfidence: metrics.textConfidence,
    tablesDetected: metrics.tablesDetected,
    hasCurrency: metrics.financialIndicators.hasCurrency,
    currencies: metrics.financialIndicators.currencies,
    warnings: metrics.warnings.length,
    errors: metrics.errors.length,
  }, 'Extraction quality metrics');
  
  // Warn on low confidence
  if (WORKER_CONFIG.quality.warnOnLowConfidence && 
      metrics.textConfidence < WORKER_CONFIG.quality.confidenceWarningThreshold) {
    logger.warn({
      contractId: metrics.contractId,
      confidence: metrics.textConfidence,
      threshold: WORKER_CONFIG.quality.confidenceWarningThreshold,
    }, 'Low confidence extraction - may require manual review');
  }
}

type CircuitBreakerLike = {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): unknown;
  getMetrics(): unknown;
  reset(): void;
};

type CircuitBreakerOptionsLike = {
  failureThreshold: number;
  successThreshold: number;
  resetTimeout: number;
  requestTimeout: number;
  onStateChange?: (from: unknown, to: unknown, metrics: unknown) => void;
  onFailure?: (error: Error, metrics: unknown) => void;
};

function getCircuitBreakerCtor(): new (name: string, options: CircuitBreakerOptionsLike) => CircuitBreakerLike {
  const ctor = (circuitBreakerExports as any).CircuitBreaker ?? (circuitBreakerExports as any).default?.CircuitBreaker;
  if (typeof ctor !== 'function') {
    throw new TypeError('CircuitBreaker constructor unavailable');
  }
  return ctor;
}

function getCircuitBreakerErrorCtor(): new (...args: any[]) => Error {
  const errorCtor = (circuitBreakerExports as any).CircuitBreakerError ?? (circuitBreakerExports as any).default?.CircuitBreakerError;
  if (typeof errorCtor !== 'function') {
    throw new TypeError('CircuitBreakerError constructor unavailable');
  }
  return errorCtor;
}

function getCircuitState() {
  const state = (circuitBreakerExports as any).CircuitState ?? (circuitBreakerExports as any).default?.CircuitState;
  if (!state) {
    throw new TypeError('CircuitState enum unavailable');
  }
  return state as { OPEN: unknown; CLOSED: unknown; HALF_OPEN: unknown };
}

function createLazyCircuitBreaker(name: string, options: CircuitBreakerOptionsLike) {
  let instance: CircuitBreakerLike | null = null;
  return () => {
    if (!instance) {
      const CircuitBreaker = getCircuitBreakerCtor();
      instance = new CircuitBreaker(name, options);
    }
    return instance;
  };
}

// Circuit breakers for external services (Swiss-compliant only)
const getMistralCircuitBreaker = createLazyCircuitBreaker('mistral-ocr', {
  failureThreshold: 7,                    // Increased tolerance
  successThreshold: 2,                    // Faster recovery
  resetTimeout: 45000,                    // 45 seconds - faster reset
  requestTimeout: 180000,                 // 3 minutes for OCR (increased)
  onStateChange: (from, to, metrics) => {
    logger.warn({ from, to, metrics }, 'Mistral circuit breaker state changed');
  },
  onFailure: (error, metrics) => {
    logger.error({ error: error.message, metrics }, 'Mistral circuit breaker failure');
  },
});

const getAzureCircuitBreaker = createLazyCircuitBreaker('azure-ch-ocr', {
  failureThreshold: 7,                    // Increased tolerance
  successThreshold: 2,                    // Faster recovery
  resetTimeout: 45000,                    // 45 seconds
  requestTimeout: 180000,                 // 3 minutes for OCR
  onStateChange: (from, to, metrics) => {
    logger.warn({ from, to, metrics }, 'Azure Switzerland circuit breaker state changed');
  },
  onFailure: (error, metrics) => {
    logger.error({ error: error.message, metrics }, 'Azure Switzerland circuit breaker failure');
  },
});

const getStorageCircuitBreaker = createLazyCircuitBreaker('storage', {
  failureThreshold: 3,
  successThreshold: 2,
  resetTimeout: 10000,
  requestTimeout: 30000,
  onStateChange: (from, to, metrics) => {
    logger.warn({ from, to, metrics }, 'Storage circuit breaker state changed');
  },
});
const prisma = getClient();

// Use distributed Redis cache instead of in-memory cache

// ============ IMAGE PREPROCESSING UTILITIES ============

/**
 * Preprocessing options for image enhancement before OCR
 */
interface ImagePreprocessingOptions {
  enableDeskew: boolean;
  enableDenoise: boolean;
  enableContrastEnhancement: boolean;
  enableBinarization: boolean;
  targetDpi: number;
  maxDimension: number;
}

/**
 * Quality metrics from preprocessing analysis
 */
interface PreprocessingQualityMetrics {
  estimatedDpi: number;
  sharpness: number;
  contrast: number;
  brightness: number;
  noiseLevel: number;
  qualityScore: number;
  recommendations: string[];
}

/**
 * Result from image preprocessing
 */
interface PreprocessingResult {
  buffer: Buffer;
  qualityBefore: PreprocessingQualityMetrics;
  qualityAfter: PreprocessingQualityMetrics;
  stepsApplied: string[];
  processingTimeMs: number;
  estimatedAccuracyImprovement: number;
}

/**
 * Preprocess image buffer for better OCR accuracy using sharp
 * This is a lightweight preprocessing pipeline for the worker
 */
async function preprocessImageForOCR(
  imageBuffer: Buffer,
  options: Partial<ImagePreprocessingOptions> = {}
): Promise<PreprocessingResult> {
  const startTime = Date.now();
  const stepsApplied: string[] = [];
  
  const opts: ImagePreprocessingOptions = {
    enableDeskew: options.enableDeskew ?? true,
    enableDenoise: options.enableDenoise ?? true,
    enableContrastEnhancement: options.enableContrastEnhancement ?? true,
    enableBinarization: options.enableBinarization ?? false,
    targetDpi: options.targetDpi ?? 300,
    maxDimension: options.maxDimension ?? 3000,
  };
  
  try {
    const sharp = (await import('sharp')).default;
    
    // Analyze initial quality
    const inputImage = sharp(imageBuffer);
    const metadata = await inputImage.metadata();
    const stats = await inputImage.stats();
    
    // Calculate initial quality metrics
    const qualityBefore = calculateImageQuality(metadata, stats);
    
    // Skip preprocessing if quality is already good
    if (qualityBefore.qualityScore >= WORKER_CONFIG.ocr.minQualityScoreForSkip) {
      logger.info({ qualityScore: qualityBefore.qualityScore }, 'Image quality sufficient, skipping preprocessing');
      return {
        buffer: imageBuffer,
        qualityBefore,
        qualityAfter: qualityBefore,
        stepsApplied: ['skipped-good-quality'],
        processingTimeMs: Date.now() - startTime,
        estimatedAccuracyImprovement: 0,
      };
    }
    
    let pipeline = sharp(imageBuffer);
    
    // Step 1: Convert to grayscale
    if (metadata.channels && metadata.channels > 1) {
      pipeline = pipeline.grayscale();
      stepsApplied.push('grayscale');
    }
    
    // Step 2: Resize if too large (memory efficiency)
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (width > opts.maxDimension || height > opts.maxDimension) {
      pipeline = pipeline.resize({
        width: opts.maxDimension,
        height: opts.maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      });
      stepsApplied.push('resize');
    }
    
    // Step 3: Upscale low-DPI images
    if (qualityBefore.estimatedDpi < opts.targetDpi && width < opts.maxDimension / 2) {
      const scale = Math.min(2, opts.targetDpi / Math.max(qualityBefore.estimatedDpi, 72));
      if (scale > 1.1) {
        const newWidth = Math.round(width * scale);
        pipeline = pipeline.resize({
          width: Math.min(newWidth, opts.maxDimension),
          fit: 'inside',
        });
        stepsApplied.push(`upscale-${scale.toFixed(1)}x`);
      }
    }
    
    // Step 3b: Deskew if enabled (NEW ENHANCEMENT)
    if (opts.enableDeskew && WORKER_CONFIG.ocr.enableDeskew) {
      try {
        const tempBuffer = await pipeline.toBuffer();
        const deskewResult = await deskewImage(tempBuffer);
        if (deskewResult.wasApplied) {
          pipeline = sharp(deskewResult.buffer);
          stepsApplied.push(`deskew-${deskewResult.angle.toFixed(1)}deg`);
          logger.info({ angle: deskewResult.angle, confidence: deskewResult.confidence }, 'Deskew applied');
        }
      } catch (deskewError) {
        logger.warn({ error: deskewError }, 'Deskew failed, continuing without');
      }
    }
    
    // Step 4: Denoise if noisy
    if (opts.enableDenoise && qualityBefore.noiseLevel > 0.3) {
      pipeline = pipeline.median(3);
      stepsApplied.push('denoise');
    }
    
    // Step 5: Enhance contrast
    if (opts.enableContrastEnhancement) {
      pipeline = pipeline.normalize();
      stepsApplied.push('normalize-contrast');
      
      // Additional contrast boost for low-contrast images
      if (qualityBefore.contrast < 0.5) {
        pipeline = pipeline.linear(1.2, -30);
        stepsApplied.push('boost-contrast');
      }
    }
    
    // Step 6: Sharpen if blurry
    if (qualityBefore.sharpness < 0.7) {
      pipeline = pipeline.sharpen({
        sigma: 1.5,
        m1: 1.0,
        m2: 0.5,
      });
      stepsApplied.push('sharpen');
    }
    
    // Step 7: Binarize for very low quality
    if (opts.enableBinarization && qualityBefore.qualityScore < 50) {
      pipeline = pipeline.threshold(128);
      stepsApplied.push('binarize');
    }
    
    // Output as PNG for best quality
    const processedBuffer = await pipeline
      .png({ compressionLevel: 6 })
      .toBuffer();
    
    // Analyze output quality
    const outputImage = sharp(processedBuffer);
    const outputMetadata = await outputImage.metadata();
    const outputStats = await outputImage.stats();
    const qualityAfter = calculateImageQuality(outputMetadata, outputStats);
    
    const processingTimeMs = Date.now() - startTime;
    const estimatedAccuracyImprovement = Math.max(0, ((qualityAfter.qualityScore - qualityBefore.qualityScore) / 10) * 5);
    
    logger.info({
      qualityBefore: qualityBefore.qualityScore,
      qualityAfter: qualityAfter.qualityScore,
      stepsApplied,
      processingTimeMs,
      estimatedAccuracyImprovement: `${estimatedAccuracyImprovement.toFixed(1)}%`,
    }, 'Image preprocessing completed');
    
    return {
      buffer: processedBuffer,
      qualityBefore,
      qualityAfter,
      stepsApplied,
      processingTimeMs,
      estimatedAccuracyImprovement,
    };
  } catch (error) {
    logger.warn({ error }, 'Image preprocessing failed, using original buffer');
    const defaultMetrics: PreprocessingQualityMetrics = {
      estimatedDpi: 72,
      sharpness: 0.5,
      contrast: 0.5,
      brightness: 128,
      noiseLevel: 0.2,
      qualityScore: 50,
      recommendations: ['Preprocessing failed - using original'],
    };
    return {
      buffer: imageBuffer,
      qualityBefore: defaultMetrics,
      qualityAfter: defaultMetrics,
      stepsApplied: ['preprocessing-failed'],
      processingTimeMs: Date.now() - startTime,
      estimatedAccuracyImprovement: 0,
    };
  }
}

/**
 * Calculate image quality score from metadata and stats
 */
function calculateImageQuality(
  metadata: { width?: number; height?: number; density?: number; channels?: number },
  stats: { channels: Array<{ min: number; max: number; mean: number; stdev?: number }> }
): PreprocessingQualityMetrics {
  const width = metadata.width || 1;
  const height = metadata.height || 1;
  
  // Estimate DPI (assume letter size 8.5x11 if no metadata)
  const estimatedDpi = metadata.density || Math.round(((width / 8.5) + (height / 11)) / 2);
  
  // Get channel stats (use first channel for grayscale metrics)
  const channel = stats.channels[0] || { min: 0, max: 255, mean: 128 };
  
  // Calculate contrast from range
  const contrast = (channel.max - channel.min) / 255;
  
  // Brightness from mean
  const brightness = channel.mean;
  
  // Simplified sharpness and noise estimation
  const sharpness = contrast > 0.6 ? 0.8 : contrast > 0.4 ? 0.6 : 0.4;
  const noiseLevel = contrast < 0.3 ? 0.5 : 0.2;
  
  // Calculate overall quality score (0-100)
  let qualityScore = 0;
  
  // DPI contribution (30 points)
  if (estimatedDpi >= 300) qualityScore += 30;
  else if (estimatedDpi >= 200) qualityScore += 20;
  else if (estimatedDpi >= 150) qualityScore += 10;
  
  // Contrast contribution (25 points)
  qualityScore += contrast * 25;
  
  // Sharpness contribution (20 points)
  qualityScore += sharpness * 20;
  
  // Brightness contribution (10 points, optimal 100-180)
  if (brightness >= 100 && brightness <= 180) qualityScore += 10;
  else if (brightness >= 50 && brightness <= 220) qualityScore += 5;
  
  // Noise penalty (15 points max)
  qualityScore += (1 - noiseLevel) * 15;
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (estimatedDpi < 200) recommendations.push('Consider higher DPI scan (300+ recommended)');
  if (sharpness < 0.5) recommendations.push('Image appears blurry');
  if (contrast < 0.4) recommendations.push('Low contrast detected');
  if (brightness < 80) recommendations.push('Image is too dark');
  if (brightness > 200) recommendations.push('Image is too bright');
  if (noiseLevel > 0.4) recommendations.push('High noise detected');
  if (qualityScore >= 75) recommendations.push('Quality is acceptable');
  
  return {
    estimatedDpi,
    sharpness,
    contrast,
    brightness,
    noiseLevel,
    qualityScore: Math.max(0, Math.min(100, qualityScore)),
    recommendations,
  };
}

/**
 * Check if file is an image type that can be preprocessed
 */
function isPreprocessableImage(filePath: string): boolean {
  const ext = filePath.toLowerCase().split('.').pop() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'tif'].includes(ext);
}
const OCR_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

// Valid OCR modes — includes DI v4.0 models + legacy providers
type OCRMode =
  | 'openai'
  | 'azure-ch'
  | 'mistral'
  | 'azure-di-layout'
  | 'azure-di-contract'
  | 'azure-di-invoice'
  | 'auto';

// Fallback chain for generic/legacy modes (DI modes short-circuit before this)
const OCR_FALLBACK_CHAIN: readonly OCRMode[] = ['openai', 'azure-ch', 'mistral'];

// Map preclassification OCRModel → worker OCRMode
const OCR_MODEL_TO_MODE: Record<string, OCRMode> = {
  AZURE_DI_LAYOUT: 'azure-di-layout',
  AZURE_DI_CONTRACT: 'azure-di-contract',
  AZURE_DI_INVOICE: 'azure-di-invoice',
  AZURE_READ: 'azure-ch',
  AZURE_FORM: 'azure-di-layout', // superseded by DI v4.0
  GOOGLE_DOCUMENT_AI: 'openai',  // not available, best alternative
  GOOGLE_VISION: 'openai',
  AWS_TEXTRACT: 'openai',
  TESSERACT_FAST: 'mistral',
  TESSERACT_BEST: 'mistral',
  MANUAL_REVIEW: 'openai',
};

// Preload heavy modules to reduce cold start time
let pdfParseModule: any = null;
let mistralModule: any = null;

(async () => {
  try {
    // Preload in background
    pdfParseModule = (await import('pdf-parse')).default;
    const mistral = await import('@mistralai/mistralai');
    mistralModule = mistral.Mistral;
    logger.info('Heavy modules preloaded for faster processing');
  } catch (e) {
    logger.warn('Failed to preload modules, will load on-demand');
  }
})();

// Initialize S3 client for MinIO — lazy initialization to avoid build-time errors
function getS3Client(): S3Client {
  if (process.env.NODE_ENV === 'production' && (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY)) {
    throw new Error('CRITICAL: MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be configured in production');
  }
  return new S3Client({
    endpoint: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    },
    forcePathStyle: true,
  });
}

let _s3Client: S3Client | null = null;
function s3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = getS3Client();
  }
  return _s3Client;
}

// For references that need a client object
const getS3ClientInstance = () => s3Client();

interface OCRArtifactResult {
  success: boolean;
  artifactsCreated: number;
  extractedText?: string;
  partialSuccess?: boolean;
  failedArtifacts?: string[];
}

/**
 * Generate cache key for OCR results.
 * Uses content hash when available for collision resistance;
 * falls back to filename + size for backward compatibility.
 */
function generateOCRCacheKey(filePath: string, fileSize: number, contentHash?: string): string {
  if (contentHash) {
    return `ocr:${contentHash}`;
  }
  const fileName = path.basename(filePath);
  return `ocr:${fileName}:${fileSize}`;
}

/**
 * Perform OCR extraction on a file with circuit breaker protection and caching.
 * Returns StructuredOCRResult preserving DI structured data when available.
 */
async function performOCR(filePath: string, ocrMode: string, fileSize?: number, onProgress?: (pct: number) => void, contentHash?: string): Promise<StructuredOCRResult> {
  logger.info({ filePath, ocrMode }, 'Performing OCR extraction');
  
  // Check distributed cache first
  if (fileSize) {
    const cacheKey = generateOCRCacheKey(filePath, fileSize, contentHash);
    const cached = await ocrCache.get(cacheKey);
    if (cached) {
      logger.info({ cacheKey, hasDIStructured: !!cached.diStructured }, 'Using cached OCR result from distributed cache');
      // Restore structured DI data when available, otherwise wrap as non-DI
      if (cached.diStructured) {
        const di = cached.diStructured;
        return {
          text: cached.text,
          source: di.source as StructuredOCRResult['source'],
          diResult: null, // Full diResult not cached (too large)
          contractFields: (di.contractFields as ContractExtractionResult) ?? null,
          invoiceFields: (di.invoiceFields as InvoiceExtractionResult) ?? null,
          tables: di.tables as DITable[],
          keyValuePairs: di.keyValuePairs as DIKeyValuePair[],
          paragraphs: di.paragraphs as DIParagraph[],
          pages: [],
          confidence: di.confidence,
          styles: (di.styles as DIStyle[]) || [],
          handwrittenText: (di.handwrittenText as string[]) || [],
          detectedLanguages: (di.detectedLanguages as string[]) || [],
          selectionMarks: (di.selectionMarks as StructuredOCRResult['selectionMarks']) || [],
          barcodes: (di.barcodes as DIBarcode[]) || [],
          formulas: (di.formulas as DIFormula[]) || [],
          pageInfo: (di.pageInfo as StructuredOCRResult['pageInfo']) || [],
          isDISource: true,
        };
      }
      return makeNonDIResult(cached.text, 'fallback');
    }
  }
  
  // ── DI modes: try the specific model first, then fall through to legacy chain ──
  const DI_MODES: OCRMode[] = ['azure-di-layout', 'azure-di-contract', 'azure-di-invoice'];
  if (DI_MODES.includes(ocrMode as OCRMode)) {
    try {
      const { isDIConfigured, isDIEnabled } = await import('./azure-document-intelligence');
      if (isDIConfigured() && isDIEnabled() && getAzureCircuitBreaker().getState() !== getCircuitState().OPEN) {
        onProgress?.(15); // DI submission starting

        // Page-range limiting for large documents (cost optimization)
        // DI charges per page — limit initial pass to first N pages for large files
        const DI_MAX_PAGES = parseInt(process.env.AZURE_DI_MAX_PAGES || '50', 10);
        const fileSizeBytes = fileSize ?? 0;
        // Heuristic: PDFs average ~50KB/page. Files > DI_MAX_PAGES * 50KB likely exceed the limit.
        const estimatedPages = fileSizeBytes > 0 ? Math.ceil(fileSizeBytes / 50_000) : 0;
        const pageRange = estimatedPages > DI_MAX_PAGES ? `1-${DI_MAX_PAGES}` : undefined;
        if (pageRange) {
          logger.info({ estimatedPages, pageRange, DI_MAX_PAGES }, 'Large document detected — limiting DI to page range for cost savings');
        }

        const structuredResult = await getAzureCircuitBreaker().execute(() =>
          retry(async (): Promise<StructuredOCRResult> => {
            const { analyzeLayout, analyzeContract, analyzeInvoice } = await import('./azure-document-intelligence');
            const fileBuffer = await fs.readFile(filePath);

            if (ocrMode === 'azure-di-contract') {
              const { analysis, contract } = await analyzeContract(fileBuffer);
              // Build rich text with structured appendices
              const parts = [analysis.content];
              if (contract.parties.length > 0) {
                parts.push('\n--- CONTRACT PARTIES ---');
                for (const p of contract.parties) parts.push(`${p.role || 'Party'}: ${p.name}`);
              }
              if (contract.dates.effectiveDate) parts.push(`Effective Date: ${contract.dates.effectiveDate}`);
              if (contract.dates.expirationDate) parts.push(`Expiration Date: ${contract.dates.expirationDate}`);
              if (contract.jurisdiction) parts.push(`Jurisdiction: ${contract.jurisdiction}`);
              return {
                text: parts.join('\n'),
                source: 'azure-di-contract',
                diResult: analysis,
                contractFields: contract,
                invoiceFields: null,
                tables: analysis.tables || [],
                keyValuePairs: analysis.keyValuePairs || [],
                paragraphs: analysis.paragraphs || [],
                pages: analysis.pages || [],
                styles: analysis.styles || [],
                handwrittenText: extractHandwrittenSpans(analysis.content, analysis.styles || []),
                detectedLanguages: (analysis.languages || []).map(l => l.locale),
                selectionMarks: (analysis.pages || []).flatMap((p, i) => (p.selectionMarks || []).map(sm => ({ state: sm.state as 'selected' | 'unselected', confidence: sm.confidence, page: i + 1 }))),
                barcodes: analysis.barcodes || [],
                formulas: analysis.formulas || [],
                pageInfo: (analysis.pages || []).map(p => ({ pageNumber: p.pageNumber, width: p.width, height: p.height, unit: p.unit })),
                confidence: computeDIConfidence(analysis.pages || []),
                isDISource: true,
              };
            } else if (ocrMode === 'azure-di-invoice') {
              const { analysis, invoice } = await analyzeInvoice(fileBuffer);
              const parts = [analysis.content, '\n--- INVOICE DATA ---'];
              if (invoice.vendorName) parts.push(`Vendor: ${invoice.vendorName}`);
              if (invoice.invoiceId) parts.push(`Invoice #: ${invoice.invoiceId}`);
              if (invoice.invoiceDate) parts.push(`Date: ${invoice.invoiceDate}`);
              if (invoice.invoiceTotal != null) parts.push(`Total: ${invoice.currency || ''} ${invoice.invoiceTotal}`);
              if (invoice.lineItems.length > 0) {
                parts.push('\n| Description | Qty | Unit Price | Amount |');
                parts.push('| --- | --- | --- | --- |');
                for (const li of invoice.lineItems) {
                  parts.push(`| ${li.description || '-'} | ${li.quantity ?? '-'} | ${li.unitPrice ?? '-'} | ${li.amount ?? '-'} |`);
                }
              }
              return {
                text: parts.join('\n'),
                source: 'azure-di-invoice',
                diResult: analysis,
                contractFields: null,
                invoiceFields: invoice,
                tables: analysis.tables || [],
                keyValuePairs: analysis.keyValuePairs || [],
                paragraphs: analysis.paragraphs || [],
                pages: analysis.pages || [],
                styles: analysis.styles || [],
                handwrittenText: extractHandwrittenSpans(analysis.content, analysis.styles || []),
                detectedLanguages: (analysis.languages || []).map(l => l.locale),
                selectionMarks: (analysis.pages || []).flatMap((p, i) => (p.selectionMarks || []).map(sm => ({ state: sm.state as 'selected' | 'unselected', confidence: sm.confidence, page: i + 1 }))),
                barcodes: analysis.barcodes || [],
                formulas: analysis.formulas || [],
                pageInfo: (analysis.pages || []).map(p => ({ pageNumber: p.pageNumber, width: p.width, height: p.height, unit: p.unit })),
                confidence: computeDIConfidence(analysis.pages || []),
                isDISource: true,
              };
            } else {
              // azure-di-layout
              const result = await analyzeLayout(fileBuffer, { extractKeyValuePairs: true, pages: pageRange });
              // Tables & KV pairs are passed via structured diTables/diKeyValuePairs in prompts —
              // skip flat-text duplication to save tokens. Only append for RAG indexing summary.
              const parts = [result.content];
              return {
                text: parts.join('\n'),
                source: 'azure-di-layout',
                diResult: result,
                contractFields: null,
                invoiceFields: null,
                tables: result.tables || [],
                keyValuePairs: result.keyValuePairs || [],
                paragraphs: result.paragraphs || [],
                pages: result.pages || [],
                styles: result.styles || [],
                handwrittenText: extractHandwrittenSpans(result.content, result.styles || []),
                detectedLanguages: (result.languages || []).map(l => l.locale),
                selectionMarks: (result.pages || []).flatMap((p, i) => (p.selectionMarks || []).map(sm => ({ state: sm.state as 'selected' | 'unselected', confidence: sm.confidence, page: i + 1 }))),
                barcodes: result.barcodes || [],
                formulas: result.formulas || [],
                pageInfo: (result.pages || []).map(p => ({ pageNumber: p.pageNumber, width: p.width, height: p.height, unit: p.unit })),
                confidence: computeDIConfidence(result.pages || []),
                isDISource: true,
              };
            }
          }, {
            maxAttempts: 2,
            initialDelay: 2000,
            maxDelay: 15000,
            onRetry: (error, attempt, delay) => {
              logger.warn({ error: error.message, attempt, delay, ocrMode }, 'DI model retry');
            },
          })
        );

        // ── analyzeWithQueries enrichment: extract key contract answers via DI query fields ──
        if (
          structuredResult.isDISource &&
          process.env.AZURE_DI_QUERY_ENRICHMENT !== 'false' &&
          structuredResult.confidence > 0.4
        ) {
          try {
            const { analyzeWithQueries } = await import('./azure-document-intelligence');
            const queryFields = [
              'What is the governing law or jurisdiction?',
              'What is the termination notice period?',
              'What is the contract effective date?',
              'What is the contract expiration or renewal date?',
              'What are the payment terms?',
              'What is the total contract value?',
              'Who are the contracting parties?',
              'What are the key obligations?',
            ];
            const fileBuffer = await fs.readFile(filePath);
            const { answers } = await analyzeWithQueries(fileBuffer, queryFields);
            const validAnswers = Object.entries(answers).filter(([, v]) => v && v.trim().length > 0);
            if (validAnswers.length > 0) {
              // Merge answers into keyValuePairs for downstream artifact generation
              for (const [key, value] of validAnswers) {
                structuredResult.keyValuePairs.push({ key, value, confidence: 0.8 } as any);
              }
              // Append answers to the text for RAG indexing
              const answerBlock = validAnswers.map(([k, v]) => `${k}: ${v}`).join('\n');
              structuredResult.text += `\n\n--- DI QUERY FIELD ANSWERS ---\n${answerBlock}`;
              logger.info({ answerCount: validAnswers.length }, 'DI analyzeWithQueries enrichment added');
            }
          } catch (queryErr) {
            logger.warn({ error: (queryErr as Error).message }, 'DI analyzeWithQueries enrichment failed, continuing without');
          }
        }

        // Cache the text and structured DI data for fast retrieval
        if (fileSize && structuredResult.text && structuredResult.text.length > 100) {
          const cacheKey = generateOCRCacheKey(filePath, fileSize, contentHash);
          await ocrCache.set(cacheKey, structuredResult.text, structuredResult.isDISource ? {
            source: structuredResult.source,
            tables: structuredResult.tables.map(t => ({ pageNumber: t.pageNumber, headers: t.headers, rows: t.rows, confidence: t.confidence })),
            keyValuePairs: structuredResult.keyValuePairs.map(kv => ({ key: kv.key, value: kv.value, confidence: kv.confidence })),
            paragraphs: structuredResult.paragraphs.map(p => ({ content: p.content, role: p.role })),
            contractFields: structuredResult.contractFields ?? undefined,
            invoiceFields: structuredResult.invoiceFields ?? undefined,
            confidence: structuredResult.confidence,
            styles: structuredResult.styles.map(s => ({ isHandwritten: s.isHandwritten, spans: s.spans, confidence: s.confidence })),
            handwrittenText: structuredResult.handwrittenText,
            detectedLanguages: structuredResult.detectedLanguages,
            selectionMarks: structuredResult.selectionMarks,
            barcodes: structuredResult.barcodes.map(b => ({ kind: b.kind, value: b.value, confidence: b.confidence })),
            formulas: structuredResult.formulas.map(f => ({ kind: f.kind, value: f.value, confidence: f.confidence })),
            pageInfo: structuredResult.pageInfo,
          } : undefined);
        }
        logger.info({ ocrMode, textLength: structuredResult.text.length, confidence: structuredResult.confidence.toFixed(3), tables: structuredResult.tables.length, kvPairs: structuredResult.keyValuePairs.length }, 'DI model OCR succeeded with structured data');

        // Log DI API usage for cost tracking persistence
        const diPageCount = structuredResult.pages.length || 1;
        logAIUsage({
          model: ocrMode,
          endpoint: 'azure-document-intelligence',
          feature: 'ocr-extraction',
          inputTokens: diPageCount, // DI charges per page, not per token
          outputTokens: structuredResult.text.length,
          latencyMs: 0, // Latency tracked by circuit breaker/DI module
          success: true,
          metadata: {
            diModel: ocrMode,
            pages: diPageCount,
            tables: structuredResult.tables.length,
            kvPairs: structuredResult.keyValuePairs.length,
            confidence: structuredResult.confidence,
            handwritingDetected: structuredResult.handwrittenText.length > 0,
          },
        });
        onProgress?.(55); // DI analysis complete
        return structuredResult;
      }
    } catch (diError) {
      logger.warn({ error: (diError as Error).message, ocrMode }, 'DI model OCR failed, falling through to legacy chain');
      logAIUsage({
        model: ocrMode,
        endpoint: 'azure-document-intelligence',
        feature: 'ocr-extraction',
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        success: false,
        errorType: (diError as Error).message?.slice(0, 200),
      });
    }
    // Fall through to legacy fallback chain
  }

  // Build fallback chain starting from preferred mode
  const preferredIndex = OCR_FALLBACK_CHAIN.indexOf(ocrMode as OCRMode);
  const fallbackOrder = preferredIndex >= 0 
    ? [...OCR_FALLBACK_CHAIN.slice(preferredIndex), ...OCR_FALLBACK_CHAIN.slice(0, preferredIndex)]
    : OCR_FALLBACK_CHAIN;
  
  let lastError: Error | null = null;
  
  for (const mode of fallbackOrder) {
    // Check circuit breaker state before attempting
    if (mode === 'mistral' && getMistralCircuitBreaker().getState() === getCircuitState().OPEN) {
      logger.warn('Mistral circuit breaker is open, skipping');
      continue;
    }
    if (mode === 'azure-ch' && getAzureCircuitBreaker().getState() === getCircuitState().OPEN) {
      logger.warn('Azure Switzerland circuit breaker is open, skipping');
      continue;
    }
    
    try {
      let result: string;
      
      if (mode === 'openai') {
        // OpenAI GPT-4 Vision OCR (for testing/development)
        result = await retry(() => performGPT4OCR(filePath), {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          onRetry: (error, attempt, delay) => {
            logger.warn({ error: error.message, attempt, delay }, 'OpenAI OCR retry');
          },
        });
      } else if (mode === 'mistral') {
        result = await getMistralCircuitBreaker().execute(() => 
          retry(() => performMistralOCR(filePath), {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            onRetry: (error, attempt, delay) => {
              logger.warn({ error: error.message, attempt, delay }, 'Mistral OCR retry');
            },
          })
        );
      } else if (mode === 'azure-ch') {
        result = await getAzureCircuitBreaker().execute(() => 
          retry(() => performAzureSwitzerlandOCR(filePath), {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            onRetry: (error, attempt, delay) => {
              logger.warn({ error: error.message, attempt, delay }, 'Azure Switzerland OCR retry');
            },
          })
        );
      } else {
        // Fallback to basic extraction
        result = await extractTextFallback(filePath);
      }
      
      // Cache successful result in distributed cache
      if (fileSize && result && result.length > 100) {
        const cacheKey = generateOCRCacheKey(filePath, fileSize, contentHash);
        await ocrCache.set(cacheKey, result);
        logger.info({ cacheKey, textLength: result.length }, 'Cached OCR result in distributed cache');
      }
      
      logger.info({ mode, textLength: result.length }, 'OCR extraction succeeded');
      return makeNonDIResult(result, mode as StructuredOCRResult['source']);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof getCircuitBreakerErrorCtor()) {
        logger.warn({ mode, state: error.state }, 'Circuit breaker prevented OCR call, trying next');
      } else {
        logger.warn({ mode, error: lastError.message }, 'OCR mode failed, trying next');
      }
    }
  }
  
  // All modes exhausted - use basic extraction as last resort
  logger.error({ lastError: lastError?.message }, 'All OCR modes exhausted, using basic extraction');
  const fallbackText = await extractTextFallback(filePath);
  return makeNonDIResult(fallbackText, 'fallback');
}

/**
 * Fallback text extraction (no AI enhancement)
 */
async function extractTextFallback(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const isPDF = filePath.toLowerCase().endsWith('.pdf');
    
    if (isPDF) {
      const pdfParse = pdfParseModule || (await import('pdf-parse')).default;
      const pdfData = await pdfParse(fileBuffer);
      return pdfData.text || 'Unable to extract text from PDF';
    } else {
      // For images, return a placeholder
      return `[Image file: ${filePath} - OCR services unavailable]`;
    }
  } catch (error) {
    logger.error({ error, filePath }, 'Fallback extraction failed');
    return `[Error extracting text from: ${filePath}]`;
  }
}

/**
 * Azure Switzerland OCR extraction (Swiss FADP compliant)
 *
 * Uses Azure Document Intelligence v4.0 Layout model when DI credentials
 * are available (richer output: text + tables + key-value pairs + structure).
 * Falls back to legacy Computer Vision Read API v3.2 otherwise.
 */
async function performAzureSwitzerlandOCR(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const ext = filePath.toLowerCase().split('.').pop() || '';
    const isTextFile = ['txt', 'text', 'md', 'html', 'htm', 'xml', 'json', 'csv'].includes(ext);

    // For text files, just read directly
    if (isTextFile) {
      logger.info({ filePath, size: fileBuffer.length }, 'Reading text file directly (no OCR needed)');
      return fileBuffer.toString('utf-8');
    }

    // ── Try Document Intelligence v4.0 Layout model first ──
    const diEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const diKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

    if (diEndpoint && diKey && getAzureCircuitBreaker().getState() !== getCircuitState().OPEN) {
      try {
        const { analyzeLayout } = await import('./azure-document-intelligence');
        const result = await analyzeLayout(fileBuffer, { extractKeyValuePairs: true });

        // Build rich text output with tables rendered as markdown
        const parts: string[] = [];
        parts.push(result.content);

        // Append tables as markdown for downstream AI processing
        if (result.tables.length > 0) {
          parts.push('\n\n--- EXTRACTED TABLES ---\n');
          for (const table of result.tables) {
            if (table.headers.length > 0) {
              parts.push(`| ${table.headers.join(' | ')} |`);
              parts.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
            }
            for (const row of table.rows) {
              parts.push(`| ${row.join(' | ')} |`);
            }
            parts.push('');
          }
        }

        // Append key-value pairs
        if (result.keyValuePairs.length > 0) {
          parts.push('\n--- KEY-VALUE PAIRS ---\n');
          for (const kv of result.keyValuePairs) {
            if (kv.key && kv.value) {
              parts.push(`${kv.key}: ${kv.value}`);
            }
          }
        }

        const extractedText = parts.join('\n');
        logger.info(
          {
            textLength: extractedText.length,
            pages: result.metadata.pageCount,
            tables: result.tables.length,
            kvPairs: result.keyValuePairs.length,
            model: 'prebuilt-layout',
            apiVersion: 'v4.0',
          },
          'Azure Document Intelligence v4.0 OCR completed'
        );
        return extractedText;
      } catch (diError) {
        logger.warn(
          { error: (diError as Error).message },
          'Document Intelligence v4.0 failed, falling back to Read API v3.2'
        );
        // Fall through to legacy path
      }
    }

    // ── Legacy fallback: Azure Computer Vision Read API v3.2 ──
    const endpoint = process.env.AZURE_VISION_ENDPOINT_CH;
    const apiKey = process.env.AZURE_VISION_KEY_CH;
    
    if (!endpoint || !apiKey) {
      throw new Error('Azure Switzerland credentials not configured (AZURE_VISION_ENDPOINT_CH / AZURE_VISION_KEY_CH or AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT / AZURE_DOCUMENT_INTELLIGENCE_KEY)');
    }
    
    const readUrl = `${endpoint}/vision/v3.2/read/analyze`;
    logger.info({ filePath, endpoint: readUrl }, 'Using Azure Switzerland OCR (legacy Read v3.2)');
    
    const submitResponse = await fetch(readUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    });
    
    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Azure OCR submit failed: ${submitResponse.status} ${errorText}`);
    }
    
    const operationLocation = submitResponse.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('Azure OCR did not return Operation-Location header');
    }
    
    let result;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const resultResponse = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      });
      
      if (!resultResponse.ok) {
        throw new Error(`Azure OCR result failed: ${resultResponse.status}`);
      }
      
      result = await resultResponse.json();
      
      if (result.status === 'succeeded') break;
      if (result.status === 'failed') throw new Error('Azure OCR processing failed');
      
      attempts++;
    }
    
    if (!result || result.status !== 'succeeded') {
      throw new Error('Azure OCR timed out or failed');
    }
    
    const extractedText = result.analyzeResult.readResults
      .map((page: any) => page.lines.map((line: any) => line.text).join('\n'))
      .join('\n\n');
    
    logger.info({ textLength: extractedText.length, pages: result.analyzeResult.readResults.length }, 'Azure Switzerland OCR completed (legacy Read v3.2)');
    return extractedText;
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err, message: err.message }, 'Azure Switzerland OCR failed');
    throw error;
  }
}

/**
 * Mistral OCR extraction
 * For PDFs: uses pdf-parse to extract text, then Mistral AI to enhance/structure it
 * For images: uses Pixtral vision model
 */
async function performMistralOCR(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);

    // Guard against OOM: base64 encoding doubles memory. Cap at 20MB for Vision OCR.
    const MAX_VISION_OCR_SIZE = 20 * 1024 * 1024;
    if (fileBuffer.length > MAX_VISION_OCR_SIZE) {
      logger.warn({ size: fileBuffer.length, maxSize: MAX_VISION_OCR_SIZE, filePath }, 'File too large for Mistral Vision OCR — falling back to text extraction');
      throw new Error(`File size ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB exceeds Vision OCR limit of 20MB`);
    }

    const ext = filePath.toLowerCase().split('.').pop() || '';
    const isPDF = ext === 'pdf';
    const isTextFile = ['txt', 'text', 'md', 'html', 'htm', 'xml', 'json', 'csv'].includes(ext);
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'tif'].includes(ext);
    
    // For text files, just read directly - no OCR needed
    if (isTextFile) {
      logger.info({ filePath, size: fileBuffer.length }, 'Reading text file directly (no OCR needed)');
      return fileBuffer.toString('utf-8');
    }
    
    if (isPDF) {
      // Use pdf-parse for PDF text extraction (preloaded or lazy load)
      logger.info({ filePath, size: fileBuffer.length }, 'Extracting text from PDF with pdf-parse');
      const pdfParse = pdfParseModule || (await import('pdf-parse')).default;
      const pdfData = await pdfParse(fileBuffer);
      
      const rawText = pdfData.text;
      const meaningfulText = rawText.replace(/\s+/g, ' ').trim();
      logger.info({ textLength: rawText.length, meaningfulLength: meaningfulText.length, pages: pdfData.numpages }, 'PDF text extracted');
      
      // Scanned/image PDF: Mistral chat can't handle these — throw so fallback chain tries OpenAI Vision
      if (meaningfulText.length < 50) {
        throw new Error('Scanned/image PDF detected — Mistral text enhancement requires extractable text, falling back to next OCR provider');
      }
      
      // Optimize: Skip AI enhancement for small/medium documents to improve speed
      if (rawText.length < 5000) {
        logger.info('Text is small/medium, skipping AI enhancement for speed');
        return rawText;
      }
      
      // Use Mistral AI to enhance and structure the extracted text (preloaded or lazy load)
      const Mistral = mistralModule || (await import('@mistralai/mistralai')).Mistral;
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        logger.warn('MISTRAL_API_KEY not configured, returning raw PDF text');
        return rawText;
      }
      
      const client = new Mistral({ apiKey });
      // Enhance first 20k chars with AI; append un-enhanced remainder to avoid data loss
      const ENHANCE_LIMIT = 20000;
      const textToProcess = rawText.substring(0, ENHANCE_LIMIT);
      const remainder = rawText.length > ENHANCE_LIMIT ? rawText.substring(ENHANCE_LIMIT) : '';
      
      if (remainder) {
        logger.info({ totalLength: rawText.length, enhancedLength: ENHANCE_LIMIT, remainderLength: remainder.length }, 'Document exceeds enhancement limit — remainder will be appended unenhanced');
      }
      
      // Use smaller/faster model for better performance
      const chatResponse = await client.chat.complete({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'user',
            content: `Clean this text, fix errors, return markdown:\n\n${textToProcess}`,
          },
        ],
        maxTokens: 4000,
        temperature: 0.3, // Lower temperature for faster, more deterministic responses
      });
      
      const rawContent = chatResponse.choices?.[0]?.message?.content;
      // Mistral SDK may return string[] for some responses — coerce to string
      const enhancedPart = (Array.isArray(rawContent) ? rawContent.join('') : rawContent) || textToProcess;
      // Append un-enhanced remainder so no text is silently lost
      const enhancedText = remainder ? `${enhancedPart}\n\n${remainder}` : enhancedPart;
      logger.info({ enhancedLength: enhancedText.length }, 'Text enhanced with Mistral AI');
      return enhancedText;
    } else if (isImage) {
      // For images, use Pixtral vision model with optional preprocessing
      const { Mistral } = await import('@mistralai/mistralai');
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        throw new Error('MISTRAL_API_KEY not configured');
      }
      
      // Apply preprocessing if enabled
      let processedBuffer: Buffer = fileBuffer;
      if (WORKER_CONFIG.ocr.enablePreprocessing) {
        logger.info({ filePath }, 'Preprocessing image for better OCR accuracy');
        const preprocessResult = await preprocessImageForOCR(fileBuffer, {
          enableDeskew: true,
          enableDenoise: true,
          enableContrastEnhancement: true,
          enableBinarization: false,
          targetDpi: 300,
          maxDimension: 3000,
        });
        processedBuffer = Buffer.from(preprocessResult.buffer);
        
        if (preprocessResult.estimatedAccuracyImprovement > 0) {
          logger.info({
            qualityBefore: preprocessResult.qualityBefore.qualityScore,
            qualityAfter: preprocessResult.qualityAfter.qualityScore,
            accuracyImprovement: `${preprocessResult.estimatedAccuracyImprovement.toFixed(1)}%`,
            stepsApplied: preprocessResult.stepsApplied,
          }, 'Image preprocessing improved quality');
        }
      }
      
      const client = new Mistral({ apiKey });
      const base64Data = processedBuffer.toString('base64');
      const mimeType = ext === 'png' ? 'image/png' : 
                       ext === 'gif' ? 'image/gif' : 
                       ext === 'webp' ? 'image/webp' : 'image/jpeg';
      
      logger.info({ filePath, size: processedBuffer.length, mimeType }, 'Processing image with Mistral Pixtral Vision OCR');
      
      const chatResponse = await client.chat.complete({
        model: 'pixtral-12b-2409',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this image and return it in markdown format. Preserve the structure and formatting as much as possible.',
              },
              {
                type: 'image_url',
                imageUrl: `data:${mimeType};base64,${base64Data}`,
              },
            ],
          },
        ],
        maxTokens: 8000,
      });
      
      const extractedText = chatResponse.choices?.[0]?.message?.content || '';
      logger.info({ textLength: extractedText.length }, 'Mistral Vision OCR completed');
      return typeof extractedText === 'string' ? extractedText : '';
    } else {
      // For DOCX/DOC and other unsupported types, try to read as text
      logger.info({ filePath, ext }, 'Unsupported file type for Mistral Vision, trying text extraction');
      try {
        return fileBuffer.toString('utf-8');
      } catch {
        throw new Error(`Unsupported file type: ${ext}. Mistral Vision only supports images.`);
      }
    }
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err, message: err.message, stack: err.stack }, 'Mistral OCR failed');
    throw error;
  }
}

/**
 * GPT-4 Vision OCR extraction
 * For PDFs: Uses pdf-parse to extract text, then GPT to clean/enhance
 * For text files: Just read the file directly
 * For images: Uses GPT-4 Vision
 */
async function performGPT4OCR(filePath: string): Promise<string> {
  try {
    const OpenAI = (await import('openai')).default;
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    const openai = await getOCROpenAIClient();
    const fileBuffer = await fs.readFile(filePath);

    // Guard against OOM: base64 encoding doubles memory. Cap at 20MB for Vision OCR.
    const MAX_VISION_OCR_SIZE = 20 * 1024 * 1024;
    if (fileBuffer.length > MAX_VISION_OCR_SIZE) {
      logger.warn({ size: fileBuffer.length, maxSize: MAX_VISION_OCR_SIZE, filePath }, 'File too large for Vision OCR — falling back to text extraction');
      throw new Error(`File size ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB exceeds Vision OCR limit of 20MB`);
    }

    const ext = filePath.toLowerCase().split('.').pop() || '';
    const isPDF = ext === 'pdf';
    const isTextFile = ['txt', 'text', 'md', 'html', 'htm', 'xml', 'json', 'csv'].includes(ext);
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'tif'].includes(ext);
    
    // For text files, just read directly - no OCR needed
    if (isTextFile) {
      logger.info({ filePath, size: fileBuffer.length }, 'Reading text file directly (no OCR needed)');
      return fileBuffer.toString('utf-8');
    }
    
    // For PDFs, use pdf-parse first, then GPT for enhancement
    if (isPDF) {
      logger.info({ filePath, size: fileBuffer.length }, 'Processing PDF with pdf-parse + GPT enhancement');
      
      const pdfParse = pdfParseModule || (await import('pdf-parse')).default;
      const pdfData = await pdfParse(fileBuffer);
      const rawText = pdfData.text;
      const meaningfulText = rawText.replace(/\s+/g, ' ').trim();
      
      logger.info({ textLength: rawText.length, meaningfulLength: meaningfulText.length, pages: pdfData.numpages }, 'PDF text extracted');
      
      // Scanned / image-based PDF: very little extractable text → use GPT-4o native PDF file input
      if (meaningfulText.length < 50) {
        logger.info({ pages: pdfData.numpages, extractedChars: meaningfulText.length }, 'Scanned/image PDF detected — using GPT-4o native PDF file input');
        const visionModel = WORKER_CONFIG.ai.visionModel || 'gpt-4o';
        const base64 = fileBuffer.toString('base64');
        const fileName = path.basename(filePath);
        
        // Use native PDF file content type (NOT image_url which rejects application/pdf MIME)
        const response = await openai.chat.completions.create({
          model: visionModel,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract ALL text from this scanned PDF document with high accuracy.
Preserve the exact structure, formatting, and layout.
Include:
- All headings and subheadings
- All paragraphs with proper spacing
- All lists (numbered and bulleted)
- Table data in markdown table format
- Headers and footers
- Any signatures or handwritten annotations

Return the extracted text in clean markdown format.`,
                },
                {
                  type: 'file',
                  file: {
                    filename: fileName,
                    file_data: `data:application/pdf;base64,${base64}`,
                  },
                } as any,
              ],
            },
          ],
          max_tokens: 8192,
          temperature: 0.1,
        });
        
        const visionText = response.choices[0]?.message?.content || '';
        logger.info({ textLength: visionText.length, model: visionModel }, 'GPT-4o Vision OCR completed for scanned PDF');
        
        if (visionText.length > 50) {
          return visionText;
        }
        // If vision also returned little text, fall through to return whatever we have
        logger.warn({ visionTextLength: visionText.length }, 'GPT-4o Vision returned minimal text for scanned PDF');
        return visionText || rawText;
      }
      
      // Text-based PDF with sufficient content
      // For small documents, skip GPT enhancement
      if (rawText.length < 3000) {
        return rawText;
      }
      
      // Use GPT to clean and structure the text
      const textToProcess = rawText.substring(0, 15000);
      
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a document processing expert. Clean and structure the following extracted PDF text. Fix OCR errors, format as clean markdown, and preserve the document structure.'
          },
          {
            role: 'user',
            content: textToProcess
          }
        ],
        max_tokens: 4096,
        temperature: 0.2
      });
      
      const enhancedText = response.choices[0]?.message?.content || rawText;
      logger.info({ originalLength: rawText.length, enhancedLength: enhancedText.length }, 'GPT text enhancement completed');
      
      return enhancedText;
    } else if (isImage) {
      // For images, use GPT-4o Vision (full model for best accuracy) with preprocessing
      
      // Apply preprocessing if enabled for better OCR accuracy
      let processedBuffer: Buffer = fileBuffer;
      if (WORKER_CONFIG.ocr.enablePreprocessing) {
        logger.info({ filePath }, 'Preprocessing image for GPT-4o Vision OCR');
        const preprocessResult = await preprocessImageForOCR(fileBuffer, {
          enableDeskew: true,
          enableDenoise: true,
          enableContrastEnhancement: true,
          enableBinarization: false,
          targetDpi: 300,
          maxDimension: 4000, // Higher resolution for GPT-4o Vision
        });
        processedBuffer = Buffer.from(preprocessResult.buffer);
        
        if (preprocessResult.estimatedAccuracyImprovement > 0) {
          logger.info({
            qualityBefore: preprocessResult.qualityBefore.qualityScore,
            qualityAfter: preprocessResult.qualityAfter.qualityScore,
            accuracyImprovement: `${preprocessResult.estimatedAccuracyImprovement.toFixed(1)}%`,
            stepsApplied: preprocessResult.stepsApplied,
          }, 'Image preprocessing improved quality for GPT-4o Vision');
        }
      }
      
      const base64 = processedBuffer.toString('base64');
      const mimeType = ext === 'png' ? 'image/png' : 
                       ext === 'gif' ? 'image/gif' : 
                       ext === 'webp' ? 'image/webp' : 'image/jpeg';
      
      // Use GPT-4o for Vision OCR (NOT gpt-4o-mini) for best quality
      const visionModel = WORKER_CONFIG.ai.visionModel || 'gpt-4o';
      logger.info({ filePath, size: processedBuffer.length, mimeType, visionModel }, 'Processing image with GPT-4o Vision OCR');
      
      const response = await openai.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract ALL text from this document image with high accuracy.
Preserve the exact structure, formatting, and layout.
Include:
- All headings and subheadings
- All paragraphs with proper spacing
- All lists (numbered and bulleted)
- Table data in markdown table format
- Headers and footers
- Any handwritten annotations

Return the extracted text in clean markdown format.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                  detail: 'high', // Use high detail for better OCR accuracy
                },
              },
            ],
          },
        ],
        max_tokens: 8192, // Increased for longer documents
        temperature: 0.1, // Lower temperature for more accurate extraction
      });
      
      const extractedText = response.choices[0]?.message?.content || '';
      logger.info({ textLength: extractedText.length, model: visionModel }, 'GPT-4o Vision OCR completed');
      
      return extractedText;
    } else {
      // For DOCX/DOC and other unsupported types, try to read as text
      logger.info({ filePath, ext }, 'Unsupported file type for GPT-4 Vision, trying text extraction');
      try {
        return fileBuffer.toString('utf-8');
      } catch {
        throw new Error(`Unsupported file type: ${ext}. GPT-4 Vision only supports images (png, jpg, gif, webp).`);
      }
    }
  } catch (error) {
    logger.error({ error }, 'GPT-4 OCR failed');
    throw error;
  }
}

/**
 * OCR + Artifact Generation Worker
 * Downloads file from storage, runs OCR, generates artifacts
 */
export async function processOCRArtifactJob(
  job: JobType<ProcessContractJobData>
): Promise<OCRArtifactResult> {
  const { contractId, tenantId, filePath } = job.data;
  const trace = getTraceContextFromJobData(job.data);
  const jobLogger = logger.child({ jobId: job.id, contractId, tenantId });

  let qualityMetrics: ExtractionQualityMetrics | undefined;
  let localFilePath!: string;
  let isTempFile = false;

  jobLogger.info({ filePath }, 'Starting OCR + artifact processing');

  // Connect to Redis event bus for real-time updates
  try {
    await redisEventBus.connect();
  } catch (err) {
    jobLogger.warn({ error: err }, 'Redis event bus not available, continuing without real-time updates');
  }

  try {
    jobLogger.info('Step 1: Updating progress to 5%');
    try { await job.updateProgress(5); } catch { /* best-effort */ }
    
    // Publish processing started event
    await publishJobProgress(job.id || '', contractId, tenantId, 5, 'started', 'OCR processing started');

    // 1. Fetch contract from database
    jobLogger.info('Step 2: Fetching contract from database');
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });

    if (!contract || contract.tenantId !== tenantId) {
      jobLogger.error({ found: !!contract }, 'Contract not found or tenant mismatch');
      throw new Error(`Contract ${contractId} not found`);
    }

    // Idempotency guard: if this is a retry and OCR already completed, skip re-processing
    if (job.attemptsMade > 0 && contract.rawText && contract.rawText.length > 100 && contract.status === 'COMPLETED') {
      const existingArtifacts = await prisma.artifact.count({ where: { contractId } });
      if (existingArtifacts > 0) {
        jobLogger.info({ attemptsMade: job.attemptsMade, existingArtifacts, textLength: contract.rawText.length }, 'Idempotency: OCR already completed on prior attempt, skipping re-processing');
        return { success: true, artifactsCreated: existingArtifacts, extractedText: contract.rawText };
      }
    }

    await ensureProcessingJob({
      tenantId,
      contractId,
      queueId: job.id ? String(job.id) : undefined,
      traceId: trace.traceId,
    });

    jobLogger.info({ status: contract.status }, 'Contract found');
    try { await job.updateProgress(10); } catch { /* best-effort */ }
    await publishJobProgress(job.id || '', contractId, tenantId, 10, 'processing', 'Downloading contract file');

    // 2. Download file from storage to temp location
    if (!contract.storagePath) {
      throw new Error(`Contract ${contractId} has no storage path`);
    }
    
    // Store storagePath in a local const to preserve narrowing inside callbacks
    const storagePath = contract.storagePath;
    
    if (contract.storageProvider === 's3') {
      jobLogger.info({ storagePath }, 'Downloading from S3/MinIO');
      
      // Use circuit breaker and retry for storage operations
      const fileBuffer = await getStorageCircuitBreaker().execute(() => 
        retryStorage(async () => {
          const getObjectCommand = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET || process.env.MINIO_BUCKET || 'contracts',
            Key: storagePath,
          });

          const response = await s3Client().send(getObjectCommand);
          
          // Read stream to buffer
          const stream = response.Body as Readable;
          const chunks: Buffer[] = [];
          
          for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
          }
          
          return Buffer.concat(chunks);
        })
      );
      
      // Create temp file
      const tempDir = os.tmpdir();
      const fileName = path.basename(contract.storagePath!);
      localFilePath = path.join(tempDir, `${contractId}-${fileName}`);
      
      await fs.writeFile(localFilePath, fileBuffer);
      isTempFile = true;
      jobLogger.info({ localFilePath, size: fileBuffer.length }, 'File downloaded');
    } else {
      // Local file system
      localFilePath = contract.storagePath!;
      jobLogger.info({ localFilePath }, 'Using local file');
    }

    // Compute content hash for collision-resistant OCR cache key
    let fileContentHash: string | undefined;
    let localFileSize: number | undefined;
    try {
      const buf = await fs.readFile(localFilePath);
      fileContentHash = createHash('sha256').update(buf).digest('hex');
      localFileSize = buf.length;
    } catch {
      // Non-critical — fall back to hash-less cache key
    }

    // 3. Run OCR extraction (skip progress update for speed)
    jobLogger.info({ filePath: localFilePath }, 'Running OCR extraction');
    await publishJobProgress(job.id || '', contractId, tenantId, 20, 'ocr', 'Extracting text from document');
    
    // Get ocrMode from job data (user selection) or use preclassification
    let ocrMode: string = job.data.ocrMode || 'auto';

    // Auto-select: run quick preclassification to pick the optimal DI model
    if (ocrMode === 'auto') {
      try {
        const { isDIConfigured, isDIEnabled } = await import('./azure-document-intelligence');
        if (isDIConfigured() && isDIEnabled()) {
          // Check feedback-driven OCR model preference first
          try {
            const { getUserFeedbackLearner } = await import('./agents/user-feedback-learner');
            const preferred = await getUserFeedbackLearner().getPreferredOCRModel(tenantId);
            if (preferred) {
              ocrMode = preferred;
              jobLogger.info({ preferredModel: preferred }, 'Feedback learner selected OCR model based on historical edit rates');
            }
          } catch {
            // Non-critical — fall through to preclassification
          }

          // If feedback didn't pick a model, use preclassification
          if (ocrMode === 'auto') {
            // Read a small text sample for preclassification (use pdf-parse for PDFs)
            let textSample = '';
            const ext = localFilePath.toLowerCase().split('.').pop() || '';
            if (['pdf'].includes(ext)) {
              try {
                const buf = await fs.readFile(localFilePath);
                const pdfParse = pdfParseModule || (await import('pdf-parse')).default;
                const parsed = await pdfParse(buf, { max: 3 }); // first 3 pages
                textSample = (parsed.text || '').slice(0, 3000);
              } catch { /* ignore, proceed without sample */ }
            }

            if (textSample.length > 50) {
              const { quickClassify } = await import('./document-preclassification');
              const classification = await quickClassify(textSample);
              const mappedMode = OCR_MODEL_TO_MODE[classification.recommendedModel];
              if (mappedMode) {
                ocrMode = mappedMode;
                jobLogger.info({
                  category: classification.category,
                  contractType: classification.contractType,
                  recommendedModel: classification.recommendedModel,
                  resolvedMode: ocrMode,
                }, 'Preclassification selected DI model');
              }
            }

            // If still auto (scanned PDF with no text, or image file), DI layout
            // is the best option — it handles images and scanned docs natively.
            if (ocrMode === 'auto') {
              ocrMode = 'azure-di-layout';
              jobLogger.info('No text sample for preclassification — defaulting to azure-di-layout');
            }
          }
        }

        // DI not configured? fall back to azure-ch legacy chain
        if (ocrMode === 'auto') ocrMode = 'azure-ch';
      } catch (preErr) {
        jobLogger.warn({ error: (preErr as Error).message }, 'Preclassification failed, defaulting to azure-ch');
        ocrMode = 'azure-ch';
      }
    }

    let ocrResult = await performOCR(localFilePath, ocrMode, localFileSize, async (pct) => {
      try { await job.updateProgress(pct); } catch { /* best-effort */ }
    }, fileContentHash);
    let rawExtractedText = ocrResult.text;
    
    // ============ OCR ENHANCEMENT PIPELINE ============
    // Skip enhancement for DI output — DI text is already clean and deterministic.
    // For non-DI providers, apply post-OCR corrections, validation, and quality improvements.
    let enhancedText = rawExtractedText;
    let ocrEnhancementResult: OCREnhancementPipelineResult | null = null;
    let adaptiveConfig: AdaptiveModelConfig | null = null;
    
    if (ocrResult.isDISource) {
      jobLogger.info({ source: ocrResult.source, confidence: ocrResult.confidence.toFixed(3) }, 
        'DI source detected — skipping OCR enhancement pipeline (DI output is deterministic)');
    } else if (WORKER_CONFIG.ocr.enablePostOCRCorrection && rawExtractedText.length > 0) {
      try {
        jobLogger.info('Running OCR enhancement pipeline...');
        await publishJobProgress(job.id || '', contractId, tenantId, 30, 'ocr-enhancement', 'Enhancing OCR accuracy');
        
        // Run the full enhancement pipeline
        const enhancementResult = await runOCREnhancementPipeline(
          Buffer.alloc(0), // Image buffer not needed for text-only enhancements
          rawExtractedText,
          {
            enableDeskew: false, // Already done in preprocessing
            enableSpellCheck: WORKER_CONFIG.ocr.enableLegalSpellCheck,
            enableDateValidation: WORKER_CONFIG.ocr.enableDateValidation,
            enableAmountValidation: WORKER_CONFIG.ocr.enableAmountValidation,
            enableAdaptiveModel: WORKER_CONFIG.ocr.enableAdaptiveModelSelection,
            collectTrainingData: WORKER_CONFIG.ocr.collectTrainingData,
            tenantId,
            contractId,
            ocrProvider: ocrMode,
          }
        );
        
        enhancedText = enhancementResult.enhancedText;
        ocrEnhancementResult = enhancementResult;
        adaptiveConfig = enhancementResult.preprocessing.adaptiveConfig || null;
        
        jobLogger.info({
          correctionsApplied: enhancementResult.validation.metrics.totalCorrections,
          spellingCorrections: enhancementResult.validation.metrics.spellingCorrections,
          dateCorrections: enhancementResult.validation.metrics.dateCorrections,
          amountCorrections: enhancementResult.validation.metrics.amountCorrections,
          confidenceImprovement: enhancementResult.validation.metrics.confidenceImprovement.toFixed(2),
          lowConfidenceRegions: enhancementResult.lowConfidenceRegions?.length || 0,
        }, 'OCR enhancement pipeline completed');
        
        // Flag low-confidence regions for human review
        if (enhancementResult.lowConfidenceRegions && enhancementResult.lowConfidenceRegions.length > 5) {
          jobLogger.warn({
            regionCount: enhancementResult.lowConfidenceRegions.length,
          }, 'Multiple low-confidence regions detected - document may need human review');
        }
      } catch (enhancementError) {
        jobLogger.warn({ error: enhancementError }, 'OCR enhancement failed, using raw text');
        enhancedText = rawExtractedText;
      }
    }
    
    // ============ LLM ENHANCEMENT (Swiss Data Protection Compliant) ============
    // Skip for DI output — DI text is high-quality and doesn't need LLM spell correction.
    // For non-DI providers, use AI for intelligent spell correction with data residency compliance.
    let llmEnhancementResult: HybridEnhancementResult | null = null;
    
    if (ocrResult.isDISource) {
      jobLogger.info('DI source — skipping LLM enhancement (DI output is high-quality)');
    } else if (WORKER_CONFIG.ocr.enableLLMCorrection && enhancedText.length > 100) {
      try {
        jobLogger.info({
          dataResidency: WORKER_CONFIG.ocr.llmDataResidency,
          anonymizePII: WORKER_CONFIG.ocr.llmAnonymizePII,
        }, 'Running LLM-enhanced spell correction (Swiss compliant)...');
        
        await publishJobProgress(job.id || '', contractId, tenantId, 35, 'llm-enhancement', 'AI spell correction (Swiss compliant)');
        
        llmEnhancementResult = await runHybridEnhancement(enhancedText, {
          enableLLMCorrection: true,
          enableLocalCorrection: false, // Already done above
          dataProtection: {
            dataResidencyRegion: WORKER_CONFIG.ocr.llmDataResidency,
            anonymizePII: WORKER_CONFIG.ocr.llmAnonymizePII,
            auditLogging: WORKER_CONFIG.ocr.llmAuditLogging,
            blockNonCompliant: WORKER_CONFIG.ocr.llmBlockNonCompliant,
            tenantId,
            contractId,
          },
          focusAreas: ['legal', 'financial', 'general'],
          tenantId,
          contractId,
        });
        
        if (llmEnhancementResult.totalCorrections > 0) {
          enhancedText = llmEnhancementResult.enhancedText;
          
          jobLogger.info({
            llmCorrections: llmEnhancementResult.llmResult?.corrections.length || 0,
            provider: llmEnhancementResult.llmResult?.provider || 'none',
            piiProtected: llmEnhancementResult.dataProtection.piiProtected,
            region: llmEnhancementResult.dataProtection.region,
            processingTimeMs: llmEnhancementResult.processingTimeMs,
          }, 'LLM enhancement completed (Swiss compliant)');
        } else {
          jobLogger.info({
            llmUsed: llmEnhancementResult.dataProtection.llmUsed,
            region: llmEnhancementResult.dataProtection.region,
          }, 'LLM enhancement found no corrections needed');
        }
      } catch (llmError) {
        jobLogger.warn({ error: llmError }, 'LLM enhancement failed, continuing with local enhancements only');
      }
    }
    
    // ============ MULTI-PASS CROSS-VALIDATION ============
    // For non-DI, low-confidence results: run a secondary OCR pass and adopt the
    // longer/better result when the differential is significant.
    const CROSS_VALIDATE_THRESHOLD = 0.6;
    if (
      !ocrResult.isDISource &&
      WORKER_CONFIG.ocr.enableMultiPassExtraction &&
      (ocrEnhancementResult?.validation.confidence ?? 0.5) < CROSS_VALIDATE_THRESHOLD &&
      localFilePath &&
      enhancedText.length > 100
    ) {
      try {
        jobLogger.info({ confidence: ocrEnhancementResult?.validation.confidence }, 'Low confidence — attempting cross-validation pass');
        // Pick a different provider for the second pass
        const secondaryMode = ocrMode === 'openai' ? 'mistral' : 'openai';
        const secondResult = await performOCR(localFilePath, secondaryMode, undefined, async () => {});
        if (secondResult.text.length > enhancedText.length * 1.15) {
          jobLogger.info({
            primary: enhancedText.length,
            secondary: secondResult.text.length,
            provider: secondaryMode,
          }, 'Cross-validation pass produced significantly more text — adopting');
          enhancedText = secondResult.text;
        }
      } catch (crossErr) {
        jobLogger.warn({ error: (crossErr as Error).message }, 'Cross-validation pass failed, continuing with primary');
      }
    }

    // ============ DI LOW-CONFIDENCE CROSS-VALIDATION ============
    // When DI returns a result below a confidence threshold, run a secondary DI model
    // (e.g., prebuilt-read for pure text) and adopt the better result.
    const DI_CROSS_VALIDATE_THRESHOLD = 0.55;
    if (
      ocrResult.isDISource &&
      ocrResult.confidence < DI_CROSS_VALIDATE_THRESHOLD &&
      localFilePath &&
      enhancedText.length > 100
    ) {
      try {
        jobLogger.info({ confidence: ocrResult.confidence, primaryMode: ocrMode }, 'DI low confidence — attempting DI cross-validation with secondary model');
        const secondaryDIMode: string = ocrMode === 'azure-di-layout' ? 'azure-di-contract' : 'azure-di-layout';
        const secondResult = await performOCR(localFilePath, secondaryDIMode as any, undefined, async () => {});
        // Adopt if the secondary DI pass yields significantly better confidence or more text
        const betterConfidence = secondResult.confidence > ocrResult.confidence + 0.1;
        const moreText = secondResult.text.length > enhancedText.length * 1.15;
        if (betterConfidence || moreText) {
          jobLogger.info({
            primaryConfidence: ocrResult.confidence.toFixed(3),
            secondaryConfidence: secondResult.confidence.toFixed(3),
            primaryLen: enhancedText.length,
            secondaryLen: secondResult.text.length,
            provider: secondaryDIMode,
          }, 'DI cross-validation produced better result — adopting');
          enhancedText = secondResult.text;
          rawExtractedText = secondResult.text;
          ocrMode = secondaryDIMode;
          // The adopted DI result must become the canonical source for downstream
          // persistence, prompting, and metadata so we do not mix structures from
          // two different DI passes.
          ocrResult = secondResult;
        }
      } catch (diCrossErr) {
        jobLogger.warn({ error: (diCrossErr as Error).message }, 'DI cross-validation pass failed, continuing with primary');
      }
    }
    
    // Initialize quality metrics — prefer DI word-level confidence when available
    const baseConfidence = ocrResult.isDISource && ocrResult.confidence > 0
      ? ocrResult.confidence
      : (ocrEnhancementResult?.validation.confidence || 0.5);
    qualityMetrics = {
      contractId,
      startTime: Date.now(),
      textLength: enhancedText.length,
      artifactsGenerated: 0,
      failedArtifacts: [],
      textConfidence: baseConfidence,
      tablesDetected: 0,
      financialIndicators: { hasCurrency: false, currencies: [], hasPercentages: false, hasPaymentTerms: false, estimatedTotalValue: null, confidence: 0.5 },
      errors: [],
      warnings: [],
    };
    
    // 3.1 Preprocess the extracted text (use enhanced text) — with cache
    const { cleanedText: extractedText, tables, metrics: textMetrics, fromCache: preprocessFromCache } = 
      await preprocessTextCached(enhancedText, jobLogger);
    if (preprocessFromCache) {
      jobLogger.info('Preprocessing result loaded from cache, skipping recomputation');
    }
    qualityMetrics.textLength = extractedText.length;
    qualityMetrics.textConfidence = textMetrics.confidenceScore;
    qualityMetrics.tablesDetected = textMetrics.tablesDetected;
    
    // 3.2 Detect financial indicators for better FINANCIAL artifact extraction
    const financialIndicators = extractFinancialIndicators(extractedText);
    qualityMetrics.financialIndicators = financialIndicators;
    
    // 3.3 Detect rate tables
    const rateTableInfo = detectRateTables(extractedText);
    
    jobLogger.info({ 
      ocrMode, 
      rawTextLength: rawExtractedText.length,
      enhancedTextLength: enhancedText.length,
      cleanedTextLength: extractedText.length, 
      tablesDetected: textMetrics.tablesDetected,
      textConfidence: textMetrics.confidenceScore,
      hasCurrency: financialIndicators.hasCurrency,
      currencies: financialIndicators.currencies,
      hasRateTables: rateTableInfo.hasRateTables,
      ocrEnhancements: ocrEnhancementResult ? {
        totalCorrections: ocrEnhancementResult.validation.metrics.totalCorrections,
        spellingCorrections: ocrEnhancementResult.validation.metrics.spellingCorrections,
        dateCorrections: ocrEnhancementResult.validation.metrics.dateCorrections,
        amountCorrections: ocrEnhancementResult.validation.metrics.amountCorrections,
        lowConfidenceRegions: ocrEnhancementResult.lowConfidenceRegions?.length || 0,
        confidence: ocrEnhancementResult.validation.confidence,
      } : null,
    }, 'OCR extraction and preprocessing completed');

    // Save extracted text to contract's rawText field for AI processing
    if (extractedText && extractedText.length > 0) {
      try {
        const ocrUpdateData: Record<string, any> = {
          ...buildPersistedContractTextFields(extractedText),
          ocrProvider: ocrMode,
          ocrModel: ocrMode.startsWith('azure-di-') ? `prebuilt-${ocrMode.replace('azure-di-', '')}` : undefined,
          ocrProcessedAt: new Date(),
          updatedAt: new Date(),
        };

        // Persist DI confidence and structured metadata when available
        if (ocrResult.isDISource) {
          ocrUpdateData.aiMetadata = {
            ocrStructuredMeta: {
              source: ocrResult.source,
              confidence: ocrResult.confidence,
              tableCount: ocrResult.tables.length,
              kvPairCount: ocrResult.keyValuePairs.length,
              paragraphCount: ocrResult.paragraphs.length,
              pageCount: ocrResult.pages.length,
              hasContractFields: !!ocrResult.contractFields,
              hasInvoiceFields: !!ocrResult.invoiceFields,
              processedAt: new Date().toISOString(),
            },
            // Store DI paragraph hints for RAG chunker
            diParagraphs: ocrResult.paragraphs.slice(0, 500).map(p => ({
              content: p.content.slice(0, 200),
              role: p.role,
            })),
            // Persist DI structured data for reprocessing without re-calling API
            diTables: ocrResult.tables.slice(0, 100),
            diKeyValuePairs: ocrResult.keyValuePairs.slice(0, 200),
            diContractFields: ocrResult.contractFields || null,
            diInvoiceFields: ocrResult.invoiceFields || null,
            diHandwritingDetected: ocrResult.handwrittenText.length > 0,
            diHandwrittenSpans: ocrResult.handwrittenText.slice(0, 50),
            diDetectedLanguages: ocrResult.detectedLanguages,
          };
        }

        await prisma.contract.updateMany({
          where: { id: contractId, tenantId },
          data: ocrUpdateData,
        });
        jobLogger.info({ textLength: extractedText.length, isDI: ocrResult.isDISource, confidence: ocrResult.confidence.toFixed(3) }, 'Raw text saved to contract');
      } catch (rawTextError) {
        jobLogger.warn({ error: rawTextError }, 'Failed to save rawText, continuing with processing');
      }
    }

    try { await job.updateProgress(60); } catch { /* best-effort */ }
    await publishJobProgress(job.id || '', contractId, tenantId, 60, 'artifacts', 'Detecting contract type with AI');

    // 3.5 Detect contract type using AI analysis for better accuracy
    jobLogger.info('Analyzing contract type using AI...');
    const contractTypeDetection = await detectContractTypeWithAI(extractedText);
    const detectedContractType = contractTypeDetection.type;
    const profile = getContractProfile(detectedContractType);
    
    jobLogger.info({ 
      detectedType: detectedContractType,
      confidence: contractTypeDetection.confidence,
      reasoning: contractTypeDetection.reasoning,
      displayName: profile.displayName,
    }, 'Contract type detected using AI analysis');

    // Persist detected contract type + classification metadata to the Contract record
    try {
      await prisma.contract.updateMany({
        where: { id: contractId, tenantId },
        data: {
          contractType: detectedContractType,
          classificationConf: contractTypeDetection.confidence,
          classificationMeta: {
            method: 'ocr-artifact-worker-ai',
            reasoning: contractTypeDetection.reasoning,
            matchedKeywords: contractTypeDetection.matchedKeywords || [],
            profileDisplayName: profile.displayName,
            detectedAt: new Date().toISOString(),
          },
          classifiedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      jobLogger.info({ contractId, contractType: detectedContractType }, 'Contract type persisted to contract record');
    } catch (typeUpdateError) {
      jobLogger.warn({ error: typeUpdateError }, 'Failed to persist contract type, continuing');
    }

    // 4. Generate artifacts using AI with partial success tracking
    // Use contract type to determine which artifacts to generate
    jobLogger.info('Generating AI artifacts (adaptive based on contract type)');
    
    // Load tenant-specific artifact config overrides (P2 #2: respect tenant config)
    let enabledArtifactTypes = SHARED_ARTIFACT_TYPES.filter(c => c.enabled);
    try {
      const tenantConfig = await prisma.tenantConfig.findUnique({
        where: { tenantId },
        select: { workflowSettings: true },
      });
      if (tenantConfig?.workflowSettings && typeof tenantConfig.workflowSettings === 'object') {
        const settings = tenantConfig.workflowSettings as Record<string, any>;
        const artifactOverrides = settings.artifactTypes || {};
        
        // Also check per-contract-type overrides (P3 #16)
        const contractTypeOverrides = settings.contractTypeOverrides?.[detectedContractType] || {};
        
        enabledArtifactTypes = SHARED_ARTIFACT_TYPES.map(defaultType => {
          const globalOverride = artifactOverrides[defaultType.type] || {};
          const perTypeOverride = contractTypeOverrides[defaultType.type] || {};
          // Per-contract-type overrides take precedence over global tenant overrides
          return {
            ...defaultType,
            enabled: perTypeOverride.enabled ?? globalOverride.enabled ?? defaultType.enabled,
            priority: perTypeOverride.priority ?? globalOverride.priority ?? defaultType.priority,
            qualityThreshold: perTypeOverride.qualityThreshold ?? globalOverride.qualityThreshold ?? defaultType.qualityThreshold,
            maxRetries: perTypeOverride.maxRetries ?? globalOverride.maxRetries ?? defaultType.maxRetries,
          };
        }).filter(c => c.enabled);
        jobLogger.info({ overrides: Object.keys(artifactOverrides), contractTypeOverrides: Object.keys(contractTypeOverrides) }, 'Applied tenant artifact config overrides');
      }
    } catch (configError) {
      jobLogger.warn({ error: configError }, 'Failed to load tenant artifact config, using defaults');
    }

    // Use unified artifact types from shared module (P1 #1: single source of truth)
    const allArtifactTypes: ArtifactType[] = enabledArtifactTypes
      .sort((a, b) => a.priority - b.priority)
      .map(c => c.type as ArtifactType);

    // Filter to relevant artifacts using isArtifactApplicable (P1 #2: proper tenant config)
    const artifactTypes = allArtifactTypes.filter(type => 
      isArtifactApplicable(detectedContractType, type as any)
    );
    
    // Track non-applicable artifacts
    const notApplicableArtifacts = allArtifactTypes.filter(type => !artifactTypes.includes(type));
    
    jobLogger.info({ 
      relevantArtifacts: artifactTypes,
      skippedAsNotApplicable: notApplicableArtifacts,
    }, 'Artifact types determined by contract type');

    const failedArtifacts: string[] = [];
    const successfulArtifacts: string[] = [];

    // Quality validator using unified thresholds (P2 #7: consistent quality)
    const qualityValidator = new ArtifactQualityValidator(UNIFIED_QUALITY_THRESHOLDS);

    // Cost budget enforcement (P2 #11: limit per-contract and per-tenant spend)
    const budgetTracker = new ArtifactCostTracker();

    // Generate artifacts in parallel batches for faster processing (~3x speedup)
    // Priority order preserved within batches; high-priority artifacts complete first.
    // Batch size configurable via ARTIFACT_BATCH_SIZE env var (default: 3 concurrent).
    const PARALLEL_BATCH_SIZE = parseInt(process.env.ARTIFACT_BATCH_SIZE || '5', 10);
    const generatedArtifactResults: any[] = [];
    let completedCount = 0;

    // Store expected artifact count in contract aiMetadata so the SSE stream
    // can calculate accurate progress (e.g., 3 of 15 instead of 3 of 3).
    const expectedArtifactCount = allArtifactTypes.length; // includes applicable + not-applicable
    try {
      const existingMeta: any = contract.aiMetadata || {};
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          aiMetadata: {
            ...existingMeta,
            expectedArtifactCount,
            applicableArtifactCount: artifactTypes.length,
            processingStartedAt: new Date().toISOString(),
          },
        },
      });
    } catch (metaErr) {
      jobLogger.warn({ error: (metaErr as Error).message }, 'Failed to store expected artifact count');
    }
    
    for (let batchStart = 0; batchStart < artifactTypes.length; batchStart += PARALLEL_BATCH_SIZE) {
      const batch = artifactTypes.slice(batchStart, Math.min(batchStart + PARALLEL_BATCH_SIZE, artifactTypes.length));
      jobLogger.info({ batch: Math.floor(batchStart / PARALLEL_BATCH_SIZE) + 1, batchSize: batch.length, total: artifactTypes.length }, 'Processing artifact batch');

      await Promise.allSettled(batch.map(async (artifactType) => {
      if (!artifactType) return;
      // Use per-type config from shared module
      const typeConfig = SHARED_ARTIFACT_TYPES.find(c => c.type === artifactType);
      const maxRetries = typeConfig?.maxRetries ?? 2;
      const isAdvancedCategory = typeConfig?.category === 'advanced';
      const maxRegenerations = isAdvancedCategory ? 0 : 1; // Skip self-critique for low-priority artifacts
      let lastError: Error | null = null;
      let bestArtifactData: Record<string, any> | null = null;
      let bestQualityScore = 0;
      let tokensUsed = 0;
      let modelUsed = 'unknown';
      
      jobLogger.info({ artifactType, progress: `${completedCount + 1}/${artifactTypes.length}` }, 'Generating artifact');

      // Check cost budget before generating (P2 #11)
      const budgetCheck = budgetTracker.canProceed(contractId, tenantId);
      if (!budgetCheck.allowed) {
        jobLogger.warn({ artifactType, reason: budgetCheck.reason }, 'Cost budget exhausted, skipping artifact');
        failedArtifacts.push(artifactType);
        generatedArtifactResults.push({
          contractId,
          tenantId,
          type: artifactType,
          data: {
            error: 'Budget limit reached',
            type: artifactType,
            fallback: true,
            retryable: true,
            budgetExceeded: true,
            _extractionMeta: {
              contractType: detectedContractType,
              contractTypeConfidence: contractTypeDetection.confidence,
              isApplicable: true,
            }
          },
          validationStatus: 'error',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        completedCount++;
        return;
      }
      if (budgetCheck.warning) {
        jobLogger.warn({ artifactType, warning: budgetCheck.warning }, 'Approaching cost budget limit');
      }

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const artifactResult = await generateArtifactWithAI(
            artifactType, 
            extractedText, 
            contract,
            detectedContractType, // Pass detected type for adaptive prompts
            ocrResult // Pass structured DI data for pre-validated fields
          );
          
          // Track token usage from the result metadata
          if (artifactResult._meta) {
            tokensUsed = artifactResult._meta.tokensUsed || 0;
            modelUsed = artifactResult._meta.model || 'unknown';
            // Track cost for budget enforcement (P2 #11)
            const estimatedCost = sharedEstimateTokenCost(
              modelUsed,
              artifactResult._meta.promptTokens || Math.floor(tokensUsed * 0.7),
              artifactResult._meta.completionTokens || Math.floor(tokensUsed * 0.3)
            );
            budgetTracker.addCost(contractId, tenantId, estimatedCost);

            // Persist usage to ai_usage_logs for dashboard & cost alerts
            logAIUsage({
              model: modelUsed,
              endpoint: 'openai',
              feature: `artifact-generation:${artifactType}`,
              inputTokens: artifactResult._meta.promptTokens || Math.floor(tokensUsed * 0.7),
              outputTokens: artifactResult._meta.completionTokens || Math.floor(tokensUsed * 0.3),
              latencyMs: 0, // not tracked at this granularity
              success: true,
              tenantId,
              contractId,
            }).catch(() => {}); // fire-and-forget
          }
          
          // Quality validation — check if generated content meets quality thresholds
          let qualityScore;
          try {
            qualityScore = await qualityValidator.validateArtifact(
              artifactType,
              artifactResult,
              extractedText
            );
            
            jobLogger.info({
              artifactType,
              qualityScore: qualityScore.overall.toFixed(2),
              passesThreshold: qualityScore.passesThreshold,
              issues: qualityScore.issues.length,
            }, 'Artifact quality validation');
            
            // If quality is acceptable, use this result
            if (qualityScore.passesThreshold || qualityScore.overall >= 0.65) {
              bestArtifactData = artifactResult;
              bestQualityScore = qualityScore.overall;
              break;
            }
            
            // Quality is low — try self-critique if this is our first attempt
            if (attempt === 1 && maxRegenerations > 0) {
              try {
                const critique = await selfCritiqueArtifact(artifactType, artifactResult, extractedText);
                if (critique.shouldRegenerate) {
                  jobLogger.warn({
                    artifactType,
                    qualityScore: qualityScore.overall.toFixed(2),
                    critiqueIssues: critique.issues.length,
                  }, 'Low quality detected, regenerating artifact');
                  // Keep track of best so far in case regeneration also fails
                  if (qualityScore.overall > bestQualityScore) {
                    bestArtifactData = artifactResult;
                    bestQualityScore = qualityScore.overall;
                  }
                  continue; // Retry with another attempt
                }
              } catch {
                // Self-critique failed, accept current result
              }
            }
            
            // Accept what we have (quality check ran but didn't meet threshold)
            if (!bestArtifactData || qualityScore.overall > bestQualityScore) {
              bestArtifactData = artifactResult;
              bestQualityScore = qualityScore.overall;
            }
            break;
            
          } catch {
            // Quality validation failed — accept the artifact as-is
            bestArtifactData = artifactResult;
            break;
          }
          
        } catch (error) {
          lastError = error as Error;
          jobLogger.warn({ error, artifactType, attempt }, `Artifact generation attempt ${attempt} failed`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          }
        }
      }
      
      // If we got a valid result (even low quality), use it
      if (bestArtifactData) {
        successfulArtifacts.push(artifactType);
        const artifactRecord = {
          contractId,
          tenantId,
          type: artifactType,
          data: {
            ...bestArtifactData,
            _extractionMeta: {
              contractType: detectedContractType,
              contractTypeConfidence: contractTypeDetection.confidence,
              isApplicable: true,
              qualityScore: bestQualityScore,
              tokensUsed,
              modelUsed,
            }
          },
          validationStatus: bestQualityScore >= 0.65 ? 'valid' : 'low-quality',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        generatedArtifactResults.push(artifactRecord);
        completedCount++;

        // Write artifact to DB immediately so SSE stream can report real-time progress
        try {
          await prisma.artifact.upsert({
            where: {
              contractId_type: { contractId, type: artifactType },
            },
            create: artifactRecord,
            update: {
              data: artifactRecord.data,
              validationStatus: artifactRecord.validationStatus,
              updatedAt: new Date(),
            },
          });
          // Update aiMetadata with current processing stage so the contracts list API
          // can show real-time progress (e.g., "Generating artifacts (5/15)")
          try {
            const currentMeta: any = (await prisma.contract.findUnique({ where: { id: contractId }, select: { aiMetadata: true } }))?.aiMetadata || {};
            await prisma.contract.update({
              where: { id: contractId },
              data: {
                aiMetadata: {
                  ...currentMeta,
                  currentStage: `Generating artifacts (${completedCount}/${artifactTypes.length})`,
                  completedArtifacts: completedCount,
                },
              },
            });
          } catch (_stageErr) {
            // Non-critical — progress display only
          }
          jobLogger.info({ artifactType, progress: `${completedCount}/${artifactTypes.length}` }, 'Artifact saved incrementally');
        } catch (incrementalErr) {
          jobLogger.warn({ artifactType, error: (incrementalErr as Error).message }, 'Incremental artifact save failed — will retry in batch');
        }
      } else {
        // Track failed artifact for partial success reporting
        failedArtifacts.push(artifactType);
        
        // Generate fallback artifact with retry metadata
        jobLogger.error({ error: lastError, artifactType }, `All attempts failed, creating fallback artifact`);
        const fallbackRecord = {
          contractId,
          tenantId,
          type: artifactType,
          data: { 
            error: 'Failed to generate', 
            type: artifactType, 
            fallback: true,
            retryable: true,
            lastError: lastError?.message,
            _extractionMeta: {
              contractType: detectedContractType,
              contractTypeConfidence: contractTypeDetection.confidence,
              isApplicable: true,
            }
          },
          validationStatus: 'error',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        generatedArtifactResults.push(fallbackRecord);
        completedCount++;

        // Write fallback to DB immediately too
        try {
          await prisma.artifact.upsert({
            where: {
              contractId_type: { contractId, type: artifactType },
            },
            create: fallbackRecord,
            update: {
              data: fallbackRecord.data,
              validationStatus: fallbackRecord.validationStatus,
              updatedAt: new Date(),
            },
          });
        } catch {
          // Will be retried in the final batch
        }
      }

      })); // End Promise.allSettled(batch.map...)
    }

    // Also create "not applicable" placeholder artifacts for skipped types
    const notApplicableArtifactData = notApplicableArtifacts.map(artifactType => ({
      contractId,
      tenantId,
      type: artifactType,
      data: {
        notApplicable: true,
        reason: `${artifactType} is not typically applicable for ${profile.displayName} contracts`,
        contractType: detectedContractType,
        _extractionMeta: {
          contractType: detectedContractType,
          contractTypeConfidence: contractTypeDetection.confidence,
          isApplicable: false,
        }
      },
      validationStatus: 'not-applicable',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const generatedArtifacts = generatedArtifactResults.filter(Boolean);
    
    // ============ ENHANCEMENT: Add industry insights and smart suggestions ============
    // Enrich OVERVIEW artifact with contract type insights
    const overviewIdx = generatedArtifacts.findIndex((a: any) => a.type === 'OVERVIEW');
    if (overviewIdx !== -1) {
      const overviewArtifact = generatedArtifacts[overviewIdx] as any;
      if (overviewArtifact?.data && !overviewArtifact.data.error) {
        const insights = getContractTypeInsights(detectedContractType);
        overviewArtifact.data.industryInsights = {
          typicalDuration: insights.typicalDuration,
          commonIssues: insights.commonIssues,
          negotiationFocus: insights.negotiationFocus,
          industryBenchmarks: insights.industryBenchmarks,
        };
        
        // Generate smart suggestions based on extracted data
        const suggestions = getSmartSuggestions(detectedContractType, overviewArtifact.data);
        overviewArtifact.data.smartSuggestions = suggestions;
        
        jobLogger.info({ 
          insightsAdded: true,
          suggestionsCount: suggestions.length,
        }, 'Added industry insights and smart suggestions to OVERVIEW');
      }
    }
    
    // Flag low-confidence detections for human review
    const needsReview = contractTypeDetection.confidence < 0.6;
    if (needsReview) {
      jobLogger.warn({ 
        confidence: contractTypeDetection.confidence,
        detectedType: detectedContractType,
      }, 'Low confidence contract type detection - flagging for human review');
    }
    
    // Add review flag to all artifacts
    generatedArtifacts.forEach((artifact: any) => {
      if (artifact.data && artifact.data._extractionMeta) {
        artifact.data._extractionMeta.needsHumanReview = needsReview;
        artifact.data._extractionMeta.reviewReason = needsReview 
          ? `Low confidence (${Math.round(contractTypeDetection.confidence * 100)}%) in contract type detection`
          : null;
      }
    });
    
    const artifactDataArray = [...generatedArtifacts, ...notApplicableArtifactData];
    
    // Verify contract still exists before attempting artifact upsert (handles deleted-while-processing edge case)
    const contractStillExists = await prisma.contract.findUnique({ where: { id: contractId }, select: { id: true } });
    if (!contractStillExists) {
      jobLogger.error({ contractId }, 'Contract was deleted while processing — skipping artifact upsert');
      throw new Error(`Contract ${contractId} was deleted during processing`);
    }

    // Use transaction to ensure artifacts and contract update are atomic
    const artifacts = await prisma.$transaction(async (tx: any) => {
      // Upsert all artifacts to support both initial processing and reprocessing
      // This allows us to update existing artifacts with new AI-generated data
      const upsertPromises = artifactDataArray.map((artifact: any) => 
        tx.artifact.upsert({
          where: {
            contractId_type: {
              contractId: artifact.contractId,
              type: artifact.type,
            },
          },
          create: artifact,
          update: {
            data: artifact.data,
            validationStatus: artifact.validationStatus || 'valid',
            updatedAt: new Date(),
          },
        })
      );
      
      await Promise.all(upsertPromises);
      
      jobLogger.info({ artifactCount: artifactDataArray.length }, 'Artifacts upserted (created or updated)');
      
      // 4b. Apply OVERVIEW artifact data to contract record for display
      const overviewArtifact = artifactDataArray.find((a: any) => a.type === 'OVERVIEW') as any;
      if (overviewArtifact?.data && !overviewArtifact.data?.error) {
        const overviewData = overviewArtifact.data as any;
        const contractUpdate: Record<string, any> = {};
        
        // Helper to unwrap values (AI may return { value: X, source: '...' } or just X)
        const unwrap = (val: any) => val?.value !== undefined ? val.value : val;
        const unwrapNumber = (val: any): number | null => {
          const unwrapped = unwrap(val);
          if (typeof unwrapped === 'number') return unwrapped;
          if (typeof unwrapped === 'string') {
            const cleaned = unwrapped.replace(/[$€£¥,]/g, '').trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? null : parsed;
          }
          return null;
        };
        const unwrapDate = (val: any): Date | null => {
          const unwrapped = unwrap(val);
          if (!unwrapped) return null;
          try {
            const d = new Date(unwrapped);
            return isNaN(d.getTime()) ? null : d;
          } catch { return null; }
        };
        
        // IMPROVEMENT: Use keyword-detected contract type (more reliable) with fallback to AI
        // Prefer our keyword detection over AI-generated type since it's validated against our enum
        contractUpdate.contractType = detectedContractType; // Use the validated type from detectContractType()
        
        // Store detection metadata in aiMetadata for analytics
        const existingAiMeta: any = contract.aiMetadata || {};
        contractUpdate.aiMetadata = {
          ...existingAiMeta,
          typeDetection: {
            detectedType: detectedContractType,
            confidence: contractTypeDetection.confidence,
            matchedKeywords: contractTypeDetection.matchedKeywords,
            aiSuggestedType: unwrap(overviewData.contractType),
            needsHumanReview: contractTypeDetection.confidence < 0.6,
            detectedAt: new Date().toISOString(),
          }
        };
        
        // Extract parties - handle various structures
        if (overviewData.parties && Array.isArray(overviewData.parties)) {
          const getPartyName = (p: any) => unwrap(p.name) || unwrap(p.legalName) || p;
          const getPartyRole = (p: any) => (unwrap(p.role) || '').toLowerCase();
          
          const clientParty = overviewData.parties.find((p: any) => {
            const role = getPartyRole(p);
            return role.includes('client') || role.includes('buyer') || role.includes('customer');
          });
          const supplierParty = overviewData.parties.find((p: any) => {
            const role = getPartyRole(p);
            return role.includes('supplier') || role.includes('vendor') || role.includes('provider') || role.includes('contractor');
          });
          
          if (clientParty) {
            const name = getPartyName(clientParty);
            if (name && typeof name === 'string') contractUpdate.clientName = name;
          }
          if (supplierParty) {
            const name = getPartyName(supplierParty);
            if (name && typeof name === 'string') contractUpdate.supplierName = name;
          }
          
          // If only one party found, use it as supplier
          if (!contractUpdate.supplierName && !contractUpdate.clientName && overviewData.parties.length > 0) {
            const name = getPartyName(overviewData.parties[0]);
            if (name && typeof name === 'string') contractUpdate.supplierName = name;
          }
        }
        
        // Extract total value - handle wrapped values and strings
        const totalValue = unwrapNumber(overviewData.totalValue);
        if (totalValue && totalValue > 0) {
          contractUpdate.totalValue = totalValue;
        }
        const currency = unwrap(overviewData.currency);
        if (currency && typeof currency === 'string') {
          contractUpdate.currency = currency;
        }
        
        // Extract dates - handle wrapped values, with keyDates fallback
        let effectiveDate = unwrapDate(overviewData.effectiveDate);
        let expirationDate = unwrapDate(overviewData.expirationDate);
        
        // Fallback: derive dates from keyDates array if top-level fields are empty
        if ((!effectiveDate || !expirationDate) && Array.isArray(overviewData.keyDates)) {
          for (const kd of overviewData.keyDates) {
            const eventName = (unwrap(kd.event) || '').toLowerCase();
            const kdDate = unwrapDate(kd.date);
            if (!kdDate) continue;
            
            if (!effectiveDate) {
              if (eventName.includes('effective') || eventName.includes('commencement') || eventName.includes('start date')) {
                effectiveDate = kdDate;
              }
            }
            if (!expirationDate) {
              if (eventName.includes('expir') || eventName.includes('term end') || eventName.includes('end date') || eventName.includes('termination date')) {
                expirationDate = kdDate;
              }
            }
          }
          // Last resort: use the latest signing date as effective date
          if (!effectiveDate) {
            let latestSigning: Date | null = null;
            for (const kd of overviewData.keyDates) {
              const eventName = (unwrap(kd.event) || '').toLowerCase();
              if (eventName.includes('sign') || eventName.includes('execution')) {
                const kdDate = unwrapDate(kd.date);
                if (kdDate && (!latestSigning || kdDate > latestSigning)) {
                  latestSigning = kdDate;
                }
              }
            }
            if (latestSigning) effectiveDate = latestSigning;
          }
        }
        
        // If we have an effective date but no expiration, try to derive from duration text
        if (effectiveDate && !expirationDate) {
          const termText = unwrap(overviewData.termAndTermination) || '';
          if (typeof termText === 'string') {
            // Match patterns like "two years", "3 years", "24 months", "six months"
            const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, eighteen: 18, twenty: 20 };
            const yearMatch = termText.match(/(?:for|of|period of)\s+(?:a\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\(\d+\)\s+)?year/i);
            const monthMatch = termText.match(/(?:for|of|period of)\s+(?:a\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|eighteen|twenty)\s+(?:\(\d+\)\s+)?month/i);
            if (yearMatch) {
              const num = parseInt(yearMatch[1]!) || wordToNum[yearMatch[1]!.toLowerCase()] || 0;
              if (num > 0) {
                const computed = new Date(effectiveDate);
                computed.setFullYear(computed.getFullYear() + num);
                expirationDate = computed;
              }
            } else if (monthMatch) {
              const num = parseInt(monthMatch[1]!) || wordToNum[monthMatch[1]!.toLowerCase()] || 0;
              if (num > 0) {
                const computed = new Date(effectiveDate);
                computed.setMonth(computed.getMonth() + num);
                expirationDate = computed;
              }
            }
          }
        }

        if (effectiveDate) {
          contractUpdate.effectiveDate = effectiveDate;
        }
        if (expirationDate) {
          contractUpdate.expirationDate = expirationDate;
        }
        
        // Extract jurisdiction from OVERVIEW (fallback: CLAUSES governing-law clause)
        const jurisdiction = unwrap(overviewData.jurisdiction) || unwrap(overviewData.governingLaw);
        if (jurisdiction && typeof jurisdiction === 'string') {
          contractUpdate.jurisdiction = jurisdiction;
        }

        // Extract termination clause from OVERVIEW
        const termAndTermination = unwrap(overviewData.termAndTermination);
        if (termAndTermination && typeof termAndTermination === 'string') {
          contractUpdate.terminationClause = termAndTermination;
        }

        // Extract notice period days from termAndTermination text
        if (termAndTermination && typeof termAndTermination === 'string') {
          const noticeMatch = termAndTermination.match(/(\d+)\s*(?:calendar\s+)?day/i);
          const monthMatch = termAndTermination.match(/(\d+)\s*month/i);
          if (noticeMatch) {
            contractUpdate.noticePeriodDays = parseInt(noticeMatch[1]!, 10);
          } else if (monthMatch) {
            contractUpdate.noticePeriodDays = parseInt(monthMatch[1]!, 10) * 30;
          }
        }

        // Extract payment terms from FINANCIAL artifact
        const financialArt = artifactDataArray.find((a: any) => a.type === 'FINANCIAL') as any;
        if (financialArt?.data?.paymentTerms) {
          const pt = unwrap(financialArt.data.paymentTerms);
          if (pt && typeof pt === 'string') {
            contractUpdate.paymentTerms = pt;
          }
        }

        // Extract contract title if we have a summary
        if (overviewData.summary && !contract.contractTitle) {
          // Use first sentence of summary as title, max 100 chars
          const summaryText = unwrap(overviewData.summary);
          if (summaryText && typeof summaryText === 'string') {
            const title = summaryText.split('.')[0]!.substring(0, 100);
            if (title.length > 10) {
              contractUpdate.contractTitle = title;
            }
          }
        }
        
        // Apply updates within transaction if we extracted anything
        if (Object.keys(contractUpdate).length > 0) {
          await tx.contract.updateMany({
            where: { id: contractId, tenantId },
            data: {
              ...contractUpdate,
              updatedAt: new Date(),
            },
          });
          jobLogger.info({ 
            fieldsApplied: Object.keys(contractUpdate),
            effectiveDateExtracted: contractUpdate.effectiveDate || null,
            expirationDateExtracted: contractUpdate.expirationDate || null,
            keyDatesCount: Array.isArray(overviewData.keyDates) ? overviewData.keyDates.length : 0,
          }, 'Applied OVERVIEW data to contract record (transactional)');
        }
      }
      
      return { count: artifactDataArray.length };
    }, {
      maxWait: 10000, // 10s max wait for transaction
      timeout: 30000, // 30s timeout for transaction
    });

    // NOTE: OVERVIEW processing is now done in the transaction above (lines ~760-850)
    // The old non-transactional code has been removed since OVERVIEW is fully handled in the transaction

    // 4c. Build enterprise metadata schema (24-field format) from all artifacts
    const financialArtifact = artifactDataArray.find((a: any) => a.type === 'FINANCIAL');
    const clausesArtifact = artifactDataArray.find((a: any) => a.type === 'CLAUSES');
    const riskArtifact = artifactDataArray.find((a: any) => a.type === 'RISK');
    const complianceArtifact = artifactDataArray.find((a: any) => a.type === 'COMPLIANCE');
    const contactsArtifact = artifactDataArray.find((a: any) => a.type === 'CONTACTS');
    const overviewArtifactData: any = (artifactDataArray.find((a: any) => a.type === 'OVERVIEW')?.data) || {};
    const financialData: any = financialArtifact?.data || {};
    const clausesData: any = clausesArtifact?.data || {};
    const riskData: any = riskArtifact?.data || {};
    const complianceData: any = complianceArtifact?.data || {};
    const contactsData: any = contactsArtifact?.data || {};

    // Helper to unwrap values (AI may return { value: X, source: '...' } or just X)
    const unwrapVal = (val: any) => val?.value !== undefined ? val.value : val;

    // Helper to resolve a date from keyDates array by matching event keywords
    const resolveFromKeyDates = (keyDates: any, keywords: string[], unwrapFn: (v: any) => any): string | null => {
      if (!Array.isArray(keyDates)) return null;
      // First pass: look for exact keyword match
      for (const kd of keyDates) {
        const event = (unwrapFn(kd.event) || '').toLowerCase();
        const dateVal = unwrapFn(kd.date);
        if (!dateVal || typeof dateVal !== 'string') continue;
        // Validate it looks like a date string
        const parsed = new Date(dateVal);
        if (isNaN(parsed.getTime())) continue;
        if (keywords.some(kw => event.includes(kw))) return dateVal;
      }
      return null;
    };

    // Build external parties array from overview
    const externalParties: Array<{legalName: string; role: string; registeredAddress?: string}> = [];
    if (overviewArtifactData.parties && Array.isArray(overviewArtifactData.parties)) {
      for (const party of overviewArtifactData.parties) {
        const partyName = unwrapVal(party.name) || unwrapVal(party.legalName);
        if (partyName && typeof partyName === 'string') {
          externalParties.push({
            legalName: partyName,
            role: unwrapVal(party.role) || 'Party',
            registeredAddress: unwrapVal(party.address) || unwrapVal(party.contact) || '',
          });
        }
      }
    }

    // Determine payment type from financial data
    let paymentType = '';
    if (financialData.paymentTerms) {
      const terms = String(financialData.paymentTerms || '').toLowerCase();
      if (terms.includes('fixed') || terms.includes('lump')) paymentType = 'Fixed';
      else if (terms.includes('milestone')) paymentType = 'Milestone';
      else if (terms.includes('time') || terms.includes('hourly')) paymentType = 'Time & Materials';
      else if (terms.includes('recurring') || terms.includes('subscription')) paymentType = 'Recurring';
      else paymentType = 'Other';
    }

    // Determine billing frequency
    let billingFrequency = '';
    if (financialData.paymentSchedule || financialData.billingCycle) {
      // Handle paymentSchedule which could be an array or string
      let scheduleText = '';
      if (Array.isArray(financialData.paymentSchedule)) {
        // If it's an array, check the length to determine frequency
        const scheduleLength = financialData.paymentSchedule.length;
        if (scheduleLength === 12) billingFrequency = 'Monthly';
        else if (scheduleLength === 4) billingFrequency = 'Quarterly';
        else if (scheduleLength === 1) billingFrequency = 'One-time';
        else if (scheduleLength === 2) billingFrequency = 'Semi-annually';
        else billingFrequency = 'Custom';
      } else {
        scheduleText = String(financialData.paymentSchedule || financialData.billingCycle || '').toLowerCase();
        if (scheduleText.includes('month')) billingFrequency = 'Monthly';
        else if (scheduleText.includes('quarter')) billingFrequency = 'Quarterly';
        else if (scheduleText.includes('annual') || scheduleText.includes('year')) billingFrequency = 'Annually';
        else if (scheduleText.includes('week')) billingFrequency = 'Weekly';
        else if (scheduleText.includes('one') || scheduleText.includes('single')) billingFrequency = 'One-time';
      }
    }

    // Extract notice period if available
    let noticePeriod = '';
    if (clausesData.clauses && Array.isArray(clausesData.clauses)) {
      const terminationClause = clausesData.clauses.find((c: any) => 
        c.type?.toLowerCase().includes('termination') || c.title?.toLowerCase().includes('termination')
      );
      if (terminationClause?.text) {
        const noticeMatch = terminationClause.text.match(/(\d+)\s*(day|month|week)/i);
        if (noticeMatch) {
          noticePeriod = `${noticeMatch[1]} ${noticeMatch[2]}${parseInt(noticeMatch[1]) > 1 ? 's' : ''}`;
        }
      }
    }

    // Build enterprise metadata schema
    const enterpriseMetadata = {
      // Document identification
      document_number: unwrapVal(overviewArtifactData.documentNumber) || contractId,
      document_title: unwrapVal(overviewArtifactData.contractTitle) || 
        (unwrapVal(overviewArtifactData.summary) || '').split('.')[0]?.substring(0, 100) || '',
      contract_short_description: unwrapVal(overviewArtifactData.summary) || '',
      contract_language: unwrapVal(overviewArtifactData.language) || null,
      
      // Parties
      external_parties: externalParties,
      
      // Financial - handle wrapped values
      tcv_amount: (() => {
        const val = unwrapVal(overviewArtifactData.totalValue) || unwrapVal(financialData.totalValue);
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const cleaned = val.replace(/[$€£¥,]/g, '').trim();
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      })(),
      tcv_text: unwrapVal(financialData.totalValueText) || 
        (unwrapVal(overviewArtifactData.totalValue) ? 
          `$${Number(unwrapVal(overviewArtifactData.totalValue) || 0).toLocaleString()}` : ''),
      payment_type: paymentType,
      billing_frequency_type: billingFrequency,
      periodicity: billingFrequency || '',
      currency: unwrapVal(overviewArtifactData.currency) || unwrapVal(financialData.currency) || null,
      
      // Dates - with keyDates fallback (use latest signing date, not first)
      execution_date: unwrapVal(overviewArtifactData.executionDate) || 
        unwrapVal(overviewArtifactData.effectiveDate) || 
        resolveFromKeyDates(overviewArtifactData.keyDates, ['effective', 'commencement', 'start date'], unwrapVal) ||
        (() => {
          // Last resort: find the latest signing/execution date
          if (!Array.isArray(overviewArtifactData.keyDates)) return null;
          let latest: string | null = null;
          let latestTime = 0;
          for (const kd of overviewArtifactData.keyDates) {
            const event = (unwrapVal(kd.event) || '').toLowerCase();
            if (event.includes('sign') || event.includes('execution')) {
              const dateVal = unwrapVal(kd.date);
              if (dateVal && typeof dateVal === 'string') {
                const t = new Date(dateVal).getTime();
                if (!isNaN(t) && t > latestTime) { latest = dateVal; latestTime = t; }
              }
            }
          }
          return latest;
        })() ||
        null,
      contract_effective_date: unwrapVal(overviewArtifactData.effectiveDate) || 
        resolveFromKeyDates(overviewArtifactData.keyDates, ['effective', 'commencement', 'start date'], unwrapVal) ||
        (() => {
          if (!Array.isArray(overviewArtifactData.keyDates)) return null;
          let latest: string | null = null;
          let latestTime = 0;
          for (const kd of overviewArtifactData.keyDates) {
            const event = (unwrapVal(kd.event) || '').toLowerCase();
            if (event.includes('sign') || event.includes('execution')) {
              const dateVal = unwrapVal(kd.date);
              if (dateVal && typeof dateVal === 'string') {
                const t = new Date(dateVal).getTime();
                if (!isNaN(t) && t > latestTime) { latest = dateVal; latestTime = t; }
              }
            }
          }
          return latest;
        })() ||
        null,
      contract_end_date: unwrapVal(overviewArtifactData.expirationDate) || 
        resolveFromKeyDates(overviewArtifactData.keyDates, ['expir', 'term end', 'end date', 'termination date'], unwrapVal) ||
        (() => {
          // Derive from duration text (e.g., "two years", "24 months") + effective date
          const effDate = unwrapVal(overviewArtifactData.effectiveDate) ||
            resolveFromKeyDates(overviewArtifactData.keyDates, ['effective', 'commencement', 'start date'], unwrapVal);
          if (!effDate) return null;
          const termText = unwrapVal(overviewArtifactData.termAndTermination) || '';
          if (typeof termText !== 'string') return null;
          const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, eighteen: 18, twenty: 20 };
          const yearMatch = termText.match(/(?:for|of|period of)\s+(?:a\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\(\d+\)\s+)?year/i);
          const monthMatch = termText.match(/(?:for|of|period of)\s+(?:a\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|eighteen|twenty)\s+(?:\(\d+\)\s+)?month/i);
          if (yearMatch) {
            const num = parseInt(yearMatch[1]!) || wordToNum[yearMatch[1]!.toLowerCase()] || 0;
            if (num > 0) { const d = new Date(effDate); d.setFullYear(d.getFullYear() + num); return d.toISOString(); }
          } else if (monthMatch) {
            const num = parseInt(monthMatch[1]!) || wordToNum[monthMatch[1]!.toLowerCase()] || 0;
            if (num > 0) { const d = new Date(effDate); d.setMonth(d.getMonth() + num); return d.toISOString(); }
          }
          return null;
        })() ||
        null,
      
      // Signature status: combine AI verdict with DI handwriting evidence.
      // The AI only analyzes OCR text and can miss physical handwritten signatures
      // (scribbles/cursive that DI detects as handwriting but can't read as text).
      // DI handwriting detection overrides AI's 'unsigned' when signatures are present.
      signature_status: (() => {
        const aiStatus = unwrapVal(contactsData.signatureStatus);
        const handwrittenSpans = ocrResult.handwrittenText || [];
        const hasHandwriting = handwrittenSpans.length > 0;
        const fullText = ocrResult.text || '';
        const sigPatterns = /\b(signature|signed|sign here|executed|witness|authorized|acknowledged)\b|\/s\//i;
        const hasSignatureContext = sigPatterns.test(fullText);
        const signatoryCount = (contactsData.signatories || []).length;
        const signedCount = (contactsData.signatories || []).filter((s: any) => s.isSigned).length;

        // If AI says signed/partially_signed, trust it
        if (aiStatus === 'signed' || aiStatus === 'partially_signed') return aiStatus;

        // If signatories have isSigned flags, trust those
        if (signedCount > 0 && signedCount === signatoryCount) return 'signed';
        if (signedCount > 0) return 'partially_signed';

        // DI detected handwriting + document has signature blocks → signed
        // This catches handwritten signatures the AI couldn't see in text form
        if (hasHandwriting && hasSignatureContext) return 'signed';

        // AI says unsigned with no DI contradiction → trust it
        if (aiStatus === 'unsigned' && !hasHandwriting) return 'unsigned';

        // AI says unsigned but DI found handwriting without signature context
        // (could be annotations/fill-ins, not signatures) → keep unsigned
        if (aiStatus === 'unsigned') return 'unsigned';

        return aiStatus || 'unknown';
      })(),
      signature_date: unwrapVal(contactsData.signatureDate) || 
        (contactsData.signatories?.find((s: any) => s.dateSigned)?.dateSigned) || 
        ocrResult.contractFields?.dates?.executionDate ||
        unwrapVal(overviewArtifactData.executionDate) || null,
      // Only flag signature_required if we have a definitive unsigned/partially_signed status
      // Don't flag when status is 'unknown' — avoids spurious alerts on newly uploaded contracts
      signature_required_flag: unwrapVal(contactsData.signatureStatus) === 'unsigned' || 
        unwrapVal(contactsData.signatureStatus) === 'partially_signed',
      signatories: contactsData.signatories || [],
      signature_analysis: contactsData.signatureAnalysis || null,
      di_handwriting_detected: ocrResult.handwrittenText.length > 0,
      di_handwritten_spans: ocrResult.handwrittenText.slice(0, 20),
      
      // Reminders
      first_reminder_days: 90,
      second_reminder_days: 60,
      final_reminder_days: 30,
      
      // Contract details
      auto_renewing: unwrapVal(overviewArtifactData.autoRenewal) === true || 
        unwrapVal(clausesData.autoRenewal) === true,
      notice_period: noticePeriod,
      jurisdiction: unwrapVal(overviewArtifactData.jurisdiction) || '',
      
      // Internal tracking
      owner_name: '',
      owner_email: '',
      internal_organization: '',
      is_inbound: unwrapVal(overviewArtifactData.isInbound) ?? null,
      
      // Extraction metadata
      _extractedAt: new Date().toISOString(),
      _extractionSource: 'ocr-artifact-worker',
      _artifactsUsed: ['OVERVIEW', 'FINANCIAL', 'CLAUSES', 'RISK', 'COMPLIANCE'].filter(
        type => artifactDataArray.some((a: any) => a.type === type && !a.data?.error)
      ),
      _confidence: {
        overall: successfulArtifacts.length / artifactDataArray.length,
        parties: externalParties.length > 0 ? 0.9 : 0.3,
        financial: unwrapVal(financialData.totalValue) ? 0.9 : 0.5,
        dates: unwrapVal(overviewArtifactData.effectiveDate) ? 0.9 : 0.5,
      },
    };

    // Save enterprise metadata to contract.aiMetadata AND persist extracted fields to DB columns
    try {
      // Parse signature date if string
      let signatureDateParsed: Date | null = null;
      if (enterpriseMetadata.signature_date) {
        const parsed = new Date(enterpriseMetadata.signature_date);
        if (!isNaN(parsed.getTime())) {
          signatureDateParsed = parsed;
        }
      }

      // Parse effective/start and end/expiration dates
      let effectiveDateParsed: Date | null = null;
      if (enterpriseMetadata.contract_effective_date) {
        const parsed = new Date(enterpriseMetadata.contract_effective_date);
        if (!isNaN(parsed.getTime())) effectiveDateParsed = parsed;
      }
      let endDateParsed: Date | null = null;
      if (enterpriseMetadata.contract_end_date) {
        const parsed = new Date(enterpriseMetadata.contract_end_date);
        if (!isNaN(parsed.getTime())) endDateParsed = parsed;
      }

      // Parse total value as Decimal-compatible number
      const totalValueParsed = (enterpriseMetadata.tcv_amount != null && enterpriseMetadata.tcv_amount > 0) 
        ? enterpriseMetadata.tcv_amount : null;

      // Extract client/supplier names from parties
      const clientParty = externalParties.find((p: any) => 
        /client|buyer|customer|purchaser/i.test(p.role || '')
      );
      const supplierParty = externalParties.find((p: any) => 
        /vendor|supplier|provider|contractor|seller|service provider/i.test(p.role || '')
      );
      // Fallback: if roles don't match, use first two parties
      const firstParty = externalParties[0];
      const secondParty = externalParties[1];

      // Parse notice period string to days integer
      let noticePeriodDaysParsed: number | null = null;
      if (enterpriseMetadata.notice_period) {
        const match = enterpriseMetadata.notice_period.match(/(\d+)\s*(day|month|week)/i);
        if (match) {
          const num = parseInt(match[1]!);
          const unit = match[2]!.toLowerCase();
          noticePeriodDaysParsed = unit === 'month' ? num * 30 : unit === 'week' ? num * 7 : num;
        }
      }

      // Determine contract type from OVERVIEW artifact
      const contractTypeParsed = unwrapVal(overviewArtifactData.contractType) || null;

      await prisma.contract.updateMany({
        where: { id: contractId, tenantId },
        data: {
          aiMetadata: enterpriseMetadata as any,
          // Signature fields
          signatureStatus: enterpriseMetadata.signature_status || 'unknown',
          signatureDate: signatureDateParsed,
          signatureRequiredFlag: enterpriseMetadata.signature_required_flag || false,
          // Core identification
          contractTitle: enterpriseMetadata.document_title || undefined,
          description: enterpriseMetadata.contract_short_description || undefined,
          // Financial fields
          ...(totalValueParsed != null ? { totalValue: totalValueParsed } : {}),
          ...(enterpriseMetadata.currency ? { currency: enterpriseMetadata.currency } : {}),
          ...(enterpriseMetadata.payment_type ? { paymentTerms: enterpriseMetadata.payment_type } : {}),
          ...(enterpriseMetadata.billing_frequency_type ? { paymentFrequency: enterpriseMetadata.billing_frequency_type, billingCycle: enterpriseMetadata.billing_frequency_type } : {}),
          // Dates
          ...(effectiveDateParsed ? { effectiveDate: effectiveDateParsed, startDate: effectiveDateParsed } : {}),
          ...(endDateParsed ? { expirationDate: endDateParsed, endDate: endDateParsed } : {}),
          // Parties
          ...(clientParty?.legalName ? { clientName: clientParty.legalName } : 
              !supplierParty && firstParty?.legalName ? { clientName: firstParty.legalName } : {}),
          ...(supplierParty?.legalName ? { supplierName: supplierParty.legalName } : 
              !clientParty && secondParty?.legalName ? { supplierName: secondParty.legalName } : {}),
          // Classification & jurisdiction
          ...(contractTypeParsed ? { contractType: contractTypeParsed } : {}),
          ...(enterpriseMetadata.jurisdiction ? { jurisdiction: enterpriseMetadata.jurisdiction } : {}),
          // Document classification from contract type
          ...(contractTypeParsed ? {
            documentClassification: (() => {
              const t = contractTypeParsed.toLowerCase();
              if (t.includes('purchase order') || t.includes('po')) return 'purchase_order';
              if (t.includes('invoice')) return 'invoice';
              if (t.includes('quote') || t.includes('quotation')) return 'quote';
              if (t.includes('proposal')) return 'proposal';
              if (t.includes('amendment') || t.includes('addendum')) return 'amendment';
              if (t.includes('sow') || t.includes('statement of work')) return 'sow';
              return 'contract';
            })(),
          } : {}),
          // Renewal & termination
          autoRenewalEnabled: enterpriseMetadata.auto_renewing || false,
          ...(noticePeriodDaysParsed != null ? { noticePeriodDays: noticePeriodDaysParsed } : {}),
          // Computed financial breakdowns
          ...(() => {
            if (totalValueParsed == null || !effectiveDateParsed || !endDateParsed) return {};
            const months = Math.max(1, Math.round((endDateParsed.getTime() - effectiveDateParsed.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
            return {
              annualValue: months >= 12 ? Math.round((totalValueParsed / months) * 12 * 100) / 100 : totalValueParsed,
              monthlyValue: Math.round((totalValueParsed / months) * 100) / 100,
            };
          })(),
          updatedAt: new Date(),
        },
      });
      
      jobLogger.info({ 
        fieldsPopulated: Object.keys(enterpriseMetadata).filter(k => !k.startsWith('_')).length,
        partiesCount: externalParties.length,
        hasFinancials: !!enterpriseMetadata.tcv_amount,
        signatureStatus: enterpriseMetadata.signature_status,
        signatureRequiredFlag: enterpriseMetadata.signature_required_flag,
        dbColumnsUpdated: {
          contractTitle: !!enterpriseMetadata.document_title,
          totalValue: totalValueParsed != null,
          effectiveDate: !!effectiveDateParsed,
          expirationDate: !!endDateParsed,
          clientName: !!(clientParty?.legalName || firstParty?.legalName),
          supplierName: !!(supplierParty?.legalName || secondParty?.legalName),
          contractType: !!contractTypeParsed,
          jurisdiction: !!enterpriseMetadata.jurisdiction,
          autoRenewalEnabled: enterpriseMetadata.auto_renewing,
          noticePeriodDays: noticePeriodDaysParsed,
        },
      }, 'Enterprise metadata persisted to aiMetadata JSON and DB columns');
    } catch (metadataError) {
      jobLogger.warn({ error: metadataError }, 'Failed to save enterprise metadata, continuing with processing');
    }

    // Determine final status based on success rate
    const hasPartialSuccess = failedArtifacts.length > 0 && successfulArtifacts.length > 0;
    const hasCompleteFailure = successfulArtifacts.length === 0;
    const finalStatus = hasCompleteFailure ? 'FAILED' : (hasPartialSuccess ? 'PARTIAL' : 'COMPLETED');

    jobLogger.info({ 
      artifactsCreated: artifacts.count,
      successfulArtifacts,
      failedArtifacts,
      finalStatus,
    }, 'Artifact generation completed');

    // ============ AGENTIC AI INTEGRATION ============
    // Run autonomous agents after artifact generation
    try {
      const { 
        proactiveValidationAgent,
        smartGapFillingAgent,
        contractHealthMonitor,
      } = await import('./agents');
      
      // Get tenant extraction settings for configurable thresholds
      const tenantConfig = await prisma.tenantConfig.findUnique({
        where: { tenantId },
        select: { extractionSettings: true },
      });
      
      const extractionSettings = (tenantConfig?.extractionSettings as Record<string, unknown>) || {};
      const tenantCompleteness = (extractionSettings.gapFillingCompletenessThreshold as number) ?? 0.85;
      const tenantAlwaysRun = (extractionSettings.alwaysRunGapFilling as boolean) ?? false;
      const tenantAggressive = (extractionSettings.aggressiveGapFilling as boolean) ?? true;

      // 1. Run proactive validation and health monitor in parallel (independent)
      jobLogger.info('Running proactive validation agent + health monitor in parallel');
      const [validationResult, _healthResult] = await Promise.all([
        proactiveValidationAgent.executeWithTracking({
          contractId,
          tenantId,
          context: { 
            artifacts: artifactDataArray,
            contractType: detectedContractType,
          },
          triggeredBy: 'ocr_pipeline',
        }),
        contractHealthMonitor.executeWithTracking({
          contractId,
          tenantId,
          context: { 
            artifacts: artifactDataArray,
            contractType: detectedContractType,
          },
          triggeredBy: 'ocr_pipeline',
        }),
      ]);

      // 2. Run smart gap filling ALWAYS to ensure completeness
      // Triggers: validation issues, partial success, or proactive gap detection
      const hasGaps = validationResult.output?.issues?.some((i: any) => 
        i.type === 'missing_critical_data' || i.type === 'placeholder_detected'
      ) || false;
      
      // Calculate overall completeness to decide on gap filling aggressiveness
      const overallCompleteness = validationResult.output?.overallCompleteness ?? 1.0;
      // Use tenant setting, env var fallback, or default 0.85
      const completenessThreshold = tenantCompleteness || parseFloat(process.env.GAP_FILLING_COMPLETENESS_THRESHOLD || '0.85');
      const alwaysRunGapFilling = tenantAlwaysRun || process.env.ALWAYS_RUN_GAP_FILLING === 'true';
      const aggressiveMode = tenantAggressive;
      
      // Run gap filling if:
      // 1. There are identified gaps from validation
      // 2. There was any partial success during artifact generation
      // 3. Overall completeness is below threshold (default 85%)
      // 4. ALWAYS_RUN_GAP_FILLING env var is set to true or tenant config
      const shouldRunGapFilling = hasGaps || 
                                   hasPartialSuccess || 
                                   overallCompleteness < completenessThreshold ||
                                   alwaysRunGapFilling;
      
      if (shouldRunGapFilling) {
        jobLogger.info({ 
          hasGaps, 
          hasPartialSuccess, 
          overallCompleteness, 
          completenessThreshold,
          alwaysRunGapFilling,
          aggressiveMode,
        }, 'Running smart gap filling agent');
        const gapFillingResult = await smartGapFillingAgent.executeWithTracking({
          contractId,
          tenantId,
          context: { 
            artifacts: artifactDataArray,
            validationIssues: validationResult.output?.issues,
            contractType: detectedContractType,
            // Pass additional context for more aggressive gap filling
            aggressiveMode, // Use tenant setting
            minimumCompleteness: completenessThreshold,
            contractText: extractedText, // Pass full text for re-extraction
          },
          triggeredBy: 'ocr_pipeline',
        });
        
        // If gap filling succeeded, update artifacts with filled data
        if (gapFillingResult.success && gapFillingResult.output?.filledFields?.length > 0) {
          jobLogger.info({ 
            filledCount: gapFillingResult.output.filledFields.length 
          }, 'Gap filling completed, updating artifacts');
          
          // Update artifact data with filled values
          // Query for actual artifact IDs from database since artifactDataArray doesn't have IDs
          for (const filled of gapFillingResult.output.filledFields) {
            const dbArtifact = await prisma.artifact.findFirst({
              where: { 
                contractId, 
                type: filled.artifactType 
              },
            });
            if (dbArtifact) {
              const existingData = (dbArtifact.data as Record<string, unknown>) || {};
              await prisma.artifact.update({
                where: { id: dbArtifact.id },
                data: {
                  data: {
                    ...existingData,
                    [filled.field]: filled.value,
                  },
                  updatedAt: new Date(),
                },
              });
            }
          }

          // Re-map gap-filled OVERVIEW/FINANCIAL data to contract record
          // The initial transaction mapped from the original OVERVIEW, but gap-filling
          // may have added fields like jurisdiction, totalValue, effectiveDate, etc.
          const gapFilledContractUpdate: Record<string, any> = {};
          const gapUnwrap = (val: any) => val?.value !== undefined ? val.value : val;
          const gapUnwrapDate = (val: any): Date | null => {
            const v = gapUnwrap(val);
            if (!v) return null;
            try { const d = new Date(v); return isNaN(d.getTime()) ? null : d; } catch { return null; }
          };
          const gapUnwrapNumber = (val: any): number | null => {
            const v = gapUnwrap(val);
            if (typeof v === 'number') return v;
            if (typeof v === 'string') { const p = parseFloat(v.replace(/[$€£¥,]/g, '').trim()); return isNaN(p) ? null : p; }
            return null;
          };

          for (const filled of gapFillingResult.output.filledFields) {
            if (filled.artifactType === 'OVERVIEW') {
              switch (filled.field) {
                case 'effectiveDate': {
                  const d = gapUnwrapDate(filled.value);
                  if (d) gapFilledContractUpdate.effectiveDate = d;
                  break;
                }
                case 'expirationDate': {
                  const d = gapUnwrapDate(filled.value);
                  if (d) gapFilledContractUpdate.expirationDate = d;
                  break;
                }
                case 'jurisdiction':
                case 'governingLaw': {
                  const v = gapUnwrap(filled.value);
                  if (v && typeof v === 'string') gapFilledContractUpdate.jurisdiction = v;
                  break;
                }
                case 'totalValue': {
                  const n = gapUnwrapNumber(filled.value);
                  if (n && n > 0) gapFilledContractUpdate.totalValue = n;
                  break;
                }
                case 'currency': {
                  const v = gapUnwrap(filled.value);
                  if (v && typeof v === 'string') gapFilledContractUpdate.currency = v;
                  break;
                }
                case 'termAndTermination': {
                  const v = gapUnwrap(filled.value);
                  if (v && typeof v === 'string') {
                    gapFilledContractUpdate.terminationClause = v;
                    const noticeMatch = v.match(/(\d+)\s*(?:calendar\s+)?day/i);
                    const monthMatch = v.match(/(\d+)\s*month/i);
                    if (noticeMatch) gapFilledContractUpdate.noticePeriodDays = parseInt(noticeMatch[1]!, 10);
                    else if (monthMatch) gapFilledContractUpdate.noticePeriodDays = parseInt(monthMatch[1]!, 10) * 30;
                  }
                  break;
                }
              }
            } else if (filled.artifactType === 'FINANCIAL' && filled.field === 'paymentTerms') {
              const v = gapUnwrap(filled.value);
              if (v && typeof v === 'string') gapFilledContractUpdate.paymentTerms = v;
            }
          }

          if (Object.keys(gapFilledContractUpdate).length > 0) {
            await prisma.contract.updateMany({
              where: { id: contractId, tenantId },
              data: { ...gapFilledContractUpdate, updatedAt: new Date() },
            });
            jobLogger.info({
              gapFilledFields: Object.keys(gapFilledContractUpdate),
            }, 'Re-mapped gap-filled data to contract record');
          }
        }
      }

      jobLogger.info('Agentic AI integration completed successfully');
    } catch (error) {
      // Don't fail the job if agents fail - just log the error
      jobLogger.error({ error }, 'Agentic AI integration failed (non-fatal)');
    }

    try { await job.updateProgress(90); } catch { /* best-effort */ }

    // 5. Batch update contract and processing job in parallel
    const updatePromises = [
      prisma.contract.updateMany({
        where: { id: contractId, tenantId },
        data: {
          status: finalStatus === 'PARTIAL' ? 'COMPLETED' : finalStatus, // Treat partial as completed for now
          updatedAt: new Date(),
        },
      }),
      prisma.processingJob.findFirst({
        where: { contractId, tenantId },
        orderBy: { createdAt: 'desc' },
      }).then((processingJob: any) => {
        if (processingJob) {
          return prisma.processingJob.updateMany({
            where: { id: processingJob.id, tenantId },
            data: {
              status: finalStatus === 'PARTIAL' ? 'COMPLETED' : finalStatus,
              progress: 100,
              currentStep: failedArtifacts.length > 0 ? `completed with ${failedArtifacts.length} failed artifacts` : 'completed',
            },
          });
        }
      })
    ];
    
    const [contractUpdateResult] = await Promise.all(updatePromises);

    if (contractUpdateResult && contractUpdateResult.count === 0) {
      jobLogger.warn('Contract update skipped because no matching record was found');
    }

    // ============ ENHANCEMENT: Populate ContractMetadata with AI insights ============
    try {
      const overviewData: any = (artifactDataArray.find((a: any) => a.type === 'OVERVIEW')?.data) || {};
      const riskData: any = (artifactDataArray.find((a: any) => a.type === 'RISK')?.data) || {};
      const missingFields = getMissingMandatoryFields(detectedContractType, overviewData);
      const tabOrder = getTabPriorityOrder(detectedContractType);
      
      // Calculate data quality score (0-100)
      const mandatoryFieldsCount = profile.mandatoryFields.length;
      const foundMandatoryFields = mandatoryFieldsCount - missingFields.length;
      const completenessScore = mandatoryFieldsCount > 0 
        ? Math.round((foundMandatoryFields / mandatoryFieldsCount) * 100) 
        : 50;
      
      // Calculate complexity score based on contract characteristics
      const complexityScore = Math.min(100, Math.round(
        (profile.clauseCategories.length * 5) + 
        (profile.financialFields.length * 5) +
        (profile.riskCategories.length * 5) +
        (extractedText.length > 10000 ? 20 : extractedText.length > 5000 ? 10 : 0)
      ));
      
      // Calculate overall quality score
      const artifactSuccessRate = successfulArtifacts.length / artifactTypes.length;
      const dataQualityScore = Math.round(
        (completenessScore * 0.4) + 
        (contractTypeDetection.confidence * 100 * 0.3) +
        (artifactSuccessRate * 100 * 0.3)
      );
      
      // Extract risk score from RISK artifact
      const riskScore = typeof riskData.riskScore === 'number' 
        ? Math.min(100, Math.max(0, riskData.riskScore))
        : (riskData.overallRisk === 'high' ? 75 : riskData.overallRisk === 'medium' ? 50 : 25);

      await prisma.contractMetadata.upsert({
        where: { contractId },
        create: {
          contractId,
          tenantId,
          updatedBy: 'ocr-artifact-worker',
          dataQualityScore,
          riskScore,
          complexityScore,
          lastAiAnalysis: new Date(),
          aiAnalysisVersion: 'ocr-artifact-v2',
          aiSummary: overviewData.summary || null,
          aiKeyInsights: overviewData.smartSuggestions || [],
          aiRiskFactors: riskData.risks || riskData.riskFactors || [],
          aiRecommendations: overviewData.smartSuggestions?.filter((s: any) => s.priority === 'high') || [],
          searchKeywords: overviewData.keyTerms || [],
          artifactSummary: {
            tabPriorityOrder: tabOrder,
            generatedArtifacts: successfulArtifacts,
            failedArtifacts,
            notApplicableArtifacts: notApplicableArtifacts,
            completenessScore,
            missingMandatoryFields: missingFields,
            contractType: detectedContractType,
            contractTypeConfidence: contractTypeDetection.confidence,
            industryInsights: overviewData.industryInsights || null,
          },
          systemFields: {
            extractionVersion: '2.0',
            ocrMode,
            processedAt: new Date().toISOString(),
          },
        },
        update: {
          dataQualityScore,
          riskScore,
          complexityScore,
          lastAiAnalysis: new Date(),
          aiAnalysisVersion: 'ocr-artifact-v2',
          aiSummary: overviewData.summary || undefined,
          aiKeyInsights: overviewData.smartSuggestions || [],
          aiRiskFactors: riskData.risks || riskData.riskFactors || [],
          aiRecommendations: overviewData.smartSuggestions?.filter((s: any) => s.priority === 'high') || [],
          searchKeywords: overviewData.keyTerms || [],
          artifactSummary: {
            tabPriorityOrder: tabOrder,
            generatedArtifacts: successfulArtifacts,
            failedArtifacts,
            notApplicableArtifacts: notApplicableArtifacts,
            completenessScore,
            missingMandatoryFields: missingFields,
            contractType: detectedContractType,
            contractTypeConfidence: contractTypeDetection.confidence,
            industryInsights: overviewData.industryInsights || null,
          },
          updatedBy: 'ocr-artifact-worker',
        },
      });
      
      jobLogger.info({ 
        dataQualityScore,
        riskScore,
        complexityScore,
        completenessScore,
        missingMandatoryFields: missingFields.length,
      }, 'ContractMetadata populated with AI insights');
    } catch (metadataPopulateError) {
      jobLogger.error({ error: metadataPopulateError }, 'CRITICAL: Failed to populate ContractMetadata — AI insights may be missing for this contract');
    }

    // 5.5 Deterministic downstream plan (persisted for debugging/ops)
    const { plan, inputs } = buildProcessingPlan({ extractedText });
    await setProcessingPlan({ tenantId, contractId, plan, inputs });

    // 6. Auto-queue RAG indexing for semantic search
    // Uses minimal delay since we're inside a transaction - data is committed
    if (!hasCompleteFailure && plan.ragIndexing) {
      try {
        jobLogger.info({ plan }, 'Queueing automatic RAG indexing');
        const queueService = getQueueService();
        await queueService.addJob(
          QUEUE_NAMES.RAG_INDEXING,
          'index-contract',
          { contractId, tenantId, artifactIds: [], traceId: trace.traceId } as any,
          {
            priority: 15,
            delay: 3000, // Allow 3s for DB transaction to fully commit before RAG worker reads
            jobId: `rag-${contractId}`,
          }
        );
        jobLogger.info('RAG indexing job queued successfully');
      } catch (ragError) {
        // Don't fail the job if RAG queueing fails
        jobLogger.warn({ error: ragError }, 'Failed to queue RAG indexing, contract still processed successfully');
      }
    }

    // 7. Auto-queue metadata extraction for AI-powered field extraction
    // Runs after RAG indexing via priority ordering (higher priority = later)
    if (!hasCompleteFailure && plan.metadataExtraction) {
      try {
        jobLogger.info({ plan }, 'Queueing automatic metadata extraction');
        const queueService = getQueueService();
        await queueService.addJob(
          QUEUE_NAMES.METADATA_EXTRACTION,
          'extract-metadata',
          { 
            contractId, 
            tenantId, 
            autoApply: true,
            autoApplyThreshold: 0.85,
            source: 'upload',
            priority: 'normal',
            traceId: trace.traceId,
          },
          {
            priority: 20, // Higher priority number = processed later
            delay: 200, // Minimal delay
            jobId: `metadata-${contractId}`,
          }
        );
        jobLogger.info('Metadata extraction job queued successfully');
      } catch (metadataError) {
        // Don't fail the job if metadata queueing fails
        jobLogger.warn({ error: metadataError }, 'Failed to queue metadata extraction, contract still processed successfully');
      }
    }

    // 8. Auto-queue AI categorization for contract type, risk, industry classification
    if (!hasCompleteFailure && plan.categorization) {
      try {
        jobLogger.info({ plan }, 'Queueing automatic AI categorization');
        const queueService = getQueueService();
        await queueService.addJob(
          QUEUE_NAMES.CATEGORIZATION,
          'categorize-contract',
          { 
            contractId, 
            tenantId, 
            autoApply: true,
            autoApplyThreshold: 0.75,
            source: 'upload',
            priority: 'normal',
            traceId: trace.traceId,
          },
          {
            priority: 25, // Higher priority number = processed later
            delay: 300, // Minimal delay
            jobId: `categorize-${contractId}`,
          }
        );
        jobLogger.info('AI categorization job queued successfully');
      } catch (categorizationError) {
        // Don't fail the job if categorization queueing fails
        jobLogger.warn({ error: categorizationError }, 'Failed to queue AI categorization, contract still processed successfully');
      }
    }

    // 9. Re-index artifacts for RAG semantic search (includes artifact summaries)
    if (!hasCompleteFailure && artifacts.count > 0) {
      try {
        const autoReindex = process.env.AUTO_RAG_ARTIFACT_REINDEX !== 'false'; // Default to true
        if (autoReindex) {
          jobLogger.info('Triggering RAG artifact reindexing');
          await publishJobProgress(job.id || '', contractId, tenantId, 95, 'indexing', 'Indexing for semantic search');
          // Import dynamically to avoid circular dependencies
          const { ragIntegrationService } = await import('../../data-orchestration/src/services/rag-integration.service');
          await ragIntegrationService.reindexContract(contractId);
          jobLogger.info('RAG artifact reindexing completed');
        }
      } catch (reindexError) {
        // Don't fail the job if reindexing fails
        jobLogger.warn({ error: reindexError }, 'Failed to reindex artifacts for RAG, contract still processed successfully');
      }
    }

    try { await job.updateProgress(100); } catch { /* best-effort */ }
    
    // Publish completion event
    await redisEventBus.publish(RedisEvents.PROCESSING_COMPLETED, {
      contractId,
      tenantId,
      jobId: job.id,
      status: hasCompleteFailure ? 'failed' : (hasPartialSuccess ? 'partial' : 'completed'),
      artifactsCreated: artifacts.count,
      failedArtifacts: failedArtifacts.length > 0 ? failedArtifacts : undefined,
    }, 'ocr-artifact-worker');

    // Kick off the manager agent loop (non-blocking)
    // The agent orchestrator can validate/repair downstream processing and fill gaps.
    try {
      const queueService = getQueueService();
      await queueService.addJob(
        QUEUE_NAMES.AGENT_ORCHESTRATION,
        'run-agent',
        {
          contractId,
          tenantId,
          traceId: trace.traceId,
          requestId: (job.data as any)?.requestId,
          iteration: 0,
        } as any,
        {
          priority: 40,
          delay: 500,
          jobId: `agent-${contractId}-0`,
        }
      );
      jobLogger.info('Agent orchestrator tick queued');
    } catch (agentError) {
      jobLogger.warn({ error: agentError }, 'Failed to queue agent orchestrator tick');
    }

    jobLogger.info({ 
      artifactsCreated: artifacts.count,
      textLength: extractedText.length,
      partialSuccess: hasPartialSuccess,
      failedArtifacts,
    }, 'OCR + artifact processing completed');

    // Log quality metrics
    qualityMetrics.endTime = Date.now();
    qualityMetrics.artifactsGenerated = artifacts.count;
    qualityMetrics.failedArtifacts = failedArtifacts;
    logQualityMetrics(qualityMetrics);

    return {
      success: !hasCompleteFailure,
      artifactsCreated: artifacts.count,
      extractedText: extractedText.substring(0, 500), // First 500 chars for logging
      partialSuccess: hasPartialSuccess,
      failedArtifacts: failedArtifacts.length > 0 ? failedArtifacts : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    jobLogger.error({ 
      error: errorMessage,
      stack: errorStack
    }, 'OCR + artifact processing failed');

    // Log quality metrics on failure too
    if (qualityMetrics) {
      qualityMetrics.endTime = Date.now();
      qualityMetrics.errors.push(errorMessage);
      logQualityMetrics(qualityMetrics);
    }

    // Publish failure event
    await redisEventBus.publish(RedisEvents.PROCESSING_FAILED, {
      contractId,
      tenantId,
      jobId: job.id,
      status: 'failed',
      message: errorMessage,
    }, 'ocr-artifact-worker');

    // Update statuses to failed
    try {
      await prisma.contract.updateMany({
        where: { id: contractId, tenantId },
        data: { status: 'FAILED', updatedAt: new Date() },
      });

      const processingJob = await prisma.processingJob.findFirst({
        where: { contractId, tenantId },
        orderBy: { createdAt: 'desc' },
      });

      if (processingJob) {
        await prisma.processingJob.updateMany({
          where: { id: processingJob.id, tenantId },
          data: {
            status: 'FAILED',
            currentStep: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    } catch (updateError) {
      jobLogger.error({ updateError }, 'Failed to update failure status');
    }

    throw error;
  } finally {
    // Clean up temp files regardless of success/failure
    if (isTempFile && localFilePath) {
      try {
        await fs.unlink(localFilePath);
      } catch {
        // best-effort cleanup
      }
    }
  }
}

/**
 * AI provider configuration for artifact generation
 */
const AI_RETRY_CONFIG = {
  maxAttempts: 2,
  baseDelay: 800,
  maxDelay: 8000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Call Mistral AI for artifact generation with retry logic
 */
async function callMistralForArtifact(
  prompt: string,
  systemPrompt: string,
  type: string
): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'MISTRAL_API_KEY not configured' };
  }

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= AI_RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const Mistral = mistralModule || (await import('@mistralai/mistralai')).Mistral;
      const client = new Mistral({ apiKey });
      
      logger.info({ type, attempt }, 'Calling Mistral for artifact generation');
      
      const response = await Promise.race([
        client.chat.complete({
          model: 'mistral-large-latest',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          maxTokens: 8192,
          responseFormat: { type: 'json_object' },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Mistral request timeout (90s)')), 90_000)),
      ]);

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Empty response from Mistral');
      }

      const artifactData = sharedSafeParseJSON(content, type);
      if (!artifactData) {
        throw new Error(`Failed to parse Mistral response as JSON for ${type}`);
      }
      logger.info({ type, keys: Object.keys(artifactData) }, 'Mistral artifact generation succeeded');
      
      return { success: true, data: artifactData };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = lastError.message;
      
      // Check if retryable (rate limits, server errors)
      const isRateLimited = errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('quota');
      const isServerError = errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503') || errorMsg.includes('504');
      const isRetryable = isRateLimited || isServerError;
      
      if (!isRetryable || attempt >= AI_RETRY_CONFIG.maxAttempts) {
        logger.warn({ type, attempt, error: errorMsg }, 'Mistral artifact generation failed');
        return { success: false, error: errorMsg };
      }
      
      // Calculate backoff delay with jitter
      const baseDelay = AI_RETRY_CONFIG.baseDelay * Math.pow(AI_RETRY_CONFIG.backoffMultiplier, attempt - 1);
      const delay = Math.min(baseDelay, AI_RETRY_CONFIG.maxDelay) * (0.5 + Math.random());
      
      logger.warn({ type, attempt, delay: Math.round(delay), error: errorMsg }, 'Mistral rate limited, retrying');
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  return { success: false, error: lastError?.message || 'Unknown Mistral error' };
}

/**
 * Call OpenAI for artifact generation with retry logic
 */
async function callOpenAIForArtifact(
  prompt: string,
  systemPrompt: string,
  type: string
): Promise<{ success: boolean; data?: Record<string, any>; error?: string; tokensUsed?: number; promptTokens?: number; completionTokens?: number; model?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  let lastError: Error | null = null;
  let isDowngraded = false;
  
  for (let attempt = 1; attempt <= AI_RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const openai = await getOCROpenAIClient();
      if (!openai) return { success: false, error: 'OPENAI_API_KEY not configured' };
      
      logger.info({ type, attempt }, 'Calling OpenAI for artifact generation');
      
      // Model downgrade cascade: gpt-4o → gpt-4o-mini on rate limit retries
      const primaryModel = process.env.OPENAI_MODEL || 'gpt-4o';
      const currentModel = (attempt >= 3 && isDowngraded) ? 'gpt-4o-mini' : primaryModel;
      
      const response = await openai.chat.completions.create({
        model: currentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: currentModel === 'gpt-4o-mini' ? 4096 : 8192,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }, { signal: AbortSignal.timeout(90_000) });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const artifactData = sharedSafeParseJSON(content, type);
      if (!artifactData) {
        throw new Error(`Failed to parse OpenAI response as JSON for ${type}`);
      }
      const usage = response.usage;
      logger.info({ type, model: currentModel, keys: Object.keys(artifactData), tokensUsed: usage?.total_tokens }, 'OpenAI artifact generation succeeded');
      
      return { 
        success: true, 
        data: artifactData,
        tokensUsed: usage?.total_tokens || 0,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        model: currentModel,
      };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = lastError.message;
      
      // Check if retryable (rate limits, server errors)
      const isRateLimited = errorMsg.includes('429') || errorMsg.includes('rate_limit') || errorMsg.includes('quota');
      const isServerError = errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503') || errorMsg.includes('504');
      const isRetryable = isRateLimited || isServerError;
      
      // Downgrade model on rate limit to increase chance of success
      if (isRateLimited && !isDowngraded) {
        isDowngraded = true;
        logger.warn({ type, attempt }, 'Rate limited on primary model, will downgrade to gpt-4o-mini on next attempt');
      }
      
      if (!isRetryable || attempt >= AI_RETRY_CONFIG.maxAttempts) {
        logger.warn({ type, attempt, error: errorMsg, wasDowngraded: isDowngraded }, 'OpenAI artifact generation failed');
        return { success: false, error: errorMsg };
      }
      
      // Calculate backoff delay with jitter (longer for rate limits)
      const multiplier = isRateLimited ? 3 : 1;
      const baseDelay = AI_RETRY_CONFIG.baseDelay * Math.pow(AI_RETRY_CONFIG.backoffMultiplier, attempt - 1) * multiplier;
      const delay = Math.min(baseDelay, AI_RETRY_CONFIG.maxDelay) * (0.5 + Math.random());
      
      logger.warn({ type, attempt, delay: Math.round(delay), error: errorMsg }, 'OpenAI rate limited, retrying');
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  return { success: false, error: lastError?.message || 'Unknown OpenAI error' };
}

/**
 * Generate artifact data using AI (Mistral first, OpenAI fallback)
 * Now adaptive based on detected contract type with retry logic for rate limits.
 * When DI structured data is available, it's injected into the prompt context
 * so the LLM uses pre-validated tables, parties, dates, and financial data.
 */
async function generateArtifactWithAI(
  type: string,
  contractText: string,
  contract: any,
  detectedContractType?: ContractType,
  ocrResult?: StructuredOCRResult | null
): Promise<Record<string, any>> {
  const mistralKey = process.env.MISTRAL_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  // If no AI keys, use fallback templates
  if (!mistralKey && !openaiKey) {
    logger.warn('No AI API keys configured, using fallback templates');
    return getFallbackArtifact(type, contractText, contract);
  }
  
  try {
    // Get contract type profile for adaptive extraction
    const contractType = detectedContractType || 'OTHER';
    const profile = getContractProfile(contractType);
    
    // Build prompt context from contract profile for the shared module
    const promptCtx: PromptContext = {
      contractText,
      contractType: contractType,
      contractTypeDisplayName: profile.displayName,
      contractTypeHints: detectedContractType ? profile.extractionHints : undefined,
      expectedSections: detectedContractType ? profile.expectedSections : undefined,
      clauseCategories: profile.clauseCategories.length > 0 ? profile.clauseCategories : undefined,
      financialFieldsHint: profile.financialFields.length > 0 
        ? `Focus on extracting: ${profile.financialFields.join(', ')}`
        : undefined,
      riskCategoriesHint: profile.riskCategories.length > 0
        ? `Key risk areas for this contract type: ${profile.riskCategories.join(', ')}`
        : undefined,
    };

    // Inject DI structured data into prompt context when available
    if (ocrResult?.isDISource) {
      promptCtx.diConfidence = ocrResult.confidence;
      if (ocrResult.tables.length > 0) {
        promptCtx.diTables = ocrResult.tables.map(t => ({
          pageNumber: t.pageNumber,
          headers: t.headers,
          rows: t.rows,
          confidence: t.confidence,
        }));
      }
      if (ocrResult.keyValuePairs.length > 0) {
        promptCtx.diKeyValuePairs = ocrResult.keyValuePairs.map(kv => ({
          key: kv.key,
          value: kv.value,
          confidence: kv.confidence,
        }));
      }
      if (ocrResult.contractFields) {
        promptCtx.diContractFields = {
          parties: ocrResult.contractFields.parties.map(p => ({
            name: p.name,
            role: p.role,
            address: p.address,
            confidence: p.confidence,
          })),
          dates: ocrResult.contractFields.dates,
          jurisdiction: ocrResult.contractFields.jurisdiction,
          title: ocrResult.contractFields.title,
          confidence: ocrResult.contractFields.confidence,
        };
      }
      if (ocrResult.invoiceFields) {
        promptCtx.diInvoiceFields = {
          vendorName: ocrResult.invoiceFields.vendorName,
          customerName: ocrResult.invoiceFields.customerName,
          invoiceId: ocrResult.invoiceFields.invoiceId,
          invoiceDate: ocrResult.invoiceFields.invoiceDate,
          invoiceTotal: ocrResult.invoiceFields.invoiceTotal,
          currency: ocrResult.invoiceFields.currency,
          lineItems: ocrResult.invoiceFields.lineItems.map(li => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            amount: li.amount,
          })),
          confidence: ocrResult.invoiceFields.confidence,
        };
      }
      // Inject handwriting/signature detection from DI styles
      const handwrittenSpans = ocrResult.handwrittenText || [];
      promptCtx.diHandwritingInfo = {
        hasHandwriting: handwrittenSpans.length > 0,
        handwrittenSpans,
        handwrittenSpanCount: handwrittenSpans.length,
      };
      // Inject detected document languages
      if (ocrResult.detectedLanguages.length > 0) {
        promptCtx.diDetectedLanguages = ocrResult.detectedLanguages;
      }
      // Inject document structure from paragraph roles
      const structuredParagraphs = ocrResult.paragraphs
        .filter(p => p.role && ['title', 'sectionHeading'].includes(p.role))
        .map(p => ({ content: p.content.slice(0, 200), role: p.role! }));
      if (structuredParagraphs.length > 0) {
        promptCtx.diDocumentStructure = structuredParagraphs;
      }
      // Inject selection marks, barcodes, formulas
      if (ocrResult.selectionMarks.length > 0) {
        promptCtx.diSelectionMarks = ocrResult.selectionMarks;
      }
      if (ocrResult.barcodes.length > 0) {
        promptCtx.diBarcodes = ocrResult.barcodes;
      }
      if (ocrResult.formulas.length > 0) {
        promptCtx.diFormulas = ocrResult.formulas;
      }
    }

    // Use shared module for prompt generation (single source of truth)
    const prompt = buildArtifactPrompt(type, promptCtx);
    if (!prompt) {
      logger.warn({ type }, 'Unknown artifact type, using fallback');
      return getFallbackArtifact(type, contractText, contract);
    }

    const truncatedText = truncateTextForType(contractText, type);
    const systemPrompt = getSystemPrompt();
    let usedProvider = 'none';
    let artifactData: Record<string, any> | null = null;

    // Try Mistral first (if configured)
    if (mistralKey) {
      logger.info({ type, textLength: truncatedText.length }, 'Trying Mistral for artifact generation');
      const mistralResult = await callMistralForArtifact(prompt, systemPrompt, type);
      
      if (mistralResult.success && mistralResult.data) {
        artifactData = mistralResult.data;
        usedProvider = 'mistral-large-latest';
      } else {
        logger.warn({ type, error: mistralResult.error }, 'Mistral failed, trying OpenAI fallback');
      }
    }

    // Fall back to OpenAI if Mistral failed or not configured
    if (!artifactData && openaiKey) {
      logger.info({ type, textLength: truncatedText.length }, 'Trying OpenAI for artifact generation');
      const openaiResult = await callOpenAIForArtifact(prompt, systemPrompt, type);
      
      if (openaiResult.success && openaiResult.data) {
        artifactData = openaiResult.data;
        usedProvider = openaiResult.model || process.env.OPENAI_MODEL || 'gpt-4o';
        // Capture token usage from OpenAI
        artifactData._tokenUsage = {
          tokensUsed: openaiResult.tokensUsed || 0,
          promptTokens: openaiResult.promptTokens || 0,
          completionTokens: openaiResult.completionTokens || 0,
        };
      } else {
        logger.warn({ type, error: openaiResult.error }, 'OpenAI also failed');
      }
    }

    // If both AI providers failed, use fallback templates
    if (!artifactData) {
      logger.error({ type }, 'All AI providers failed, using fallback templates');
      return getFallbackArtifact(type, contractText, contract);
    }

    // Add metadata including token usage tracking
    const tokenUsage = artifactData._tokenUsage || {};
    delete artifactData._tokenUsage; // Remove temp field
    
    artifactData._meta = {
      generatedAt: new Date().toISOString(),
      model: usedProvider,
      aiGenerated: true,
      textAnalyzed: truncatedText.length,
      tokensUsed: tokenUsage.tokensUsed || 0,
      promptTokens: tokenUsage.promptTokens || 0,
      completionTokens: tokenUsage.completionTokens || 0,
      estimatedCost: sharedEstimateTokenCost(usedProvider, tokenUsage.promptTokens || 0, tokenUsage.completionTokens || 0),
      promptVersion: PROMPT_VERSION,
      antiHallucinationEnabled: true,
    };

    logger.info({ type, provider: usedProvider, tokensUsed: tokenUsage.tokensUsed || 0 }, 'Successfully generated artifact with AI');
    return artifactData;

  } catch (error) {
    logger.error({ error, type }, 'AI artifact generation failed unexpectedly, using fallback');
    return getFallbackArtifact(type, contractText, contract);
  }
}

/**
 * Estimate token cost in USD — delegates to shared module
 */
function estimateTokenCost(model: string, promptTokens: number, completionTokens: number): number {
  return sharedEstimateTokenCost(model, promptTokens, completionTokens);
}

/**
 * Fallback artifact templates when AI is unavailable (delegates to shared module with contract overlay)
 */
function getFallbackArtifact(type: string, contractText: string, contract: any): Record<string, any> {
  const base = getFallbackTemplate(type);
  
  // Overlay contract-specific data for richer fallbacks
  if (type === 'OVERVIEW' && base) {
    base.summary = `Contract uploaded: ${contract.fileName || contract.contractTitle || 'Unknown'}. AI analysis unavailable - please review manually.`;
    base.contractType = contract.contractType || 'Unknown';
    // Try to extract parties from DB fields or text
    const parties: Array<{name: string; role: string}> = [];
    if (contract.clientName) parties.push({ name: contract.clientName, role: 'Client' });
    if (contract.supplierName) parties.push({ name: contract.supplierName, role: 'Supplier' });
    if (parties.length === 0 && contractText?.length > 50) {
      const betweenMatch = contractText.match(
        /(?:between|by and between|entered into by)\s+([A-Z][A-Za-z0-9\s&,.'()\-]{2,80}?)\s*(?:\(.*?\))?\s*(?:,?\s*(?:and|&)\s+)([A-Z][A-Za-z0-9\s&,.'()\-]{2,80}?)\s*(?:\(|,|\n)/i
      );
      if (betweenMatch) {
        parties.push({ name: betweenMatch[1]!.trim(), role: 'Party A' });
        parties.push({ name: betweenMatch[2]!.trim(), role: 'Party B' });
      }
    }
    if (parties.length > 0) base.parties = parties;
    base.effectiveDate = contract.effectiveDate?.toISOString() || null;
    base.expirationDate = contract.expirationDate?.toISOString() || null;
    if (contract.totalValue) base.totalValue = contract.totalValue;
    if (contract.currency) base.currency = contract.currency;
  } else if (type === 'FINANCIAL' && base) {
    if (contract.totalValue) base.totalValue = { value: contract.totalValue, source: 'database', extractedFromText: false };
    if (contract.currency) base.currency = { value: contract.currency, source: 'database', extractedFromText: false };
  } else if (type === 'RENEWAL' && base) {
    if (contract.expirationDate) base.currentTermEnd = contract.expirationDate.toISOString();
  }
  
  return base;
}

/**
 * Register OCR + Artifact worker
 */
export function registerOCRArtifactWorker() {
  const queueService = getQueueService();

  // Read concurrency from env or use optimized defaults
  // Enhanced worker configuration for better throughput and reliability
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '8', 10);  // Increased from 5 to 8
  const maxJobsPerMinute = parseInt(process.env.WORKER_RATE_LIMIT || '60', 10);  // Increased from 30 to 60
  
  logger.info({ 
    concurrency, 
    maxJobsPerMinute,
    features: {
      multiPassOCR: WORKER_CONFIG.ocr.enableMultiPassExtraction,
      tableExtraction: WORKER_CONFIG.ocr.enableTableExtraction,
      partyValidation: WORKER_CONFIG.ai.enablePartyNameValidation,
      aiModel: WORKER_CONFIG.ai.model,
    }
  }, '⚡ Enhanced worker configuration for improved accuracy and throughput');
  
  const worker = queueService.registerWorker<ProcessContractJobData, OCRArtifactResult>(
    QUEUE_NAMES.CONTRACT_PROCESSING,
    processOCRArtifactJob,
    {
      concurrency, // Process multiple contracts in parallel (env configurable)
      limiter: {
        max: maxJobsPerMinute,
        duration: 60000, // Rate limit per minute
      },
      // OCR + AI artifact generation can take 2–5 min per contract
      lockDuration: 300_000,    // 5 min lock (prevents premature stall detection)
      lockRenewTime: 60_000,    // renew every 60s while still processing
      stalledInterval: 60_000,  // check stalls every 60s
      maxStalledCount: 2,       // 2 stalls before failing (covers transient pauses)
      removeOnComplete: { age: 86400, count: 1000 },  // keep 24h / 1k completed
      removeOnFail: { age: 604800, count: 5000 },      // keep 7d / 5k failed
    }
  );

  logger.info('OCR + Artifact worker registered');

  return worker;
}

// Start worker if this file is run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  logger.info('Starting OCR + Artifact worker...');
  
  // Initialize queue service with config before registering worker
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable must be configured');
  }
  getQueueService({
    redis: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 5000 },
    },
  });
  
  registerOCRArtifactWorker();
  
  // Graceful shutdown — wait for in-progress jobs before exiting
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, closing worker gracefully...');
    const queueService = getQueueService();
    try {
      // worker.close() waits for active jobs to finish
      await Promise.race([
        queueService.close(),
        new Promise(resolve => setTimeout(resolve, 30000)), // 30s timeout
      ]);
      logger.info('Worker shutdown complete');
    } catch (err) {
      logger.error({ err }, 'Error during worker shutdown');
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Get circuit breaker metrics for health monitoring
 */
export function getCircuitBreakerMetrics() {
  return {
    mistral: getMistralCircuitBreaker().getMetrics(),
    azure: getAzureCircuitBreaker().getMetrics(),
    storage: getStorageCircuitBreaker().getMetrics(),
  };
}

/**
 * Reset circuit breakers (for testing or manual intervention)
 */
export function resetCircuitBreakers() {
  getMistralCircuitBreaker().reset();
  getAzureCircuitBreaker().reset();
  getStorageCircuitBreaker().reset();
  logger.info('All circuit breakers reset');
}

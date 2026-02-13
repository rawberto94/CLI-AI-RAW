import dotenv from 'dotenv';
// Load environment variables FIRST, before any other imports that need them
dotenv.config();

// Use local type definition for cross-package compatibility
type Job<T = any> = { id?: string; name: string; data: T; attemptsMade: number; opts: any };
import clientsDb from 'clients-db';
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
import { getQueueService, JobType } from '@repo/utils/queue/queue-service';
import { QUEUE_NAMES, ProcessContractJobData, IndexContractJobData } from '@repo/utils/queue/contract-queue';
import pino from 'pino';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { 
  CircuitBreaker, 
  CircuitState, 
  CircuitBreakerError 
} from '@repo/utils/patterns/circuit-breaker';
import { retry, retryOpenAI, retryStorage } from '@repo/utils/patterns/retry';
import { redisEventBus, RedisEvents, publishJobProgress } from '@repo/utils/events/redis-event-bus';
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

// Type-only imports for Azure Document Intelligence
import type {
  DIAnalyzeResult,
  ContractExtractionResult,
  InvoiceExtractionResult,
} from './azure-document-intelligence';
import { ArtifactQualityValidator, selfCritiqueArtifact } from './utils/artifact-quality-validator';

// Check if we're in build mode - skip worker initialization
const isBuildTime = process.env.NEXT_BUILD === 'true';

const logger = pino({ 
  name: 'ocr-artifact-worker',
  level: isBuildTime ? 'silent' : (process.env.LOG_LEVEL || 'info')
});

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

// Circuit breakers for external services (Swiss-compliant only)
const mistralCircuitBreaker = new CircuitBreaker('mistral-ocr', {
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

const azureCircuitBreaker = new CircuitBreaker('azure-ch-ocr', {
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

const storageCircuitBreaker = new CircuitBreaker('storage', {
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
import { ocrCache } from '@repo/utils/cache/distributed-cache';

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

// Initialize S3 client for MinIO — fail fast if credentials are missing in production
if (process.env.NODE_ENV === 'production' && (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY)) {
  throw new Error('CRITICAL: MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be configured in production');
}
const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
});

interface OCRArtifactResult {
  success: boolean;
  artifactsCreated: number;
  extractedText?: string;
  partialSuccess?: boolean;
  failedArtifacts?: string[];
}

/**
 * Generate cache key for OCR results
 */
function generateOCRCacheKey(filePath: string, fileSize: number): string {
  const fileName = path.basename(filePath);
  return `ocr:${fileName}:${fileSize}`;
}

/**
 * Perform OCR extraction on a file with circuit breaker protection and caching
 */
async function performOCR(filePath: string, ocrMode: string, fileSize?: number, onProgress?: (pct: number) => void): Promise<string> {
  logger.info({ filePath, ocrMode }, 'Performing OCR extraction');
  
  // Check distributed cache first
  if (fileSize) {
    const cacheKey = generateOCRCacheKey(filePath, fileSize);
    const cached = await ocrCache.get(cacheKey);
    if (cached) {
      logger.info({ cacheKey }, 'Using cached OCR result from distributed cache');
      return cached.text;
    }
  }
  
  // ── DI modes: try the specific model first, then fall through to legacy chain ──
  const DI_MODES: OCRMode[] = ['azure-di-layout', 'azure-di-contract', 'azure-di-invoice'];
  if (DI_MODES.includes(ocrMode as OCRMode)) {
    try {
      const { isDIConfigured, isDIEnabled } = await import('./azure-document-intelligence');
      if (isDIConfigured() && isDIEnabled() && azureCircuitBreaker.getState() !== CircuitState.OPEN) {
        onProgress?.(15); // DI submission starting
        const result = await azureCircuitBreaker.execute(() =>
          retry(async () => {
            const { analyzeLayout, analyzeContract, analyzeInvoice } = await import('./azure-document-intelligence');
            const fileBuffer = await fs.readFile(filePath);

            if (ocrMode === 'azure-di-contract') {
              const { analysis, contract } = await analyzeContract(fileBuffer);
              const parts = [analysis.content];
              if (contract.parties.length > 0) {
                parts.push('\n--- CONTRACT PARTIES ---');
                for (const p of contract.parties) parts.push(`${p.role || 'Party'}: ${p.name}`);
              }
              if (contract.dates.effectiveDate) parts.push(`Effective Date: ${contract.dates.effectiveDate}`);
              if (contract.dates.expirationDate) parts.push(`Expiration Date: ${contract.dates.expirationDate}`);
              if (contract.jurisdiction) parts.push(`Jurisdiction: ${contract.jurisdiction}`);
              return parts.join('\n');
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
              return parts.join('\n');
            } else {
              // azure-di-layout
              const result = await analyzeLayout(fileBuffer, { extractKeyValuePairs: true });
              const parts = [result.content];
              if (result.tables.length > 0) {
                parts.push('\n--- EXTRACTED TABLES ---');
                for (const t of result.tables) {
                  if (t.headers.length) {
                    parts.push(`| ${t.headers.join(' | ')} |`);
                    parts.push(`| ${t.headers.map(() => '---').join(' | ')} |`);
                  }
                  for (const r of t.rows) parts.push(`| ${r.join(' | ')} |`);
                }
              }
              if (result.keyValuePairs.length > 0) {
                parts.push('\n--- KEY-VALUE PAIRS ---');
                for (const kv of result.keyValuePairs) {
                  if (kv.key && kv.value) parts.push(`${kv.key}: ${kv.value}`);
                }
              }
              return parts.join('\n');
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

        // Cache and return
        if (fileSize && result && result.length > 100) {
          const cacheKey = generateOCRCacheKey(filePath, fileSize);
          await ocrCache.set(cacheKey, result);
        }
        logger.info({ ocrMode, textLength: result.length }, 'DI model OCR succeeded');
        onProgress?.(55); // DI analysis complete
        return result;
      }
    } catch (diError) {
      logger.warn({ error: (diError as Error).message, ocrMode }, 'DI model OCR failed, falling through to legacy chain');
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
    if (mode === 'mistral' && mistralCircuitBreaker.getState() === CircuitState.OPEN) {
      logger.warn('Mistral circuit breaker is open, skipping');
      continue;
    }
    if (mode === 'azure-ch' && azureCircuitBreaker.getState() === CircuitState.OPEN) {
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
        result = await mistralCircuitBreaker.execute(() => 
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
        result = await azureCircuitBreaker.execute(() => 
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
        const cacheKey = generateOCRCacheKey(filePath, fileSize);
        await ocrCache.set(cacheKey, result);
        logger.info({ cacheKey, textLength: result.length }, 'Cached OCR result in distributed cache');
      }
      
      logger.info({ mode, textLength: result.length }, 'OCR extraction succeeded');
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof CircuitBreakerError) {
        logger.warn({ mode, state: error.state }, 'Circuit breaker prevented OCR call, trying next');
      } else {
        logger.warn({ mode, error: lastError.message }, 'OCR mode failed, trying next');
      }
    }
  }
  
  // All modes exhausted - use basic extraction as last resort
  logger.error({ lastError: lastError?.message }, 'All OCR modes exhausted, using basic extraction');
  return await extractTextFallback(filePath);
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

    if (diEndpoint && diKey) {
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
      logger.info({ textLength: rawText.length, pages: pdfData.numpages }, 'PDF text extracted');
      
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
      // Limit to 20k chars for even faster processing
      const textToProcess = rawText.substring(0, 20000);
      
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
      
      const enhancedText = chatResponse.choices?.[0]?.message?.content || rawText;
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
    
    const openai = new OpenAI({ apiKey });
    const fileBuffer = await fs.readFile(filePath);
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
    
    // For PDFs, use pdf-parse first, then GPT for enhancement
    if (isPDF) {
      logger.info({ filePath, size: fileBuffer.length }, 'Processing PDF with pdf-parse + GPT enhancement');
      
      const pdfParse = pdfParseModule || (await import('pdf-parse')).default;
      const pdfData = await pdfParse(fileBuffer);
      const rawText = pdfData.text;
      
      logger.info({ textLength: rawText.length, pages: pdfData.numpages }, 'PDF text extracted');
      
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

  jobLogger.info({ jobData: job.data }, '🔍 RAW JOB DATA RECEIVED');

  jobLogger.info({ filePath }, 'Starting OCR + artifact processing');

  // Connect to Redis event bus for real-time updates
  try {
    await redisEventBus.connect();
  } catch (err) {
    jobLogger.warn({ error: err }, 'Redis event bus not available, continuing without real-time updates');
  }

  try {
    jobLogger.info('Step 1: Updating progress to 5%');
    await job.updateProgress(5);
    
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

    await ensureProcessingJob({
      tenantId,
      contractId,
      queueId: job.id ? String(job.id) : undefined,
      traceId: trace.traceId,
    });

    jobLogger.info({ status: contract.status }, 'Contract found');
    await job.updateProgress(10);
    await publishJobProgress(job.id || '', contractId, tenantId, 10, 'processing', 'Downloading contract file');

    // 2. Download file from storage to temp location
    let localFilePath: string;
    
    if (!contract.storagePath) {
      throw new Error(`Contract ${contractId} has no storage path`);
    }
    
    // Store storagePath in a local const to preserve narrowing inside callbacks
    const storagePath = contract.storagePath;
    
    if (contract.storageProvider === 's3') {
      jobLogger.info({ storagePath }, 'Downloading from S3/MinIO');
      
      // Use circuit breaker and retry for storage operations
      const fileBuffer = await storageCircuitBreaker.execute(() => 
        retryStorage(async () => {
          const getObjectCommand = new GetObjectCommand({
            Bucket: process.env.MINIO_BUCKET || 'contracts',
            Key: storagePath,
          });

          const response = await s3Client.send(getObjectCommand);
          
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
      jobLogger.info({ localFilePath, size: fileBuffer.length }, 'File downloaded');
    } else {
      // Local file system
      localFilePath = contract.storagePath!;
      jobLogger.info({ localFilePath }, 'Using local file');
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
        }

        // Still auto? fall back to azure-ch (which already tries DI v4.0 internally)
        if (ocrMode === 'auto') ocrMode = 'azure-ch';
      } catch (preErr) {
        jobLogger.warn({ error: (preErr as Error).message }, 'Preclassification failed, defaulting to azure-ch');
        ocrMode = 'azure-ch';
      }
    }

    const rawExtractedText = await performOCR(localFilePath, ocrMode, undefined, async (pct) => {
      try { await job.updateProgress(pct); } catch { /* best-effort */ }
    });
    
    // ============ OCR ENHANCEMENT PIPELINE (NEW) ============
    // Apply post-OCR corrections, validation, and quality improvements
    let enhancedText = rawExtractedText;
    let ocrEnhancementResult: OCREnhancementPipelineResult | null = null;
    let adaptiveConfig: AdaptiveModelConfig | null = null;
    
    if (WORKER_CONFIG.ocr.enablePostOCRCorrection && rawExtractedText.length > 0) {
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
    // Use AI for intelligent spell correction with data residency compliance
    let llmEnhancementResult: HybridEnhancementResult | null = null;
    
    if (WORKER_CONFIG.ocr.enableLLMCorrection && enhancedText.length > 100) {
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
    
    // Initialize quality metrics
    qualityMetrics = {
      contractId,
      startTime: Date.now(),
      textLength: enhancedText.length,
      artifactsGenerated: 0,
      failedArtifacts: [],
      textConfidence: ocrEnhancementResult?.validation.confidence || 0.5,
      tablesDetected: 0,
      financialIndicators: { hasCurrency: false, currencies: [], hasPercentages: false, hasPaymentTerms: false, estimatedTotalValue: null, confidence: 0.5 },
      errors: [],
      warnings: [],
    };
    
    // 3.1 Preprocess the extracted text (use enhanced text)
    const { cleanedText: extractedText, tables, metrics: textMetrics } = preprocessText(enhancedText);
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
        await prisma.contract.updateMany({
          where: { id: contractId, tenantId },
          data: {
            rawText: extractedText,
            ocrProvider: ocrMode,
            ocrModel: ocrMode.startsWith('azure-di-') ? `prebuilt-${ocrMode.replace('azure-di-', '')}` : undefined,
            ocrProcessedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        jobLogger.info({ textLength: extractedText.length }, 'Raw text saved to contract');
      } catch (rawTextError) {
        jobLogger.warn({ error: rawTextError }, 'Failed to save rawText, continuing with processing');
      }
    }

    await job.updateProgress(60);
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
    
    // All possible artifact types
    const allArtifactTypes: ArtifactType[] = [
      'OVERVIEW',
      'CLAUSES', 
      'FINANCIAL',
      'RISK',
      'COMPLIANCE',
      'OBLIGATIONS',
      'RENEWAL',
      'NEGOTIATION_POINTS',
      'AMENDMENTS',
      'CONTACTS',
      'PARTIES',
      'TIMELINE',
      'DELIVERABLES',
      'EXECUTIVE_SUMMARY',
    ];

    // Filter to relevant artifacts based on contract type
    const relevantArtifacts = getRelevantArtifacts(detectedContractType);
    // Include all types — if getRelevantArtifacts doesn't know about new types, include them anyway
    const artifactTypes = allArtifactTypes.filter(type => 
      relevantArtifacts.includes(type) || ['PARTIES', 'TIMELINE', 'DELIVERABLES', 'EXECUTIVE_SUMMARY'].includes(type)
    );
    
    // Track non-applicable artifacts
    const notApplicableArtifacts = allArtifactTypes.filter(type => !relevantArtifacts.includes(type));
    
    jobLogger.info({ 
      relevantArtifacts: artifactTypes,
      skippedAsNotApplicable: notApplicableArtifacts,
    }, 'Artifact types determined by contract type');

    const failedArtifacts: string[] = [];
    const successfulArtifacts: string[] = [];

    // Quality validator for artifact content validation
    const qualityValidator = new ArtifactQualityValidator({
      overall: 0.65,
      completeness: 0.55,
      accuracy: 0.65,
      consistency: 0.60,
      confidence: 0.55,
    });

    // Generate relevant artifacts in parallel with retry + quality validation
    const artifactPromises = artifactTypes.map(async (artifactType) => {
      const maxRetries = 2;
      const maxRegenerations = 1; // Allow 1 quality-based regeneration
      let lastError: Error | null = null;
      let bestArtifactData: Record<string, any> | null = null;
      let bestQualityScore = 0;
      let tokensUsed = 0;
      let modelUsed = 'unknown';
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const artifactResult = await generateArtifactWithAI(
            artifactType, 
            extractedText, 
            contract,
            detectedContractType // Pass detected type for adaptive prompts
          );
          
          // Track token usage from the result metadata
          if (artifactResult._meta) {
            tokensUsed = artifactResult._meta.tokensUsed || 0;
            modelUsed = artifactResult._meta.model || 'unknown';
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
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }
      
      // If we got a valid result (even low quality), use it
      if (bestArtifactData) {
        successfulArtifacts.push(artifactType);
        return {
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
      }
      
      // Track failed artifact for partial success reporting
      failedArtifacts.push(artifactType);
      
      // Generate fallback artifact with retry metadata
      jobLogger.error({ error: lastError, artifactType }, `All attempts failed, creating fallback artifact`);
      return {
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
    });

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

    const generatedArtifacts = (await Promise.all(artifactPromises)).filter(Boolean);
    
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
        
        // Extract dates - handle wrapped values
        const effectiveDate = unwrapDate(overviewData.effectiveDate);
        if (effectiveDate) {
          contractUpdate.effectiveDate = effectiveDate;
        }
        const expirationDate = unwrapDate(overviewData.expirationDate);
        if (expirationDate) {
          contractUpdate.expirationDate = expirationDate;
        }
        
        // Extract contract title if we have a summary
        if (overviewData.summary && !contract.contractTitle) {
          // Use first sentence of summary as title, max 100 chars
          const summaryText = unwrap(overviewData.summary);
          if (summaryText && typeof summaryText === 'string') {
            const title = summaryText.split('.')[0].substring(0, 100);
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
      document_number: contractId,
      document_title: unwrapVal(overviewArtifactData.contractTitle) || 
        (unwrapVal(overviewArtifactData.summary) || '').split('.')[0]?.substring(0, 100) || '',
      contract_short_description: unwrapVal(overviewArtifactData.summary) || '',
      
      // Parties
      external_parties: externalParties,
      
      // Financial - handle wrapped values
      tcv_amount: (() => {
        const val = unwrapVal(overviewArtifactData.totalValue) || unwrapVal(financialData.totalValue);
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const cleaned = val.replace(/[$€£¥,]/g, '').trim();
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      })(),
      tcv_text: unwrapVal(financialData.totalValueText) || 
        (unwrapVal(overviewArtifactData.totalValue) ? 
          `$${Number(unwrapVal(overviewArtifactData.totalValue) || 0).toLocaleString()}` : ''),
      payment_type: paymentType,
      billing_frequency_type: billingFrequency,
      periodicity: billingFrequency || '',
      currency: unwrapVal(overviewArtifactData.currency) || unwrapVal(financialData.currency) || 'USD',
      
      // Dates
      execution_date: unwrapVal(overviewArtifactData.executionDate) || 
        unwrapVal(overviewArtifactData.effectiveDate) || null,
      contract_effective_date: unwrapVal(overviewArtifactData.effectiveDate) || null,
      contract_end_date: unwrapVal(overviewArtifactData.expirationDate) || null,
      
      // Signature status (from CONTACTS artifact)
      signature_status: unwrapVal(contactsData.signatureStatus) || 'unknown',
      signature_date: unwrapVal(contactsData.signatureDate) || 
        (contactsData.signatories?.find((s: any) => s.dateSigned)?.dateSigned) || 
        unwrapVal(overviewArtifactData.executionDate) || null,
      signature_required_flag: unwrapVal(contactsData.signatureStatus) === 'unsigned' || 
        unwrapVal(contactsData.signatureStatus) === 'partially_signed' ||
        (!unwrapVal(contactsData.signatureDate) && unwrapVal(contactsData.signatureStatus) !== 'signed'),
      signatories: contactsData.signatories || [],
      signature_analysis: contactsData.signatureAnalysis || null,
      
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

    // Save enterprise metadata to contract.aiMetadata AND update signature status on contract
    try {
      // Parse signature date if string
      let signatureDateParsed: Date | null = null;
      if (enterpriseMetadata.signature_date) {
        const parsed = new Date(enterpriseMetadata.signature_date);
        if (!isNaN(parsed.getTime())) {
          signatureDateParsed = parsed;
        }
      }
      
      await prisma.contract.updateMany({
        where: { id: contractId, tenantId },
        data: {
          aiMetadata: enterpriseMetadata as any,
          // Update signature fields on the contract model for easy querying and legal tracking
          signatureStatus: enterpriseMetadata.signature_status || 'unknown',
          signatureDate: signatureDateParsed,
          signatureRequiredFlag: enterpriseMetadata.signature_required_flag || false,
          updatedAt: new Date(),
        },
      });
      jobLogger.info({ 
        fieldsPopulated: Object.keys(enterpriseMetadata).filter(k => !k.startsWith('_')).length,
        partiesCount: externalParties.length,
        hasFinancials: !!enterpriseMetadata.tcv_amount,
        signatureStatus: enterpriseMetadata.signature_status,
        signatureRequiredFlag: enterpriseMetadata.signature_required_flag,
      }, 'Enterprise metadata schema populated in aiMetadata and signature status updated');
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

      // 1. Run proactive validation on all artifacts
      jobLogger.info('Running proactive validation agent');
      const validationResult = await proactiveValidationAgent.executeWithTracking({
        contractId,
        tenantId,
        context: { 
          artifacts: artifactDataArray,
          contractType: detectedContractType,
        },
        triggeredBy: 'ocr_pipeline',
      });

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
        }
      }

      // 3. Run health monitor to assess contract health
      jobLogger.info('Running contract health monitor');
      await contractHealthMonitor.executeWithTracking({
        contractId,
        tenantId,
        context: { 
          artifacts: artifactDataArray,
          validationResult: validationResult.output,
          contractType: detectedContractType,
        },
        triggeredBy: 'ocr_pipeline',
      });

      jobLogger.info('Agentic AI integration completed successfully');
    } catch (error) {
      // Don't fail the job if agents fail - just log the error
      jobLogger.error({ error }, 'Agentic AI integration failed (non-fatal)');
    }

    await job.updateProgress(90);

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
      jobLogger.warn({ error: metadataPopulateError }, 'Failed to populate ContractMetadata, continuing');
    }

    // Clean up temp file if we created one
    if (contract.storageProvider === 's3') {
      await fs.unlink(localFilePath).catch(() => {});
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
            delay: 500, // Minimal delay - transaction is committed
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
            delay: 1000, // Minimal delay
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
            delay: 1500, // Minimal delay
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

    await job.updateProgress(100);
    
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
          delay: 2000,
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
  }
}

/**
 * AI provider configuration for artifact generation
 */
const AI_RETRY_CONFIG = {
  maxAttempts: 4,
  baseDelay: 2000,
  maxDelay: 30000,
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
      
      const response = await client.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        maxTokens: 8192,
        responseFormat: { type: 'json_object' },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Empty response from Mistral');
      }

      const artifactData = JSON.parse(content);
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
): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  let lastError: Error | null = null;
  let isDowngraded = false;
  
  for (let attempt = 1; attempt <= AI_RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey });
      
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
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const artifactData = JSON.parse(content);
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
 * Now adaptive based on detected contract type with retry logic for rate limits
 */
async function generateArtifactWithAI(
  type: string,
  contractText: string,
  contract: any,
  detectedContractType?: ContractType
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
    
    // Adjust text limit based on contract complexity — use generous limits for comprehensive analysis
    const textLimit = contractType === 'MSA' || contractType === 'LOAN' || contractType === 'SOW' || contractType === 'LEASE' ? 60000 : 50000;
    const truncatedText = contractText.substring(0, textLimit);
    
    // Build contract-type-specific extraction hints
    const typeContext = detectedContractType ? `
CONTRACT TYPE DETECTED: ${profile.displayName}
${profile.extractionHints}
EXPECTED SECTIONS: ${profile.expectedSections.join(', ')}
` : '';
    
    // Get adaptive clause categories based on contract type
    const clauseCategories = profile.clauseCategories.length > 0 
      ? profile.clauseCategories.join(', ')
      : 'payment, termination, liability, confidentiality, indemnification, warranty, scope, other';

    // Get adaptive financial fields
    const financialFieldsHint = profile.financialFields.length > 0
      ? `Focus on extracting: ${profile.financialFields.join(', ')}`
      : 'Extract any financial terms present';

    // Get adaptive risk categories
    const riskCategoriesHint = profile.riskCategories.length > 0
      ? `Key risk areas for this contract type: ${profile.riskCategories.join(', ')}`
      : 'Analyze general contract risks';
    
    const prompts: Record<string, string> = {
      OVERVIEW: `Analyze this contract COMPREHENSIVELY and extract all key information. Return a JSON object with:
{
  "summary": "A thorough executive summary of 8-12 sentences covering: what the contract is, who the parties are and their roles, the core purpose and scope, key commercial terms (value, duration, payment structure), the most important obligations on each side, notable risks or unusual provisions, and any critical deadlines. This should be detailed enough that a reader understands the contract without reading it.",
  "executiveBriefing": "A detailed 2-3 paragraph briefing suitable for C-level executives highlighting: 1) What this contract does and why it matters, 2) Key value proposition and commercial terms, 3) Main obligations and deliverables, 4) Notable risks, opportunities, or unusual provisions, 5) Recommended actions or decisions needed",
  "contractType": "The type of contract (e.g., Service Agreement, NDA, MSA, SOW, Employment, Lease)",
  "contractTypeConfidence": number 0-100 indicating confidence in type classification,
  "parties": [{"name": "Party name", "role": "Client/Vendor/Contractor/etc", "address": "if mentioned", "jurisdiction": "Country/State if mentioned"}],
  "effectiveDate": "YYYY-MM-DD or null if not found",
  "expirationDate": "YYYY-MM-DD or null if not found",
  "totalValue": numeric value or 0 if not found,
  "currency": "USD/EUR/GBP/CHF/etc",
  "keyTerms": ["list", "of", "key", "terms", "or", "topics"],
  "jurisdiction": "Legal jurisdiction if mentioned",
  "governingLaw": "Applicable law/state",
  "definedTerms": [{"term": "Definition name", "definition": "Brief definition"}],
  "documentStructure": ["List of main sections/headings found"],
  "keyDates": [{"event": "Event name (signing, start, end, renewal, milestone)", "date": "YYYY-MM-DD", "description": "Brief description", "source": "Section/clause where found"}],
  "keyNumbers": [{"metric": "Metric name", "value": "Value with units", "context": "What this number represents", "source": "Section where found"}],
  "redFlags": [{"issue": "Description of concern", "severity": "high/medium/low", "location": "Where in the document", "recommendation": "What to do about it"}],
  "scopeOfWork": "Detailed description of what work/services/goods the contract covers (3-5 sentences minimum). Null if not applicable.",
  "termAndTermination": "Summary of contract duration, renewal terms, and termination rights (2-3 sentences)",
  "additionalFindings": [
    {
      "field": "Auto-discovered field name not in schema above",
      "value": "Extracted value",
      "sourceSection": "Section/location in document where found",
      "confidence": 0.85,
      "category": "legal|financial|operational|dates|parties|other"
    }
  ],
  "openEndedNotes": "Any other relevant observations, unusual terms, or important context not captured by the structured fields above. Include anything a contract reviewer should know."
}

${typeContext}

IMPORTANT EXTRACTION RULES:
1. Be thorough - scan the ENTIRE document for information.
2. Extract ALL parties mentioned, not just primary parties.
3. Look for dates in multiple formats (MM/DD/YYYY, DD.MM.YYYY, "January 1, 2024", "1st day of January").
4. For totalValue, include recurring costs multiplied by term length if applicable.
5. If you discover important information that doesn't fit the schema above, add it to additionalFindings. Never discard relevant contract details.
6. KeyNumbers should capture any significant metrics (headcount, quantities, limits, thresholds).
7. The executiveBriefing should be actionable - what would an executive need to know to make decisions?
8. The summary MUST be comprehensive (8-12 sentences) - this is the primary description users will see.
9. For every extracted fact, mentally verify it exists in the source text. Do NOT invent or assume information.
10. Include source section references where possible for traceability.

Contract text:
${truncatedText}`,

      CLAUSES: `Extract the key clauses from this contract. Return a JSON object with:
{
  "clauses": [
    {
      "title": "Clause title/name",
      "section": "Section number if available (e.g., 5.2)",
      "content": "Brief summary of what the clause says (2-3 sentences)",
      "fullText": "The verbatim clause text if short enough (under 500 chars)",
      "importance": "high/medium/low",
      "category": "${clauseCategories.split(', ').slice(0, 5).join('/')}",
      "obligations": ["List any specific obligations created"],
      "risks": ["Any risks or concerns with this clause"],
      "crossReferences": ["References to other sections/clauses"]
    }
  ],
  "missingClauses": ["Standard clauses NOT found that might be expected"],
  "unusualClauses": ["Any non-standard or unusual provisions"],
  "additionalFindings": [
    {
      "field": "Any clause-related info not fitting above schema",
      "value": "The extracted content",
      "sourceSection": "Section/location",
      "confidence": 0.85,
      "category": "legal|financial|operational|restriction|right|obligation"
    }
  ],
  "openEndedNotes": "Any other clause-related observations, cross-references, or dependencies between clauses not captured above."
}

${typeContext}

Find ALL significant clauses (aim for 5-20 clauses). Focus on:
${clauseCategories}

IMPORTANT: If you find clauses or provisions that don't fit the schema, add them to additionalFindings. Capture EVERYTHING relevant.
If a standard clause for this contract type is missing, note it in missingClauses.

Contract text:
${truncatedText}`,

      FINANCIAL: `Extract ALL financial terms from this contract comprehensively. Return a JSON object with:
{
  "totalValue": numeric value or 0 or null if not applicable,
  "currency": "USD/EUR/GBP/etc",
  "hasFinancialTerms": true/false - set false if this contract type typically has no financial terms (like NDAs),
  "paymentTerms": "Description of payment terms (e.g., Net 30, monthly, milestone-based)",
  "paymentSchedule": [{"milestone": "description", "amount": number, "dueDate": "date or trigger", "year": number}],
  "yearlyBreakdown": [
    {
      "year": 1,
      "label": "Year 1 (2024-2025)",
      "payments": [{"description": "Payment description", "amount": number, "dueDate": "date"}],
      "subtotal": number
    }
  ],
  "costBreakdown": [{"category": "name", "amount": number, "description": "details"}],
  "rateCards": [
    {
      "id": "rate-1",
      "role": "Job title or resource type (e.g., Senior Developer, Project Manager)",
      "rate": numeric hourly/daily/monthly rate,
      "unit": "hourly/daily/monthly/yearly",
      "currency": "USD/EUR/GBP"
    }
  ],
  "financialTables": [
    {
      "tableName": "Name/title of the pricing table",
      "headers": ["Column1", "Column2", "Amount"],
      "rows": [
        {"Column1": "value", "Column2": "value", "Amount": number}
      ],
      "totals": {"Column1": "Total", "Amount": number},
      "notes": "Any footnotes or additional info"
    }
  ],
  "offers": [
    {
      "offerName": "Name of offer/proposal",
      "validityPeriod": "How long the offer is valid",
      "totalAmount": number,
      "lineItems": [
        {"description": "item description", "quantity": 1, "unit": "each/hour/month", "unitPrice": number, "total": number}
      ],
      "terms": ["List of terms for this offer"]
    }
  ],
  "penalties": [
    {"type": "late_payment/breach/sla_violation", "amount": number, "description": "description", "trigger": "what triggers the penalty"}
  ],
  "discounts": [
    {"type": "early_payment/volume/loyalty", "value": number, "unit": "percentage/fixed", "description": "details"}
  ],
  "paymentMethod": "How payments should be made (wire, check, ACH, etc.)",
  "invoicingRequirements": "Any invoicing requirements mentioned",
  "contractTypeSpecificFinancials": {},
  "additionalFindings": [
    {
      "field": "Any financial info not fitting above schema (bonuses, royalties, escalations, caps, etc.)",
      "value": "The extracted value or description",
      "sourceSection": "Section/table where found",
      "confidence": 0.85,
      "category": "pricing|payment|penalty|incentive|cap|escalation|other"
    }
  ],
  "openEndedNotes": "Any other financial observations - hidden costs, unusual payment structures, financial risks, or pricing anomalies not captured above."
}

${typeContext}
${financialFieldsHint}

IMPORTANT EXTRACTION RULES:
1. If this is an NDA or similar non-financial contract, set hasFinancialTerms=false and skip financial extraction.
2. For EMPLOYMENT: Extract base salary, bonuses, equity grants, benefits value, severance.
3. For LEASE: Extract rent schedule, CAM charges, security deposit, tenant improvements.
4. For LICENSE/SUBSCRIPTION: Extract license fees, royalties, usage tiers.
5. For LOAN: Extract principal, interest rate, repayment schedule.
6. Group payments by contract year in yearlyBreakdown. Year 1 starts from contract effective date.
7. Extract ALL rate cards/pricing for labor, resources, or services.
8. Look for pricing tables - extract as financialTables with proper column headers.
9. For tables, preserve the structure with headers and row data.
10. **CRITICAL: If you find ANY financial information not fitting the schema, add it to additionalFindings. Never discard financial data.**

Contract text:
${truncatedText}`,

      RISK: `Analyze this contract for risks specific to its type. Return a JSON object with:
{
  "overallRisk": "Low/Medium/High/Critical",
  "riskScore": number from 0-100 (0=no risk, 100=extreme risk),
  "contractTypeRisks": "${profile.riskCategories.slice(0, 5).join(', ')}",
  "risks": [
    {
      "category": "Financial/Legal/Operational/Compliance/Reputational/ContractTypeSpecific",
      "level": "Low/Medium/High/Critical",
      "title": "Short risk title",
      "description": "Detailed description of the risk",
      "mitigation": "Suggested mitigation or action",
      "clauseReference": "Section/clause number where risk originates"
    }
  ],
  "redFlags": ["List any critical concerns or red flags"],
  "missingProtections": ["Standard protections for this contract type that are missing"],
  "recommendations": ["Key recommendations for negotiation or review"],
  "comparativeAnalysis": "How this contract compares to market standard for its type",
  "additionalFindings": [
    {
      "field": "Any risk-related finding not fitting above schema",
      "value": "Description of the risk or concern",
      "sourceSection": "Section/clause where found",
      "confidence": 0.85,
      "severity": "critical|high|medium|low"
    }
  ],
  "openEndedNotes": "Any other risk observations, potential disputes, enforceability concerns, or contextual risks not captured above."
}

${typeContext}
${riskCategoriesHint}

Look for:
- Unfavorable terms, one-sided clauses
- Missing protections (liability caps, termination rights)
- Contract-type-specific risks (see above)
- Compliance concerns (GDPR, regulatory)
- Financial risks (payment terms, penalties)
- Ambiguous language that could cause disputes
- **IMPORTANT: Any risk or concern not fitting the schema goes in additionalFindings**

Contract text:
${truncatedText}`,

      COMPLIANCE: `Review this contract for compliance requirements. Return a JSON object with:
{
  "compliant": true/false (overall assessment),
  "complianceScore": number from 0-100,
  "checks": [
    {
      "regulation": "Name of regulation/standard (GDPR, SOC2, HIPAA, etc)",
      "status": "compliant/non-compliant/needs-review/not-applicable",
      "details": "Brief explanation"
    }
  ],
  "issues": [
    {
      "severity": "high/medium/low",
      "description": "Description of the compliance issue",
      "recommendation": "How to address it"
    }
  ],
  "dataProtection": {
    "hasDataProcessing": true/false,
    "hasDPA": true/false,
    "concerns": ["any data protection concerns"]
  },
  "recommendations": ["List of compliance recommendations"],
  "additionalFindings": [
    {
      "field": "Any compliance-related finding not in schema",
      "value": "Description",
      "regulation": "Related regulation if any",
      "severity": "critical|high|medium|low"
    }
  ],
  "openEndedNotes": "Any other regulatory concerns, industry-specific compliance needs, or jurisdictional issues not captured above."
}

Contract text:
${truncatedText}`,

      OBLIGATIONS: `Extract all contractual obligations from this contract. Return a JSON object with:
{
  "obligations": [
    {
      "party": "Name of responsible party",
      "obligation": "Description of the obligation",
      "type": "deliverable/payment/reporting/compliance/performance",
      "dueDate": "Due date or trigger event if specified",
      "frequency": "one-time/daily/weekly/monthly/quarterly/annually/ongoing",
      "status": "pending/in-progress/completed/overdue",
      "priority": "high/medium/low"
    }
  ],
  "milestones": [
    {
      "name": "Milestone name",
      "description": "What needs to be delivered",
      "dueDate": "Date or timeframe",
      "associatedPayment": number or null,
      "status": "pending"
    }
  ],
  "keyDeadlines": ["List of critical deadlines mentioned"],
  "summary": "Brief summary of major obligations for each party",
  "additionalFindings": [
    {
      "field": "Any obligation not fitting the schema above",
      "value": "Description of the obligation",
      "party": "Responsible party",
      "dueInfo": "Timing or trigger if known",
      "category": "deliverable|payment|reporting|compliance|operational|other"
    }
  ],
  "openEndedNotes": "Any other obligation-related observations, dependencies between obligations, or conditional triggers not captured above."
}

Contract text:
${truncatedText}`,

      RENEWAL: `Analyze the renewal and termination terms of this contract. Return a JSON object with:
{
  "autoRenewal": true/false,
  "renewalTerms": "Description of how renewal works",
  "renewalPeriod": "Duration of renewal period (e.g., 1 year, 12 months)",
  "renewalNoticeRequired": true/false,
  "noticeRequirements": {
    "noticePeriod": "How many days before expiry",
    "noticeMethod": "How notice must be given (written, email, etc.)",
    "noticeRecipient": "Who to notify"
  },
  "terminationRights": {
    "forCause": "Conditions allowing termination for cause",
    "forConvenience": "Conditions for termination without cause",
    "noticePeriod": "Required notice for termination"
  },
  "earlyTerminationFees": "Any fees for early termination",
  "expirationDate": "Contract end date if specified",
  "renewalHistory": [],
  "recommendations": ["Recommendations for renewal strategy"],
  "additionalFindings": [
    {
      "field": "Any renewal/termination info not in schema",
      "value": "Description",
      "sourceSection": "Section where found",
      "category": "renewal|termination|extension|option|other"
    }
  ],
  "openEndedNotes": "Any other renewal/termination observations - special conditions, negotiation opportunities, or strategic considerations."
}

Contract text:
${truncatedText}`,

      NEGOTIATION_POINTS: `Identify negotiation points and areas for improvement in this contract. Return a JSON object with:
{
  "negotiationPoints": [
    {
      "clause": "Name or section of the clause",
      "currentTerms": "Current contract language or terms",
      "concern": "Why this might be problematic",
      "suggestedChange": "Recommended modification",
      "priority": "high/medium/low",
      "impact": "financial/legal/operational"
    }
  ],
  "favorabilityScore": number from 0-100 (0=very unfavorable, 100=very favorable),
  "favorabilityAssessment": "Overall assessment of contract favorability",
  "imbalances": ["List of terms that heavily favor one party"],
  "missingSprotections": ["Standard clauses or protections that are missing"],
  "strongPoints": ["Terms that are particularly favorable"],
  "recommendations": ["Top recommendations for negotiation"],
  "additionalFindings": [
    {
      "field": "Any negotiation-relevant finding not in schema",
      "value": "Description",
      "leverage": "strong|weak|neutral",
      "category": "pricing|terms|rights|obligations|other"
    }
  ],
  "openEndedNotes": "Any other negotiation insights - leverage points, counterparty pressures, market context, or strategic observations."
}

Contract text:
${truncatedText}`,

      AMENDMENTS: `Extract information about any amendments, addenda, or modifications to this contract. Return a JSON object with:
{
  "hasAmendments": true/false,
  "amendments": [
    {
      "number": "Amendment number or identifier",
      "date": "Date of amendment",
      "title": "Title or subject of amendment",
      "summary": "Brief description of changes",
      "affectedSections": ["List of sections modified"],
      "parties": ["Parties who signed"]
    }
  ],
  "changeHistory": [
    {
      "date": "Date of change",
      "type": "amendment/addendum/modification/side-letter",
      "description": "What was changed"
    }
  ],
  "originalContractDate": "Date of original contract if mentioned",
  "latestVersion": "Current version number if versioned",
  "summary": "Overview of contract modification history",
  "additionalFindings": [
    {
      "field": "Any amendment-related info not in schema",
      "value": "Description",
      "date": "Date if known",
      "category": "amendment|addendum|side-letter|modification|other"
    }
  ],
  "openEndedNotes": "Any other observations about the amendment history, superseded terms, or version conflicts."
}

Contract text:
${truncatedText}`,

      CONTACTS: `Extract all contact information, key personnel, and SIGNATURE STATUS from this contract. Return a JSON object with:
{
  "contacts": [
    {
      "name": "Full name",
      "role": "Job title or role",
      "organization": "Company name",
      "partyType": "client/vendor/witness/guarantor",
      "email": "Email address if provided",
      "phone": "Phone number if provided",
      "address": "Mailing address if provided",
      "isSignatory": true/false,
      "isPrimaryContact": true/false
    }
  ],
  "signatories": [
    {
      "name": "Name of signatory",
      "title": "Job title",
      "organization": "Company",
      "dateSigned": "Signature date if shown (YYYY-MM-DD format)",
      "isSigned": true/false - TRUE if actual signature/handwriting present, FALSE if signature line is blank/empty
    }
  ],
  "signatureStatus": "signed/partially_signed/unsigned/unknown",
  "signatureDate": "YYYY-MM-DD - the date the contract was signed (look for dates near signatures)",
  "signatureAnalysis": {
    "totalSignatureBlocks": "Number of signature blocks/lines found",
    "signedBlocks": "Number of blocks with actual signatures",
    "unsignedBlocks": "Number of empty/blank signature lines",
    "hasWitnessSignatures": true/false,
    "hasNotaryOrSeal": true/false,
    "executionLanguage": "Any 'IN WITNESS WHEREOF' or similar execution language found"
  },
  "noticeAddresses": [
    {
      "party": "Party name",
      "address": "Full notice address",
      "attention": "Attention to (if specified)"
    }
  ],
  "summary": "Overview of key contacts for contract management",
  "additionalFindings": [
    {
      "field": "Any contact-related info not in schema",
      "value": "Description",
      "contactType": "escalation|emergency|technical|billing|legal|other"
    }
  ],
  "openEndedNotes": "Any other contact observations - escalation procedures, preferred communication methods, or key relationship notes."
}

CRITICAL SIGNATURE STATUS DETECTION RULES:
- Look at the END of the document for signature blocks
- "signed" = ALL signature lines have actual signatures (handwritten marks, typed /s/ names with dates, or electronic signature indicators like DocuSign stamps)
- "partially_signed" = SOME but NOT ALL signature lines have signatures
- "unsigned" = NO signatures present, all signature lines are blank/empty (just lines like ______)
- "unknown" = Cannot find signature blocks or unclear if document requires signatures
- Look for: actual handwriting/cursive marks, "/s/ Name" typed signatures, dates written near signatures, "Signed:", "By:", electronic signature timestamps
- Empty lines like "________________________" or "Signature: _______" without marks = unsigned
- Names TYPED above/below signature lines are NOT signatures unless accompanied by "/s/" or actual handwriting

Contract text:
${truncatedText}`
    };

    // Add prompts for extended artifact types
    prompts['PARTIES'] = `Extract comprehensive party information from this contract. Return a JSON object with:
{
  "parties": [
    {
      "name": "Full legal entity name exactly as written in the contract",
      "role": "Client/Vendor/Contractor/Employer/Employee/Licensor/Licensee/Landlord/Tenant/etc",
      "type": "corporation/llc/partnership/individual/government/nonprofit/other",
      "address": "Full address if mentioned",
      "jurisdiction": "State/Country of incorporation or residence",
      "registrationNumber": "Company registration/tax ID if mentioned",
      "signatoryName": "Name of the person signing on behalf of this party",
      "signatoryTitle": "Title/role of the signatory",
      "contactInfo": {"email": "if mentioned", "phone": "if mentioned", "website": "if mentioned"},
      "obligations": ["Key obligations this party has under the contract"],
      "rights": ["Key rights this party has under the contract"],
      "source": "Section/clause where this party is first introduced"
    }
  ],
  "relationships": [
    {
      "partyA": "Name",
      "partyB": "Name",
      "relationship": "Description of the contractual relationship",
      "powerDynamic": "equal/partyA-dominant/partyB-dominant"
    }
  ],
  "thirdParties": [
    {
      "name": "Any third parties mentioned (subcontractors, beneficiaries, guarantors)",
      "role": "Their role in the contract",
      "source": "Where mentioned"
    }
  ],
  "guarantors": [{"name": "Guarantor name", "guaranteeScope": "What they guarantee"}],
  "additionalFindings": [{"field": "Party-related finding", "value": "Detail", "source": "Section"}],
  "openEndedNotes": "Any notable observations about party relationships, affiliates, or organizational structure."
}

${typeContext}

CRITICAL RULES:
1. Extract party names EXACTLY as written in the contract - do not paraphrase or abbreviate.
2. Every party field must reference where in the document the information was found.
3. Include ALL parties - primary, secondary, third-party beneficiaries, guarantors, agents.
4. Do NOT invent party information. If a field is not mentioned, use null.
5. Look carefully for "defined as" or "hereinafter referred to as" constructs.

Contract text:
${truncatedText}`;

    prompts['TIMELINE'] = `Extract a comprehensive timeline of all dates, deadlines, milestones, and temporal events from this contract. Return a JSON object with:
{
  "contractTimeline": {
    "executionDate": {"date": "YYYY-MM-DD or null", "source": "Section reference"},
    "effectiveDate": {"date": "YYYY-MM-DD or null", "source": "Section reference"},
    "expirationDate": {"date": "YYYY-MM-DD or null", "source": "Section reference"},
    "totalDuration": "Human-readable duration (e.g., '3 years', '36 months')",
    "renewalDates": [{"date": "YYYY-MM-DD", "description": "Renewal event", "source": "Section"}]
  },
  "milestones": [
    {
      "name": "Milestone name/description",
      "date": "YYYY-MM-DD or relative description (e.g., '30 days after effective date')",
      "type": "delivery/payment/review/approval/transition/go-live/other",
      "owner": "Which party is responsible",
      "dependencies": ["Any prerequisites"],
      "deliverables": ["What must be completed"],
      "consequences": "What happens if missed",
      "source": "Section/clause reference"
    }
  ],
  "deadlines": [
    {
      "description": "Deadline description",
      "date": "YYYY-MM-DD or relative",
      "type": "notice/filing/delivery/payment/response/other",
      "consequences": "What happens if deadline is missed",
      "source": "Section reference"
    }
  ],
  "paymentSchedule": [
    {
      "description": "Payment description",
      "amount": "Amount if specified",
      "dueDate": "YYYY-MM-DD or relative or recurring description",
      "frequency": "one-time/monthly/quarterly/annually/milestone-based/other",
      "source": "Section reference"
    }
  ],
  "noticePeriods": [
    {
      "type": "termination/renewal/breach/change/other",
      "period": "Duration (e.g., '30 days', '90 days')",
      "method": "How notice must be given",
      "source": "Section reference"
    }
  ],
  "criticalPath": ["Ordered list of the most important dates/events that determine the contract's lifecycle"],
  "additionalFindings": [{"field": "Timeline finding", "value": "Detail", "source": "Section"}],
  "openEndedNotes": "Any temporal observations, implied deadlines, or scheduling concerns."
}

${typeContext}

CRITICAL RULES:
1. Extract ALL dates mentioned anywhere in the contract, even in appendices.
2. Convert relative dates to absolute where possible (e.g., "30 days after January 1" = "January 31").
3. Always cite the source section for every date and deadline.
4. For recurring events, specify the frequency and first occurrence.
5. Do NOT invent dates. If a date is unclear, note the ambiguity.

Contract text:
${truncatedText}`;

    prompts['DELIVERABLES'] = `Extract all deliverables, work products, services, and outputs from this contract. Return a JSON object with:
{
  "deliverables": [
    {
      "name": "Deliverable name/title",
      "description": "Detailed description of what must be delivered (2-3 sentences)",
      "type": "document/software/service/report/hardware/training/milestone/other",
      "owner": "Which party is responsible for delivering",
      "recipient": "Which party receives the deliverable",
      "dueDate": "YYYY-MM-DD or relative or null",
      "acceptanceCriteria": ["List of acceptance criteria if specified"],
      "qualityStandards": ["Quality requirements or standards referenced"],
      "dependencies": ["Prerequisites or dependent deliverables"],
      "status": "defined/implied/conditional",
      "priority": "critical/high/medium/low",
      "source": "Section/clause where specified"
    }
  ],
  "servicelevels": [
    {
      "metric": "SLA metric name",
      "target": "Target value",
      "measurement": "How it's measured",
      "penalty": "Penalty for non-compliance",
      "source": "Section reference"
    }
  ],
  "acceptanceProcess": {
    "reviewPeriod": "Duration for review/acceptance",
    "approvalAuthority": "Who approves deliverables",
    "rejectionProcess": "What happens if deliverable is rejected",
    "disputes": "How disputes about acceptance are resolved"
  },
  "workBreakdown": ["High-level breakdown of work phases or streams if identifiable"],
  "exclusions": ["Explicitly excluded items or services"],
  "assumptions": ["Stated assumptions about deliverables"],
  "additionalFindings": [{"field": "Deliverable finding", "value": "Detail", "source": "Section"}],
  "openEndedNotes": "Any observations about deliverable scope, gaps, or ambiguities."
}

${typeContext}

CRITICAL RULES:
1. Extract EVERY deliverable mentioned, including those in appendices, SOWs, and schedules.
2. Distinguish between explicitly defined and implied deliverables.
3. Note acceptance criteria and quality standards where specified.
4. Capture dependencies between deliverables.
5. Do NOT invent deliverables. Only extract what is explicitly or clearly implied in the text.

Contract text:
${truncatedText}`;

    prompts['EXECUTIVE_SUMMARY'] = `Generate a comprehensive executive summary of this contract suitable for senior leadership review. Return a JSON object with:
{
  "headline": "One-line headline capturing the essence of the contract (< 100 chars)",
  "strategicSummary": "A 3-4 paragraph strategic summary (400-600 words) covering: 1) Purpose and scope of the agreement, 2) Business context and strategic value, 3) Key commercial terms and financial impact, 4) Risk profile and recommended actions",
  "keyMetrics": {
    "totalContractValue": "Total value with currency",
    "contractDuration": "Duration in human-readable format",
    "keyDeadlines": ["Most important dates/deadlines"],
    "numberOfParties": number,
    "numberOfDeliverables": number or "N/A"
  },
  "businessImpact": {
    "revenueImpact": "Description of revenue/cost implications",
    "operationalImpact": "How this affects operations",
    "strategicAlignment": "How this aligns with business objectives (if inferrable)",
    "resourceRequirements": "Key resources or commitments needed"
  },
  "riskProfile": {
    "overallRisk": "low/medium/high/critical",
    "topRisks": [
      {
        "risk": "Risk description",
        "severity": "high/medium/low",
        "mitigation": "Suggested mitigation or existing protection",
        "source": "Section reference"
      }
    ],
    "missingProtections": ["Standard protections not found in this contract"]
  },
  "recommendedActions": [
    {
      "action": "What needs to be done",
      "priority": "immediate/short-term/long-term",
      "owner": "Who should take this action",
      "rationale": "Why this action is recommended"
    }
  ],
  "negotiationInsights": {
    "favorability": "Score 1-10, 1=heavily favors counterparty, 10=heavily favors our side",
    "leveragePoints": ["Areas where we have negotiation leverage"],
    "concessions": ["Areas where concessions were made"],
    "improvementOpportunities": ["Terms that could be improved in future negotiations"]
  },
  "additionalFindings": [{"field": "Finding", "value": "Detail", "source": "Section"}],
  "openEndedNotes": "Any strategic observations, concerns, or opportunities not captured above."
}

${typeContext}

CRITICAL RULES:
1. The strategicSummary must be comprehensive (400-600 words) - this is the primary document executives will read.
2. Focus on business impact and actionable insights, not legal jargon.
3. Every risk and recommendation must cite its source in the contract.
4. Be specific about numbers, dates, and obligations - avoid vague language.
5. Do NOT invent information. Base all analysis solely on what appears in the contract text.
6. The headline should be memorable and capture the deal's significance.

Contract text:
${truncatedText}`;

    const prompt = prompts[type];
    if (!prompt) {
      logger.warn({ type }, 'Unknown artifact type, using fallback');
      return getFallbackArtifact(type, contractText, contract);
    }

    const systemPrompt = `You are an expert contract analyst with deep legal and commercial expertise. Analyze contracts and return ONLY valid JSON (no markdown, no explanation, no code fences).

ANTI-HALLUCINATION RULES (CRITICAL):
1. ONLY extract information that is explicitly stated in the contract text. Do NOT infer, assume, or fabricate any data.
2. If a field cannot be determined from the text, use null or an empty array — NEVER guess.
3. For dates: only extract dates that appear verbatim in the text. Do not calculate or estimate dates.
4. For monetary values: only extract amounts explicitly stated. Do not calculate totals unless the math is straightforward from stated figures.
5. For party names: use the EXACT legal names as written in the contract.
6. For clauses and provisions: quote or closely paraphrase the actual text. Do not rephrase in ways that change meaning.
7. Confidence scores must honestly reflect certainty. If you're unsure, score below 70.

OUTPUT QUALITY RULES:
1. Be thorough — scan the ENTIRE provided text, including headers, footers, appendices, and exhibits.
2. Prefer completeness over brevity. It is better to include too much detail than too little.
3. Summaries should be substantive and specific, not generic boilerplate.
4. Use precise language. Replace vague terms like "various" or "certain" with specifics from the text.`;
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
      estimatedCost: estimateTokenCost(usedProvider, tokenUsage.promptTokens || 0, tokenUsage.completionTokens || 0),
    };

    logger.info({ type, provider: usedProvider, tokensUsed: tokenUsage.tokensUsed || 0 }, 'Successfully generated artifact with AI');
    return artifactData;

  } catch (error) {
    logger.error({ error, type }, 'AI artifact generation failed unexpectedly, using fallback');
    return getFallbackArtifact(type, contractText, contract);
  }
}

/**
 * Estimate token cost in USD based on model pricing (approximate, as of 2025)
 */
function estimateTokenCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o':       { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
    'gpt-4o-mini':  { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
    'gpt-4-turbo':  { input: 10.00 / 1_000_000, output: 30.00 / 1_000_000 },
    'mistral-large-latest': { input: 2.00 / 1_000_000, output: 6.00 / 1_000_000 },
  };
  const rate = pricing[model] || pricing['gpt-4o'];
  return Number(((promptTokens * rate.input) + (completionTokens * rate.output)).toFixed(6));
}

/**
 * Fallback artifact templates when AI is unavailable
 */
function getFallbackArtifact(type: string, contractText: string, contract: any): Record<string, any> {
  const artifactTemplates: Record<string, any> = {
    OVERVIEW: {
      summary: `Contract uploaded: ${contract.fileName || contract.contractTitle || 'Unknown'}. AI analysis unavailable - please review manually.`,
      contractType: contract.contractType || 'Unknown',
      parties: (() => {
        // Start with DB fields
        const p = [contract.clientName, contract.supplierName].filter(Boolean).map((name: string) => ({ name, role: 'Party' }));
        // If empty, try to extract from contract text using common patterns
        if (p.length === 0 && contractText && contractText.length > 50) {
          const betweenMatch = contractText.match(
            /(?:between|by and between|entered into by)\s+([A-Z][A-Za-z0-9\s&,.'()\-]{2,80}?)\s*(?:\(.*?\))?\s*(?:,?\s*(?:and|&)\s+)([A-Z][A-Za-z0-9\s&,.'()\-]{2,80}?)\s*(?:\(|,|\n)/i
          );
          if (betweenMatch) {
            p.push({ name: betweenMatch[1].trim(), role: 'Party A' });
            p.push({ name: betweenMatch[2].trim(), role: 'Party B' });
          } else {
            const clientMatch = contractText.match(/(?:Client|Buyer|Customer)\s*[:.]\s*(.+?)(?:\n|$)/i);
            const supplierMatch = contractText.match(/(?:Service Provider|Vendor|Supplier|Provider|Contractor)\s*[:.]\s*(.+?)(?:\n|$)/i);
            if (clientMatch) p.push({ name: clientMatch[1].replace(/[,;]+$/, '').trim(), role: 'Client' });
            if (supplierMatch) p.push({ name: supplierMatch[1].replace(/[,;]+$/, '').trim(), role: 'Service Provider' });
          }
        }
        return p;
      })(),
      effectiveDate: contract.effectiveDate?.toISOString() || null,
      expirationDate: contract.expirationDate?.toISOString() || null,
      totalValue: contract.totalValue || 0,
      currency: contract.currency || 'USD',
      keyTerms: [],
      extractedLength: contractText.length,
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    CLAUSES: {
      clauses: [],
      _meta: { fallback: true, reason: 'AI unavailable', message: 'Clause extraction requires AI analysis' }
    },
    FINANCIAL: {
      totalValue: contract.totalValue || 0,
      currency: contract.currency || 'USD',
      paymentTerms: 'Not analyzed',
      paymentSchedule: [],
      yearlyBreakdown: [],
      costBreakdown: [],
      paymentMethod: null,
      invoicingRequirements: null,
      analysis: 'Financial analysis requires AI - please configure OPENAI_API_KEY',
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    RISK: {
      overallRisk: 'Unknown',
      riskScore: 50,
      risks: [],
      redFlags: [],
      recommendations: ['Configure AI analysis for proper risk assessment'],
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    COMPLIANCE: {
      compliant: null,
      complianceScore: null,
      checks: [],
      issues: [],
      recommendations: ['Configure AI analysis for compliance review'],
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    OBLIGATIONS: {
      obligations: [],
      milestones: [],
      keyDeadlines: [],
      summary: 'Obligation extraction requires AI - please configure OPENAI_API_KEY',
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    RENEWAL: {
      autoRenewal: null,
      renewalTerms: 'Not analyzed',
      renewalPeriod: null,
      renewalNoticeRequired: null,
      noticeRequirements: null,
      terminationRights: null,
      earlyTerminationFees: null,
      expirationDate: contract.expirationDate?.toISOString() || null,
      renewalHistory: [],
      recommendations: ['Configure AI analysis for renewal terms extraction'],
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    NEGOTIATION_POINTS: {
      negotiationPoints: [],
      favorabilityScore: 50,
      favorabilityAssessment: 'AI analysis required',
      imbalances: [],
      missingProtections: [],
      strongPoints: [],
      recommendations: ['Configure AI analysis for negotiation points'],
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    AMENDMENTS: {
      hasAmendments: false,
      amendments: [],
      changeHistory: [],
      originalContractDate: null,
      latestVersion: null,
      summary: 'Amendment extraction requires AI analysis',
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    CONTACTS: {
      contacts: [],
      signatories: [],
      noticeAddresses: [],
      summary: 'Contact extraction requires AI analysis',
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    PARTIES: {
      parties: [],
      relationships: [],
      thirdParties: [],
      guarantors: [],
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    TIMELINE: {
      contractTimeline: { executionDate: null, effectiveDate: null, expirationDate: null, totalDuration: null },
      milestones: [],
      deadlines: [],
      paymentSchedule: [],
      noticePeriods: [],
      criticalPath: [],
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    DELIVERABLES: {
      deliverables: [],
      servicelevels: [],
      acceptanceProcess: null,
      workBreakdown: [],
      exclusions: [],
      assumptions: [],
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
    EXECUTIVE_SUMMARY: {
      headline: null,
      strategicSummary: null,
      keyMetrics: {},
      businessImpact: {},
      riskProfile: { overallRisk: 'Unknown', topRisks: [], missingProtections: [] },
      recommendedActions: [],
      _meta: { fallback: true, reason: 'AI unavailable' }
    },
  };

  return artifactTemplates[type] || { type, generated: true, timestamp: new Date(), _meta: { fallback: true } };
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
    mistral: mistralCircuitBreaker.getMetrics(),
    azure: azureCircuitBreaker.getMetrics(),
    storage: storageCircuitBreaker.getMetrics(),
  };
}

/**
 * Reset circuit breakers (for testing or manual intervention)
 */
export function resetCircuitBreakers() {
  mistralCircuitBreaker.reset();
  azureCircuitBreaker.reset();
  storageCircuitBreaker.reset();
  logger.info('All circuit breakers reset');
}

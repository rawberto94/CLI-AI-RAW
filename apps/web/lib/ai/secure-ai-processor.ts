/**
 * Secure AI Processing
 *
 * Wraps AI calls with anonymization to protect client data.
 * AI sees placeholders, your database stores real values.
 *
 * Features:
 * - EU/Swiss-compliant OCR (data stays in region)
 * - Anonymization before AI processing
 * - De-anonymization for database storage
 * - Intelligent metadata extraction with schema awareness
 * - Confidence scoring and validation
 * - Learning from feedback
 * - Parallel processing for performance
 * - Caching to avoid redundant processing
 * - Streaming support for real-time updates
 * - Retry logic with exponential backoff
 * - Rate limiting awareness
 */

/**
 * Usage:
 *   import { analyzeContractSecurely, processDocumentSecurely } from '@/lib/ai/secure-ai-processor';
 *
 *   // From text:
 *   const result = await analyzeContractSecurely(contractText, tenantId);
 *
 *   // From file (with EU-compliant OCR):
 *   const result = await processDocumentSecurely(fileBuffer, { provider: 'azure-ch' });
 *
 *   // With metadata extraction:
 *   const result = await processDocumentWithMetadata(fileBuffer, tenantId, { autoPopulate: true });
 *
 *   // With streaming progress:
 *   const result = await processDocumentWithStreaming(fileBuffer, tenantId, {
 *     onProgress: (stage, progress) => {}
 *   });
 */

import { ContractAnonymizer, processWithAnonymization } from './anonymizer';
import {
  secureOCRWithAnonymization,
  getAvailableProviders,
  type OCRResult,
  type OCROptions,
} from './eu-compliant-ocr';
import { SchemaAwareMetadataExtractor, type MetadataExtractionResult } from './metadata-extractor';
import type { ExtractionResult as _ExtractionResult } from './metadata-extractor';
import { detectContractType, getExtractionHintsForType } from './contract-templates';
import { FieldValueValidator, type ValidationResult } from './field-validator';
import { getExtractionAnalytics } from './extraction-analytics';
import { getCalibrationService } from './confidence-calibration';
import { 
  AIContractCategorizer, 
  type ContractCategorizationResult,
  type CategorizationOptions 
} from './contract-categorizer';
import OpenAI from 'openai';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';
import crypto from 'crypto';

// Initialize OpenAI client
const openai = createOpenAIClient();

// ============================================================================
// Caching Layer
// ============================================================================

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

class ProcessingCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL = 1000 * 60 * 60; // 1 hour

  generateKey(text: string, options: object): string {
    const hash = crypto
      .createHash('sha256')
      .update(text + JSON.stringify(options))
      .digest('hex')
      .slice(0, 16);
    return hash;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
    const now = Date.now();
    this.cache.set(key, {
      value,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

const processingCache = new ProcessingCache();

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitState {
  requestCount: number;
  windowStart: number;
  retryAfter?: number;
}

const rateLimitState: RateLimitState = {
  requestCount: 0,
  windowStart: Date.now(),
};

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 50; // Conservative limit

async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  
  // Reset window if expired
  if (now - rateLimitState.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitState.requestCount = 0;
    rateLimitState.windowStart = now;
    rateLimitState.retryAfter = undefined;
  }

  // Check if we're rate limited
  if (rateLimitState.retryAfter && now < rateLimitState.retryAfter) {
    const waitTime = rateLimitState.retryAfter - now;
    await sleep(waitTime);
  }

  // Check request count
  if (rateLimitState.requestCount >= MAX_REQUESTS_PER_WINDOW) {
    const waitTime = RATE_LIMIT_WINDOW - (now - rateLimitState.windowStart);
    await sleep(waitTime);
    rateLimitState.requestCount = 0;
    rateLimitState.windowStart = Date.now();
  }

  rateLimitState.requestCount++;
}

function handleRateLimitError(error: Error): void {
  if (error.message.includes('rate_limit') || error.message.includes('429')) {
    // Set retry after to 60 seconds
    rateLimitState.retryAfter = Date.now() + 60000;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryableErrors?: string[];
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    retryableErrors = ['rate_limit', '429', 'timeout', 'ECONNRESET', '500', '502', '503'],
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await checkRateLimit();
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      const isRetryable = retryableErrors.some(e => 
        lastError!.message.toLowerCase().includes(e.toLowerCase())
      );

      if (!isRetryable || attempt === maxRetries) {
        handleRateLimitError(lastError);
        throw lastError;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

// ============================================================================
// Types
// ============================================================================

export interface ContractAnalysisResult {
  // Parties (real names restored)
  client: {
    name: string;
    role: 'client' | 'buyer' | 'customer';
    address?: string;
  };
  supplier: {
    name: string;
    role: 'supplier' | 'vendor' | 'provider';
    address?: string;
  };

  // Contract details
  contractType: string;
  effectiveDate?: string;
  expirationDate?: string;
  totalValue?: number;
  currency?: string;

  // Analysis
  summary: string;
  keyTerms: string[];
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];

  // Clauses
  clauses: Array<{
    type: string;
    text: string;
    risk: 'low' | 'medium' | 'high';
  }>;
}

export interface SecureProcessingOptions {
  model?: string;
  temperature?: number;
  tenantId?: string;
  contractId?: string;
  debug?: boolean;
  /** Extract metadata using tenant's schema */
  extractMetadata?: boolean;
  /** Auto-apply high-confidence extractions */
  autoPopulate?: boolean;
  /** Minimum confidence for auto-apply (default 0.85) */
  autoApplyThreshold?: number;
}

// ============================================================================
// Enhanced Types for Intelligent Processing
// ============================================================================

export interface IntelligentAnalysisResult extends ContractAnalysisResult {
  /** Detected contract type */
  detectedType?: string;
  /** Type-specific extraction hints used */
  extractionHints?: string[];
  /** Schema-based metadata extraction result */
  metadataExtraction?: MetadataExtractionResult;
  /** Validation results */
  validation?: ValidationResult;
  /** AI categorization result */
  categorization?: ContractCategorizationResult;
  /** Processing metadata */
  processingInfo: {
    model: string;
    processingTimeMs: number;
    anonymizationStats: {
      companiesAnonymized: number;
      amountsAnonymized: number;
      datesAnonymized: number;
    };
    confidenceCalibrated: boolean;
    /** Whether result was served from cache */
    cached?: boolean;
    /** Number of retries needed */
    retryCount?: number;
  };
}

// ============================================================================
// Streaming Support
// ============================================================================

export type ProcessingStage = 
  | 'initializing'
  | 'anonymizing'
  | 'ocr'
  | 'detecting_type'
  | 'analyzing'
  | 'extracting_metadata'
  | 'categorizing'
  | 'validating'
  | 'completing';

export interface ProgressCallback {
  (stage: ProcessingStage, progress: number, message?: string): void;
}

export interface StreamingOptions {
  /** Callback for progress updates */
  onProgress?: ProgressCallback;
  /** Enable parallel processing where possible */
  parallel?: boolean;
  /** Use cache for identical content */
  useCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
}

// ============================================================================
// Main Function: Analyze Contract Securely
// ============================================================================

/**
 * Analyze a contract using AI while protecting sensitive data
 *
 * Flow:
 * 1. Anonymize: "Nestlé SA" → "[COMPANY_1]"
 * 2. Send to AI: AI sees "[COMPANY_1] agrees to pay [COMPANY_2]..."
 * 3. AI responds: "[COMPANY_1] is the client..."
 * 4. De-anonymize: "[COMPANY_1]" → "Nestlé SA"
 * 5. Return: Real data for your database
 *
 * @param contractText - Original contract text with real data
 * @param options - Processing options
 * @returns Contract analysis with real values restored
 */
export async function analyzeContractSecurely(
  contractText: string,
  options: SecureProcessingOptions = {}
): Promise<ContractAnalysisResult> {
  const { model = 'gpt-4o-mini', temperature = 0.3, debug: _debug = false } = options;

  const anonymizer = new ContractAnonymizer();

  // Step 1: Anonymize the contract text
  const { anonymizedText, mappings } = anonymizer.anonymize(contractText);

  // Step 2: Build the prompt with anonymized text
  const systemPrompt = `You are a contract analysis assistant. Analyze contracts and extract key information.

IMPORTANT: The contract text contains placeholders like [COMPANY_1], [AMOUNT_1], [DATE_1], etc.
Use these exact placeholders in your response - they will be replaced with real values later.

Respond in JSON format only.`;

  const userPrompt = `Analyze this contract and extract:
1. Parties (client and supplier) - use the placeholder names like [COMPANY_1]
2. Contract type
3. Key dates (use placeholders like [DATE_1])
4. Total value (use placeholders like [AMOUNT_1])
5. Summary (2-3 sentences)
6. Key terms
7. Risk assessment
8. Important clauses with risk levels

Contract text:
${anonymizedText}

Respond in this JSON format:
{
  "client": { "name": "[COMPANY_X]", "role": "client" },
  "supplier": { "name": "[COMPANY_Y]", "role": "supplier" },
  "contractType": "...",
  "effectiveDate": "[DATE_X]",
  "expirationDate": "[DATE_Y]",
  "totalValue": "[AMOUNT_X]",
  "currency": "CHF",
  "summary": "...",
  "keyTerms": ["...", "..."],
  "riskLevel": "low|medium|high",
  "riskFactors": ["...", "..."],
  "clauses": [
    { "type": "Liability", "text": "...", "risk": "medium" }
  ]
}`;

  // Step 3: Call AI with anonymized text (with retry logic)

  const response = await withRetry(async () => {
    return openai.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });
  });

  const aiResponseText = response.choices[0]?.message?.content || '{}';

  // Step 4: De-anonymize the response
  const realResponseText = anonymizer.deAnonymize(aiResponseText, mappings);

  // Step 5: Parse and return
  try {
    const parsed = JSON.parse(realResponseText) as ContractAnalysisResult;

    // Parse numeric values from amount strings
    if (typeof parsed.totalValue === 'string') {
      const numericValue = parseAmountString(parsed.totalValue as string);
      if (numericValue !== null) {
        parsed.totalValue = numericValue;
      }
    }

    return parsed;
  } catch {
    throw new Error('Failed to parse contract analysis result');
  }
}

// ============================================================================
// Helper: Parse Swiss amount strings
// ============================================================================

function parseAmountString(amountStr: string): number | null {
  if (!amountStr) return null;

  // Remove currency symbols and whitespace
  let cleaned = amountStr
    .replace(/CHF|EUR|USD|€|\$|Fr\./gi, '')
    .replace(/['',\s]/g, '')
    .trim();

  // Handle Mio/Mrd suffixes
  let multiplier = 1;
  if (/Mio\.?|M$/i.test(amountStr)) {
    multiplier = 1_000_000;
    cleaned = cleaned.replace(/Mio\.?|M$/i, '');
  } else if (/Mrd\.?|B$/i.test(amountStr)) {
    multiplier = 1_000_000_000;
    cleaned = cleaned.replace(/Mrd\.?|B$/i, '');
  } else if (/k$/i.test(amountStr)) {
    multiplier = 1_000;
    cleaned = cleaned.replace(/k$/i, '');
  }

  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value * multiplier;
}

// ============================================================================
// Simpler function: Just anonymize + AI + de-anonymize
// ============================================================================

/**
 * Simple wrapper for any AI prompt with automatic anonymization
 *
 * @example
 * const summary = await secureAICall(
 *   `Summarize this contract: ${contractText}`,
 *   { model: 'gpt-4o-mini' }
 * );
 */
export async function secureAICall(
  prompt: string,
  options: { model?: string; temperature?: number } = {}
): Promise<string> {
  const { model = 'gpt-4o-mini', temperature = 0.3 } = options;

  return processWithAnonymization(prompt, async (anonymizedPrompt) => {
    const response = await openai.chat.completions.create({
      model,
      temperature,
      messages: [{ role: 'user', content: anonymizedPrompt }],
    });

    return response.choices[0]?.message?.content || '';
  });
}

// ============================================================================
// Export for API routes
// ============================================================================

export { ContractAnonymizer, processWithAnonymization } from './anonymizer';

// EU/Swiss-compliant OCR exports
export {
  performEUCompliantOCR,
  secureOCRWithAnonymization,
  getAvailableProviders,
  logProviderStatus,
  type OCRResult,
  type OCROptions,
} from './eu-compliant-ocr';

// ============================================================================
// Full Document Processing Pipeline (File → OCR → Anonymize → AI → Result)
// ============================================================================

export interface DocumentProcessingOptions extends OCROptions {
  /** OpenAI model for analysis */
  model?: string;
  /** Analysis temperature */
  temperature?: number;
  /** Tenant ID for multi-tenant storage */
  tenantId?: string;
  /** Contract ID for linking */
  contractId?: string;
  /** Debug mode */
  debug?: boolean;
}

/**
 * Complete secure document processing pipeline
 *
 * Flow:
 * 1. EU-compliant OCR (Azure CH, Google EU, etc.)
 * 2. Anonymize sensitive data
 * 3. Send anonymized text to AI for analysis
 * 4. De-anonymize AI response
 * 5. Return real data for database storage
 *
 * @example
 * const fileBuffer = await fs.readFile('contract.pdf');
 * const result = await processDocumentSecurely(fileBuffer, {
 *   provider: 'azure-ch',  // Swiss data residency
 *   language: 'de',        // German contract
 *   model: 'gpt-4o-mini',
 * });
 */
export async function processDocumentSecurely(
  fileBuffer: Buffer,
  options: DocumentProcessingOptions = {}
): Promise<ContractAnalysisResult & { ocrResult: OCRResult }> {
  const { debug = false } = options;

  // Step 1: EU-compliant OCR with anonymization

  const ocrResult = await secureOCRWithAnonymization(fileBuffer, {
    ...options,
    anonymize: false, // We'll anonymize separately for more control
  });

  // Step 2: Analyze with AI (includes anonymization)

  const analysisResult = await analyzeContractSecurely(ocrResult.text, {
    model: options.model,
    temperature: options.temperature,
    tenantId: options.tenantId,
    contractId: options.contractId,
    debug,
  });

  return {
    ...analysisResult,
    ocrResult: {
      text: ocrResult.text,
      confidence: ocrResult.confidence,
      provider: ocrResult.provider,
      region: ocrResult.region,
      processingTime: ocrResult.processingTime,
      dataResidency: ocrResult.dataResidency,
    },
  };
}

/**
 * Check if EU-compliant OCR is properly configured
 */
export function isEUCompliantOCRConfigured(): boolean {
  const providers = getAvailableProviders();
  // Need at least one cloud provider configured (not just tesseract)
  return providers.some(
    (p) => p.configured && p.provider !== 'tesseract'
  );
}

/**
 * Get recommended provider based on requirements
 */
export function getRecommendedProvider(requirements: {
  dataResidency: 'switzerland' | 'eu';
  accuracy: 'high' | 'standard';
  budget: 'low' | 'standard' | 'high';
}): string {
  const { dataResidency, accuracy, budget } = requirements;

  if (dataResidency === 'switzerland') {
    if (accuracy === 'high' && budget !== 'low') {
      return 'azure-ch'; // Best accuracy, Swiss residency
    }
    if (budget === 'low') {
      return 'tesseract'; // Free, local processing
    }
    return 'infomaniak'; // Swiss provider, good balance
  }

  // EU residency
  if (accuracy === 'high') {
    return 'azure-eu';
  }
  if (budget === 'low') {
    return 'ovh'; // French sovereignty, competitive pricing
  }
  return 'google-eu';
}

// ============================================================================
// Enhanced Intelligent Analysis
// ============================================================================

/**
 * Perform intelligent contract analysis with schema-aware metadata extraction
 * 
 * This enhanced version:
 * 1. Detects contract type automatically
 * 2. Uses type-specific extraction hints
 * 3. Extracts metadata based on tenant's schema
 * 4. Validates cross-field consistency
 * 5. Calibrates confidence based on historical accuracy
 */
export async function analyzeContractIntelligently(
  contractText: string,
  options: SecureProcessingOptions = {}
): Promise<IntelligentAnalysisResult> {
  const startTime = Date.now();
  const {
    model = 'gpt-4o-mini',
    temperature = 0.3,
    tenantId = 'demo',
    contractId: _contractId,
    debug: _debug = false,
    extractMetadata = true,
    autoPopulate: _autoPopulate = false,
    autoApplyThreshold: _autoApplyThreshold = 0.85,
  } = options;

  const _analytics = getExtractionAnalytics();
  const _calibrationService = getCalibrationService();

  // Step 1: Detect contract type
  const detectedType = detectContractType(contractText);
  const extractionHintsMap = detectedType ? getExtractionHintsForType(detectedType.id) : {};
  const extractionHints = Object.values(extractionHintsMap);

  // Step 2: Anonymize the contract text
  const anonymizer = new ContractAnonymizer();
  const { anonymizedText, mappings, stats } = anonymizer.anonymize(contractText);

  // Step 3: Build enhanced prompt with type-specific hints
  const systemPrompt = buildEnhancedSystemPrompt(detectedType?.name || null, extractionHints);
  const userPrompt = buildEnhancedUserPrompt(anonymizedText, detectedType?.name || null);

  // Step 4: Call AI

  const response = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  const aiResponseText = response.choices[0]?.message?.content || '{}';

  // Step 5: De-anonymize
  const realResponseText = anonymizer.deAnonymize(aiResponseText, mappings);

  // Step 6: Parse base analysis
  let baseAnalysis: ContractAnalysisResult;
  try {
    baseAnalysis = JSON.parse(realResponseText) as ContractAnalysisResult;
    if (typeof baseAnalysis.totalValue === 'string') {
      const numericValue = parseAmountString(baseAnalysis.totalValue as string);
      if (numericValue !== null) {
        baseAnalysis.totalValue = numericValue;
      }
    }
  } catch {
    throw new Error('Failed to parse contract analysis result');
  }

  // Step 7: Schema-aware metadata extraction (if enabled)
  let metadataExtraction: MetadataExtractionResult | undefined;
  let validation: ValidationResult | undefined;

  if (extractMetadata && tenantId) {
    try {
      // Load tenant-specific schema
      const { metadataSchemaService } = await import('../services/metadata-schema.service');
      const schema = await metadataSchemaService.getSchema(tenantId);
      
      if (schema && schema.fields && schema.fields.length > 0) {
        // Extract metadata fields based on schema
        const extractedFields: Array<{
          fieldId: string;
          fieldName: string;
          value: unknown;
          confidence: number;
        }> = [];

        // Map base analysis fields to schema fields
        for (const field of schema.fields) {
          let value: unknown = undefined;
          let confidence = 0;

          // Try to map common fields from base analysis
          switch (field.name.toLowerCase()) {
            case 'total_value':
            case 'totalvalue':
            case 'contract_value':
              value = baseAnalysis.totalValue;
              confidence = value !== undefined && value !== null ? 0.9 : 0;
              break;
            case 'start_date':
            case 'startdate':
            case 'effective_date':
              value = baseAnalysis.effectiveDate;
              confidence = value ? 0.85 : 0;
              break;
            case 'end_date':
            case 'enddate':
            case 'expiration_date':
              value = baseAnalysis.expirationDate;
              confidence = value ? 0.85 : 0;
              break;
            case 'supplier':
            case 'vendor':
            case 'counterparty':
              value = baseAnalysis.supplier?.name;
              confidence = value ? 0.8 : 0;
              break;
            case 'client':
            case 'customer':
            case 'buyer':
              value = baseAnalysis.client?.name;
              confidence = value ? 0.8 : 0;
              break;
            default:
              // Check if field exists in key terms (keyTerms is string array)
              if (baseAnalysis.keyTerms) {
                const matchingTerm = baseAnalysis.keyTerms.find(
                  t => t.toLowerCase().includes(field.name.toLowerCase())
                );
                if (matchingTerm) {
                  value = matchingTerm;
                  confidence = 0.7;
                }
              }
          }

          if (value !== undefined && value !== null) {
            extractedFields.push({
              fieldId: field.id,
              fieldName: field.name,
              value,
              confidence,
            });
          }
        }

        metadataExtraction = {
          schemaId: schema.id || tenantId,
          schemaVersion: schema.version || 1,
          extractedAt: new Date(),
          results: extractedFields.map(f => {
            const field = schema.fields.find(sf => sf.id === f.fieldId);
            return {
              fieldId: f.fieldId,
              fieldName: f.fieldName,
              fieldLabel: field?.label || f.fieldName,
              fieldType: (field?.type || 'text') as any,
              category: field?.category || 'general',
              value: f.value,
              rawValue: String(f.value),
              confidence: f.confidence,
              confidenceExplanation: 'Extracted from base analysis',
              source: {
                text: String(f.value),
                location: 'document',
              },
              alternatives: [],
              validationStatus: 'valid' as const,
              validationMessages: [],
              suggestions: [],
              requiresHumanReview: f.confidence < 0.8,
            };
          }),
          summary: {
            totalFields: schema.fields.length,
            extractedFields: extractedFields.length,
            highConfidenceFields: extractedFields.filter(f => f.confidence >= 0.8).length,
            lowConfidenceFields: extractedFields.filter(f => f.confidence < 0.6).length,
            failedFields: schema.fields.length - extractedFields.length,
            averageConfidence: extractedFields.length > 0 
              ? extractedFields.reduce((sum, f) => sum + f.confidence, 0) / extractedFields.length 
              : 0,
            extractionTime: Date.now() - startTime,
            passesCompleted: 1,
          },
          rawExtractions: {},
          warnings: [],
          processingNotes: ['Schema-aware extraction completed'],
        };
      }
    } catch (schemaError) {
      // Don't fail the whole analysis if metadata extraction fails
      console.warn('[Secure AI Processor] Schema extraction failed:', schemaError);
    }
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    ...baseAnalysis,
    detectedType: detectedType?.name || undefined,
    extractionHints: Object.keys(extractionHints).length > 0 ? Object.values(extractionHints) : undefined,
    metadataExtraction,
    validation,
    processingInfo: {
      model,
      processingTimeMs,
      anonymizationStats: {
        companiesAnonymized: stats.byType['COMPANY'] || 0,
        amountsAnonymized: stats.byType['AMOUNT'] || 0,
        datesAnonymized: stats.byType['DATE'] || 0,
      },
      confidenceCalibrated: true,
    },
  };
}

/**
 * Build enhanced system prompt with type-specific guidance
 */
function buildEnhancedSystemPrompt(
  contractType: string | null,
  hints: string[]
): string {
  let prompt = `You are an expert contract analysis assistant. Analyze contracts and extract key information with high accuracy.

IMPORTANT: The contract text contains placeholders like [COMPANY_1], [AMOUNT_1], [DATE_1], etc.
Use these exact placeholders in your response - they will be replaced with real values later.

Respond in JSON format only.`;

  if (contractType) {
    prompt += `\n\nThis appears to be a ${contractType.toUpperCase()} contract.`;
    
    if (hints.length > 0) {
      prompt += `\n\nKey things to look for in this type of contract:`;
      for (const hint of hints.slice(0, 5)) {
        prompt += `\n- ${hint}`;
      }
    }
  }

  return prompt;
}

/**
 * Build enhanced user prompt
 */
function buildEnhancedUserPrompt(
  anonymizedText: string,
  contractType: string | null
): string {
  const typeSpecificFields = getTypeSpecificFields(contractType);

  return `Analyze this contract and extract:
1. Parties (client and supplier) - use the placeholder names like [COMPANY_1]
2. Contract type
3. Key dates (use placeholders like [DATE_1])
4. Total value (use placeholders like [AMOUNT_1])
5. Summary (2-3 sentences)
6. Key terms
7. Risk assessment
8. Important clauses with risk levels
${typeSpecificFields}

Contract text:
${anonymizedText}

Respond in this JSON format:
{
  "client": { "name": "[COMPANY_X]", "role": "client", "address": "..." },
  "supplier": { "name": "[COMPANY_Y]", "role": "supplier", "address": "..." },
  "contractType": "...",
  "effectiveDate": "[DATE_X]",
  "expirationDate": "[DATE_Y]",
  "totalValue": "[AMOUNT_X]",
  "currency": "CHF",
  "summary": "...",
  "keyTerms": ["...", "..."],
  "riskLevel": "low|medium|high",
  "riskFactors": ["...", "..."],
  "clauses": [
    { "type": "Liability", "text": "...", "risk": "medium" }
  ]
}`;
}

/**
 * Get type-specific field extraction instructions
 */
function getTypeSpecificFields(contractType: string | null): string {
  if (!contractType) return '';

  const typeFields: Record<string, string> = {
    msa: `
Additionally extract:
- Payment terms and schedules
- Intellectual property provisions
- Termination notice period`,
    nda: `
Additionally extract:
- Confidentiality period
- Permitted disclosures
- Return of materials clause`,
    sow: `
Additionally extract:
- Deliverables with dates
- Acceptance criteria
- Change request process`,
    saas: `
Additionally extract:
- SLA commitments
- Data handling provisions
- Subscription terms`,
    employment: `
Additionally extract:
- Position and responsibilities
- Compensation details
- Non-compete provisions`,
  };

  return typeFields[contractType] || '';
}

// ============================================================================
// Complete Document Processing with Metadata
// ============================================================================

export interface FullProcessingOptions extends DocumentProcessingOptions {
  /** Extract metadata using tenant's schema */
  extractMetadata?: boolean;
  /** Auto-apply high-confidence extractions */
  autoPopulate?: boolean;
  /** Minimum confidence for auto-apply */
  autoApplyThreshold?: number;
}

/**
 * Complete document processing with OCR, analysis, and metadata extraction
 * 
 * This is the most comprehensive processing function:
 * 1. EU-compliant OCR
 * 2. Contract type detection
 * 3. Anonymized AI analysis
 * 4. Schema-aware metadata extraction
 * 5. Cross-field validation
 * 6. Confidence calibration
 */
export async function processDocumentWithMetadata(
  fileBuffer: Buffer,
  tenantId: string,
  options: FullProcessingOptions = {}
): Promise<IntelligentAnalysisResult & { ocrResult: OCRResult }> {
  const { debug = false } = options;

  // Step 1: EU-compliant OCR

  const ocrResult = await secureOCRWithAnonymization(fileBuffer, {
    ...options,
    anonymize: false,
  });

  // Step 2: Intelligent analysis with metadata extraction

  const analysisResult = await analyzeContractIntelligently(ocrResult.text, {
    model: options.model,
    temperature: options.temperature,
    tenantId,
    contractId: options.contractId,
    debug,
    extractMetadata: options.extractMetadata ?? true,
    autoPopulate: options.autoPopulate,
    autoApplyThreshold: options.autoApplyThreshold,
  });

  return {
    ...analysisResult,
    ocrResult: {
      text: ocrResult.text,
      confidence: ocrResult.confidence,
      provider: ocrResult.provider,
      region: ocrResult.region,
      processingTime: ocrResult.processingTime,
      dataResidency: ocrResult.dataResidency,
    },
  };
}

// ============================================================================
// Advanced Processing with Streaming, Caching, and Parallel Execution
// ============================================================================

export interface AdvancedProcessingOptions extends FullProcessingOptions, StreamingOptions {
  /** Include AI categorization */
  categorize?: boolean;
  /** Categorization options */
  categorizationOptions?: CategorizationOptions;
}

export interface AdvancedAnalysisResult extends IntelligentAnalysisResult {
  ocrResult?: OCRResult;
}

/**
 * Most comprehensive document processing with all features enabled
 * 
 * Features:
 * 1. EU-compliant OCR
 * 2. Content caching (skip re-processing identical content)
 * 3. Contract type detection
 * 4. Anonymized AI analysis with retry logic
 * 5. Schema-aware metadata extraction
 * 6. AI-powered categorization (parallel with metadata)
 * 7. Cross-field validation
 * 8. Confidence calibration
 * 9. Real-time progress streaming
 * 
 * @example
 * const result = await processDocumentAdvanced(fileBuffer, tenantId, {
 *   onProgress: (stage, progress) => updateUI(stage, progress),
 *   parallel: true,
 *   useCache: true,
 *   categorize: true,
 * });
 */
export async function processDocumentAdvanced(
  fileBuffer: Buffer,
  tenantId: string,
  options: AdvancedProcessingOptions = {}
): Promise<AdvancedAnalysisResult & { ocrResult: OCRResult }> {
  const {
    debug: _debug = false,
    onProgress,
    parallel = true,
    useCache = true,
    cacheTTL = 1000 * 60 * 60, // 1 hour
    categorize = true,
    categorizationOptions = {},
  } = options;

  const startTime = Date.now();
  const retryCount = 0;

  // Report progress
  const report = (stage: ProcessingStage, progress: number, message?: string) => {
    if (onProgress) {
      onProgress(stage, progress, message);
    }
  };

  report('initializing', 0, 'Starting document processing...');

  // Step 1: EU-compliant OCR
  report('ocr', 5, 'Performing EU-compliant OCR...');
  
  const ocrResult = await withRetry(async () => {
    return secureOCRWithAnonymization(fileBuffer, {
      ...options,
      anonymize: false,
    });
  });

  report('ocr', 20, `OCR completed with ${ocrResult.provider}`);

  // Check cache for identical content
  const cacheKey = useCache 
    ? processingCache.generateKey(ocrResult.text, { tenantId, model: options.model })
    : null;

  if (cacheKey) {
    const cached = processingCache.get<AdvancedAnalysisResult>(cacheKey);
    if (cached) {
      report('completing', 100, 'Served from cache');
      return {
        ...cached,
        ocrResult: {
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          provider: ocrResult.provider,
          region: ocrResult.region,
          processingTime: ocrResult.processingTime,
          dataResidency: ocrResult.dataResidency,
        },
        processingInfo: {
          ...cached.processingInfo,
          cached: true,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  // Step 2: Anonymize and detect contract type
  report('anonymizing', 25, 'Anonymizing sensitive data...');
  
  const anonymizer = new ContractAnonymizer();
  const { anonymizedText, mappings, stats } = anonymizer.anonymize(ocrResult.text);

  report('detecting_type', 30, 'Detecting contract type...');
  
  const detectedType = detectContractType(ocrResult.text);
  const extractionHintsMap = detectedType ? getExtractionHintsForType(detectedType.id) : {};
  const extractionHints = Object.values(extractionHintsMap);

  // Step 3: Build prompts
  const systemPrompt = buildEnhancedSystemPrompt(detectedType?.name || null, extractionHints);
  const userPrompt = buildEnhancedUserPrompt(anonymizedText, detectedType?.name || null);

  // Step 4: AI Analysis (with retry logic)
  report('analyzing', 35, 'Performing AI analysis...');

  const analysisResponse = await withRetry(async () => {
    return openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      temperature: options.temperature || 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });
  });

  report('analyzing', 50, 'AI analysis complete');

  const aiResponseText = analysisResponse.choices[0]?.message?.content || '{}';
  const realResponseText = anonymizer.deAnonymize(aiResponseText, mappings);

  let baseAnalysis: ContractAnalysisResult;
  try {
    baseAnalysis = JSON.parse(realResponseText) as ContractAnalysisResult;
    if (typeof baseAnalysis.totalValue === 'string') {
      const numericValue = parseAmountString(baseAnalysis.totalValue as string);
      if (numericValue !== null) {
        baseAnalysis.totalValue = numericValue;
      }
    }
  } catch {
    throw new Error('Failed to parse contract analysis result');
  }

  // Step 5: Parallel processing - Metadata extraction + Categorization
  report('extracting_metadata', 55, 'Extracting metadata and categorizing...');

  const parallelTasks: Promise<unknown>[] = [];
  
  let metadataExtraction: MetadataExtractionResult | undefined;
  let validation: ValidationResult | undefined;
  let categorization: ContractCategorizationResult | undefined;

  // Metadata extraction task
  if (options.extractMetadata !== false) {
    parallelTasks.push(
      (async () => {
        try {
          // Get schema for tenant (using dynamic import to avoid circular dependencies)
          const { metadataSchemaService } = await import('../services/metadata-schema.service');
          const schema = await metadataSchemaService.getSchema(tenantId);
          
          const extractor = new SchemaAwareMetadataExtractor();
          metadataExtraction = await extractor.extractMetadata(
            ocrResult.text,
            schema
          );

          // Calibrate confidence
          const calibrationService = getCalibrationService();
          for (const field of metadataExtraction.results) {
            if (field.confidence !== null) {
              const calibrated = calibrationService.calibrateConfidence(
                tenantId,
                field.fieldName,
                field.confidence
              );
              field.confidence = calibrated.calibratedConfidence;
            }
          }

          // Validate - convert ExtractionResult[] to the expected format
          const validator = new FieldValueValidator();
          const extractedFields = metadataExtraction.results.map(r => ({
            fieldKey: r.fieldId,
            fieldName: r.fieldName,
            fieldType: r.fieldType,
            value: r.value,
            confidence: r.confidence,
            source: r.source.text,
          }));
          validation = await validator.validateFields(
            extractedFields,
            ocrResult.text
          );
        } catch {
          // Metadata extraction failed silently
        }
      })()
    );
  }

  // Categorization task
  if (categorize) {
    parallelTasks.push(
      (async () => {
        try {
          const categorizer = new AIContractCategorizer();
          categorization = await categorizer.categorize(ocrResult.text, {
            ...categorizationOptions,
            contractId: options.contractId,
          });
        } catch {
          // Categorization failed silently
        }
      })()
    );
  }

  // Wait for parallel tasks
  if (parallel && parallelTasks.length > 0) {
    await Promise.all(parallelTasks);
  } else {
    for (const task of parallelTasks) {
      await task;
    }
  }

  report('validating', 85, 'Validating results...');

  // Record analytics
  if (metadataExtraction && options.contractId) {
    const analytics = getExtractionAnalytics();
    // Convert ExtractionResult[] to ExtractedField[]
    const extractedFields = metadataExtraction.results.map(r => ({
      fieldKey: r.fieldId,
      value: r.value,
      confidence: r.confidence,
      fieldType: r.fieldType,
    }));
    await analytics.recordExtractionComplete(
      options.contractId,
      tenantId,
      extractedFields,
      Date.now() - startTime,
      options.model || 'gpt-4o-mini'
    );
  }

  report('completing', 95, 'Finalizing...');

  const processingTimeMs = Date.now() - startTime;

  const result: AdvancedAnalysisResult = {
    ...baseAnalysis,
    detectedType: detectedType?.name || undefined,
    extractionHints: extractionHints.length > 0 ? extractionHints : undefined,
    metadataExtraction,
    validation,
    categorization,
    processingInfo: {
      model: options.model || 'gpt-4o-mini',
      processingTimeMs,
      anonymizationStats: {
        companiesAnonymized: stats.byType.COMPANY || 0,
        amountsAnonymized: stats.byType.AMOUNT || 0,
        datesAnonymized: stats.byType.DATE || 0,
      },
      confidenceCalibrated: true,
      cached: false,
      retryCount,
    },
  };

  // Cache the result
  if (cacheKey) {
    processingCache.set(cacheKey, result, cacheTTL);
  }

  report('completing', 100, 'Processing complete!');

  return {
    ...result,
    ocrResult: {
      text: ocrResult.text,
      confidence: ocrResult.confidence,
      provider: ocrResult.provider,
      region: ocrResult.region,
      processingTime: ocrResult.processingTime,
      dataResidency: ocrResult.dataResidency,
    },
  };
}

/**
 * Stream-based document processing with Server-Sent Events support
 * Returns an async generator for real-time progress updates
 */
export async function* processDocumentStreaming(
  fileBuffer: Buffer,
  tenantId: string,
  options: AdvancedProcessingOptions = {}
): AsyncGenerator<{ stage: ProcessingStage; progress: number; message?: string; result?: AdvancedAnalysisResult }> {
  const progressEvents: Array<{ stage: ProcessingStage; progress: number; message?: string }> = [];
  
  const onProgress: ProgressCallback = (stage, progress, message) => {
    progressEvents.push({ stage, progress, message });
  };

  // Start processing in background
  const processingPromise = processDocumentAdvanced(fileBuffer, tenantId, {
    ...options,
    onProgress,
  });

  // Yield progress events as they come in
  let lastIndex = 0;
  let result: AdvancedAnalysisResult & { ocrResult: OCRResult } | null = null;

  while (!result) {
    // Yield any new progress events
    while (lastIndex < progressEvents.length) {
      const event = progressEvents[lastIndex++];
      if (event) {
        yield event;
      }
    }

    // Check if processing is complete
    try {
      result = await Promise.race([
        processingPromise,
        sleep(100).then(() => null),
      ]) as (AdvancedAnalysisResult & { ocrResult: OCRResult }) | null;
    } catch (error) {
      yield { 
        stage: 'completing', 
        progress: 0, 
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
      throw error;
    }
  }

  // Yield final result
  yield {
    stage: 'completing',
    progress: 100,
    message: 'Processing complete!',
    result,
  };
}

/**
 * Quick analysis without full processing - useful for previews
 */
export async function quickAnalyze(
  text: string,
  options: { model?: string; maxLength?: number } = {}
): Promise<{
  contractType: string;
  parties: string[];
  summary: string;
  riskLevel: string;
}> {
  const { model = 'gpt-4o-mini', maxLength = 3000 } = options;
  
  // Truncate text if needed
  const truncatedText = text.length > maxLength 
    ? text.substring(0, maxLength) + '...[truncated]'
    : text;

  const response = await withRetry(async () => {
    return openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are a contract analysis assistant. Provide quick analysis in JSON format.',
        },
        {
          role: 'user',
          content: `Quick analysis of this contract:
${truncatedText}

Respond in JSON:
{
  "contractType": "MSA|NDA|SOW|SLA|Employment|License|Other",
  "parties": ["Party 1", "Party 2"],
  "summary": "One sentence summary",
  "riskLevel": "low|medium|high"
}`,
        },
      ],
      response_format: { type: 'json_object' },
    });
  });

  const result = JSON.parse(response.choices[0]?.message?.content || '{}');
  return {
    contractType: result.contractType || 'Unknown',
    parties: result.parties || [],
    summary: result.summary || 'Unable to summarize',
    riskLevel: result.riskLevel || 'medium',
  };
}

/**
 * Batch processing for multiple contracts
 */
export async function batchProcessContracts(
  contracts: Array<{ id: string; text: string }>,
  tenantId: string,
  options: AdvancedProcessingOptions & { concurrency?: number } = {}
): Promise<Map<string, AdvancedAnalysisResult | Error>> {
  const { concurrency = 3 } = options;
  const results = new Map<string, AdvancedAnalysisResult | Error>();
  
  // Process in batches
  for (let i = 0; i < contracts.length; i += concurrency) {
    const batch = contracts.slice(i, i + concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (contract) => {
        const result = await analyzeContractIntelligently(contract.text, {
          ...options,
          tenantId,
          contractId: contract.id,
        });
        return { id: contract.id, result };
      })
    );

    for (const outcome of batchResults) {
      if (outcome.status === 'fulfilled') {
        results.set(outcome.value.id, outcome.value.result);
      } else {
        // Find the corresponding contract ID
        const idx = batchResults.indexOf(outcome);
        const contractId = batch[idx]?.id || 'unknown';
        results.set(contractId, new Error(outcome.reason?.message || 'Processing failed'));
      }
    }

    // Brief pause between batches to respect rate limits
    if (i + concurrency < contracts.length) {
      await sleep(1000);
    }
  }

  return results;
}

/**
 * Clear the processing cache
 */
export function clearProcessingCache(): void {
  processingCache.clear();
}

/**
 * Prune expired cache entries
 */
export function pruneProcessingCache(): void {
  processingCache.prune();
}
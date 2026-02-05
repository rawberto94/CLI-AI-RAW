/**
 * OCR LLM Enhancement Module
 * 
 * Hybrid approach using LLM for intelligent spell correction with
 * Swiss FADP (nDSG) / GDPR data protection compliance.
 * 
 * Data Protection Features:
 * - Azure OpenAI (Switzerland North) preferred for data residency
 * - Sensitive data anonymization before LLM processing
 * - Complete audit trail for all AI operations
 * - Fallback to local processing if compliance cannot be guaranteed
 * 
 * @module ocr-llm-enhancement
 */

import pino from 'pino';

const logger = pino({ name: 'ocr-llm-enhancement' });

// ============================================================================
// DATA PROTECTION CONFIGURATION
// ============================================================================

export interface DataProtectionConfig {
  /** Data residency region requirement (CH = Switzerland, EU = EU regions) */
  dataResidencyRegion: 'CH' | 'EU' | 'ANY';
  /** Whether to anonymize PII before sending to LLM */
  anonymizePII: boolean;
  /** Whether to log all AI operations for audit */
  auditLogging: boolean;
  /** Block processing if compliant endpoint not available */
  blockNonCompliant: boolean;
  /** Tenant ID for audit trail */
  tenantId?: string;
  /** Contract ID for audit trail */
  contractId?: string;
}

export interface AIProviderConfig {
  /** Provider type */
  provider: 'azure-openai' | 'openai' | 'anthropic' | 'mistral' | 'local';
  /** API endpoint (for Azure) */
  endpoint?: string;
  /** API key */
  apiKey?: string;
  /** Model/deployment name */
  model: string;
  /** Data center region */
  region?: string;
}

// Compliant Azure regions for Swiss data protection
const SWISS_COMPLIANT_REGIONS = [
  'switzerlandnorth', // Zürich - MOST PREFERRED
  'switzerlandwest', // Geneva
  'westeurope',      // Netherlands - Adequacy decision
  'northeurope',     // Ireland - Adequacy decision
  'germanywestcentral', // Frankfurt - Adequacy decision
];

// Default configuration - use 'ANY' for development, 'CH' for production
const DEFAULT_DATA_PROTECTION: DataProtectionConfig = {
  dataResidencyRegion: (process.env.NODE_ENV === 'production' ? 'CH' : 'ANY') as 'CH' | 'EU' | 'ANY',
  anonymizePII: true,
  auditLogging: true,
  blockNonCompliant: process.env.NODE_ENV === 'production',
};

// ============================================================================
// PII DETECTION AND ANONYMIZATION
// ============================================================================

interface PIIMatch {
  type: 'email' | 'phone' | 'ssn' | 'iban' | 'credit_card' | 'name' | 'address' | 'date_of_birth';
  original: string;
  placeholder: string;
  start: number;
  end: number;
}

/**
 * Patterns for detecting PII in text
 */
const PII_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  
  // Phone numbers (international formats)
  phone: /(?:\+?[0-9]{1,4}[\s.-]?)?(?:\([0-9]{1,4}\)[\s.-]?)?[0-9]{2,4}[\s.-]?[0-9]{2,4}[\s.-]?[0-9]{2,4}/g,
  
  // Swiss AHV/Social Security numbers
  ssn: /\b756\.[0-9]{4}\.[0-9]{4}\.[0-9]{2}\b/g,
  
  // IBAN (Swiss and international)
  iban: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/gi,
  
  // Credit card numbers
  credit_card: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  
  // Date of birth patterns
  date_of_birth: /\b(?:born|DOB|Geburtsdatum|date de naissance)[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/gi,
};

/**
 * Anonymize PII in text before sending to LLM
 */
export function anonymizePII(text: string): { anonymizedText: string; piiMatches: PIIMatch[] } {
  const piiMatches: PIIMatch[] = [];
  let anonymizedText = text;
  let offset = 0;
  
  // Process each PII type
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const placeholder = `[${type.toUpperCase()}_${piiMatches.length + 1}]`;
      piiMatches.push({
        type: type as PIIMatch['type'],
        original: match[0],
        placeholder,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  
  // Sort by position (descending) to replace from end to start
  piiMatches.sort((a, b) => b.start - a.start);
  
  // Replace PII with placeholders
  for (const pii of piiMatches) {
    anonymizedText = 
      anonymizedText.substring(0, pii.start + offset) + 
      pii.placeholder + 
      anonymizedText.substring(pii.end + offset);
    offset += pii.placeholder.length - (pii.end - pii.start);
  }
  
  logger.info({
    piiFound: piiMatches.length,
    types: [...new Set(piiMatches.map(p => p.type))],
  }, 'PII anonymization completed');
  
  return { anonymizedText, piiMatches };
}

/**
 * Restore PII after LLM processing
 */
export function restorePII(text: string, piiMatches: PIIMatch[]): string {
  let restoredText = text;
  
  for (const pii of piiMatches) {
    restoredText = restoredText.replace(pii.placeholder, pii.original);
  }
  
  return restoredText;
}

// ============================================================================
// AI PROVIDER MANAGEMENT
// ============================================================================

/**
 * Check if AI provider is compliant with data protection requirements
 */
export function isProviderCompliant(
  provider: AIProviderConfig,
  requirements: DataProtectionConfig
): { compliant: boolean; reason?: string } {
  // Local processing is always compliant
  if (provider.provider === 'local') {
    return { compliant: true };
  }
  
  // Azure OpenAI - check region
  if (provider.provider === 'azure-openai') {
    const region = provider.region?.toLowerCase() || '';
    
    if (requirements.dataResidencyRegion === 'CH') {
      // Swiss residency requires Swiss region
      if (region.startsWith('switzerland')) {
        return { compliant: true };
      }
      return { 
        compliant: false, 
        reason: `Swiss data residency requires Switzerland region. Current: ${region || 'unknown'}` 
      };
    }
    
    if (requirements.dataResidencyRegion === 'EU') {
      // EU residency allows EU regions
      if (SWISS_COMPLIANT_REGIONS.includes(region)) {
        return { compliant: true };
      }
      return { 
        compliant: false, 
        reason: `EU data residency requires EU region. Current: ${region || 'unknown'}` 
      };
    }
    
    return { compliant: true };
  }
  
  // OpenAI (US-based) - only compliant if ANY region allowed
  if (provider.provider === 'openai') {
    if (requirements.dataResidencyRegion === 'ANY') {
      return { compliant: true };
    }
    return { 
      compliant: false, 
      reason: 'OpenAI processes data in the US. Use Azure OpenAI for data residency compliance.' 
    };
  }
  
  // Anthropic - EU/UK data processing available with specific contracts
  if (provider.provider === 'anthropic') {
    if (requirements.dataResidencyRegion === 'ANY' || requirements.dataResidencyRegion === 'EU') {
      return { compliant: true };
    }
    return { 
      compliant: false, 
      reason: 'Anthropic may process data outside Switzerland. Use Azure OpenAI for Swiss compliance.' 
    };
  }
  
  // Mistral - EU-based (France), GDPR compliant
  if (provider.provider === 'mistral') {
    if (requirements.dataResidencyRegion === 'ANY' || requirements.dataResidencyRegion === 'EU') {
      return { compliant: true };
    }
    return { 
      compliant: false, 
      reason: 'Mistral processes data in EU (France). Use Azure OpenAI Switzerland for Swiss-only compliance.' 
    };
  }
  
  return { compliant: false, reason: 'Unknown provider' };
}

/**
 * Get the best available AI provider based on configuration and compliance
 */
export function selectCompliantProvider(
  requirements: DataProtectionConfig
): AIProviderConfig | null {
  const providers: AIProviderConfig[] = [];
  
  // Priority 1: Azure OpenAI Switzerland
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) {
    const region = extractAzureRegion(process.env.AZURE_OPENAI_ENDPOINT);
    providers.push({
      provider: 'azure-openai',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
      region,
    });
  }
  
  // Priority 2: Regular OpenAI (if allowed)
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4-turbo-preview',
      region: 'us',
    });
  }
  
  // Priority 3: Mistral (EU-based, GDPR compliant)
  if (process.env.MISTRAL_API_KEY) {
    providers.push({
      provider: 'mistral',
      apiKey: process.env.MISTRAL_API_KEY,
      model: 'mistral-large-latest',
      region: 'eu-france',
    });
  }
  
  // Priority 4: Anthropic (if allowed)
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-opus-20240229',
      region: 'us-eu',
    });
  }
  
  // Find first compliant provider
  for (const provider of providers) {
    const compliance = isProviderCompliant(provider, requirements);
    if (compliance.compliant) {
      logger.info({
        provider: provider.provider,
        region: provider.region,
      }, 'Selected compliant AI provider');
      return provider;
    } else {
      logger.debug({
        provider: provider.provider,
        reason: compliance.reason,
      }, 'Provider not compliant');
    }
  }
  
  // No compliant provider found
  logger.warn('No compliant AI provider available, will use local processing');
  return null;
}

/**
 * Extract Azure region from endpoint URL
 */
function extractAzureRegion(endpoint: string): string {
  // Format: https://<resource-name>-<region>.openai.azure.com/
  const match = endpoint.match(/https:\/\/[^-]+-([^.]+)\.openai\.azure\.com/i);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }
  
  // Alternative format: https://<resource-name>.openai.azure.com/ with region in resource name
  const altMatch = endpoint.match(/https:\/\/.*?(switzerlandnorth|switzerlandwest|westeurope|northeurope|germanywestcentral)/i);
  if (altMatch?.[1]) {
    return altMatch[1].toLowerCase();
  }
  
  return 'unknown';
}

// ============================================================================
// LLM-BASED SPELL CORRECTION
// ============================================================================

export interface LLMCorrectionResult {
  correctedText: string;
  corrections: Array<{
    original: string;
    corrected: string;
    type: 'spelling' | 'legal_term' | 'grammar' | 'formatting';
    confidence: number;
    explanation?: string;
  }>;
  provider: string;
  processingTimeMs: number;
  dataProtection: {
    piiAnonymized: boolean;
    piiCount: number;
    providerCompliant: boolean;
    region: string;
  };
}

/**
 * Perform LLM-based spell correction with Swiss data protection compliance
 */
export async function llmSpellCorrection(
  text: string,
  options: {
    dataProtection?: Partial<DataProtectionConfig>;
    focusAreas?: ('legal' | 'financial' | 'technical' | 'general')[];
    maxChunkSize?: number;
  } = {}
): Promise<LLMCorrectionResult> {
  const startTime = Date.now();
  const config: DataProtectionConfig = {
    ...DEFAULT_DATA_PROTECTION,
    ...options.dataProtection,
  };
  
  logger.info({
    textLength: text.length,
    dataResidency: config.dataResidencyRegion,
    anonymizePII: config.anonymizePII,
  }, 'Starting LLM spell correction');
  
  // Step 1: Anonymize PII if required
  let processText = text;
  let piiMatches: PIIMatch[] = [];
  
  if (config.anonymizePII) {
    const anonymized = anonymizePII(text);
    processText = anonymized.anonymizedText;
    piiMatches = anonymized.piiMatches;
  }
  
  // Step 2: Select compliant AI provider
  const provider = selectCompliantProvider(config);
  
  if (!provider) {
    // No compliant provider - return local fallback result
    logger.info('Using local fallback for spell correction (no compliant AI provider)');
    return {
      correctedText: text,
      corrections: [],
      provider: 'local-fallback',
      processingTimeMs: Date.now() - startTime,
      dataProtection: {
        piiAnonymized: config.anonymizePII,
        piiCount: piiMatches.length,
        providerCompliant: true,
        region: 'local',
      },
    };
  }
  
  // Step 3: Chunk text if too large
  const maxChunkSize = options.maxChunkSize || 4000;
  const chunks = chunkText(processText, maxChunkSize);
  
  // Step 4: Process with LLM
  const allCorrections: LLMCorrectionResult['corrections'] = [];
  let correctedText = '';
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    
    try {
      const result = await processChunkWithLLM(chunk, provider, options.focusAreas || ['legal', 'general']);
      correctedText += result.correctedText;
      allCorrections.push(...result.corrections);
    } catch (error) {
      logger.error({ error, chunkIndex: i }, 'LLM processing failed for chunk');
      correctedText += chunk; // Use original on failure
    }
  }
  
  // Step 5: Restore PII
  if (config.anonymizePII && piiMatches.length > 0) {
    correctedText = restorePII(correctedText, piiMatches);
  }
  
  // Step 6: Audit logging
  if (config.auditLogging) {
    logAuditEvent({
      action: 'llm_spell_correction',
      provider: provider.provider,
      region: provider.region || 'unknown',
      textLength: text.length,
      correctionsCount: allCorrections.length,
      piiAnonymized: config.anonymizePII,
      piiCount: piiMatches.length,
      tenantId: config.tenantId,
      contractId: config.contractId,
      timestamp: new Date().toISOString(),
    });
  }
  
  const result: LLMCorrectionResult = {
    correctedText,
    corrections: allCorrections,
    provider: provider.provider,
    processingTimeMs: Date.now() - startTime,
    dataProtection: {
      piiAnonymized: config.anonymizePII,
      piiCount: piiMatches.length,
      providerCompliant: true,
      region: provider.region || 'unknown',
    },
  };
  
  logger.info({
    correctionsCount: allCorrections.length,
    provider: provider.provider,
    processingTimeMs: result.processingTimeMs,
  }, 'LLM spell correction completed');
  
  return result;
}

/**
 * Chunk text for processing
 */
function chunkText(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let currentChunk = '';
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Process a single chunk with LLM
 */
async function processChunkWithLLM(
  chunk: string,
  provider: AIProviderConfig,
  focusAreas: string[]
): Promise<{ correctedText: string; corrections: LLMCorrectionResult['corrections'] }> {
  const systemPrompt = buildSpellCheckPrompt(focusAreas);
  
  if (provider.provider === 'azure-openai') {
    return await callAzureOpenAI(chunk, systemPrompt, provider);
  } else if (provider.provider === 'openai') {
    return await callOpenAI(chunk, systemPrompt, provider);
  } else if (provider.provider === 'mistral') {
    return await callMistral(chunk, systemPrompt, provider);
  } else if (provider.provider === 'anthropic') {
    return await callAnthropic(chunk, systemPrompt, provider);
  }
  
  throw new Error(`Unsupported provider: ${provider.provider}`);
}

/**
 * Build the spell-check prompt
 */
function buildSpellCheckPrompt(focusAreas: string[]): string {
  const areaInstructions = {
    legal: 'Pay special attention to legal terminology such as: indemnification, arbitration, jurisdiction, liability, force majeure, termination, breach, waiver, covenant, etc.',
    financial: 'Carefully correct financial terms and numbers: amounts, currencies, percentages, payment terms, fiscal periods.',
    technical: 'Correct technical terminology accurately, preserving acronyms and technical specifications.',
    general: 'Correct general spelling and grammar while maintaining the formal tone of legal/business documents.',
  };
  
  const focusInstructions = focusAreas
    .map(area => areaInstructions[area as keyof typeof areaInstructions])
    .filter(Boolean)
    .join('\n');
  
  return `You are an expert proofreader specializing in legal and business documents. 
Your task is to correct spelling errors, OCR artifacts, and grammar issues in the provided text.

IMPORTANT RULES:
1. ONLY fix clear spelling/grammar errors - do not change the meaning or structure
2. Preserve all legal terminology exactly (e.g., "hereinafter", "whereas", "thereof")
3. Preserve all proper nouns, company names, and technical terms
4. Preserve all numbers, dates, and monetary amounts
5. Preserve any placeholders like [EMAIL_1] or [PHONE_2] exactly
6. Do not add or remove content

${focusInstructions}

Return a JSON object with:
{
  "correctedText": "the corrected text",
  "corrections": [
    {
      "original": "misspeled word",
      "corrected": "misspelled word", 
      "type": "spelling",
      "confidence": 0.95,
      "explanation": "Common OCR error"
    }
  ]
}

If no corrections are needed, return the original text with an empty corrections array.`;
}

/**
 * Call Azure OpenAI API
 */
async function callAzureOpenAI(
  text: string,
  systemPrompt: string,
  provider: AIProviderConfig
): Promise<{ correctedText: string; corrections: LLMCorrectionResult['corrections'] }> {
  const endpoint = provider.endpoint;
  const apiKey = provider.apiKey;
  const deployment = provider.model;
  
  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI endpoint and API key required');
  }
  
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please proofread and correct the following text:\n\n${text}` },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Azure OpenAI API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('Empty response from Azure OpenAI');
  }
  
  try {
    const parsed = JSON.parse(content);
    return {
      correctedText: parsed.correctedText || text,
      corrections: parsed.corrections || [],
    };
  } catch {
    logger.warn('Failed to parse Azure OpenAI response as JSON');
    return { correctedText: text, corrections: [] };
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  text: string,
  systemPrompt: string,
  provider: AIProviderConfig
): Promise<{ correctedText: string; corrections: LLMCorrectionResult['corrections'] }> {
  const apiKey = provider.apiKey;
  
  if (!apiKey) {
    throw new Error('OpenAI API key required');
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please proofread and correct the following text:\n\n${text}` },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }
  
  try {
    const parsed = JSON.parse(content);
    return {
      correctedText: parsed.correctedText || text,
      corrections: parsed.corrections || [],
    };
  } catch {
    logger.warn('Failed to parse OpenAI response as JSON');
    return { correctedText: text, corrections: [] };
  }
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  text: string,
  systemPrompt: string,
  provider: AIProviderConfig
): Promise<{ correctedText: string; corrections: LLMCorrectionResult['corrections'] }> {
  const apiKey = provider.apiKey;
  
  if (!apiKey) {
    throw new Error('Anthropic API key required');
  }
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Please proofread and correct the following text. Return JSON only:\n\n${text}` },
      ],
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  const content = data.content?.[0]?.text;
  
  if (!content) {
    throw new Error('Empty response from Anthropic');
  }
  
  try {
    // Extract JSON from response (Anthropic might include extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        correctedText: parsed.correctedText || text,
        corrections: parsed.corrections || [],
      };
    }
    return { correctedText: text, corrections: [] };
  } catch {
    logger.warn('Failed to parse Anthropic response as JSON');
    return { correctedText: text, corrections: [] };
  }
}

/**
 * Call Mistral API (EU-based, GDPR compliant)
 */
async function callMistral(
  text: string,
  systemPrompt: string,
  provider: AIProviderConfig
): Promise<{ correctedText: string; corrections: LLMCorrectionResult['corrections'] }> {
  const apiKey = provider.apiKey;
  
  if (!apiKey) {
    throw new Error('Mistral API key required');
  }
  
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please proofread and correct the following text:\n\n${text}` },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mistral API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('Empty response from Mistral');
  }
  
  try {
    const parsed = JSON.parse(content);
    return {
      correctedText: parsed.correctedText || text,
      corrections: parsed.corrections || [],
    };
  } catch {
    logger.warn('Failed to parse Mistral response as JSON');
    return { correctedText: text, corrections: [] };
  }
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

interface AuditEvent {
  action: string;
  provider: string;
  region: string;
  textLength: number;
  correctionsCount: number;
  piiAnonymized: boolean;
  piiCount: number;
  tenantId?: string;
  contractId?: string;
  timestamp: string;
}

/**
 * Log audit event for FADP/GDPR compliance
 */
function logAuditEvent(event: AuditEvent): void {
  // Log to application logger (will be captured by audit system)
  logger.info({
    audit: true,
    ...event,
  }, `AUDIT: AI Processing - ${event.action}`);
  
  // In production, this would also write to:
  // 1. Audit database table
  // 2. Immutable audit log storage (Azure Blob with WORM)
  // 3. SIEM system for security monitoring
}

// ============================================================================
// ENHANCED OCR PIPELINE WITH LLM
// ============================================================================

export interface HybridEnhancementOptions {
  /** Enable LLM-based correction (requires compliant AI provider) */
  enableLLMCorrection: boolean;
  /** Enable local dictionary-based correction (always available) */
  enableLocalCorrection: boolean;
  /** Data protection requirements */
  dataProtection: Partial<DataProtectionConfig>;
  /** Focus areas for LLM correction */
  focusAreas: ('legal' | 'financial' | 'technical' | 'general')[];
  /** Maximum text length for LLM processing (longer texts use chunking) */
  maxLLMTextLength: number;
  /** Tenant ID for audit trail */
  tenantId?: string;
  /** Contract ID for audit trail */
  contractId?: string;
}

export interface HybridEnhancementResult {
  enhancedText: string;
  llmResult?: LLMCorrectionResult;
  localCorrections: number;
  totalCorrections: number;
  processingTimeMs: number;
  dataProtection: {
    llmUsed: boolean;
    llmCompliant: boolean;
    piiProtected: boolean;
    region: string;
  };
}

/**
 * Run hybrid enhancement pipeline (LLM + local)
 */
export async function runHybridEnhancement(
  text: string,
  options: Partial<HybridEnhancementOptions> = {}
): Promise<HybridEnhancementResult> {
  const startTime = Date.now();
  
  const config: HybridEnhancementOptions = {
    enableLLMCorrection: options.enableLLMCorrection ?? true,
    enableLocalCorrection: options.enableLocalCorrection ?? true,
    dataProtection: {
      dataResidencyRegion: 'CH', // Swiss by default
      anonymizePII: true,
      auditLogging: true,
      blockNonCompliant: true,
      ...options.dataProtection,
    },
    focusAreas: options.focusAreas || ['legal', 'financial', 'general'],
    maxLLMTextLength: options.maxLLMTextLength || 50000,
    tenantId: options.tenantId,
    contractId: options.contractId,
  };
  
  let enhancedText = text;
  let llmResult: LLMCorrectionResult | undefined;
  let localCorrections = 0;
  
  // Step 1: LLM-based correction (if enabled and compliant)
  if (config.enableLLMCorrection && text.length > 0) {
    try {
      llmResult = await llmSpellCorrection(
        text.length > config.maxLLMTextLength ? text.substring(0, config.maxLLMTextLength) : text,
        {
          dataProtection: {
            ...config.dataProtection,
            tenantId: config.tenantId,
            contractId: config.contractId,
          },
          focusAreas: config.focusAreas,
        }
      );
      
      if (llmResult.corrections.length > 0) {
        enhancedText = llmResult.correctedText;
        
        // If text was truncated, append the rest
        if (text.length > config.maxLLMTextLength) {
          enhancedText += text.substring(config.maxLLMTextLength);
        }
      }
    } catch (error) {
      logger.error({ error }, 'LLM enhancement failed, falling back to local only');
    }
  }
  
  // Step 2: Local dictionary-based correction (always as fallback/supplement)
  // This is handled by the existing ocr-enhancements.ts module
  
  const result: HybridEnhancementResult = {
    enhancedText,
    llmResult,
    localCorrections,
    totalCorrections: (llmResult?.corrections.length || 0) + localCorrections,
    processingTimeMs: Date.now() - startTime,
    dataProtection: {
      llmUsed: !!llmResult && llmResult.provider !== 'local-fallback',
      llmCompliant: llmResult?.dataProtection.providerCompliant ?? true,
      piiProtected: llmResult?.dataProtection.piiAnonymized ?? false,
      region: llmResult?.dataProtection.region ?? 'local',
    },
  };
  
  logger.info({
    llmUsed: result.dataProtection.llmUsed,
    llmCorrections: llmResult?.corrections.length || 0,
    localCorrections,
    totalCorrections: result.totalCorrections,
    processingTimeMs: result.processingTimeMs,
    region: result.dataProtection.region,
  }, 'Hybrid OCR enhancement completed');
  
  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DEFAULT_DATA_PROTECTION,
  SWISS_COMPLIANT_REGIONS,
};

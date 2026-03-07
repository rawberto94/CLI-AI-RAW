/**
 * Contract Anonymizer
 *
 * Anonymizes sensitive data before sending to AI providers (OpenAI, Claude, etc.)
 * and de-anonymizes the response to restore original values.
 *
 * This ensures:
 * 1. AI providers never see real company names, amounts, personal data
 * 2. AI can still analyze contract structure, clauses, risks
 * 3. Your database stores the real data with full metadata
 *
 * Flow:
 *   Original Text → Anonymize → AI API → De-anonymize → Store with real values
 */

import { randomUUID } from 'crypto';

// Types
export interface AnonymizationMapping {
  placeholder: string;
  original: string;
  type: EntityType;
  index: number;
}

export type EntityType =
  | 'COMPANY'
  | 'PERSON'
  | 'AMOUNT'
  | 'DATE'
  | 'ADDRESS'
  | 'TAX_ID'
  | 'IBAN'
  | 'EMAIL'
  | 'PHONE'
  | 'AHV';

export interface AnonymizationResult {
  anonymizedText: string;
  mappings: AnonymizationMapping[];
  mappingId: string;
  stats: {
    totalEntities: number;
    byType: Record<EntityType, number>;
  };
}

/**
 * Swiss-specific regex patterns for detecting sensitive data
 */
const PATTERNS: Record<EntityType, RegExp> = {
  // Swiss company suffixes: AG, GmbH, SA, Sàrl, etc.
  COMPANY:
    /\b[A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\s&.\-']+(?:\s+(?:AG|GmbH|SA|Sàrl|S\.A\.|Ltd\.?|Inc\.?|Corp\.?|GmbH\s*&\s*Co\.?\s*KG|SE|NV|BV|Pty\.?\s*Ltd\.?))\b/g,

  // Person names with titles
  PERSON:
    /\b(?:Herr|Frau|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\s+[A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+){1,2}\b/g,

  // Swiss phone numbers: +41 xx xxx xx xx or 0xx xxx xx xx
  PHONE:
    /(?:\+41|0041|0)\s?(?:\(0\))?\s?(\d{2})[\s.-]?(\d{3})[\s.-]?(\d{2})[\s.-]?(\d{2})/g,

  // Swiss addresses: 4-digit postal code + city
  ADDRESS: /\b\d{4}\s+[A-ZÀ-Ü][a-zà-ü]+(?:[\s-][A-ZÀ-Ü]?[a-zà-ü]+)*\b/g,

  // Swiss AHV/AVS numbers (social security): 756.xxxx.xxxx.xx
  AHV: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g,

  // Swiss VAT/UID numbers: CHE-xxx.xxx.xxx (MWST/TVA/IVA)
  TAX_ID: /\bCHE[- ]?\d{3}[.\s]?\d{3}[.\s]?\d{3}\s?(?:MWST|TVA|IVA|HR)?\b/gi,

  // Currency amounts: CHF/EUR/USD with numbers
  AMOUNT:
    /(?:CHF|EUR|USD|€|\$|Fr\.)\s?[\d'',]+(?:\.\d{2})?(?:\s?(?:Mio\.?|Mrd\.?|k|M|B))?/gi,

  // Swiss IBAN: CH + 2 digits + 5 groups of 4 digits + 1 digit
  IBAN: /\bCH\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{1}\b/g,

  // Email addresses
  EMAIL: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,

  // Dates in various formats: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD
  DATE: /\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b/g,
};

/**
 * Order of pattern matching (most specific first to avoid partial matches)
 */
const PATTERN_ORDER: EntityType[] = [
  'AHV',
  'IBAN',
  'TAX_ID',
  'EMAIL',
  'PHONE',
  'AMOUNT',
  'DATE',
  'ADDRESS',
  'COMPANY',
  'PERSON',
];

/**
 * ContractAnonymizer class
 *
 * Usage:
 *   const anonymizer = new ContractAnonymizer();
 *   const { anonymizedText, mappings, mappingId } = anonymizer.anonymize(contractText);
 *
 *   // Send anonymizedText to AI...
 *   const aiResponse = await callAI(anonymizedText);
 *
 *   // Restore original values
 *   const realResponse = anonymizer.deAnonymize(aiResponse, mappings);
 */
export class ContractAnonymizer {
  private counters: Record<EntityType, number> = {} as Record<EntityType, number>;

  constructor() {
    this.resetCounters();
  }

  private resetCounters(): void {
    for (const type of PATTERN_ORDER) {
      this.counters[type] = 0;
    }
  }

  /**
   * Anonymize sensitive data in text
   *
   * @param text - Original contract text with real data
   * @returns Anonymized text with placeholders and mapping for restoration
   */
  anonymize(text: string): AnonymizationResult {
    this.resetCounters();
    const mappings: AnonymizationMapping[] = [];
    const mappingId = randomUUID();
    let anonymizedText = text;

    // Track already replaced positions to avoid double-replacement
    const replacedRanges: Array<{ start: number; end: number }> = [];

    // Process each pattern type in order
    for (const type of PATTERN_ORDER) {
      const pattern = PATTERNS[type];
      // Reset regex state
      pattern.lastIndex = 0;

      // Find all matches first
      const matches: Array<{ match: string; index: number }> = [];
      let match: RegExpExecArray | null;

      // Create a fresh regex to avoid state issues
      const freshPattern = new RegExp(pattern.source, pattern.flags);

      while ((match = freshPattern.exec(text)) !== null) {
        // Check if this range was already replaced by a more specific pattern
        const start = match.index;
        const end = start + match[0].length;

        const alreadyReplaced = replacedRanges.some(
          (range) =>
            (start >= range.start && start < range.end) ||
            (end > range.start && end <= range.end) ||
            (start <= range.start && end >= range.end)
        );

        if (!alreadyReplaced) {
          matches.push({ match: match[0], index: match.index });
          replacedRanges.push({ start, end });
        }
      }

      // Replace matches with placeholders
      for (const { match: matchText } of matches) {
        this.counters[type]++;
        const placeholder = `[${type}_${this.counters[type]}]`;

        mappings.push({
          placeholder,
          original: matchText,
          type,
          index: this.counters[type],
        });

        // Replace in anonymized text (first occurrence of this exact string)
        anonymizedText = anonymizedText.replace(matchText, placeholder);
      }
    }

    // Calculate stats
    const stats = {
      totalEntities: mappings.length,
      byType: { ...this.counters },
    };

    return {
      anonymizedText,
      mappings,
      mappingId,
      stats,
    };
  }

  /**
   * Restore original values in text (e.g., AI response)
   *
   * @param text - Text containing placeholders (e.g., AI response)
   * @param mappings - Mappings from anonymize()
   * @returns Text with original values restored
   */
  deAnonymize(text: string, mappings: AnonymizationMapping[]): string {
    let result = text;

    // Sort by placeholder length descending to avoid partial replacements
    // e.g., replace [COMPANY_10] before [COMPANY_1]
    const sortedMappings = [...mappings].sort(
      (a, b) => b.placeholder.length - a.placeholder.length
    );

    for (const mapping of sortedMappings) {
      // Use global replace in case AI repeated the placeholder
      const escapedPlaceholder = escapeRegex(mapping.placeholder);
      result = result.replace(new RegExp(escapedPlaceholder, 'g'), mapping.original);
    }

    return result;
  }

  /**
   * Get a summary of what was anonymized (for logging/debugging)
   */
  getSummary(mappings: AnonymizationMapping[]): string {
    const byType: Record<string, string[]> = {};

    for (const mapping of mappings) {
      if (!byType[mapping.type]) {
        byType[mapping.type] = [];
      }
      const typeArray = byType[mapping.type];
      if (typeArray) {
        typeArray.push(`${mapping.placeholder} ← "${truncate(mapping.original, 30)}"`);
      }
    }

    let summary = `Anonymized ${mappings.length} entities:\n`;
    for (const [type, items] of Object.entries(byType)) {
      summary += `  ${type}: ${items.length}\n`;
      for (const item of items.slice(0, 3)) {
        summary += `    - ${item}\n`;
      }
      if (items.length > 3) {
        summary += `    ... and ${items.length - 3} more\n`;
      }
    }

    return summary;
  }
}

// Helper functions
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Mapping Storage (for async operations)
// ============================================================================

/**
 * In-memory storage for mappings (use Redis in production)
 * TTL: 1 hour (should be enough for AI processing)
 */
const mappingStore = new Map<
  string,
  { mappings: AnonymizationMapping[]; expiresAt: number }
>();

/**
 * Store mappings for later retrieval (async AI processing)
 */
export function storeMappings(mappingId: string, mappings: AnonymizationMapping[]): void {
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
  mappingStore.set(mappingId, { mappings, expiresAt });
}

/**
 * Retrieve and delete mappings (one-time use for security)
 */
export function retrieveMappings(mappingId: string): AnonymizationMapping[] | null {
  const stored = mappingStore.get(mappingId);

  if (!stored) {
    return null;
  }

  // Check expiry
  if (Date.now() > stored.expiresAt) {
    mappingStore.delete(mappingId);
    return null;
  }

  // Delete after retrieval (one-time use)
  mappingStore.delete(mappingId);

  return stored.mappings;
}

/**
 * Clean up expired mappings (call periodically)
 */
export function cleanupExpiredMappings(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, stored] of mappingStore.entries()) {
    if (now > stored.expiresAt) {
      mappingStore.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}

// ============================================================================
// Convenience function for one-shot anonymization + AI + de-anonymization
// ============================================================================

export interface SecureAIOptions {
  onAnonymized?: (result: AnonymizationResult) => void;
  onAIResponse?: (response: string) => void;
}

/**
 * Process text through AI with automatic anonymization/de-anonymization
 *
 * @param text - Original text with real data
 * @param aiCall - Function that calls your AI provider with anonymized text
 * @param options - Optional callbacks for logging/debugging
 * @returns AI response with original values restored
 *
 * @example
 * const result = await processWithAnonymization(
 *   contractText,
 *   async (anonymizedText) => {
 *     const response = await openai.chat.completions.create({
 *       model: 'gpt-4o-mini',
 *       messages: [{ role: 'user', content: `Analyze: ${anonymizedText}` }],
 *     });
 *     return response.choices[0].message.content;
 *   }
 * );
 */
export async function processWithAnonymization(
  text: string,
  aiCall: (anonymizedText: string) => Promise<string>,
  options: SecureAIOptions = {}
): Promise<string> {
  const anonymizer = new ContractAnonymizer();

  // Step 1: Anonymize
  const { anonymizedText, mappings } = anonymizer.anonymize(text);

  if (options.onAnonymized) {
    options.onAnonymized({ anonymizedText, mappings, mappingId: '', stats: { totalEntities: mappings.length, byType: {} as Record<EntityType, number> } });
  }

  // Step 2: Call AI with anonymized text
  const aiResponse = await aiCall(anonymizedText);

  if (options.onAIResponse) {
    options.onAIResponse(aiResponse);
  }

  // Step 3: De-anonymize response
  const realResponse = anonymizer.deAnonymize(aiResponse, mappings);

  return realResponse;
}

// ============================================================================
// Export default instance for simple usage
// ============================================================================

export const anonymizer = new ContractAnonymizer();

export default ContractAnonymizer;

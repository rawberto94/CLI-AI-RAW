/**
 * Specialized Legal Named Entity Recognition (NER)
 * 
 * Advanced entity extraction for legal contracts including:
 * - Party names and roles
 * - Dates (effective, expiration, signing)
 * - Monetary amounts and currencies
 * - Legal terms and clauses
 * - Jurisdiction and governing law
 * - Contact information
 * - Contract-specific identifiers
 */

import pino from 'pino';

const logger = pino({ name: 'legal-ner' });

// ============================================================================
// TYPES
// ============================================================================

export type EntityType =
  | 'PARTY_NAME'
  | 'PARTY_ROLE'
  | 'EFFECTIVE_DATE'
  | 'EXPIRATION_DATE'
  | 'SIGNING_DATE'
  | 'NOTICE_PERIOD'
  | 'MONETARY_AMOUNT'
  | 'PERCENTAGE'
  | 'DURATION'
  | 'JURISDICTION'
  | 'GOVERNING_LAW'
  | 'ADDRESS'
  | 'EMAIL'
  | 'PHONE'
  | 'CONTRACT_ID'
  | 'CLAUSE_REFERENCE'
  | 'LEGAL_TERM'
  | 'OBLIGATION'
  | 'CONDITION'
  | 'TERMINATION_CLAUSE'
  | 'PENALTY_CLAUSE'
  | 'CONFIDENTIALITY'
  | 'LIABILITY_LIMIT'
  | 'INDEMNIFICATION'
  | 'INTELLECTUAL_PROPERTY'
  | 'SIGNATURE_BLOCK';

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  normalizedValue?: string;
  confidence: number;
  start: number;
  end: number;
  context?: string;
  metadata?: Record<string, unknown>;
}

export interface NERResult {
  entities: ExtractedEntity[];
  documentType?: string;
  language?: string;
  processingTime: number;
  warnings?: string[];
}

export interface NEROptions {
  enablePartyExtraction?: boolean;
  enableDateExtraction?: boolean;
  enableMonetaryExtraction?: boolean;
  enableClauseExtraction?: boolean;
  enableContactExtraction?: boolean;
  minConfidence?: number;
  contextWindow?: number; // Characters before/after for context
  language?: 'en' | 'de' | 'fr' | 'it' | 'auto';
}

// ============================================================================
// PATTERNS FOR ENTITY EXTRACTION
// ============================================================================

const PATTERNS = {
  // Party patterns
  PARTY_INDICATORS: [
    /(?:hereinafter|herein)\s+(?:referred\s+to\s+as|called)\s+["""]?([A-Z][^""".,]+)["""]?/gi,
    /(?:the\s+)?["""]([A-Z][A-Za-z\s&.,]+(?:Inc|LLC|Ltd|Corp|GmbH|AG|SA|SARL|Limited|Corporation|Company|Co)[.]?)["""]?/gi,
    /(?:between|by\s+and\s+between)\s+([A-Z][A-Za-z\s&.,]+)/gi,
    /(?:^|\n)\s*(?:Party\s+[AB12]|First\s+Party|Second\s+Party):\s*([^\n]+)/gim,
  ],
  
  PARTY_ROLES: [
    { pattern: /\b(Licensor|Licensee)\b/gi, role: 'LICENSE' },
    { pattern: /\b(Vendor|Supplier|Provider)\b/gi, role: 'VENDOR' },
    { pattern: /\b(Client|Customer|Purchaser|Buyer)\b/gi, role: 'CLIENT' },
    { pattern: /\b(Employer|Employee)\b/gi, role: 'EMPLOYMENT' },
    { pattern: /\b(Landlord|Tenant|Lessor|Lessee)\b/gi, role: 'LEASE' },
    { pattern: /\b(Discloser|Recipient)\b/gi, role: 'NDA' },
    { pattern: /\b(Contractor|Subcontractor)\b/gi, role: 'SERVICE' },
  ],

  // Date patterns
  DATES: {
    ISO: /\b(\d{4}-\d{2}-\d{2})\b/g,
    US_LONG: /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi,
    US_SHORT: /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
    EU: /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/g,
    ORDINAL: /\b(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)\s+(?:day\s+of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4})\b/gi,
  },

  DATE_CONTEXTS: [
    { pattern: /effective\s+(?:date|as\s+of)[:\s]+([^\n,;]+)/gi, type: 'EFFECTIVE_DATE' as EntityType },
    { pattern: /commenc(?:e|ing)\s+(?:on|date)[:\s]+([^\n,;]+)/gi, type: 'EFFECTIVE_DATE' as EntityType },
    { pattern: /expir(?:e|ation|es|ing)\s+(?:on|date)[:\s]+([^\n,;]+)/gi, type: 'EXPIRATION_DATE' as EntityType },
    { pattern: /terminat(?:e|ion|es|ing)\s+(?:on|date)[:\s]+([^\n,;]+)/gi, type: 'EXPIRATION_DATE' as EntityType },
    { pattern: /sign(?:ed|ing)\s+(?:on|date)[:\s]+([^\n,;]+)/gi, type: 'SIGNING_DATE' as EntityType },
    { pattern: /dated\s+(?:as\s+of\s+)?([^\n,;]+)/gi, type: 'SIGNING_DATE' as EntityType },
  ],

  // Monetary patterns
  MONETARY: {
    USD: /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:USD|U\.S\.\s*Dollars?|Dollars?)?/gi,
    EUR: /€\s*([\d,]+(?:\.\d{2})?)\s*(?:EUR|Euros?)?|(?:EUR|Euros?)\s*([\d,]+(?:\.\d{2})?)/gi,
    CHF: /(?:CHF|Fr\.?|SFr\.?)\s*([\d',]+(?:\.\d{2})?)/gi,
    GBP: /£\s*([\d,]+(?:\.\d{2})?)\s*(?:GBP|Pounds?(?:\s+Sterling)?)?/gi,
    GENERIC: /\b([\d,]+(?:\.\d{2})?)\s*(?:USD|EUR|CHF|GBP|dollars?|euros?|francs?|pounds?)/gi,
  },

  PERCENTAGES: /\b(\d+(?:\.\d+)?)\s*%/g,

  // Duration patterns
  DURATIONS: [
    /\b(\d+)\s*(?:year|yr)s?\b/gi,
    /\b(\d+)\s*months?\b/gi,
    /\b(\d+)\s*(?:week|wk)s?\b/gi,
    /\b(\d+)\s*(?:day|business\s+day)s?\b/gi,
    /\b(\d+)\s*(?:hour|hr)s?\b/gi,
  ],

  // Jurisdiction and governing law
  JURISDICTION: [
    /governed\s+by\s+(?:the\s+)?(?:laws?\s+of\s+)?(?:the\s+)?([A-Z][A-Za-z\s]+(?:State|Canton|Province|Country)?)/gi,
    /jurisdiction\s+(?:of|in)\s+(?:the\s+)?([A-Z][A-Za-z\s,]+)/gi,
    /courts?\s+(?:of|in|located\s+in)\s+(?:the\s+)?([A-Z][A-Za-z\s,]+)/gi,
    /(?:Swiss|German|French|Italian|English|US|American)\s+law/gi,
  ],

  // Contact patterns
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  PHONE: /(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,6}/g,
  
  ADDRESS: {
    US: /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)[.,]?\s*(?:Suite|Ste|Unit|#|Apt)?\s*\d*[,.]?\s*[A-Za-z\s]+[,.]?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/gi,
    CH: /[A-Za-z\s]+(?:strasse|straße|weg|platz|gasse)\s*\d+[a-z]?[,.]?\s*(?:CH-)?\d{4}\s+[A-Za-z\s]+/gi,
    GENERIC: /\d+[A-Za-z\s,.-]+(?:\d{4,6})\s*[A-Za-z\s]+/gi,
  },

  // Clause patterns
  CLAUSE_REF: /(?:Section|Article|Clause|Paragraph|§)\s*(\d+(?:\.\d+)*)/gi,
  
  LEGAL_TERMS: [
    /\b(force\s+majeure)\b/gi,
    /\b(indemnif(?:y|ication))\b/gi,
    /\b(limitation\s+of\s+liability)\b/gi,
    /\b(intellectual\s+property(?:\s+rights)?)\b/gi,
    /\b(confidential(?:ity)?(?:\s+obligations?)?)\b/gi,
    /\b(non-?disclosure)\b/gi,
    /\b(non-?compete)\b/gi,
    /\b(non-?solicitation)\b/gi,
    /\b(termination(?:\s+for\s+(?:cause|convenience))?)\b/gi,
    /\b(warranty|warranties)\b/gi,
    /\b(representations?\s+and\s+warranties)\b/gi,
    /\b(arbitration)\b/gi,
    /\b(mediation)\b/gi,
    /\b(dispute\s+resolution)\b/gi,
    /\b(assignment(?:\s+and\s+delegation)?)\b/gi,
    /\b(severability)\b/gi,
    /\b(entire\s+agreement)\b/gi,
    /\b(amendment(?:s)?(?:\s+and\s+waiver)?)\b/gi,
    /\b(notices?(?:\s+and\s+communications?)?)\b/gi,
  ],

  // Signature block patterns
  SIGNATURE_BLOCK: /(?:^|\n)\s*(?:By|Signature|Authorized\s+Signatory)[:\s]*_{3,}|(?:Name|Title|Date)[:\s]*_{3,}/gim,

  // Contract ID patterns
  CONTRACT_ID: [
    /(?:Contract|Agreement|Document)\s*(?:#|No\.?|Number)[:\s]*([A-Z0-9-]+)/gi,
    /(?:Ref(?:erence)?|ID)[:\s]*([A-Z0-9-]{5,})/gi,
  ],
};

// ============================================================================
// SWISS-SPECIFIC PATTERNS
// ============================================================================

const SWISS_PATTERNS = {
  // Swiss company forms
  COMPANY_FORMS: /\b(?:AG|SA|GmbH|Sàrl|Sagl|Genossenschaft|Stiftung|Verein)\b/gi,
  
  // Swiss cantons
  CANTONS: /\b(?:Zürich|Bern|Luzern|Uri|Schwyz|Obwalden|Nidwalden|Glarus|Zug|Fribourg|Solothurn|Basel(?:-Stadt|-Landschaft)?|Schaffhausen|Appenzell|St\.?\s*Gallen|Graubünden|Aargau|Thurgau|Ticino|Vaud|Valais|Neuchâtel|Genève|Geneva|Jura)\b/gi,
  
  // Swiss legal terms
  OR_REFERENCE: /(?:Art(?:ikel|icle)?\.?\s*)?(\d+(?:\s*(?:ff|bis|ter))?)\s*(?:OR|CO|CC)/gi,
  ZGB_REFERENCE: /(?:Art(?:ikel|icle)?\.?\s*)?(\d+(?:\s*(?:ff|bis|ter))?)\s*(?:ZGB|CC)/gi,
  
  // Swiss addresses
  ADDRESS: /[A-Za-zäöüÄÖÜéèàêâ\s]+(?:strasse|straße|weg|platz|gasse|allee|ring)\s*\d+[a-z]?[,.\s]+(?:CH[-\s]?)?\d{4}\s+[A-Za-zäöüÄÖÜéèàêâ\s]+/gi,
  
  // Swiss postal code
  POSTAL_CODE: /(?:CH[-\s]?)?\d{4}\s+[A-Za-zäöüÄÖÜéèàêâ\s]+/gi,
  
  // Swiss currencies
  FRANCS: /(?:CHF|Fr\.?|SFr\.?)\s*([\d'']+(?:\.\d{2})?)|(?:Schweizer\s+)?Franken\s*([\d'']+(?:\.\d{2})?)/gi,
};

// ============================================================================
// MULTILINGUAL PATTERNS
// ============================================================================

const MULTILINGUAL_PATTERNS = {
  de: {
    PARTY_INDICATORS: [
      /zwischen\s+([A-Za-zäöüÄÖÜß\s&.,]+)(?:\s+und|\s*,)/gi,
      /(?:im\s+Folgenden|nachfolgend)\s+[""„]([^""„]+)[""„]/gi,
    ],
    DATE_CONTEXTS: [
      { pattern: /(?:ab|vom|per)\s+(\d{1,2}[.]\d{1,2}[.]\d{2,4})/gi, type: 'EFFECTIVE_DATE' as EntityType },
      { pattern: /(?:bis|endet\s+am)\s+(\d{1,2}[.]\d{1,2}[.]\d{2,4})/gi, type: 'EXPIRATION_DATE' as EntityType },
    ],
    LEGAL_TERMS: [
      /\b(Haftungsbeschränkung)\b/gi,
      /\b(Geheimhaltung(?:spflicht)?)\b/gi,
      /\b(Kündigung(?:sfrist)?)\b/gi,
      /\b(Gewährleistung)\b/gi,
      /\b(Schadenersatz)\b/gi,
      /\b(Gerichtsstand)\b/gi,
    ],
  },
  fr: {
    PARTY_INDICATORS: [
      /entre\s+([A-Za-zéèàêâùûîïÉÈÀÊÂÙÛÎÏ\s&.,]+)(?:\s+et|\s*,)/gi,
      /(?:ci-après|ci-dessous)\s+[""«]([^""»]+)[""»]/gi,
    ],
    DATE_CONTEXTS: [
      { pattern: /(?:à\s+partir\s+du|dès\s+le)\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/gi, type: 'EFFECTIVE_DATE' as EntityType },
      { pattern: /(?:jusqu'au|expire\s+le)\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/gi, type: 'EXPIRATION_DATE' as EntityType },
    ],
    LEGAL_TERMS: [
      /\b(limitation\s+de\s+responsabilité)\b/gi,
      /\b(confidentialité)\b/gi,
      /\b(résiliation)\b/gi,
      /\b(garantie)\b/gi,
      /\b(dommages[- ]intérêts)\b/gi,
      /\b(for\s+juridique)\b/gi,
    ],
  },
  it: {
    PARTY_INDICATORS: [
      /tra\s+([A-Za-zàèéìòùÀÈÉÌÒÙ\s&.,]+)(?:\s+e|\s*,)/gi,
      /(?:di\s+seguito|in\s+appresso)\s+[""«]([^""»]+)[""»]/gi,
    ],
    DATE_CONTEXTS: [
      { pattern: /(?:a\s+partire\s+dal|dal)\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/gi, type: 'EFFECTIVE_DATE' as EntityType },
      { pattern: /(?:fino\s+al|scade\s+il)\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/gi, type: 'EXPIRATION_DATE' as EntityType },
    ],
    LEGAL_TERMS: [
      /\b(limitazione\s+di\s+responsabilità)\b/gi,
      /\b(riservatezza)\b/gi,
      /\b(risoluzione)\b/gi,
      /\b(garanzia)\b/gi,
      /\b(risarcimento\s+danni)\b/gi,
      /\b(foro\s+competente)\b/gi,
    ],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect document language
 */
function detectLanguage(text: string): 'en' | 'de' | 'fr' | 'it' {
  const indicators = {
    en: /\b(whereas|agreement|party|herein|shall|between|pursuant)\b/gi,
    de: /\b(zwischen|vereinbarung|vertrag|hiermit|gemäß|vertragspartei)\b/gi,
    fr: /\b(entre|accord|contrat|ci-après|partie|conformément)\b/gi,
    it: /\b(tra|accordo|contratto|seguente|parte|conformemente)\b/gi,
  };

  const counts = {
    en: (text.match(indicators.en) || []).length,
    de: (text.match(indicators.de) || []).length,
    fr: (text.match(indicators.fr) || []).length,
    it: (text.match(indicators.it) || []).length,
  };

  const maxLang = Object.entries(counts).reduce((a, b) => 
    counts[a[0] as keyof typeof counts] > counts[b[0] as keyof typeof counts] ? a : b
  );

  return (maxLang[1] > 0 ? maxLang[0] : 'en') as 'en' | 'de' | 'fr' | 'it';
}

/**
 * Extract context around a match
 */
function getContext(text: string, start: number, end: number, windowSize: number = 50): string {
  const contextStart = Math.max(0, start - windowSize);
  const contextEnd = Math.min(text.length, end + windowSize);
  return text.slice(contextStart, contextEnd).replace(/\s+/g, ' ').trim();
}

/**
 * Normalize a date string to ISO format
 */
function normalizeDate(dateStr: string): string | undefined {
  try {
    // Try parsing various formats
    const formats = [
      { regex: /^(\d{4})-(\d{2})-(\d{2})$/, order: [1, 2, 3] },
      { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: [3, 1, 2] }, // US
      { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, order: [3, 1, 2], addCentury: true },
      { regex: /^(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/, order: [3, 2, 1] }, // EU
      { regex: /^(\d{1,2})[.-](\d{1,2})[.-](\d{2})$/, order: [3, 2, 1], addCentury: true },
    ];

    for (const fmt of formats) {
      const match = dateStr.match(fmt.regex);
      if (match) {
        let year = parseInt(match[fmt.order[0]!]!, 10);
        const month = parseInt(match[fmt.order[1]!]!, 10);
        const day = parseInt(match[fmt.order[2]!]!, 10);
        
        if (fmt.addCentury) {
          year += year > 50 ? 1900 : 2000;
        }
        
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    // Try natural language dates
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Fall through
  }
  return undefined;
}

/**
 * Normalize monetary amount
 */
function normalizeAmount(amountStr: string, currency: string): { amount: number; currency: string } {
  // Remove thousand separators and normalize decimal
  const cleaned = amountStr
    .replace(/[',\s]/g, '')
    .replace(/(\d)[''](\d)/g, '$1$2');
  
  return {
    amount: parseFloat(cleaned) || 0,
    currency: currency.toUpperCase(),
  };
}

// ============================================================================
// MAIN EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extract party names and roles
 */
function extractParties(text: string, language: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  // Use language-specific patterns if available
  const langPatterns = MULTILINGUAL_PATTERNS[language as keyof typeof MULTILINGUAL_PATTERNS];
  const patterns = langPatterns?.PARTY_INDICATORS 
    ? [...PATTERNS.PARTY_INDICATORS, ...langPatterns.PARTY_INDICATORS]
    : PATTERNS.PARTY_INDICATORS;

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const value = (match[1] || match[0]).trim();
      const normalized = value.replace(/\s+/g, ' ');
      
      if (normalized.length > 2 && normalized.length < 200 && !seen.has(normalized.toLowerCase())) {
        seen.add(normalized.toLowerCase());
        entities.push({
          type: 'PARTY_NAME',
          value: normalized,
          confidence: 0.8,
          start: match.index,
          end: match.index + match[0].length,
          context: getContext(text, match.index, match.index + match[0].length),
        });
      }
    }
  }

  // Extract party roles
  for (const { pattern, role } of PATTERNS.PARTY_ROLES) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      entities.push({
        type: 'PARTY_ROLE',
        value: match[1] || match[0],
        confidence: 0.9,
        start: match.index,
        end: match.index + match[0].length,
        metadata: { roleType: role },
      });
    }
  }

  return entities;
}

/**
 * Extract dates
 */
function extractDates(text: string, language: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Extract dates with context first (more specific)
  const langPatterns = MULTILINGUAL_PATTERNS[language as keyof typeof MULTILINGUAL_PATTERNS];
  const contextPatterns = langPatterns?.DATE_CONTEXTS 
    ? [...PATTERNS.DATE_CONTEXTS, ...langPatterns.DATE_CONTEXTS]
    : PATTERNS.DATE_CONTEXTS;

  for (const { pattern, type } of contextPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const dateStr = match[1]?.trim();
      if (dateStr) {
        const normalized = normalizeDate(dateStr);
        entities.push({
          type,
          value: dateStr,
          normalizedValue: normalized,
          confidence: 0.85,
          start: match.index,
          end: match.index + match[0].length,
          context: getContext(text, match.index, match.index + match[0].length),
        });
      }
    }
  }

  return entities;
}

/**
 * Extract monetary amounts
 */
function extractMonetary(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  const currencyPatterns: { pattern: RegExp; currency: string }[] = [
    { pattern: PATTERNS.MONETARY.USD, currency: 'USD' },
    { pattern: PATTERNS.MONETARY.EUR, currency: 'EUR' },
    { pattern: PATTERNS.MONETARY.CHF, currency: 'CHF' },
    { pattern: PATTERNS.MONETARY.GBP, currency: 'GBP' },
    { pattern: SWISS_PATTERNS.FRANCS, currency: 'CHF' },
  ];

  for (const { pattern, currency } of currencyPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const amountStr = match[1] || match[2] || '';
      if (amountStr) {
        const { amount } = normalizeAmount(amountStr, currency);
        entities.push({
          type: 'MONETARY_AMOUNT',
          value: match[0],
          normalizedValue: `${currency} ${amount.toFixed(2)}`,
          confidence: 0.9,
          start: match.index,
          end: match.index + match[0].length,
          metadata: { amount, currency },
        });
      }
    }
  }

  // Extract percentages
  const percentRegex = new RegExp(PATTERNS.PERCENTAGES.source, PATTERNS.PERCENTAGES.flags);
  let percentMatch;
  
  while ((percentMatch = percentRegex.exec(text)) !== null) {
    entities.push({
      type: 'PERCENTAGE',
      value: percentMatch[0],
      normalizedValue: `${parseFloat(percentMatch[1]!)}%`,
      confidence: 0.95,
      start: percentMatch.index,
      end: percentMatch.index + percentMatch[0].length,
      metadata: { value: parseFloat(percentMatch[1]!) },
    });
  }

  return entities;
}

/**
 * Extract jurisdiction and governing law
 */
function extractJurisdiction(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS.JURISDICTION) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const value = (match[1] || match[0]).trim();
      const normalized = value.replace(/\s+/g, ' ');
      
      if (!seen.has(normalized.toLowerCase())) {
        seen.add(normalized.toLowerCase());
        entities.push({
          type: match[0].toLowerCase().includes('law') ? 'GOVERNING_LAW' : 'JURISDICTION',
          value: normalized,
          confidence: 0.85,
          start: match.index,
          end: match.index + match[0].length,
          context: getContext(text, match.index, match.index + match[0].length),
        });
      }
    }
  }

  // Swiss cantons
  const cantonRegex = new RegExp(SWISS_PATTERNS.CANTONS.source, SWISS_PATTERNS.CANTONS.flags);
  let cantonMatch;
  
  while ((cantonMatch = cantonRegex.exec(text)) !== null) {
    if (!seen.has(cantonMatch[0].toLowerCase())) {
      seen.add(cantonMatch[0].toLowerCase());
      entities.push({
        type: 'JURISDICTION',
        value: cantonMatch[0],
        confidence: 0.9,
        start: cantonMatch.index,
        end: cantonMatch.index + cantonMatch[0].length,
        metadata: { type: 'swiss_canton' },
      });
    }
  }

  return entities;
}

/**
 * Extract contact information
 */
function extractContacts(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Emails
  const emailRegex = new RegExp(PATTERNS.EMAIL.source, PATTERNS.EMAIL.flags);
  let emailMatch;
  
  while ((emailMatch = emailRegex.exec(text)) !== null) {
    entities.push({
      type: 'EMAIL',
      value: emailMatch[0],
      confidence: 0.95,
      start: emailMatch.index,
      end: emailMatch.index + emailMatch[0].length,
    });
  }

  // Phones
  const phoneRegex = new RegExp(PATTERNS.PHONE.source, PATTERNS.PHONE.flags);
  let phoneMatch;
  
  while ((phoneMatch = phoneRegex.exec(text)) !== null) {
    // Basic validation - must have at least 7 digits
    const digits = phoneMatch[0].replace(/\D/g, '');
    if (digits.length >= 7) {
      entities.push({
        type: 'PHONE',
        value: phoneMatch[0],
        normalizedValue: digits,
        confidence: 0.8,
        start: phoneMatch.index,
        end: phoneMatch.index + phoneMatch[0].length,
      });
    }
  }

  // Swiss addresses
  const swissAddrRegex = new RegExp(SWISS_PATTERNS.ADDRESS.source, SWISS_PATTERNS.ADDRESS.flags);
  let addrMatch;
  
  while ((addrMatch = swissAddrRegex.exec(text)) !== null) {
    entities.push({
      type: 'ADDRESS',
      value: addrMatch[0].replace(/\s+/g, ' ').trim(),
      confidence: 0.8,
      start: addrMatch.index,
      end: addrMatch.index + addrMatch[0].length,
      metadata: { country: 'CH' },
    });
  }

  return entities;
}

/**
 * Extract legal terms and clauses
 */
function extractLegalTerms(text: string, language: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  // Language-specific terms
  const langPatterns = MULTILINGUAL_PATTERNS[language as keyof typeof MULTILINGUAL_PATTERNS];
  const termPatterns = langPatterns?.LEGAL_TERMS 
    ? [...PATTERNS.LEGAL_TERMS, ...langPatterns.LEGAL_TERMS]
    : PATTERNS.LEGAL_TERMS;

  for (const pattern of termPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const term = (match[1] || match[0]).toLowerCase().replace(/\s+/g, ' ');
      if (!seen.has(term)) {
        seen.add(term);
        entities.push({
          type: 'LEGAL_TERM',
          value: match[1] || match[0],
          normalizedValue: term,
          confidence: 0.85,
          start: match.index,
          end: match.index + match[0].length,
          context: getContext(text, match.index, match.index + match[0].length),
        });
      }
    }
  }

  // Clause references
  const clauseRegex = new RegExp(PATTERNS.CLAUSE_REF.source, PATTERNS.CLAUSE_REF.flags);
  let clauseMatch;
  
  while ((clauseMatch = clauseRegex.exec(text)) !== null) {
    entities.push({
      type: 'CLAUSE_REFERENCE',
      value: clauseMatch[0],
      normalizedValue: clauseMatch[1],
      confidence: 0.9,
      start: clauseMatch.index,
      end: clauseMatch.index + clauseMatch[0].length,
    });
  }

  // Swiss law references
  const orRegex = new RegExp(SWISS_PATTERNS.OR_REFERENCE.source, SWISS_PATTERNS.OR_REFERENCE.flags);
  let orMatch;
  
  while ((orMatch = orRegex.exec(text)) !== null) {
    entities.push({
      type: 'CLAUSE_REFERENCE',
      value: orMatch[0],
      confidence: 0.9,
      start: orMatch.index,
      end: orMatch.index + orMatch[0].length,
      metadata: { lawCode: 'OR/CO', country: 'CH' },
    });
  }

  return entities;
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Run full NER extraction on text
 */
export async function extractLegalEntities(
  text: string,
  options: NEROptions = {}
): Promise<NERResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  const {
    enablePartyExtraction = true,
    enableDateExtraction = true,
    enableMonetaryExtraction = true,
    enableClauseExtraction = true,
    enableContactExtraction = true,
    minConfidence = 0.6,
    language = 'auto',
  } = options;

  // Detect or use specified language
  const detectedLanguage = language === 'auto' ? detectLanguage(text) : language;
  
  logger.debug({ language: detectedLanguage, textLength: text.length }, 'Starting NER extraction');

  const allEntities: ExtractedEntity[] = [];

  try {
    // Extract entities based on options
    if (enablePartyExtraction) {
      allEntities.push(...extractParties(text, detectedLanguage));
    }

    if (enableDateExtraction) {
      allEntities.push(...extractDates(text, detectedLanguage));
    }

    if (enableMonetaryExtraction) {
      allEntities.push(...extractMonetary(text));
    }

    if (enableClauseExtraction) {
      allEntities.push(...extractLegalTerms(text, detectedLanguage));
    }

    if (enableContactExtraction) {
      allEntities.push(...extractContacts(text));
      allEntities.push(...extractJurisdiction(text));
    }

  } catch (error) {
    logger.error({ error }, 'Error during NER extraction');
    warnings.push(`Extraction error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Filter by minimum confidence
  const filteredEntities = allEntities.filter(e => e.confidence >= minConfidence);

  // Sort by position in text
  filteredEntities.sort((a, b) => a.start - b.start);

  const processingTime = Date.now() - startTime;

  logger.info({
    totalEntities: filteredEntities.length,
    language: detectedLanguage,
    processingTime,
  }, 'NER extraction complete');

  return {
    entities: filteredEntities,
    language: detectedLanguage,
    processingTime,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================================
// SPECIALIZED EXTRACTORS
// ============================================================================

/**
 * Extract only key contract metadata
 */
export async function extractContractMetadata(text: string): Promise<{
  parties: string[];
  effectiveDate?: string;
  expirationDate?: string;
  totalValue?: { amount: number; currency: string };
  jurisdiction?: string;
  documentType?: string;
}> {
  const result = await extractLegalEntities(text, {
    enableClauseExtraction: false,
    enableContactExtraction: false,
    minConfidence: 0.7,
  });

  const parties = result.entities
    .filter(e => e.type === 'PARTY_NAME')
    .map(e => e.value);

  const effectiveDate = result.entities
    .find(e => e.type === 'EFFECTIVE_DATE')?.normalizedValue;

  const expirationDate = result.entities
    .find(e => e.type === 'EXPIRATION_DATE')?.normalizedValue;

  const monetaryEntities = result.entities.filter(e => e.type === 'MONETARY_AMOUNT');
  const maxAmount = monetaryEntities.reduce((max, e) => {
    const amount = e.metadata?.amount as number;
    if (!max || amount > max.amount) {
      return { amount, currency: e.metadata?.currency as string };
    }
    return max;
  }, undefined as { amount: number; currency: string } | undefined);

  const jurisdiction = result.entities
    .find(e => e.type === 'JURISDICTION' || e.type === 'GOVERNING_LAW')?.value;

  return {
    parties: [...new Set(parties)],
    effectiveDate,
    expirationDate,
    totalValue: maxAmount,
    jurisdiction,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const LegalNER = {
  extract: extractLegalEntities,
  extractMetadata: extractContractMetadata,
  detectLanguage,
  PATTERNS,
  SWISS_PATTERNS,
  MULTILINGUAL_PATTERNS,
};

export default LegalNER;

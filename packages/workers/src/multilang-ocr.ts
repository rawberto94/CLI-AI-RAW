/**
 * Multi-Language OCR Support Module
 * 
 * Supports Swiss official languages (German, French, Italian)
 * plus English for international contracts.
 * 
 * Features:
 * - Language detection
 * - Language-specific OCR dictionaries
 * - Post-OCR spell correction per language
 * - Mixed-language document handling
 */

import pino from 'pino';

const logger = pino({ name: 'multilang-ocr' });

// ============================================================================
// TYPES
// ============================================================================

export type SupportedLanguage = 'en' | 'de' | 'fr' | 'it';
export type TesseractLangCode = 'eng' | 'deu' | 'fra' | 'ita';

export interface LanguageDetectionResult {
  primaryLanguage: SupportedLanguage;
  confidence: number;
  detectedLanguages: Array<{
    language: SupportedLanguage;
    percentage: number;
    confidence: number;
  }>;
  isMixedLanguage: boolean;
  recommendedOCRLanguages: TesseractLangCode[];
}

export interface MultiLangOCROptions {
  preferredLanguages?: SupportedLanguage[];
  autoDetect?: boolean;
  fallbackLanguage?: SupportedLanguage;
  enableSpellCheck?: boolean;
  enableSpecializedDictionaries?: boolean;
  minConfidenceForDetection?: number;
}

export interface LanguageSpecificCorrection {
  original: string;
  corrected: string;
  language: SupportedLanguage;
  confidence: number;
  type: 'spelling' | 'grammar' | 'legal_term' | 'proper_noun';
}

export interface MultiLangOCRResult {
  text: string;
  detectedLanguages: LanguageDetectionResult;
  corrections: LanguageSpecificCorrection[];
  processingInfo: {
    ocrLanguages: TesseractLangCode[];
    spellCheckApplied: boolean;
    legalDictionaryUsed: boolean;
    processingTime: number;
  };
}

// ============================================================================
// LANGUAGE MAPPINGS
// ============================================================================

export const LANG_TO_TESSERACT: Record<SupportedLanguage, TesseractLangCode> = {
  en: 'eng',
  de: 'deu',
  fr: 'fra',
  it: 'ita',
};

export const TESSERACT_TO_LANG: Record<TesseractLangCode, SupportedLanguage> = {
  eng: 'en',
  deu: 'de',
  fra: 'fr',
  ita: 'it',
};

// Language names for display
export const LANGUAGE_NAMES: Record<SupportedLanguage, Record<SupportedLanguage, string>> = {
  en: { en: 'English', de: 'German', fr: 'French', it: 'Italian' },
  de: { en: 'Englisch', de: 'Deutsch', fr: 'Französisch', it: 'Italienisch' },
  fr: { en: 'Anglais', de: 'Allemand', fr: 'Français', it: 'Italien' },
  it: { en: 'Inglese', de: 'Tedesco', fr: 'Francese', it: 'Italiano' },
};

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

// Common words by language (stopwords and frequent terms)
const LANGUAGE_INDICATORS: Record<SupportedLanguage, RegExp[]> = {
  en: [
    /\bthe\b/gi, /\band\b/gi, /\bof\b/gi, /\bto\b/gi, /\bin\b/gi,
    /\bthat\b/gi, /\bfor\b/gi, /\bis\b/gi, /\bon\b/gi, /\bwith\b/gi,
    /\bagreement\b/gi, /\bshall\b/gi, /\bparty\b/gi, /\bprovide\b/gi,
    /\bpursuant\b/gi, /\bhereby\b/gi, /\bwhereas\b/gi,
  ],
  de: [
    /\bder\b/gi, /\bdie\b/gi, /\bdas\b/gi, /\bund\b/gi, /\bin\b/gi,
    /\bvon\b/gi, /\bzu\b/gi, /\bmit\b/gi, /\bfür\b/gi, /\bauf\b/gi,
    /\bvertrag\b/gi, /\bvereinbarung\b/gi, /\bpartei\b/gi, /\bzwischen\b/gi,
    /\bgemäß\b/gi, /\bhiermit\b/gi, /\bnachfolgend\b/gi,
    /\bäöü/gi, /ß/gi, // German-specific characters
  ],
  fr: [
    /\ble\b/gi, /\bla\b/gi, /\bles\b/gi, /\bet\b/gi, /\bde\b/gi,
    /\bdu\b/gi, /\bdes\b/gi, /\bun\b/gi, /\bune\b/gi, /\bpour\b/gi,
    /\bcontrat\b/gi, /\baccord\b/gi, /\bpartie\b/gi, /\bentre\b/gi,
    /\bconformément\b/gi, /\bci-après\b/gi, /\bprésent\b/gi,
    /[éèêë]/gi, /[àâ]/gi, /[çœ]/gi, // French-specific characters
  ],
  it: [
    /\bil\b/gi, /\bla\b/gi, /\blo\b/gi, /\bi\b/gi, /\ble\b/gi,
    /\be\b/gi, /\bdi\b/gi, /\bche\b/gi, /\bper\b/gi, /\bcon\b/gi,
    /\bcontratto\b/gi, /\baccordo\b/gi, /\bparte\b/gi, /\btra\b/gi,
    /\bconformemente\b/gi, /\bpresente\b/gi, /\bseguente\b/gi,
    /[àèéìòù]/gi, // Italian-specific characters
  ],
};

// Legal-specific terms by language
const LEGAL_TERMS: Record<SupportedLanguage, string[]> = {
  en: [
    'agreement', 'contract', 'party', 'parties', 'whereas', 'therefore',
    'hereinafter', 'hereby', 'hereto', 'thereof', 'notwithstanding',
    'pursuant', 'indemnify', 'warranty', 'liability', 'termination',
    'confidential', 'jurisdiction', 'governing law', 'arbitration',
    'amendment', 'assignment', 'force majeure', 'severability',
  ],
  de: [
    'vertrag', 'vereinbarung', 'vertragspartei', 'parteien', 'präambel',
    'hiermit', 'nachfolgend', 'vorgenannt', 'unbeschadet', 'gemäß',
    'haftung', 'gewährleistung', 'kündigung', 'geheimhaltung',
    'gerichtsstand', 'schiedsverfahren', 'änderung', 'abtretung',
    'höhere gewalt', 'salvatorische klausel', 'erfüllungsort',
    'schadensersatz', 'vertragsstrafe', 'laufzeit', 'verlängerung',
  ],
  fr: [
    'contrat', 'accord', 'convention', 'partie', 'parties', 'préambule',
    'ci-après', 'présent', 'susmentionné', 'nonobstant', 'conformément',
    'responsabilité', 'garantie', 'résiliation', 'confidentialité',
    'juridiction', 'droit applicable', 'arbitrage', 'modification',
    'cession', 'force majeure', 'divisibilité', 'domicile',
    'dommages-intérêts', 'clause pénale', 'durée', 'renouvellement',
  ],
  it: [
    'contratto', 'accordo', 'convenzione', 'parte', 'parti', 'premessa',
    'di seguito', 'presente', 'suddetto', 'nonostante', 'conformemente',
    'responsabilità', 'garanzia', 'risoluzione', 'riservatezza',
    'giurisdizione', 'legge applicabile', 'arbitrato', 'modifica',
    'cessione', 'forza maggiore', 'separabilità', 'domicilio',
    'risarcimento danni', 'penale', 'durata', 'rinnovo',
  ],
};

/**
 * Detect the primary language of a text
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  const scores: Record<SupportedLanguage, number> = { en: 0, de: 0, fr: 0, it: 0 };
  const totalMatches: Record<SupportedLanguage, number> = { en: 0, de: 0, fr: 0, it: 0 };

  // Count matches for each language
  for (const [lang, patterns] of Object.entries(LANGUAGE_INDICATORS)) {
    const language = lang as SupportedLanguage;
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        scores[language] += matches.length;
        totalMatches[language] += 1;
      }
    }
  }

  // Normalize scores
  const maxScore = Math.max(...Object.values(scores), 1);
  const normalizedScores = Object.entries(scores).map(([lang, score]) => ({
    language: lang as SupportedLanguage,
    score: score / maxScore,
    matchCount: totalMatches[lang as SupportedLanguage],
  }));

  // Sort by score
  normalizedScores.sort((a, b) => b.score - a.score);

  // Calculate percentages
  const totalScore = normalizedScores.reduce((sum, item) => sum + item.score, 0) || 1;
  const detectedLanguages = normalizedScores
    .filter(item => item.score > 0.1)
    .map(item => ({
      language: item.language,
      percentage: (item.score / totalScore) * 100,
      confidence: Math.min(0.95, item.score * 0.8 + 0.2),
    }));

  const primary = normalizedScores[0];
  const secondary = normalizedScores[1];
  const isMixedLanguage = secondary && secondary.score > primary!.score * 0.4;

  // Determine OCR languages to use
  const recommendedOCRLanguages: TesseractLangCode[] = [LANG_TO_TESSERACT[primary!.language]];
  if (isMixedLanguage && secondary) {
    recommendedOCRLanguages.push(LANG_TO_TESSERACT[secondary.language]);
  }
  // Always add English as fallback if not primary
  if (primary!.language !== 'en' && !recommendedOCRLanguages.includes('eng')) {
    recommendedOCRLanguages.push('eng');
  }

  logger.debug({
    primaryLanguage: primary!.language,
    isMixedLanguage,
    detectedCount: detectedLanguages.length,
  }, 'Language detection complete');

  return {
    primaryLanguage: primary!.language,
    confidence: primary!.score,
    detectedLanguages,
    isMixedLanguage: isMixedLanguage ?? false,
    recommendedOCRLanguages,
  };
}

// ============================================================================
// SPELL CORRECTION DICTIONARIES
// ============================================================================

// Common OCR errors by language
const OCR_ERROR_PATTERNS: Record<SupportedLanguage, Array<[RegExp, string]>> = {
  en: [
    [/\bl\s*n\b/gi, 'in'],
    [/\brn\b/gi, 'm'],
    [/\bcl\b/gi, 'd'],
    [/\bvv\b/gi, 'w'],
    [/\b0f\b/gi, 'of'],
    [/\bth[ae]\s+th[ae]\b/gi, 'the'],
    [/\band\s+and\b/gi, 'and'],
  ],
  de: [
    [/\buncl\b/gi, 'und'],
    [/\bdas\s+das\b/gi, 'das'],
    [/\bden\s+den\b/gi, 'den'],
    [/\bss\b/g, 'ß'], // Common OCR miss for ß
    [/\bue\b/g, 'ü'], // May need context
    [/\boe\b/g, 'ö'],
    [/\bae\b/g, 'ä'],
  ],
  fr: [
    [/\bl[ae]\s+l[ae]\b/gi, 'la'],
    [/\bd[eu]\s+d[eu]\b/gi, 'du'],
    [/\bc'\s*est\b/gi, "c'est"],
    [/\bqu'\s*il\b/gi, "qu'il"],
    [/\bl'\s*accord\b/gi, "l'accord"],
  ],
  it: [
    [/\bil\s+il\b/gi, 'il'],
    [/\bla\s+la\b/gi, 'la'],
    [/\bd[ei]\s+d[ei]\b/gi, 'di'],
    [/\bche\s+che\b/gi, 'che'],
    [/\bl'\s*accordo\b/gi, "l'accordo"],
  ],
};

// Swiss-specific terms that might be misrecognized
const SWISS_TERMS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    'swiss franc': 'CHF',
    'switzerland': 'Switzerland',
  },
  de: {
    'schwyzer': 'Schweizer',
    'schwei2': 'Schweiz',
    'schwei7': 'Schweiz',
    'eidgenössisch': 'Eidgenössisch',
    'bundesrat': 'Bundesrat',
    'kanton': 'Kanton',
    'zürlch': 'Zürich',
    'zürloh': 'Zürich',
    'bern': 'Bern',
    'genf': 'Genf',
    'geneve': 'Genève',
    'basel': 'Basel',
    'lausanne': 'Lausanne',
    'luzern': 'Luzern',
    'ag': 'AG',
    'gmbh': 'GmbH',
  },
  fr: {
    'sulsse': 'Suisse',
    'su1sse': 'Suisse',
    'confédératlon': 'Confédération',
    'fédéral': 'fédéral',
    'canton': 'canton',
    'geneve': 'Genève',
    'zürlch': 'Zurich',
    'berne': 'Berne',
    'bâle': 'Bâle',
    'lausanne': 'Lausanne',
    'sa': 'SA',
    'sàrl': 'Sàrl',
  },
  it: {
    'svlzzera': 'Svizzera',
    'confederazlone': 'Confederazione',
    'federale': 'federale',
    'cantone': 'cantone',
    'zurigo': 'Zurigo',
    'berna': 'Berna',
    'ginevra': 'Ginevra',
    'basilea': 'Basilea',
    'losanna': 'Losanna',
    'sagl': 'Sagl',
  },
};

/**
 * Apply language-specific spell corrections
 */
export function applySpellCorrections(
  text: string,
  language: SupportedLanguage,
  options: { enableLegalTerms?: boolean; enableSwissTerms?: boolean } = {}
): { correctedText: string; corrections: LanguageSpecificCorrection[] } {
  const { enableLegalTerms = true, enableSwissTerms = true } = options;
  const corrections: LanguageSpecificCorrection[] = [];
  let correctedText = text;

  // Apply OCR error patterns
  const errorPatterns = OCR_ERROR_PATTERNS[language] || [];
  for (const [pattern, replacement] of errorPatterns) {
    const matches = correctedText.match(pattern);
    if (matches) {
      for (const match of matches) {
        if (match !== replacement) {
          corrections.push({
            original: match,
            corrected: replacement,
            language,
            confidence: 0.8,
            type: 'spelling',
          });
        }
      }
      correctedText = correctedText.replace(pattern, replacement);
    }
  }

  // Apply Swiss-specific corrections
  if (enableSwissTerms) {
    const swissTerms = SWISS_TERMS[language] || {};
    for (const [incorrect, correct] of Object.entries(swissTerms)) {
      const pattern = new RegExp(`\\b${incorrect}\\b`, 'gi');
      const matches = correctedText.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (match.toLowerCase() !== correct.toLowerCase()) {
            corrections.push({
              original: match,
              corrected: correct,
              language,
              confidence: 0.85,
              type: 'proper_noun',
            });
          }
        }
        correctedText = correctedText.replace(pattern, correct);
      }
    }
  }

  // Check legal terms for common OCR errors
  if (enableLegalTerms) {
    const legalTerms = LEGAL_TERMS[language] || [];
    for (const term of legalTerms) {
      // Create fuzzy pattern for common OCR errors
      // l/1 confusion, 0/O confusion, etc.
      const fuzzyPattern = term
        .replace(/l/gi, '[l1]')
        .replace(/o/gi, '[o0]')
        .replace(/i/gi, '[i1]')
        .replace(/s/gi, '[s5]');
      
      const pattern = new RegExp(`\\b${fuzzyPattern}\\b`, 'gi');
      const matches = correctedText.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (match !== term && match.toLowerCase() !== term.toLowerCase()) {
            corrections.push({
              original: match,
              corrected: term,
              language,
              confidence: 0.75,
              type: 'legal_term',
            });
            correctedText = correctedText.replace(new RegExp(escapeRegex(match), 'g'), term);
          }
        }
      }
    }
  }

  return { correctedText, corrections };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// MAIN OCR PROCESSING FUNCTION
// ============================================================================

/**
 * Process OCR text with multi-language support
 */
export async function processMultiLangOCR(
  rawText: string,
  options: MultiLangOCROptions = {}
): Promise<MultiLangOCRResult> {
  const startTime = Date.now();
  
  const {
    preferredLanguages,
    autoDetect = true,
    fallbackLanguage = 'en',
    enableSpellCheck = true,
    enableSpecializedDictionaries = true,
    minConfidenceForDetection = 0.3,
  } = options;

  // Detect language
  let detectedLanguages: LanguageDetectionResult;
  
  if (autoDetect) {
    detectedLanguages = detectLanguage(rawText);
    
    // If detection confidence is too low, use preferred or fallback
    if (detectedLanguages.confidence < minConfidenceForDetection) {
      detectedLanguages.primaryLanguage = preferredLanguages?.[0] || fallbackLanguage;
      logger.debug({ 
        fallbackUsed: detectedLanguages.primaryLanguage,
        originalConfidence: detectedLanguages.confidence,
      }, 'Using fallback language due to low detection confidence');
    }
  } else {
    // Use preferred language without detection
    const primaryLang = preferredLanguages?.[0] || fallbackLanguage;
    detectedLanguages = {
      primaryLanguage: primaryLang,
      confidence: 1,
      detectedLanguages: [{ language: primaryLang, percentage: 100, confidence: 1 }],
      isMixedLanguage: false,
      recommendedOCRLanguages: [LANG_TO_TESSERACT[primaryLang]],
    };
  }

  let correctedText = rawText;
  const allCorrections: LanguageSpecificCorrection[] = [];

  // Apply spell corrections for each detected language
  if (enableSpellCheck) {
    const languagesToCorrect = detectedLanguages.isMixedLanguage
      ? detectedLanguages.detectedLanguages.slice(0, 2).map(l => l.language)
      : [detectedLanguages.primaryLanguage];

    for (const lang of languagesToCorrect) {
      const { correctedText: newText, corrections } = applySpellCorrections(
        correctedText,
        lang,
        { enableLegalTerms: enableSpecializedDictionaries, enableSwissTerms: enableSpecializedDictionaries }
      );
      correctedText = newText;
      allCorrections.push(...corrections);
    }
  }

  const processingTime = Date.now() - startTime;

  logger.info({
    primaryLanguage: detectedLanguages.primaryLanguage,
    isMixedLanguage: detectedLanguages.isMixedLanguage,
    correctionCount: allCorrections.length,
    processingTime,
  }, 'Multi-language OCR processing complete');

  return {
    text: correctedText,
    detectedLanguages,
    corrections: allCorrections,
    processingInfo: {
      ocrLanguages: detectedLanguages.recommendedOCRLanguages,
      spellCheckApplied: enableSpellCheck,
      legalDictionaryUsed: enableSpecializedDictionaries,
      processingTime,
    },
  };
}

/**
 * Get recommended Tesseract language string
 */
export function getTesseractLanguageString(
  languages: SupportedLanguage[],
  includeOSD: boolean = false
): string {
  const langCodes = languages.map(l => LANG_TO_TESSERACT[l]);
  if (includeOSD) {
    return [...langCodes, 'osd'].join('+');
  }
  return langCodes.join('+');
}

/**
 * Check if text contains Swiss-specific content
 */
export function containsSwissContent(text: string): boolean {
  const swissPatterns = [
    /\bschweiz\b/i,
    /\bsuisse\b/i,
    /\bsvizzera\b/i,
    /\bswitzerland\b/i,
    /\bCHF\b/,
    /\bCH-\d{4}\b/, // Swiss postal code
    /\b(?:AG|SA|GmbH|Sàrl|Sagl)\b/,
    /\b(?:Zürich|Bern|Genève|Basel|Lausanne|Luzern)\b/i,
    /\bkanton\b/i,
    /\bcanton\b/i,
  ];

  return swissPatterns.some(pattern => pattern.test(text));
}

// ============================================================================
// EXPORTS
// ============================================================================

export const MultiLangOCR = {
  detectLanguage,
  processOCR: processMultiLangOCR,
  applySpellCorrections,
  getTesseractLanguageString,
  containsSwissContent,
  LANG_TO_TESSERACT,
  TESSERACT_TO_LANG,
  LANGUAGE_NAMES,
  LEGAL_TERMS,
  SWISS_TERMS,
};

export default MultiLangOCR;

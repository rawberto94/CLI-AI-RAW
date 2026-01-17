/**
 * Multi-Language Contract Support Service
 * 
 * Handles contracts in multiple languages:
 * - Automatic language detection
 * - Language-specific extraction strategies
 * - Translation integration
 * - Locale-aware date/currency parsing
 * 
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { createLogger } from '../utils/logger';

const logger = createLogger('multi-language-service');

// =============================================================================
// TYPES
// =============================================================================

export type SupportedLanguage = 
  | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'nl' | 'pl'  // European
  | 'zh' | 'ja' | 'ko' | 'th' | 'vi'                       // Asian
  | 'ar' | 'he' | 'fa'                                      // RTL
  | 'ru' | 'uk' | 'cs' | 'sk' | 'hu'                        // Eastern European
  | 'tr' | 'el' | 'ro' | 'bg'                               // Mediterranean/Balkan
  | 'hi' | 'bn' | 'ta';                                     // Indian

export interface LanguageDetectionResult {
  primaryLanguage: SupportedLanguage;
  confidence: number;
  secondaryLanguages: Array<{ language: SupportedLanguage; percentage: number }>;
  isMultilingual: boolean;
  script: 'latin' | 'cyrillic' | 'arabic' | 'cjk' | 'devanagari' | 'other';
  textDirection: 'ltr' | 'rtl';
}

export interface LocaleConfig {
  language: SupportedLanguage;
  dateFormats: string[];
  currencySymbols: string[];
  currencyCode: string;
  numberFormat: {
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  commonLegalTerms: Record<string, string>; // Maps to English equivalents
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  confidence: number;
  warnings: string[];
}

export interface LanguageAwareExtraction {
  extractedValue: string;
  normalizedValue: string; // Standardized format
  originalLanguage: SupportedLanguage;
  extractionNotes: string[];
  requiresReview: boolean;
}

// =============================================================================
// LANGUAGE CONFIGURATION
// =============================================================================

const LOCALE_CONFIGS: Partial<Record<SupportedLanguage, LocaleConfig>> = {
  en: {
    language: 'en',
    dateFormats: ['MM/DD/YYYY', 'YYYY-MM-DD', 'Month DD, YYYY'],
    currencySymbols: ['$', '£', '€'],
    currencyCode: 'USD',
    numberFormat: { thousandsSeparator: ',', decimalSeparator: '.' },
    commonLegalTerms: {
      'agreement': 'agreement',
      'contract': 'contract',
      'party': 'party',
      'whereas': 'recital',
      'hereby': 'hereby',
      'hereunder': 'under this agreement',
      'indemnify': 'indemnify',
      'warrant': 'warrant',
      'covenant': 'covenant',
      'severability': 'severability',
    },
  },
  es: {
    language: 'es',
    dateFormats: ['DD/MM/YYYY', 'DD de Month de YYYY'],
    currencySymbols: ['€', '$', '£'],
    currencyCode: 'EUR',
    numberFormat: { thousandsSeparator: '.', decimalSeparator: ',' },
    commonLegalTerms: {
      'contrato': 'contract',
      'acuerdo': 'agreement',
      'parte': 'party',
      'cláusula': 'clause',
      'considerando': 'recital',
      'por tanto': 'therefore',
      'indemnizar': 'indemnify',
      'garantizar': 'warrant',
      'vigencia': 'term',
    },
  },
  fr: {
    language: 'fr',
    dateFormats: ['DD/MM/YYYY', 'DD Month YYYY'],
    currencySymbols: ['€', '$', '£'],
    currencyCode: 'EUR',
    numberFormat: { thousandsSeparator: ' ', decimalSeparator: ',' },
    commonLegalTerms: {
      'contrat': 'contract',
      'accord': 'agreement',
      'partie': 'party',
      'clause': 'clause',
      'attendu que': 'whereas',
      'par conséquent': 'therefore',
      'indemniser': 'indemnify',
      'garantir': 'warrant',
      'durée': 'term',
    },
  },
  de: {
    language: 'de',
    dateFormats: ['DD.MM.YYYY', 'DD. Month YYYY'],
    currencySymbols: ['€', 'CHF', '$'],
    currencyCode: 'EUR',
    numberFormat: { thousandsSeparator: '.', decimalSeparator: ',' },
    commonLegalTerms: {
      'vertrag': 'contract',
      'vereinbarung': 'agreement',
      'partei': 'party',
      'klausel': 'clause',
      'präambel': 'recital',
      'daher': 'therefore',
      'schadlos halten': 'indemnify',
      'gewährleisten': 'warrant',
      'laufzeit': 'term',
    },
  },
  pt: {
    language: 'pt',
    dateFormats: ['DD/MM/YYYY', 'DD de Month de YYYY'],
    currencySymbols: ['R$', '€', '$'],
    currencyCode: 'BRL',
    numberFormat: { thousandsSeparator: '.', decimalSeparator: ',' },
    commonLegalTerms: {
      'contrato': 'contract',
      'acordo': 'agreement',
      'parte': 'party',
      'cláusula': 'clause',
      'considerando': 'recital',
      'portanto': 'therefore',
      'indenizar': 'indemnify',
      'garantir': 'warrant',
      'vigência': 'term',
    },
  },
  zh: {
    language: 'zh',
    dateFormats: ['YYYY年MM月DD日', 'YYYY-MM-DD'],
    currencySymbols: ['¥', '￥', '$'],
    currencyCode: 'CNY',
    numberFormat: { thousandsSeparator: ',', decimalSeparator: '.' },
    commonLegalTerms: {
      '合同': 'contract',
      '协议': 'agreement',
      '当事人': 'party',
      '条款': 'clause',
      '鉴于': 'whereas',
      '因此': 'therefore',
      '赔偿': 'indemnify',
      '保证': 'warrant',
      '期限': 'term',
    },
  },
  ja: {
    language: 'ja',
    dateFormats: ['YYYY年MM月DD日', 'YYYY/MM/DD'],
    currencySymbols: ['¥', '￥', '$'],
    currencyCode: 'JPY',
    numberFormat: { thousandsSeparator: ',', decimalSeparator: '.' },
    commonLegalTerms: {
      '契約': 'contract',
      '合意': 'agreement',
      '当事者': 'party',
      '条項': 'clause',
      '前文': 'recital',
      '従って': 'therefore',
      '補償': 'indemnify',
      '保証': 'warrant',
      '期間': 'term',
    },
  },
  ar: {
    language: 'ar',
    dateFormats: ['DD/MM/YYYY', 'YYYY/MM/DD'],
    currencySymbols: ['د.إ', '$', '€', 'ر.س'],
    currencyCode: 'AED',
    numberFormat: { thousandsSeparator: ',', decimalSeparator: '.' },
    commonLegalTerms: {
      'عقد': 'contract',
      'اتفاقية': 'agreement',
      'طرف': 'party',
      'بند': 'clause',
      'حيث أن': 'whereas',
      'لذلك': 'therefore',
      'تعويض': 'indemnify',
      'ضمان': 'warrant',
      'مدة': 'term',
    },
  },
};

// =============================================================================
// MULTI-LANGUAGE SERVICE
// =============================================================================

export class MultiLanguageContractService {
  private static instance: MultiLanguageContractService;
  private openai: OpenAI | null = null;

  private constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  static getInstance(): MultiLanguageContractService {
    if (!MultiLanguageContractService.instance) {
      MultiLanguageContractService.instance = new MultiLanguageContractService();
    }
    return MultiLanguageContractService.instance;
  }

  // ===========================================================================
  // LANGUAGE DETECTION
  // ===========================================================================

  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    if (!this.openai) {
      return this.fallbackLanguageDetection(text);
    }

    const sampleText = text.slice(0, 2000);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a language detection expert. Analyze the provided text and identify:
1. The primary language
2. Any secondary languages present
3. The writing script
4. Text direction

Return JSON with this structure:
{
  "primaryLanguage": "ISO 639-1 code",
  "confidence": 0.0-1.0,
  "secondaryLanguages": [{"language": "code", "percentage": 0-100}],
  "isMultilingual": boolean,
  "script": "latin|cyrillic|arabic|cjk|devanagari|other",
  "textDirection": "ltr|rtl"
}`,
          },
          {
            role: 'user',
            content: sampleText,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        primaryLanguage: result.primaryLanguage as SupportedLanguage || 'en',
        confidence: result.confidence || 0.8,
        secondaryLanguages: result.secondaryLanguages || [],
        isMultilingual: result.isMultilingual || false,
        script: result.script || 'latin',
        textDirection: result.textDirection || 'ltr',
      };
    } catch (error) {
      logger.warn({ error }, 'AI language detection failed, using fallback');
      return this.fallbackLanguageDetection(text);
    }
  }

  private fallbackLanguageDetection(text: string): LanguageDetectionResult {
    // Simple pattern-based detection
    const patterns: Array<{ lang: SupportedLanguage; regex: RegExp; script: 'latin' | 'cyrillic' | 'arabic' | 'cjk' | 'devanagari' | 'other'; dir: 'ltr' | 'rtl' }> = [
      { lang: 'zh', regex: /[\u4e00-\u9fff]/g, script: 'cjk', dir: 'ltr' },
      { lang: 'ja', regex: /[\u3040-\u309f\u30a0-\u30ff]/g, script: 'cjk', dir: 'ltr' },
      { lang: 'ko', regex: /[\uac00-\ud7af]/g, script: 'cjk', dir: 'ltr' },
      { lang: 'ar', regex: /[\u0600-\u06ff]/g, script: 'arabic', dir: 'rtl' },
      { lang: 'he', regex: /[\u0590-\u05ff]/g, script: 'arabic', dir: 'rtl' },
      { lang: 'ru', regex: /[\u0400-\u04ff]/g, script: 'cyrillic', dir: 'ltr' },
      { lang: 'hi', regex: /[\u0900-\u097f]/g, script: 'devanagari', dir: 'ltr' },
      { lang: 'th', regex: /[\u0e00-\u0e7f]/g, script: 'other', dir: 'ltr' },
    ];

    for (const { lang, regex, script, dir } of patterns) {
      const matches = text.match(regex);
      if (matches && matches.length > text.length * 0.1) {
        return {
          primaryLanguage: lang,
          confidence: 0.7,
          secondaryLanguages: [],
          isMultilingual: false,
          script,
          textDirection: dir,
        };
      }
    }

    // Check for Latin-based European languages
    const euroPatterns: Array<{ lang: SupportedLanguage; keywords: string[] }> = [
      { lang: 'es', keywords: ['contrato', 'acuerdo', 'cláusula', 'mediante', 'según'] },
      { lang: 'fr', keywords: ['contrat', 'accord', 'clause', 'entre', 'conformément'] },
      { lang: 'de', keywords: ['vertrag', 'vereinbarung', 'klausel', 'zwischen', 'gemäß'] },
      { lang: 'pt', keywords: ['contrato', 'acordo', 'cláusula', 'entre', 'conforme'] },
      { lang: 'it', keywords: ['contratto', 'accordo', 'clausola', 'tra', 'secondo'] },
      { lang: 'nl', keywords: ['contract', 'overeenkomst', 'clausule', 'tussen', 'volgens'] },
    ];

    const lowerText = text.toLowerCase();
    for (const { lang, keywords } of euroPatterns) {
      const matchCount = keywords.filter(kw => lowerText.includes(kw)).length;
      if (matchCount >= 2) {
        return {
          primaryLanguage: lang,
          confidence: 0.6,
          secondaryLanguages: [],
          isMultilingual: false,
          script: 'latin',
          textDirection: 'ltr',
        };
      }
    }

    // Default to English
    return {
      primaryLanguage: 'en',
      confidence: 0.5,
      secondaryLanguages: [],
      isMultilingual: false,
      script: 'latin',
      textDirection: 'ltr',
    };
  }

  // ===========================================================================
  // LOCALE-AWARE EXTRACTION
  // ===========================================================================

  getLocaleConfig(language: SupportedLanguage): LocaleConfig {
    return LOCALE_CONFIGS[language] || LOCALE_CONFIGS.en!;
  }

  generateExtractionPromptAdditions(language: SupportedLanguage): string {
    const config = this.getLocaleConfig(language);
    
    const termMappings = Object.entries(config.commonLegalTerms)
      .map(([local, english]) => `"${local}" → "${english}"`)
      .join(', ');

    return `
## Language-Specific Instructions for ${language.toUpperCase()}

### Date Formats
Expect dates in these formats: ${config.dateFormats.join(', ')}
Always normalize dates to ISO 8601 format (YYYY-MM-DD) in the output.

### Currency
Common symbols: ${config.currencySymbols.join(', ')}
Default currency code: ${config.currencyCode}
Number format: thousands separator "${config.numberFormat.thousandsSeparator}", decimal separator "${config.numberFormat.decimalSeparator}"

### Legal Term Mappings
${termMappings}

When extracting, use the English equivalents for standardized field names while preserving original text in extracted values.
`;
  }

  // ===========================================================================
  // TRANSLATION
  // ===========================================================================

  async translateText(
    text: string,
    targetLanguage: SupportedLanguage = 'en'
  ): Promise<TranslationResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not available for translation');
    }

    // First detect source language
    const detection = await this.detectLanguage(text);

    if (detection.primaryLanguage === targetLanguage) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage: detection.primaryLanguage,
        targetLanguage,
        confidence: 1.0,
        warnings: ['Text is already in target language'],
      };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional legal translator. Translate the following legal/contract text from ${detection.primaryLanguage} to ${targetLanguage}.

IMPORTANT:
- Preserve legal terminology accurately
- Maintain the formal register
- Keep proper nouns, company names, and references unchanged
- Preserve formatting (bullets, numbering, etc.)
- Note any terms that may have different legal meanings in different jurisdictions`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.1,
      });

      const translatedText = response.choices[0].message.content || text;
      const warnings: string[] = [];

      // Check for potential issues
      if (text.length > 5000) {
        warnings.push('Long text may have reduced translation accuracy');
      }
      if (detection.isMultilingual) {
        warnings.push('Source text contains multiple languages');
      }

      return {
        originalText: text,
        translatedText,
        sourceLanguage: detection.primaryLanguage,
        targetLanguage,
        confidence: detection.confidence * 0.9, // Slightly reduce confidence for translation
        warnings,
      };
    } catch (error) {
      logger.error({ error }, 'Translation failed');
      throw error;
    }
  }

  // ===========================================================================
  // LOCALE-AWARE PARSING
  // ===========================================================================

  parseLocalizedDate(
    dateString: string,
    language: SupportedLanguage
  ): { isoDate: string | null; parsed: boolean; notes: string[] } {
    const config = this.getLocaleConfig(language);
    const notes: string[] = [];

    // Try ISO format first
    const isoMatch = dateString.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoMatch) {
      return { isoDate: dateString, parsed: true, notes: [] };
    }

    // Common date patterns
    const patterns: Array<{ regex: RegExp; extract: (m: RegExpMatchArray) => string }> = [
      // DD/MM/YYYY or MM/DD/YYYY
      { regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, extract: (m) => {
        // Assume DD/MM/YYYY for non-US locales
        const isUSLocale = language === 'en';
        const day = isUSLocale ? m[2] : m[1];
        const month = isUSLocale ? m[1] : m[2];
        return `${m[3]}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }},
      // DD.MM.YYYY (German)
      { regex: /(\d{1,2})\.(\d{1,2})\.(\d{4})/, extract: (m) => 
        `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
      },
      // YYYY年MM月DD日 (Chinese/Japanese)
      { regex: /(\d{4})年(\d{1,2})月(\d{1,2})日/, extract: (m) =>
        `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
      },
    ];

    for (const { regex, extract } of patterns) {
      const match = dateString.match(regex);
      if (match) {
        const isoDate = extract(match);
        // Validate the date
        const date = new Date(isoDate);
        if (!isNaN(date.getTime())) {
          return { isoDate, parsed: true, notes };
        }
      }
    }

    notes.push(`Could not parse date format for ${language}`);
    return { isoDate: null, parsed: false, notes };
  }

  parseLocalizedCurrency(
    amountString: string,
    language: SupportedLanguage
  ): { amount: number | null; currency: string; parsed: boolean; notes: string[] } {
    const config = this.getLocaleConfig(language);
    const notes: string[] = [];

    // Remove currency symbols and spaces
    let cleaned = amountString.trim();
    let detectedCurrency = config.currencyCode;

    // Detect currency from symbol
    const currencySymbols: Record<string, string> = {
      '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '￥': 'CNY',
      'R$': 'BRL', 'CHF': 'CHF', '₹': 'INR', '₩': 'KRW',
    };

    for (const [symbol, code] of Object.entries(currencySymbols)) {
      if (cleaned.includes(symbol)) {
        detectedCurrency = code;
        cleaned = cleaned.replace(symbol, '');
        break;
      }
    }

    // Normalize number format
    cleaned = cleaned.trim();
    
    // Replace locale-specific separators
    if (config.numberFormat.thousandsSeparator === '.') {
      // European format: 1.234.567,89
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (config.numberFormat.thousandsSeparator === ' ') {
      // French format: 1 234 567,89
      cleaned = cleaned.replace(/\s/g, '').replace(',', '.');
    } else {
      // US format: 1,234,567.89
      cleaned = cleaned.replace(/,/g, '');
    }

    const amount = parseFloat(cleaned);

    if (isNaN(amount)) {
      notes.push(`Could not parse currency amount for ${language}`);
      return { amount: null, currency: detectedCurrency, parsed: false, notes };
    }

    return { amount, currency: detectedCurrency, parsed: true, notes };
  }

  // ===========================================================================
  // UTILITY
  // ===========================================================================

  getSupportedLanguages(): SupportedLanguage[] {
    return Object.keys(LOCALE_CONFIGS) as SupportedLanguage[];
  }

  isRTL(language: SupportedLanguage): boolean {
    return ['ar', 'he', 'fa'].includes(language);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const multiLanguageContractService = MultiLanguageContractService.getInstance();

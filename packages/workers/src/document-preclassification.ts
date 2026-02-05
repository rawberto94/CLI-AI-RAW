/**
 * Document Pre-Classification Module
 * 
 * Classifies documents before OCR to route them to the optimal
 * processing pipeline based on document characteristics.
 */

import pino from 'pino';
import * as crypto from 'crypto';

const logger = pino({ name: 'document-preclassification' });

// ============================================================================
// TYPES
// ============================================================================

export type DocumentCategory =
  | 'CONTRACT'
  | 'INVOICE'
  | 'CORRESPONDENCE'
  | 'LEGAL_FILING'
  | 'FORM'
  | 'REPORT'
  | 'CERTIFICATE'
  | 'ID_DOCUMENT'
  | 'HANDWRITTEN'
  | 'MIXED'
  | 'UNKNOWN';

export type ContractType =
  | 'NDA'
  | 'MSA'
  | 'SOW'
  | 'EMPLOYMENT'
  | 'LEASE'
  | 'LICENSE'
  | 'PURCHASE'
  | 'SERVICE'
  | 'PARTNERSHIP'
  | 'AMENDMENT'
  | 'ADDENDUM'
  | 'MERGER_ACQUISITION'
  | 'LOAN'
  | 'INSURANCE'
  | 'GENERAL';

export type DocumentQuality =
  | 'HIGH'      // Clean scan, good resolution
  | 'MEDIUM'    // Some noise/artifacts
  | 'LOW'       // Poor scan, needs preprocessing
  | 'VERY_LOW'; // Heavily degraded, may need manual review

export type OCRModel =
  | 'TESSERACT_FAST'       // Quick, basic OCR
  | 'TESSERACT_BEST'       // Higher quality Tesseract
  | 'AZURE_READ'           // Azure Computer Vision Read API
  | 'AZURE_FORM'           // Azure Form Recognizer
  | 'GOOGLE_DOCUMENT_AI'   // Google Document AI
  | 'GOOGLE_VISION'        // Google Cloud Vision
  | 'AWS_TEXTRACT'         // AWS Textract
  | 'MANUAL_REVIEW';       // Too complex for automated OCR

export interface DocumentClassification {
  category: DocumentCategory;
  contractType?: ContractType;
  quality: DocumentQuality;
  recommendedModel: OCRModel;
  alternativeModels: OCRModel[];
  confidence: number;
  characteristics: DocumentCharacteristics;
  preprocessingNeeded: PreprocessingStep[];
  warnings: string[];
  metadata: Record<string, unknown>;
}

export interface DocumentCharacteristics {
  hasHandwriting: boolean;
  handwritingPercentage: number;
  hasSignatures: boolean;
  hasTables: boolean;
  hasCheckboxes: boolean;
  hasStamps: boolean;
  hasLogos: boolean;
  isScanned: boolean;
  isFax: boolean;
  isMultiColumn: boolean;
  hasWatermarks: boolean;
  estimatedDPI: number;
  skewAngle: number;
  noiseLevel: number;
  contrastLevel: number;
  pageCount: number;
  languages: string[];
}

export type PreprocessingStep =
  | 'DESKEW'
  | 'DENOISE'
  | 'CONTRAST_ENHANCEMENT'
  | 'BINARIZATION'
  | 'REMOVE_WATERMARK'
  | 'UPSCALE'
  | 'BORDER_REMOVAL'
  | 'LINE_REMOVAL'
  | 'TABLE_DETECTION'
  | 'HANDWRITING_SEPARATION';

export interface ClassificationOptions {
  analyzeFirstNPages?: number;
  detectHandwriting?: boolean;
  detectTables?: boolean;
  detectLanguage?: boolean;
  quickMode?: boolean; // Fast classification with less accuracy
}

// ============================================================================
// CLASSIFICATION PATTERNS
// ============================================================================

const CONTRACT_INDICATORS = {
  NDA: [
    /non-?disclosure\s+agreement/i,
    /confidentiality\s+agreement/i,
    /geheimhaltungsvereinbarung/i,
    /accord\s+de\s+confidentialit[eé]/i,
  ],
  MSA: [
    /master\s+(?:service[s]?\s+)?agreement/i,
    /rahmenvertrag/i,
    /accord[- ]cadre/i,
  ],
  SOW: [
    /statement\s+of\s+work/i,
    /scope\s+of\s+work/i,
    /work\s+order/i,
    /leistungsverzeichnis/i,
  ],
  EMPLOYMENT: [
    /employment\s+(?:agreement|contract)/i,
    /arbeitsvertrag/i,
    /contrat\s+de\s+travail/i,
  ],
  LEASE: [
    /lease\s+agreement/i,
    /rental\s+agreement/i,
    /mietvertrag/i,
    /bail/i,
  ],
  LICENSE: [
    /license\s+agreement/i,
    /software\s+license/i,
    /lizenzvertrag/i,
    /contrat\s+de\s+licence/i,
  ],
  PURCHASE: [
    /purchase\s+(?:order|agreement)/i,
    /sales\s+agreement/i,
    /kaufvertrag/i,
    /contrat\s+(?:d['']?achat|de\s+vente)/i,
  ],
  SERVICE: [
    /service[s]?\s+agreement/i,
    /consulting\s+agreement/i,
    /dienstleistungsvertrag/i,
  ],
  AMENDMENT: [
    /amendment\s+(?:to|of)/i,
    /änderungsvereinbarung/i,
    /avenant/i,
  ],
  ADDENDUM: [
    /addendum/i,
    /nachtrag/i,
    /annexe/i,
  ],
  MERGER_ACQUISITION: [
    /merger\s+agreement/i,
    /acquisition\s+agreement/i,
    /share\s+purchase/i,
    /asset\s+purchase/i,
  ],
  LOAN: [
    /loan\s+agreement/i,
    /credit\s+(?:facility|agreement)/i,
    /darlehensvertrag/i,
  ],
  INSURANCE: [
    /insurance\s+(?:policy|agreement|contract)/i,
    /versicherungsvertrag/i,
    /police\s+d['']?assurance/i,
  ],
};

const DOCUMENT_CATEGORY_PATTERNS = {
  CONTRACT: [
    /\b(?:agreement|contract|vertrag|contrat|accordo)\b/i,
    /\bwhereas\b.*\bnow,?\s*therefore\b/is,
    /\bparties?\s+(?:hereto|agree)\b/i,
    /\bin\s+witness\s+whereof\b/i,
  ],
  INVOICE: [
    /\binvoice\b/i,
    /\brechnung\b/i,
    /\bfacture\b/i,
    /\btotal\s+(?:due|amount)\b/i,
    /\bpayment\s+terms?\b/i,
  ],
  CORRESPONDENCE: [
    /\bdear\s+(?:sir|madam|mr|ms)\b/i,
    /\bsincerely\b/i,
    /\bre:\s*\w/i,
    /\bsehr\s+geehrte/i,
  ],
  LEGAL_FILING: [
    /\bcourt\s+(?:of|file)\b/i,
    /\bcase\s+(?:no|number)\b/i,
    /\bplaintiff\b.*\bdefendant\b/is,
    /\bmotion\s+(?:for|to)\b/i,
  ],
  FORM: [
    /\[\s*\]\s+\w/,  // Checkboxes
    /_{10,}/,        // Long underlines
    /\bplease\s+(?:fill|complete)\b/i,
    /\bdate:\s*_+/i,
  ],
  CERTIFICATE: [
    /\bcertificate\s+of\b/i,
    /\bcertified\s+(?:that|true)/i,
    /\bbescheinigung\b/i,
    /\bcertificat\b/i,
  ],
};

// ============================================================================
// QUALITY ASSESSMENT
// ============================================================================

interface ImageStats {
  width: number;
  height: number;
  dpi?: number;
  grayscale?: boolean;
  avgBrightness?: number;
  contrast?: number;
  noiseEstimate?: number;
  skewAngle?: number;
}

/**
 * Estimate document quality from image statistics
 */
function assessQuality(stats: ImageStats): DocumentQuality {
  let score = 100;

  // DPI penalty
  if (stats.dpi) {
    if (stats.dpi < 150) score -= 40;
    else if (stats.dpi < 200) score -= 25;
    else if (stats.dpi < 300) score -= 10;
  }

  // Resolution penalty
  const pixels = stats.width * stats.height;
  if (pixels < 500000) score -= 30;
  else if (pixels < 1000000) score -= 15;

  // Brightness penalty (too dark or too bright)
  if (stats.avgBrightness !== undefined) {
    if (stats.avgBrightness < 80 || stats.avgBrightness > 230) score -= 20;
    else if (stats.avgBrightness < 120 || stats.avgBrightness > 200) score -= 10;
  }

  // Contrast penalty
  if (stats.contrast !== undefined) {
    if (stats.contrast < 30) score -= 25;
    else if (stats.contrast < 50) score -= 10;
  }

  // Noise penalty
  if (stats.noiseEstimate !== undefined) {
    if (stats.noiseEstimate > 50) score -= 30;
    else if (stats.noiseEstimate > 30) score -= 15;
    else if (stats.noiseEstimate > 15) score -= 5;
  }

  // Skew penalty
  if (stats.skewAngle !== undefined) {
    const absSkew = Math.abs(stats.skewAngle);
    if (absSkew > 10) score -= 25;
    else if (absSkew > 5) score -= 15;
    else if (absSkew > 2) score -= 5;
  }

  // Map score to quality level
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  if (score >= 40) return 'LOW';
  return 'VERY_LOW';
}

/**
 * Determine required preprocessing steps
 */
function determinePreprocessing(
  characteristics: DocumentCharacteristics,
  quality: DocumentQuality
): PreprocessingStep[] {
  const steps: PreprocessingStep[] = [];

  // Always deskew if needed
  if (Math.abs(characteristics.skewAngle) > 1) {
    steps.push('DESKEW');
  }

  // Denoise for low quality
  if (characteristics.noiseLevel > 20) {
    steps.push('DENOISE');
  }

  // Contrast enhancement
  if (characteristics.contrastLevel < 40) {
    steps.push('CONTRAST_ENHANCEMENT');
  }

  // Binarization for very low quality or fax
  if (quality === 'VERY_LOW' || characteristics.isFax) {
    steps.push('BINARIZATION');
  }

  // Watermark removal
  if (characteristics.hasWatermarks) {
    steps.push('REMOVE_WATERMARK');
  }

  // Upscale low resolution
  if (characteristics.estimatedDPI < 200) {
    steps.push('UPSCALE');
  }

  // Table detection for documents with tables
  if (characteristics.hasTables) {
    steps.push('TABLE_DETECTION');
  }

  // Handwriting separation
  if (characteristics.hasHandwriting && characteristics.handwritingPercentage > 20) {
    steps.push('HANDWRITING_SEPARATION');
  }

  return steps;
}

// ============================================================================
// MODEL SELECTION
// ============================================================================

interface ModelSelectionCriteria {
  category: DocumentCategory;
  contractType?: ContractType;
  quality: DocumentQuality;
  characteristics: DocumentCharacteristics;
  availableModels?: OCRModel[];
}

/**
 * Select the best OCR model based on document characteristics
 */
function selectOCRModel(criteria: ModelSelectionCriteria): {
  primary: OCRModel;
  alternatives: OCRModel[];
} {
  const { category, quality, characteristics, availableModels } = criteria;

  // Default available models (can be restricted by configuration)
  const models = availableModels || [
    'TESSERACT_FAST',
    'TESSERACT_BEST',
    'AZURE_READ',
    'AZURE_FORM',
    'GOOGLE_DOCUMENT_AI',
    'AWS_TEXTRACT',
  ];

  // If too much handwriting, flag for manual review
  if (characteristics.handwritingPercentage > 60) {
    return {
      primary: 'MANUAL_REVIEW',
      alternatives: ['AZURE_READ', 'GOOGLE_DOCUMENT_AI'],
    };
  }

  // Very low quality documents
  if (quality === 'VERY_LOW') {
    return {
      primary: models.includes('AZURE_READ') ? 'AZURE_READ' : 'TESSERACT_BEST',
      alternatives: ['GOOGLE_DOCUMENT_AI', 'TESSERACT_BEST'],
    };
  }

  // Documents with forms/tables
  if (characteristics.hasTables || characteristics.hasCheckboxes) {
    if (models.includes('AZURE_FORM')) {
      return {
        primary: 'AZURE_FORM',
        alternatives: ['AWS_TEXTRACT', 'GOOGLE_DOCUMENT_AI'],
      };
    }
    return {
      primary: 'AWS_TEXTRACT',
      alternatives: ['GOOGLE_DOCUMENT_AI', 'AZURE_READ'],
    };
  }

  // Contracts and legal documents
  if (category === 'CONTRACT' || category === 'LEGAL_FILING') {
    if (quality === 'HIGH') {
      return {
        primary: models.includes('AZURE_READ') ? 'AZURE_READ' : 'TESSERACT_BEST',
        alternatives: ['GOOGLE_DOCUMENT_AI', 'TESSERACT_BEST'],
      };
    }
    return {
      primary: 'GOOGLE_DOCUMENT_AI',
      alternatives: ['AZURE_READ', 'TESSERACT_BEST'],
    };
  }

  // Invoices
  if (category === 'INVOICE') {
    return {
      primary: models.includes('AZURE_FORM') ? 'AZURE_FORM' : 'AWS_TEXTRACT',
      alternatives: ['AWS_TEXTRACT', 'GOOGLE_DOCUMENT_AI'],
    };
  }

  // High quality general documents
  if (quality === 'HIGH') {
    return {
      primary: 'TESSERACT_BEST',
      alternatives: ['AZURE_READ', 'TESSERACT_FAST'],
    };
  }

  // Default for medium quality
  return {
    primary: models.includes('AZURE_READ') ? 'AZURE_READ' : 'TESSERACT_BEST',
    alternatives: ['TESSERACT_BEST', 'GOOGLE_VISION'],
  };
}

// ============================================================================
// TEXT-BASED CLASSIFICATION
// ============================================================================

/**
 * Classify document category from text content
 */
function classifyFromText(text: string): {
  category: DocumentCategory;
  contractType?: ContractType;
  confidence: number;
} {
  // Check for contract types first
  for (const [type, patterns] of Object.entries(CONTRACT_INDICATORS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return {
          category: 'CONTRACT',
          contractType: type as ContractType,
          confidence: 0.85,
        };
      }
    }
  }

  // Check document categories
  let bestMatch: { category: DocumentCategory; score: number } = {
    category: 'UNKNOWN',
    score: 0,
  };

  for (const [category, patterns] of Object.entries(DOCUMENT_CATEGORY_PATTERNS)) {
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) matchCount++;
    }
    
    const score = matchCount / patterns.length;
    if (score > bestMatch.score) {
      bestMatch = { category: category as DocumentCategory, score };
    }
  }

  return {
    category: bestMatch.category,
    confidence: Math.min(0.9, 0.5 + bestMatch.score * 0.5),
  };
}

/**
 * Detect languages in text
 */
function detectLanguages(text: string): string[] {
  const languages: string[] = [];
  
  const indicators: Record<string, RegExp[]> = {
    en: [/\bthe\b/i, /\band\b/i, /\bagreement\b/i, /\bshall\b/i],
    de: [/\bund\b/i, /\bdie\b/i, /\bvertrag\b/i, /\bdass\b/i],
    fr: [/\bet\b/i, /\bles?\b/i, /\bcontrat\b/i, /\bque\b/i],
    it: [/\bil\b/i, /\bche\b/i, /\bcontratto\b/i, /\bdella\b/i],
  };

  for (const [lang, patterns] of Object.entries(indicators)) {
    let matches = 0;
    for (const pattern of patterns) {
      const found = text.match(pattern);
      if (found) matches += found.length;
    }
    if (matches > 5) languages.push(lang);
  }

  return languages.length > 0 ? languages : ['en'];
}

// ============================================================================
// MAIN CLASSIFICATION FUNCTION
// ============================================================================

/**
 * Pre-classify a document before OCR
 * 
 * @param input - Document buffer, base64 string, or extracted text
 * @param options - Classification options
 * @returns Document classification with recommended processing pipeline
 */
export async function classifyDocument(
  input: Buffer | string,
  options: ClassificationOptions = {}
): Promise<DocumentClassification> {
  const startTime = Date.now();
  const warnings: string[] = [];

  const {
    detectHandwriting = true,
    detectTables = true,
    detectLanguage = true,
    quickMode = false,
  } = options;

  // Determine input type
  const isText = typeof input === 'string' && !input.startsWith('data:') && input.length > 100;
  const text = isText ? input : '';

  // Initialize default characteristics
  let characteristics: DocumentCharacteristics = {
    hasHandwriting: false,
    handwritingPercentage: 0,
    hasSignatures: false,
    hasTables: false,
    hasCheckboxes: false,
    hasStamps: false,
    hasLogos: false,
    isScanned: true,
    isFax: false,
    isMultiColumn: false,
    hasWatermarks: false,
    estimatedDPI: 300,
    skewAngle: 0,
    noiseLevel: 10,
    contrastLevel: 70,
    pageCount: 1,
    languages: ['en'],
  };

  let quality: DocumentQuality = 'MEDIUM';
  let category: DocumentCategory = 'UNKNOWN';
  let contractType: ContractType | undefined;
  let confidence = 0.5;

  if (isText) {
    // Text-based classification
    const textClassification = classifyFromText(text);
    category = textClassification.category;
    contractType = textClassification.contractType;
    confidence = textClassification.confidence;

    if (detectLanguage) {
      characteristics.languages = detectLanguages(text);
    }

    // Detect tables from text patterns
    if (detectTables) {
      const tablePatterns = /(?:\|.*\||\t.*\t)/gm;
      characteristics.hasTables = tablePatterns.test(text);
    }

    // Detect checkboxes
    characteristics.hasCheckboxes = /\[\s*[xX]?\s*\]/.test(text);

  } else {
    // Image-based classification (mock implementation)
    // In production, this would use actual image analysis
    
    // Generate consistent "random" values based on input hash
    const hash = crypto.createHash('md5')
      .update(Buffer.isBuffer(input) ? input : Buffer.from(input))
      .digest('hex');
    
    const hashNum = parseInt(hash.substring(0, 8), 16);
    
    characteristics = {
      ...characteristics,
      hasHandwriting: (hashNum % 10) < 2, // 20% chance
      handwritingPercentage: (hashNum % 10) < 2 ? (hashNum % 30) + 5 : 0,
      hasSignatures: (hashNum % 5) < 2, // 40% chance
      hasTables: (hashNum % 4) === 0, // 25% chance
      hasCheckboxes: (hashNum % 8) === 0, // 12.5% chance
      isScanned: (hashNum % 3) !== 0, // 67% chance
      estimatedDPI: 200 + (hashNum % 200),
      skewAngle: ((hashNum % 100) - 50) / 25, // -2 to +2 degrees
      noiseLevel: hashNum % 40,
      contrastLevel: 50 + (hashNum % 40),
    };

    // Assess quality based on characteristics
    quality = assessQuality({
      width: 2480,
      height: 3508,
      dpi: characteristics.estimatedDPI,
      noiseEstimate: characteristics.noiseLevel,
      contrast: characteristics.contrastLevel,
      skewAngle: characteristics.skewAngle,
    });

    // If we have significant handwriting, adjust category
    if (characteristics.handwritingPercentage > 40) {
      category = 'HANDWRITTEN';
      confidence = 0.7;
      warnings.push('Document contains significant handwriting');
    }
  }

  // Determine preprocessing needs
  const preprocessingNeeded = determinePreprocessing(characteristics, quality);

  // Select OCR model
  const { primary: recommendedModel, alternatives: alternativeModels } = selectOCRModel({
    category,
    contractType,
    quality,
    characteristics,
  });

  // Generate metadata
  const metadata: Record<string, unknown> = {
    classificationTime: Date.now() - startTime,
    inputType: isText ? 'text' : 'image',
    quickMode,
  };

  if (!isText && Buffer.isBuffer(input)) {
    metadata.inputSize = input.length;
  }

  logger.info({
    category,
    contractType,
    quality,
    recommendedModel,
    confidence,
    preprocessingSteps: preprocessingNeeded.length,
  }, 'Document classified');

  return {
    category,
    contractType,
    quality,
    recommendedModel,
    alternativeModels,
    confidence,
    characteristics,
    preprocessingNeeded,
    warnings,
    metadata,
  };
}

/**
 * Quick classification for routing purposes
 */
export async function quickClassify(
  text: string
): Promise<{
  category: DocumentCategory;
  contractType?: ContractType;
  recommendedModel: OCRModel;
}> {
  const classification = await classifyDocument(text, { quickMode: true });
  return {
    category: classification.category,
    contractType: classification.contractType,
    recommendedModel: classification.recommendedModel,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const DocumentPreClassifier = {
  classify: classifyDocument,
  quickClassify,
  assessQuality,
  CONTRACT_INDICATORS,
  DOCUMENT_CATEGORY_PATTERNS,
};

export default DocumentPreClassifier;

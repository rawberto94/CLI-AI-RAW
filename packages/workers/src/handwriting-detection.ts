/**
 * Handwriting Detection and Processing Module
 * 
 * Detects and processes handwritten content in documents:
 * - Identifies handwritten regions vs printed text
 * - Extracts and processes signatures
 * - Handles annotations and margin notes
 * - Routes handwritten sections for specialized OCR
 */

import pino from 'pino';

const logger = pino({ name: 'handwriting-detection' });

// ============================================================================
// TYPES
// ============================================================================

export type HandwritingType =
  | 'SIGNATURE'
  | 'INITIALS'
  | 'ANNOTATION'
  | 'MARGIN_NOTE'
  | 'FILL_IN'
  | 'CORRECTION'
  | 'DATE_WRITTEN'
  | 'FULL_HANDWRITTEN'
  | 'MIXED'
  | 'UNKNOWN';

export interface HandwrittenRegion {
  id: string;
  type: HandwritingType;
  boundingBox: BoundingBox;
  confidence: number;
  pageNumber: number;
  extractedText?: string;
  textConfidence?: number;
  isVerified?: boolean;
  metadata?: {
    ink?: 'black' | 'blue' | 'red' | 'other';
    style?: 'cursive' | 'print' | 'mixed';
    legibility?: 'high' | 'medium' | 'low';
    possibleAuthor?: string;
  };
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SignatureInfo extends HandwrittenRegion {
  type: 'SIGNATURE' | 'INITIALS';
  associatedName?: string;
  associatedRole?: string;
  dateNearby?: string;
  isComplete?: boolean; // vs partial signature
  matchesExpected?: boolean; // matches expected signer
}

export interface HandwritingAnalysisResult {
  hasHandwriting: boolean;
  handwritingPercentage: number;
  regions: HandwrittenRegion[];
  signatures: SignatureInfo[];
  needsManualReview: boolean;
  processingRecommendation: ProcessingRecommendation;
  warnings: string[];
  summary: HandwritingSummary;
}

export interface HandwritingSummary {
  totalRegions: number;
  signatureCount: number;
  annotationCount: number;
  fillInCount: number;
  avgConfidence: number;
  legibilityScore: number;
  pagesWithHandwriting: number[];
}

export type ProcessingRecommendation =
  | 'STANDARD_OCR'       // Minimal handwriting, standard OCR sufficient
  | 'ENHANCED_OCR'       // Some handwriting, use enhanced OCR
  | 'SPECIALIZED_HWR'    // Significant handwriting, use handwriting recognition
  | 'HYBRID_PROCESSING'  // Mix of printed and handwritten, process separately
  | 'MANUAL_REVIEW';     // Too much/illegible handwriting for automated processing

export interface DetectionOptions {
  detectSignatures?: boolean;
  detectAnnotations?: boolean;
  detectFillIns?: boolean;
  pageRange?: { start: number; end: number };
  minRegionSize?: number; // Minimum pixels for a valid region
  sensitivityLevel?: 'low' | 'medium' | 'high';
}

// ============================================================================
// SIGNATURE DETECTION HEURISTICS
// ============================================================================

const SIGNATURE_PATTERNS = {
  // Text patterns near signatures
  SIGNATURE_LABELS: [
    /\bsignature\b/i,
    /\bsigned\b/i,
    /\bunterschrift\b/i,  // German
    /\bfirma\b/i,         // Italian/Spanish
    /\bsigne\b/i,         // French
    /\bauthorized\s+by\b/i,
    /\bexecuted\s+by\b/i,
    /\bwitness\b/i,
    /\bby:\s*_+/i,
  ],
  
  // Patterns for signature blocks
  SIGNATURE_BLOCK: [
    /by:\s*_{3,}/i,
    /signature:\s*_{3,}/i,
    /sign(?:ed)?:\s*_{3,}/i,
    /name:\s*_{3,}.*title:\s*_{3,}/is,
  ],
  
  // Date patterns near signatures
  DATE_PATTERNS: [
    /date:\s*_{3,}/i,
    /dated:\s*_{3,}/i,
    /datum:\s*_{3,}/i,  // German
  ],
};

const INITIALS_PATTERNS = [
  /\binitials?\b/i,
  /\bparaph\b/i,        // French for initials
  /\bkürzel\b/i,        // German
];

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

interface ImageAnalysisContext {
  width: number;
  height: number;
  pageNumber: number;
  /** Azure DI handwritten spans for this page (real detection data) */
  handwrittenSpans?: Array<{ text: string; offset: number; length: number; confidence: number }>;
  /** Full page text for context matching */
  pageText?: string;
}

/**
 * Detect handwriting regions using Azure Document Intelligence styles data.
 * Uses actual DI isHandwritten spans + text pattern heuristics to classify
 * handwritten regions as signatures, annotations, fill-ins, etc.
 */
function detectHandwritingRegions(
  context: ImageAnalysisContext,
  options: DetectionOptions
): HandwrittenRegion[] {
  const regions: HandwrittenRegion[] = [];
  const { width, height, pageNumber, handwrittenSpans = [], pageText = '' } = context;
  
  if (handwrittenSpans.length === 0) return regions;
  
  const lowerText = pageText.toLowerCase();
  
  for (let i = 0; i < handwrittenSpans.length; i++) {
    const span = handwrittenSpans[i]!;
    const spanText = span.text.trim();
    if (spanText.length === 0) continue;
    
    // Classify the handwritten span based on surrounding text context
    const type = classifyHandwrittenSpan(spanText, span.offset, lowerText);
    
    // Skip if this type isn't requested
    if (type === 'SIGNATURE' && options.detectSignatures === false) continue;
    if (type === 'ANNOTATION' && options.detectAnnotations === false) continue;
    if (type === 'FILL_IN' && options.detectFillIns === false) continue;
    
    // Estimate position based on offset ratio in text
    const offsetRatio = pageText.length > 0 ? span.offset / pageText.length : 0.5;
    const estimatedY = height * offsetRatio;
    
    regions.push({
      id: `${type.toLowerCase()}_${pageNumber}_${i}`,
      type,
      boundingBox: {
        x: width * 0.1,
        y: estimatedY,
        width: Math.min(width * 0.8, spanText.length * 12),
        height: height * 0.03,
      },
      confidence: span.confidence,
      pageNumber,
      extractedText: spanText,
      textConfidence: span.confidence,
      metadata: {
        style: type === 'SIGNATURE' ? 'cursive' : 'mixed',
        legibility: span.confidence > 0.8 ? 'high' : span.confidence > 0.6 ? 'medium' : 'low',
      },
    });
  }
  
  return regions;
}

/**
 * Classify a handwritten span based on its content and surrounding text context.
 */
function classifyHandwrittenSpan(
  spanText: string,
  offset: number,
  fullTextLower: string
): HandwritingType {
  const spanLower = spanText.toLowerCase();
  
  // Check for initials pattern (1-3 uppercase letters, possibly with dots)
  if (/^[A-Z]{1,3}\.?$/.test(spanText.trim())) {
    return 'INITIALS';
  }
  
  // Check surrounding context for signature indicators (within ~200 chars)
  const contextStart = Math.max(0, offset - 200);
  const contextEnd = Math.min(fullTextLower.length, offset + spanText.length + 200);
  const surroundingContext = fullTextLower.substring(contextStart, contextEnd);
  
  const signatureContextPatterns = [
    /\bsignature\b/, /\bsigned\b/, /\bby:\s*_/, /\bexecuted\s+by\b/,
    /\bauthorized\s+by\b/, /\bwitness\b/, /\/s\//, /\bsign\s+here\b/,
    /\bunterschrift\b/, /\bfirma\b/, /\bsigne\b/,
  ];
  
  if (signatureContextPatterns.some(p => p.test(surroundingContext))) {
    return 'SIGNATURE';
  }
  
  // Check for date patterns in the handwritten text itself
  if (/\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}/.test(spanText) || 
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(spanText)) {
    return 'DATE_WRITTEN';
  }
  
  // Short text near form fields → fill-in
  if (spanText.length < 30 && /_{3,}|\.{3,}|\[.*\]/.test(surroundingContext)) {
    return 'FILL_IN';
  }
  
  // Longer text or text in margins → annotation
  if (spanText.length > 50) {
    return 'ANNOTATION';
  }
  
  // Default: if it's near the bottom 30% of the document, likely a signature
  const docPosition = offset / Math.max(fullTextLower.length, 1);
  if (docPosition > 0.7 && spanText.length < 40) {
    return 'SIGNATURE';
  }
  
  return 'FILL_IN';
}

/**
 * Extract signature information from detected regions
 */
function extractSignatureInfo(
  regions: HandwrittenRegion[],
  documentText?: string
): SignatureInfo[] {
  const signatures: SignatureInfo[] = [];
  
  for (const region of regions) {
    if (region.type !== 'SIGNATURE' && region.type !== 'INITIALS') continue;
    
    const sig: SignatureInfo = {
      ...region,
      type: region.type as 'SIGNATURE' | 'INITIALS',
    };
    
    // Try to find associated name/role from nearby text
    if (documentText) {
      // This is a simplified heuristic - in production would use
      // spatial analysis of OCR results
      const namePatterns = [
        /name:\s*([A-Z][a-zA-Z\s]+)/gi,
        /by:\s*([A-Z][a-zA-Z\s]+)/gi,
        /signed:\s*([A-Z][a-zA-Z\s]+)/gi,
      ];
      
      for (const pattern of namePatterns) {
        const match = pattern.exec(documentText);
        if (match?.[1]) {
          sig.associatedName = match[1].trim();
          break;
        }
      }
      
      const rolePatterns = [
        /title:\s*([A-Z][a-zA-Z\s]+)/gi,
        /position:\s*([A-Z][a-zA-Z\s]+)/gi,
      ];
      
      for (const pattern of rolePatterns) {
        const match = pattern.exec(documentText);
        if (match?.[1]) {
          sig.associatedRole = match[1].trim();
          break;
        }
      }
    }
    
    // Determine if signature appears complete
    const { width, height } = region.boundingBox;
    sig.isComplete = width > 100 && height > 20; // Basic heuristic
    
    signatures.push(sig);
  }
  
  return signatures;
}

/**
 * Determine processing recommendation based on analysis
 */
function determineProcessingRecommendation(
  regions: HandwrittenRegion[],
  handwritingPercentage: number
): ProcessingRecommendation {
  // Check for illegible regions
  const illegibleCount = regions.filter(
    r => r.metadata?.legibility === 'low'
  ).length;
  
  if (illegibleCount > regions.length * 0.5) {
    return 'MANUAL_REVIEW';
  }
  
  if (handwritingPercentage < 5) {
    return 'STANDARD_OCR';
  }
  
  if (handwritingPercentage < 20) {
    return 'ENHANCED_OCR';
  }
  
  if (handwritingPercentage < 50) {
    return 'HYBRID_PROCESSING';
  }
  
  return 'SPECIALIZED_HWR';
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a document for handwritten content
 * 
 * @param input - Document buffer or extracted text for heuristic analysis
 * @param options - Detection options
 * @returns Analysis result with detected regions and recommendations
 */
export async function analyzeHandwriting(
  input: Buffer | string,
  options: DetectionOptions = {},
  /** Optional: Azure DI handwritten spans (from styles.isHandwritten). When provided, uses real detection data. */
  diHandwrittenSpans?: Array<{ text: string; offset: number; length: number; confidence: number }>
): Promise<HandwritingAnalysisResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  
  const {
    detectSignatures = true,
    detectAnnotations = true,
    detectFillIns = true,
    minRegionSize = 100,
    sensitivityLevel = 'medium',
  } = options;
  
  const documentText = typeof input === 'string' ? input : input.toString('utf-8');
  
  // Standard document dimensions (A4 at 300 DPI)
  const pageWidth = 2480;
  const pageHeight = 3508;
  
  // Use real Azure DI handwriting data when available, otherwise use text heuristics
  const spans = diHandwrittenSpans || detectHandwritingFromText(documentText);
  
  // Detect regions using the spans
  const allRegions = detectHandwritingRegions(
    { width: pageWidth, height: pageHeight, pageNumber: 1, handwrittenSpans: spans, pageText: documentText },
    { detectSignatures, detectAnnotations, detectFillIns }
  );
  
  // Filter by minimum size
  const validRegions = allRegions.filter(r => {
    const area = r.boundingBox.width * r.boundingBox.height;
    return area >= minRegionSize;
  });
  
  const pagesWithHandwriting = validRegions.length > 0 ? [1] : [];
  
  // Adjust confidence based on sensitivity
  const sensitivityMultiplier = {
    low: 0.9,
    medium: 1.0,
    high: 1.1,
  }[sensitivityLevel];
  
  for (const region of validRegions) {
    region.confidence = Math.min(1, region.confidence * sensitivityMultiplier);
  }
  
  // Extract signature details
  const signatures = extractSignatureInfo(validRegions, documentText);
  
  // Calculate handwriting percentage based on character count
  const handwrittenCharCount = spans.reduce((sum, s) => sum + s.text.length, 0);
  const handwritingPercentage = documentText.length > 0 
    ? (handwrittenCharCount / documentText.length) * 100 
    : 0;
  
  // Determine if manual review is needed
  const lowConfidenceCount = validRegions.filter(r => r.confidence < 0.6).length;
  const needsManualReview = lowConfidenceCount > validRegions.length * 0.3 ||
    signatures.some(s => !s.isComplete) ||
    handwritingPercentage > 50;
  
  if (needsManualReview && validRegions.length > 0) {
    warnings.push('Document contains significant handwriting that may require manual verification');
  }
  
  if (!diHandwrittenSpans) {
    warnings.push('Using text heuristics — provide Azure DI styles data for accurate handwriting detection');
  }
  
  // Calculate summary statistics
  const avgConfidence = validRegions.length > 0
    ? validRegions.reduce((sum, r) => sum + r.confidence, 0) / validRegions.length
    : 1;
  
  const legibilityScores = { high: 1, medium: 0.7, low: 0.4 };
  const legibilityScore = validRegions.length > 0
    ? validRegions.reduce((sum, r) => {
        return sum + (legibilityScores[r.metadata?.legibility || 'medium'] || 0.7);
      }, 0) / validRegions.length
    : 1;
  
  const summary: HandwritingSummary = {
    totalRegions: validRegions.length,
    signatureCount: signatures.length,
    annotationCount: validRegions.filter(r => r.type === 'ANNOTATION').length,
    fillInCount: validRegions.filter(r => r.type === 'FILL_IN').length,
    avgConfidence,
    legibilityScore,
    pagesWithHandwriting,
  };
  
  // Get processing recommendation
  const processingRecommendation = determineProcessingRecommendation(
    validRegions,
    handwritingPercentage
  );
  
  logger.info({
    hasHandwriting: validRegions.length > 0,
    handwritingPercentage: handwritingPercentage.toFixed(2),
    regionCount: validRegions.length,
    signatureCount: signatures.length,
    recommendation: processingRecommendation,
    processingTime: Date.now() - startTime,
    usingDIData: !!diHandwrittenSpans,
  }, 'Handwriting analysis complete');
  
  return {
    hasHandwriting: validRegions.length > 0,
    handwritingPercentage,
    regions: validRegions,
    signatures,
    needsManualReview,
    processingRecommendation,
    warnings,
    summary,
  };
}

/**
 * Fallback: detect handwriting-like patterns from text when DI data is unavailable.
 * Uses signature block patterns and /s/ markers as heuristics.
 */
function detectHandwritingFromText(
  text: string
): Array<{ text: string; offset: number; length: number; confidence: number }> {
  const spans: Array<{ text: string; offset: number; length: number; confidence: number }> = [];
  
  // Look for /s/ electronic signature markers
  const sRegex = /\/s\/\s*([^\n]{1,60})/gi;
  let match;
  while ((match = sRegex.exec(text)) !== null) {
    spans.push({
      text: match[0],
      offset: match.index,
      length: match[0].length,
      confidence: 0.85,
    });
  }
  
  // Look for "Signed: Name" / "By: Name" patterns followed by actual content (not blanks)
  const signedByRegex = /(?:signed|executed)\s*(?:by)?:\s*([A-Z][a-zA-Z\s.]{2,40})/gi;
  while ((match = signedByRegex.exec(text)) !== null) {
    const name = match[1]?.trim();
    if (name && name.length > 2 && !/_{3,}/.test(name)) {
      spans.push({
        text: match[0],
        offset: match.index,
        length: match[0].length,
        confidence: 0.7,
      });
    }
  }
  
  return spans;
}

/**
 * Quick check for signatures only
 */
export async function detectSignaturesOnly(
  input: Buffer | string
): Promise<SignatureInfo[]> {
  const result = await analyzeHandwriting(input, {
    detectSignatures: true,
    detectAnnotations: false,
    detectFillIns: false,
  });
  return result.signatures;
}

/**
 * Check if document has any handwriting
 */
export async function hasHandwriting(
  input: Buffer | string,
  threshold: number = 5 // percentage
): Promise<boolean> {
  const result = await analyzeHandwriting(input, {
    detectSignatures: true,
    detectAnnotations: true,
    detectFillIns: true,
  });
  return result.handwritingPercentage >= threshold;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const HandwritingDetector = {
  analyze: analyzeHandwriting,
  detectSignatures: detectSignaturesOnly,
  hasHandwriting,
  SIGNATURE_PATTERNS,
  INITIALS_PATTERNS,
};

export default HandwritingDetector;

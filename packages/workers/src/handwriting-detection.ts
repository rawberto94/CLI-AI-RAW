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
import * as crypto from 'crypto';

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
  seed: number; // For reproducible mock results
}

/**
 * Simulate handwriting region detection
 * In production, this would use ML models like Google Vision, Azure Computer Vision,
 * or specialized handwriting detection models
 */
function detectHandwritingRegions(
  context: ImageAnalysisContext,
  options: DetectionOptions
): HandwrittenRegion[] {
  const regions: HandwrittenRegion[] = [];
  const { width, height, pageNumber, seed } = context;
  
  // Use seed for reproducible "random" detection
  const random = (n: number) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };
  
  // Simulate signature detection (usually bottom of document)
  if (options.detectSignatures !== false && random(1) > 0.3) {
    const signatureY = height * 0.7 + random(2) * height * 0.2;
    regions.push({
      id: `sig_${pageNumber}_${Date.now()}`,
      type: 'SIGNATURE',
      boundingBox: {
        x: width * 0.1 + random(3) * width * 0.3,
        y: signatureY,
        width: width * 0.2 + random(4) * width * 0.1,
        height: height * 0.05 + random(5) * height * 0.02,
      },
      confidence: 0.7 + random(6) * 0.25,
      pageNumber,
      metadata: {
        ink: random(7) > 0.5 ? 'blue' : 'black',
        style: 'cursive',
        legibility: random(8) > 0.6 ? 'medium' : 'high',
      },
    });
  }
  
  // Simulate annotation detection (margins)
  if (options.detectAnnotations !== false && random(10) > 0.6) {
    const annotationCount = Math.floor(random(11) * 3) + 1;
    for (let i = 0; i < annotationCount; i++) {
      const isLeftMargin = random(12 + i) > 0.5;
      regions.push({
        id: `ann_${pageNumber}_${i}_${Date.now()}`,
        type: 'ANNOTATION',
        boundingBox: {
          x: isLeftMargin ? 0 : width * 0.85,
          y: height * random(13 + i),
          width: width * 0.1,
          height: height * 0.05 + random(14 + i) * height * 0.03,
        },
        confidence: 0.6 + random(15 + i) * 0.3,
        pageNumber,
        metadata: {
          ink: random(16 + i) > 0.7 ? 'red' : 'black',
          style: 'mixed',
          legibility: 'medium',
        },
      });
    }
  }
  
  // Simulate fill-in field detection
  if (options.detectFillIns !== false && random(20) > 0.4) {
    const fillInCount = Math.floor(random(21) * 5) + 1;
    for (let i = 0; i < fillInCount; i++) {
      regions.push({
        id: `fill_${pageNumber}_${i}_${Date.now()}`,
        type: 'FILL_IN',
        boundingBox: {
          x: width * 0.2 + random(22 + i) * width * 0.6,
          y: height * 0.1 + random(23 + i) * height * 0.8,
          width: width * 0.15 + random(24 + i) * width * 0.1,
          height: height * 0.02,
        },
        confidence: 0.75 + random(25 + i) * 0.2,
        pageNumber,
        metadata: {
          ink: 'black',
          style: 'print',
          legibility: 'high',
        },
      });
    }
  }
  
  // Simulate date written detection
  if (random(30) > 0.5) {
    regions.push({
      id: `date_${pageNumber}_${Date.now()}`,
      type: 'DATE_WRITTEN',
      boundingBox: {
        x: width * 0.6,
        y: height * 0.75 + random(31) * height * 0.1,
        width: width * 0.15,
        height: height * 0.02,
      },
      confidence: 0.8 + random(32) * 0.15,
      pageNumber,
      extractedText: `${Math.floor(random(33) * 28) + 1}/${Math.floor(random(34) * 12) + 1}/2024`,
      textConfidence: 0.7 + random(35) * 0.2,
      metadata: {
        ink: 'black',
        style: 'print',
        legibility: 'high',
      },
    });
  }
  
  return regions;
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
  options: DetectionOptions = {}
): Promise<HandwritingAnalysisResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  
  const {
    detectSignatures = true,
    detectAnnotations = true,
    detectFillIns = true,
    pageRange,
    minRegionSize = 100,
    sensitivityLevel = 'medium',
  } = options;
  
  // Generate seed from input for reproducible results
  const hash = crypto.createHash('md5')
    .update(Buffer.isBuffer(input) ? input : Buffer.from(input))
    .digest('hex');
  const seed = parseInt(hash.substring(0, 8), 16);
  
  // Simulate multi-page document
  const pageCount = 1 + (seed % 10);
  const startPage = pageRange?.start || 1;
  const endPage = Math.min(pageRange?.end || pageCount, pageCount);
  
  // Standard document dimensions (A4 at 300 DPI)
  const pageWidth = 2480;
  const pageHeight = 3508;
  
  // Detect regions on each page
  const allRegions: HandwrittenRegion[] = [];
  const pagesWithHandwriting: number[] = [];
  
  for (let page = startPage; page <= endPage; page++) {
    const pageRegions = detectHandwritingRegions(
      { width: pageWidth, height: pageHeight, pageNumber: page, seed: seed + page },
      { detectSignatures, detectAnnotations, detectFillIns }
    );
    
    // Filter by minimum size
    const validRegions = pageRegions.filter(r => {
      const area = r.boundingBox.width * r.boundingBox.height;
      return area >= minRegionSize;
    });
    
    if (validRegions.length > 0) {
      pagesWithHandwriting.push(page);
    }
    
    allRegions.push(...validRegions);
  }
  
  // Adjust confidence based on sensitivity
  const sensitivityMultiplier = {
    low: 0.9,
    medium: 1.0,
    high: 1.1,
  }[sensitivityLevel];
  
  for (const region of allRegions) {
    region.confidence = Math.min(1, region.confidence * sensitivityMultiplier);
  }
  
  // Extract signature details
  const documentText = typeof input === 'string' ? input : undefined;
  const signatures = extractSignatureInfo(allRegions, documentText);
  
  // Calculate handwriting percentage
  const totalPageArea = pageWidth * pageHeight * (endPage - startPage + 1);
  const handwritingArea = allRegions.reduce((sum, r) => {
    return sum + r.boundingBox.width * r.boundingBox.height;
  }, 0);
  const handwritingPercentage = (handwritingArea / totalPageArea) * 100;
  
  // Determine if manual review is needed
  const lowConfidenceCount = allRegions.filter(r => r.confidence < 0.6).length;
  const needsManualReview = lowConfidenceCount > allRegions.length * 0.3 ||
    signatures.some(s => !s.isComplete) ||
    handwritingPercentage > 50;
  
  if (needsManualReview) {
    warnings.push('Document contains significant handwriting that may require manual verification');
  }
  
  // Calculate summary statistics
  const avgConfidence = allRegions.length > 0
    ? allRegions.reduce((sum, r) => sum + r.confidence, 0) / allRegions.length
    : 1;
  
  const legibilityScores = { high: 1, medium: 0.7, low: 0.4 };
  const legibilityScore = allRegions.length > 0
    ? allRegions.reduce((sum, r) => {
        return sum + (legibilityScores[r.metadata?.legibility || 'medium'] || 0.7);
      }, 0) / allRegions.length
    : 1;
  
  const summary: HandwritingSummary = {
    totalRegions: allRegions.length,
    signatureCount: signatures.length,
    annotationCount: allRegions.filter(r => r.type === 'ANNOTATION').length,
    fillInCount: allRegions.filter(r => r.type === 'FILL_IN').length,
    avgConfidence,
    legibilityScore,
    pagesWithHandwriting,
  };
  
  // Get processing recommendation
  const processingRecommendation = determineProcessingRecommendation(
    allRegions,
    handwritingPercentage
  );
  
  logger.info({
    hasHandwriting: allRegions.length > 0,
    handwritingPercentage: handwritingPercentage.toFixed(2),
    regionCount: allRegions.length,
    signatureCount: signatures.length,
    recommendation: processingRecommendation,
    processingTime: Date.now() - startTime,
  }, 'Handwriting analysis complete');
  
  return {
    hasHandwriting: allRegions.length > 0,
    handwritingPercentage,
    regions: allRegions,
    signatures,
    needsManualReview,
    processingRecommendation,
    warnings,
    summary,
  };
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

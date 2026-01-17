/**
 * Hybrid OCR Orchestrator
 * 
 * State-of-the-art document processing that intelligently combines
 * multiple OCR engines for optimal accuracy and cost efficiency.
 * 
 * Strategy:
 * 1. Assess document complexity
 * 2. Route to appropriate engine(s)
 * 3. Merge results for best accuracy
 * 4. Provide confidence scoring
 * 
 * Engines Used:
 * - GPT-4o Vision: Best for general text, handwriting, complex layouts
 * - AWS Textract: Best for tables, forms, signatures (99%+ table accuracy)
 * - pdf-parse: Fast extraction for simple text PDFs
 * - Tesseract: Offline fallback, EU compliance
 * 
 * Cost Optimization:
 * - Fast mode: pdf-parse only (~$0.001/doc)
 * - Balanced: Smart routing (~$0.02/doc average)
 * - High: Vision + Textract merged (~$0.05/doc)
 */

import { VisionDocumentAnalyzer, VisionAnalysisResult } from './vision-document-analyzer';
import { AWSTextractClient, TextractResult } from './aws-textract-client';
import { performTesseractOCR, performEUCompliantOCR, OCRResult } from './eu-compliant-ocr';
import { DocumentPreprocessor } from './document-preprocessor';
import { optionalImport } from '@/lib/server/optional-module';

// ============================================================================
// Types
// ============================================================================

export type OCRMode = 'fast' | 'balanced' | 'high' | 'max';

export interface HybridOCRResult {
  /** Full extracted text */
  text: string;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Extracted tables with high accuracy */
  tables: UnifiedTable[];
  /** Form fields (key-value pairs) */
  formFields: FormField[];
  /** Signature information */
  signatures: SignatureInfo[];
  /** Handwriting detected */
  handwriting: HandwritingInfo[];
  /** Document structure */
  structure: DocumentStructureInfo;
  /** Processing metadata */
  metadata: ProcessingMetadata;
}

export interface UnifiedTable {
  id: string;
  pageNumber: number;
  headers: string[];
  rows: string[][];
  confidence: number;
  tableType: string;
  source: 'vision' | 'textract' | 'merged';
}

export interface FormField {
  key: string;
  value: string;
  confidence: number;
  pageNumber: number;
  source: 'vision' | 'textract';
}

export interface SignatureInfo {
  pageNumber: number;
  signerName?: string;
  date?: string;
  type: 'handwritten' | 'digital' | 'initials' | 'stamp';
  isSigned: boolean;
  confidence: number;
  source: 'vision' | 'textract';
}

export interface HandwritingInfo {
  text: string;
  pageNumber: number;
  confidence: number;
  type: 'annotation' | 'signature' | 'note' | 'correction';
}

export interface DocumentStructureInfo {
  documentType: string;
  title?: string;
  parties: string[];
  sections: { title: string; pageStart: number; pageEnd: number }[];
  language: string;
  pageCount: number;
}

export interface ProcessingMetadata {
  mode: OCRMode;
  enginesUsed: string[];
  processingTimeMs: number;
  estimatedCost: number;
  complexity: DocumentComplexity;
  preprocessingApplied: boolean;
  qualityScore: number;
}

export interface DocumentComplexity {
  score: number; // 0-1
  factors: {
    hasScannedPages: boolean;
    hasTables: boolean;
    hasHandwriting: boolean;
    hasComplexLayout: boolean;
    hasSignatures: boolean;
    pageCount: number;
    estimatedQuality: 'low' | 'medium' | 'high';
  };
}

export interface HybridOCROptions {
  /** Processing mode */
  mode?: OCRMode;
  /** Force specific engines */
  engines?: ('vision' | 'textract' | 'tesseract' | 'pdf-parse')[];
  /** Target language for OCR */
  language?: string;
  /** Apply preprocessing (deskew, denoise, etc.) */
  preprocess?: boolean;
  /** Maximum pages to process */
  maxPages?: number;
  /** EU-compliant processing only */
  euCompliant?: boolean;
  /** Custom queries for Textract */
  textractQueries?: string[];
  /** High detail mode for scanned documents */
  highDetail?: boolean;
}

// ============================================================================
// Cost Estimation
// ============================================================================

const COST_ESTIMATES = {
  'pdf-parse': 0.0001,      // Essentially free (local processing)
  'tesseract': 0.001,       // Local processing
  'gpt-4o-mini': 0.01,      // Per page (input + output tokens)
  'gpt-4o': 0.03,           // Per page (higher quality)
  'textract': 0.015,        // Per page (AWS pricing)
  'textract-tables': 0.025, // Per page with tables
  'textract-forms': 0.05,   // Per page with forms + queries
};

// ============================================================================
// Hybrid OCR Orchestrator Class
// ============================================================================

export class HybridOCROrchestrator {
  private visionAnalyzer: VisionDocumentAnalyzer | null = null;
  private textractClient: AWSTextractClient | null = null;
  private preprocessor: DocumentPreprocessor;

  constructor() {
    this.preprocessor = new DocumentPreprocessor({ preset: 'balanced' });
  }

  /**
   * Process document with hybrid OCR strategy
   */
  async processDocument(
    documentBuffer: Buffer,
    mimeType: string,
    options: HybridOCROptions = {}
  ): Promise<HybridOCRResult> {
    const startTime = Date.now();
    const mode = options.mode || 'balanced';
    const enginesUsed: string[] = [];
    let estimatedCost = 0;

    // Step 1: Assess document complexity
    const complexity = await this.assessComplexity(documentBuffer, mimeType);

    // Step 2: Apply preprocessing if needed
    let processedBuffer = documentBuffer;
    let preprocessingApplied = false;

    if (options.preprocess !== false && this.shouldPreprocess(complexity, mode)) {
      try {
        const preprocessResult = await this.preprocessor.smartPreprocess(documentBuffer);
        processedBuffer = preprocessResult.buffer;
        preprocessingApplied = true;
      } catch (error) {
        console.warn('Preprocessing failed, using original buffer:', error);
      }
    }

    // Step 3: Select and execute OCR strategy based on mode
    let result: HybridOCRResult;

    switch (mode) {
      case 'fast':
        result = await this.processFast(processedBuffer, mimeType, options);
        enginesUsed.push('pdf-parse');
        estimatedCost = COST_ESTIMATES['pdf-parse'];
        break;

      case 'balanced':
        result = await this.processBalanced(processedBuffer, mimeType, complexity, options);
        enginesUsed.push(...result.metadata.enginesUsed);
        estimatedCost = this.calculateCost(result.metadata.enginesUsed, complexity.factors.pageCount);
        break;

      case 'high':
        result = await this.processHigh(processedBuffer, mimeType, options);
        enginesUsed.push(...result.metadata.enginesUsed);
        estimatedCost = this.calculateCost(result.metadata.enginesUsed, complexity.factors.pageCount);
        break;

      case 'max':
        result = await this.processMax(processedBuffer, mimeType, options);
        enginesUsed.push(...result.metadata.enginesUsed);
        estimatedCost = this.calculateCost(result.metadata.enginesUsed, complexity.factors.pageCount);
        break;

      default:
        result = await this.processBalanced(processedBuffer, mimeType, complexity, options);
        enginesUsed.push(...result.metadata.enginesUsed);
        estimatedCost = this.calculateCost(result.metadata.enginesUsed, complexity.factors.pageCount);
    }

    // Update metadata
    result.metadata = {
      ...result.metadata,
      mode,
      enginesUsed,
      processingTimeMs: Date.now() - startTime,
      estimatedCost,
      complexity,
      preprocessingApplied,
    };

    return result;
  }

  /**
   * Assess document complexity to determine optimal processing strategy
   */
  private async assessComplexity(
    documentBuffer: Buffer,
    mimeType: string
  ): Promise<DocumentComplexity> {
    const factors = {
      hasScannedPages: false,
      hasTables: false,
      hasHandwriting: false,
      hasComplexLayout: false,
      hasSignatures: false,
      pageCount: 1,
      estimatedQuality: 'high' as const,
    };

    try {
      // Quick analysis using pdf-parse for PDFs
      if (mimeType === 'application/pdf') {
        const pdfParse = await optionalImport<any>('pdf-parse');
        if (pdfParse?.default) {
          const pdfData = await pdfParse.default(documentBuffer);
          factors.pageCount = pdfData.numpages || 1;
          
          const text = pdfData.text || '';
          
          // Detect if scanned (very little text extracted)
          const textDensity = text.length / factors.pageCount;
          if (textDensity < 100) {
            factors.hasScannedPages = true;
            factors.estimatedQuality = 'low';
          }

          // Detect tables (simple heuristic)
          if (text.includes('|') || /\t.*\t.*\t/m.test(text)) {
            factors.hasTables = true;
          }

          // Detect signature pages
          if (/signature|sign here|signed|executed/i.test(text)) {
            factors.hasSignatures = true;
          }

          // Detect complex layout
          if (factors.pageCount > 10 || /exhibit|schedule|appendix/i.test(text)) {
            factors.hasComplexLayout = true;
          }
        }
      } else if (mimeType.startsWith('image/')) {
        // Images are always treated as scanned
        factors.hasScannedPages = true;
        factors.estimatedQuality = 'medium';
      }
    } catch (error) {
      console.warn('Complexity assessment failed:', error);
    }

    // Calculate complexity score
    let score = 0;
    if (factors.hasScannedPages) score += 0.3;
    if (factors.hasTables) score += 0.2;
    if (factors.hasHandwriting) score += 0.2;
    if (factors.hasComplexLayout) score += 0.15;
    if (factors.hasSignatures) score += 0.1;
    if (factors.pageCount > 20) score += 0.05;

    return { score: Math.min(score, 1), factors };
  }

  /**
   * Determine if preprocessing should be applied
   */
  private shouldPreprocess(complexity: DocumentComplexity, mode: OCRMode): boolean {
    if (mode === 'fast') return false;
    return complexity.factors.hasScannedPages || complexity.factors.estimatedQuality === 'low';
  }

  /**
   * Fast mode: pdf-parse only (no AI)
   */
  private async processFast(
    buffer: Buffer,
    mimeType: string,
    _options: HybridOCROptions
  ): Promise<HybridOCRResult> {
    let text = '';
    let pageCount = 1;

    if (mimeType === 'application/pdf') {
      try {
        const pdfParse = await optionalImport<any>('pdf-parse');
        if (pdfParse?.default) {
          const pdfData = await pdfParse.default(buffer);
          text = pdfData.text || '';
          pageCount = pdfData.numpages || 1;
        }
      } catch (error) {
        console.error('PDF parse failed:', error);
      }
    } else {
      // For images, fall back to Tesseract
      try {
        const result = await performTesseractOCR(buffer);
        text = result.text;
      } catch {
        text = '[Image OCR not available in fast mode]';
      }
    }

    return this.createEmptyResult(text, 0.7, pageCount, ['pdf-parse']);
  }

  /**
   * Balanced mode: Smart routing based on complexity
   */
  private async processBalanced(
    buffer: Buffer,
    mimeType: string,
    complexity: DocumentComplexity,
    options: HybridOCROptions
  ): Promise<HybridOCRResult> {
    const enginesUsed: string[] = [];

    // Simple documents: pdf-parse is sufficient
    if (complexity.score < 0.3 && !complexity.factors.hasScannedPages) {
      return this.processFast(buffer, mimeType, options);
    }

    // Medium complexity: Vision AI
    if (complexity.score < 0.6) {
      enginesUsed.push('gpt-4o');
      return this.processWithVision(buffer, mimeType, options, 'gpt-4o', enginesUsed);
    }

    // High complexity: Vision + Textract for tables
    if (complexity.factors.hasTables && AWSTextractClient.isConfigured()) {
      enginesUsed.push('gpt-4o', 'textract');
      return this.processWithVisionAndTextract(buffer, mimeType, options, enginesUsed);
    }

    // Default to Vision only
    enginesUsed.push('gpt-4o');
    return this.processWithVision(buffer, mimeType, options, 'gpt-4o', enginesUsed);
  }

  /**
   * High mode: Vision + Textract combined
   */
  private async processHigh(
    buffer: Buffer,
    mimeType: string,
    options: HybridOCROptions
  ): Promise<HybridOCRResult> {
    const enginesUsed: string[] = ['gpt-4o'];

    if (AWSTextractClient.isConfigured()) {
      enginesUsed.push('textract');
      return this.processWithVisionAndTextract(buffer, mimeType, options, enginesUsed);
    }

    return this.processWithVision(buffer, mimeType, options, 'gpt-4o', enginesUsed);
  }

  /**
   * Max mode: All engines with result merging
   */
  private async processMax(
    buffer: Buffer,
    mimeType: string,
    options: HybridOCROptions
  ): Promise<HybridOCRResult> {
    const enginesUsed: string[] = [];
    const results: Partial<HybridOCRResult>[] = [];

    // Run all available engines in parallel
    const promises: Promise<any>[] = [];

    // Vision AI
    promises.push(
      this.processWithVision(buffer, mimeType, options, 'gpt-4o', ['gpt-4o'])
        .then(r => { results.push(r); enginesUsed.push('gpt-4o'); })
        .catch(e => console.warn('Vision failed:', e))
    );

    // Textract
    if (AWSTextractClient.isConfigured()) {
      promises.push(
        this.processWithTextract(buffer, options)
          .then(r => { results.push(r); enginesUsed.push('textract'); })
          .catch(e => console.warn('Textract failed:', e))
      );
    }

    // EU Compliant (as backup)
    if (options.euCompliant) {
      promises.push(
        performEUCompliantOCR(buffer)
          .then(r => { 
            results.push(this.convertOCRResult(r)); 
            enginesUsed.push('eu-compliant'); 
          })
          .catch(e => console.warn('EU OCR failed:', e))
      );
    }

    await Promise.all(promises);

    // Merge results
    return this.mergeResults(results, enginesUsed);
  }

  /**
   * Process with Vision API only
   */
  private async processWithVision(
    buffer: Buffer,
    mimeType: string,
    options: HybridOCROptions,
    model: 'gpt-4o' | 'gpt-4o-mini',
    enginesUsed: string[]
  ): Promise<HybridOCRResult> {
    if (!this.visionAnalyzer) {
      this.visionAnalyzer = new VisionDocumentAnalyzer({ model });
    }

    const visionResult = await this.visionAnalyzer.analyzeDocument(buffer, mimeType, {
      model,
      maxPages: options.maxPages,
      highDetail: options.highDetail,
      language: options.language,
    });

    return this.convertVisionResult(visionResult, enginesUsed);
  }

  /**
   * Process with Textract only
   */
  private async processWithTextract(
    buffer: Buffer,
    options: HybridOCROptions
  ): Promise<Partial<HybridOCRResult>> {
    if (!this.textractClient) {
      this.textractClient = new AWSTextractClient();
    }

    const textractResult = await this.textractClient.analyzeDocument(buffer, {
      featureTypes: ['TABLES', 'FORMS', 'SIGNATURES'],
      queries: options.textractQueries?.map(q => ({ text: q })),
    });

    return this.convertTextractResult(textractResult);
  }

  /**
   * Process with both Vision and Textract, merge results
   */
  private async processWithVisionAndTextract(
    buffer: Buffer,
    mimeType: string,
    options: HybridOCROptions,
    enginesUsed: string[]
  ): Promise<HybridOCRResult> {
    // Run in parallel
    const [visionResult, textractResult] = await Promise.all([
      this.processWithVision(buffer, mimeType, options, 'gpt-4o', []),
      this.processWithTextract(buffer, options).catch(() => null),
    ]);

    if (!textractResult) {
      return { ...visionResult, metadata: { ...visionResult.metadata, enginesUsed } };
    }

    // Merge results: Use Vision for text, Textract for tables/forms
    const merged: HybridOCRResult = {
      text: visionResult.text,
      confidence: Math.max(visionResult.confidence, textractResult.confidence || 0),
      tables: this.mergeTables(visionResult.tables, textractResult.tables || []),
      formFields: [...(textractResult.formFields || []), ...visionResult.formFields],
      signatures: this.mergeSignatures(visionResult.signatures, textractResult.signatures || []),
      handwriting: visionResult.handwriting,
      structure: visionResult.structure,
      metadata: {
        ...visionResult.metadata,
        enginesUsed,
        qualityScore: this.calculateQualityScore(visionResult, textractResult),
      },
    };

    return merged;
  }

  /**
   * Convert Vision result to unified format
   */
  private convertVisionResult(
    result: VisionAnalysisResult,
    enginesUsed: string[]
  ): HybridOCRResult {
    return {
      text: result.text,
      confidence: result.confidence,
      tables: result.tables.map((t, i) => ({
        id: `vision-table-${i}`,
        pageNumber: t.pageNumber,
        headers: t.headers,
        rows: t.rows,
        confidence: t.confidence,
        tableType: t.tableType,
        source: 'vision' as const,
      })),
      formFields: [],
      signatures: result.signatures.map(s => ({
        pageNumber: s.pageNumber,
        signerName: s.signerName,
        date: s.signatureDate,
        type: s.signatureType,
        isSigned: s.isSigned,
        confidence: s.confidence,
        source: 'vision' as const,
      })),
      handwriting: result.handwriting.map(h => ({
        text: h.text,
        pageNumber: h.pageNumber,
        confidence: h.confidence,
        type: h.type,
      })),
      structure: {
        documentType: result.documentStructure.documentType,
        title: result.documentStructure.title,
        parties: result.documentStructure.parties,
        sections: result.documentStructure.sections.map(s => ({
          title: s.title,
          pageStart: s.pageStart,
          pageEnd: s.pageEnd,
        })),
        language: result.documentStructure.language,
        pageCount: result.pages.length,
      },
      metadata: {
        mode: 'balanced',
        enginesUsed,
        processingTimeMs: result.processingTimeMs,
        estimatedCost: 0,
        complexity: { score: 0.5, factors: { hasScannedPages: false, hasTables: result.tables.length > 0, hasHandwriting: result.handwriting.length > 0, hasComplexLayout: false, hasSignatures: result.signatures.length > 0, pageCount: result.pages.length, estimatedQuality: 'high' } },
        preprocessingApplied: false,
        qualityScore: result.confidence,
      },
    };
  }

  /**
   * Convert Textract result to partial unified format
   */
  private convertTextractResult(result: TextractResult): Partial<HybridOCRResult> {
    return {
      text: result.text,
      confidence: result.confidence,
      tables: result.tables.map((t, i) => ({
        id: `textract-table-${i}`,
        pageNumber: t.pageNumber,
        headers: t.headers,
        rows: t.rows.map(r => r.cells.map(c => c.text)),
        confidence: t.confidence,
        tableType: 'data',
        source: 'textract' as const,
      })),
      formFields: result.forms.map(f => ({
        key: f.key,
        value: f.value,
        confidence: (f.keyConfidence + f.valueConfidence) / 2,
        pageNumber: f.pageNumber,
        source: 'textract' as const,
      })),
      signatures: result.signatures.map(s => ({
        pageNumber: s.pageNumber,
        type: s.type,
        isSigned: true,
        confidence: s.confidence,
        source: 'textract' as const,
      })),
    };
  }

  /**
   * Convert generic OCR result
   */
  private convertOCRResult(result: OCRResult): Partial<HybridOCRResult> {
    return {
      text: result.text,
      confidence: result.confidence,
      tables: result.tables?.map((t, i) => ({
        id: `ocr-table-${i}`,
        pageNumber: t.pageNumber,
        headers: t.headers,
        rows: t.rows,
        confidence: t.confidence,
        tableType: 'unknown',
        source: 'vision' as const,
      })) || [],
    };
  }

  /**
   * Merge results from multiple engines
   */
  private mergeResults(
    results: Partial<HybridOCRResult>[],
    enginesUsed: string[]
  ): HybridOCRResult {
    if (results.length === 0) {
      return this.createEmptyResult('', 0, 0, enginesUsed);
    }

    if (results.length === 1) {
      const r = results[0];
      return {
        ...this.createEmptyResult(r.text || '', r.confidence || 0, 1, enginesUsed),
        ...r,
        metadata: { ...this.createEmptyResult('', 0, 0, enginesUsed).metadata, enginesUsed },
      };
    }

    // Use longest text (most complete extraction)
    const bestTextResult = results.reduce((best, curr) => 
      (curr.text?.length || 0) > (best.text?.length || 0) ? curr : best
    );

    // Merge all tables
    const allTables: UnifiedTable[] = [];
    for (const r of results) {
      if (r.tables) allTables.push(...r.tables);
    }

    // Prefer Textract tables (higher accuracy)
    const textractTables = allTables.filter(t => t.source === 'textract');
    const visionTables = allTables.filter(t => t.source === 'vision');
    const mergedTables = textractTables.length > 0 ? textractTables : visionTables;

    // Merge form fields (unique by key)
    const formFields: FormField[] = [];
    const seenKeys = new Set<string>();
    for (const r of results) {
      for (const f of r.formFields || []) {
        if (!seenKeys.has(f.key)) {
          formFields.push(f);
          seenKeys.add(f.key);
        }
      }
    }

    // Merge signatures
    const signatures: SignatureInfo[] = [];
    for (const r of results) {
      if (r.signatures) signatures.push(...r.signatures);
    }

    // Calculate overall confidence
    const confidences = results.map(r => r.confidence || 0).filter(c => c > 0);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.5;

    return {
      text: bestTextResult.text || '',
      confidence: avgConfidence,
      tables: mergedTables,
      formFields,
      signatures,
      handwriting: results.flatMap(r => r.handwriting || []),
      structure: results.find(r => r.structure)?.structure || {
        documentType: 'unknown',
        parties: [],
        sections: [],
        language: 'en',
        pageCount: 1,
      },
      metadata: {
        mode: 'max',
        enginesUsed,
        processingTimeMs: 0,
        estimatedCost: 0,
        complexity: { score: 0.7, factors: { hasScannedPages: false, hasTables: mergedTables.length > 0, hasHandwriting: false, hasComplexLayout: false, hasSignatures: signatures.length > 0, pageCount: 1, estimatedQuality: 'high' } },
        preprocessingApplied: false,
        qualityScore: avgConfidence,
      },
    };
  }

  /**
   * Merge tables from different sources
   */
  private mergeTables(
    visionTables: UnifiedTable[],
    textractTables: UnifiedTable[]
  ): UnifiedTable[] {
    // Textract has higher table accuracy, prefer those
    if (textractTables.length > 0) {
      return textractTables.map(t => ({ ...t, source: 'merged' as const }));
    }
    return visionTables;
  }

  /**
   * Merge signatures from different sources
   */
  private mergeSignatures(
    visionSigs: SignatureInfo[],
    textractSigs: SignatureInfo[]
  ): SignatureInfo[] {
    // Combine and deduplicate by page
    const byPage = new Map<number, SignatureInfo>();

    // Textract signatures first (more reliable detection)
    for (const sig of textractSigs) {
      byPage.set(sig.pageNumber, sig);
    }

    // Add vision signatures for pages not covered by Textract
    for (const sig of visionSigs) {
      if (!byPage.has(sig.pageNumber)) {
        byPage.set(sig.pageNumber, sig);
      } else {
        // Merge: prefer Vision's signer name info
        const existing = byPage.get(sig.pageNumber)!;
        if (sig.signerName && !existing.signerName) {
          existing.signerName = sig.signerName;
        }
        if (sig.date && !existing.date) {
          existing.date = sig.date;
        }
      }
    }

    return Array.from(byPage.values());
  }

  /**
   * Calculate quality score from merged results
   */
  private calculateQualityScore(
    visionResult: HybridOCRResult,
    textractResult: Partial<HybridOCRResult> | null
  ): number {
    let score = visionResult.confidence;

    // Boost score if we have table confirmation from Textract
    if (textractResult?.tables && textractResult.tables.length > 0) {
      score = Math.min(score + 0.1, 1.0);
    }

    // Boost if form fields extracted
    if (textractResult?.formFields && textractResult.formFields.length > 0) {
      score = Math.min(score + 0.05, 1.0);
    }

    return score;
  }

  /**
   * Calculate estimated cost
   */
  private calculateCost(engines: string[], pageCount: number): number {
    let cost = 0;

    for (const engine of engines) {
      if (engine === 'gpt-4o') {
        cost += COST_ESTIMATES['gpt-4o'] * pageCount;
      } else if (engine === 'gpt-4o-mini') {
        cost += COST_ESTIMATES['gpt-4o-mini'] * pageCount;
      } else if (engine === 'textract') {
        cost += COST_ESTIMATES['textract-tables'] * pageCount;
      } else if (engine === 'pdf-parse') {
        cost += COST_ESTIMATES['pdf-parse'];
      } else if (engine === 'tesseract') {
        cost += COST_ESTIMATES['tesseract'] * pageCount;
      }
    }

    return cost;
  }

  /**
   * Create empty result structure
   */
  private createEmptyResult(
    text: string,
    confidence: number,
    pageCount: number,
    enginesUsed: string[]
  ): HybridOCRResult {
    return {
      text,
      confidence,
      tables: [],
      formFields: [],
      signatures: [],
      handwriting: [],
      structure: {
        documentType: 'unknown',
        parties: [],
        sections: [],
        language: 'en',
        pageCount,
      },
      metadata: {
        mode: 'fast',
        enginesUsed,
        processingTimeMs: 0,
        estimatedCost: 0,
        complexity: {
          score: 0,
          factors: {
            hasScannedPages: false,
            hasTables: false,
            hasHandwriting: false,
            hasComplexLayout: false,
            hasSignatures: false,
            pageCount,
            estimatedQuality: 'high',
          },
        },
        preprocessingApplied: false,
        qualityScore: confidence,
      },
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

let defaultOrchestrator: HybridOCROrchestrator | null = null;

export function getHybridOCR(): HybridOCROrchestrator {
  if (!defaultOrchestrator) {
    defaultOrchestrator = new HybridOCROrchestrator();
  }
  return defaultOrchestrator;
}

/**
 * Quick processing with auto mode selection
 */
export async function processDocumentHybrid(
  documentBuffer: Buffer,
  mimeType: string,
  options?: HybridOCROptions
): Promise<HybridOCRResult> {
  const orchestrator = getHybridOCR();
  return orchestrator.processDocument(documentBuffer, mimeType, options);
}

/**
 * Fast processing (pdf-parse only)
 */
export async function processDocumentFast(
  documentBuffer: Buffer,
  mimeType: string
): Promise<HybridOCRResult> {
  return processDocumentHybrid(documentBuffer, mimeType, { mode: 'fast' });
}

/**
 * High accuracy processing (Vision + Textract)
 */
export async function processDocumentHighAccuracy(
  documentBuffer: Buffer,
  mimeType: string
): Promise<HybridOCRResult> {
  return processDocumentHybrid(documentBuffer, mimeType, { mode: 'high' });
}

/**
 * Maximum accuracy processing (all engines merged)
 */
export async function processDocumentMax(
  documentBuffer: Buffer,
  mimeType: string
): Promise<HybridOCRResult> {
  return processDocumentHybrid(documentBuffer, mimeType, { mode: 'max' });
}

/**
 * Vision Document Analyzer
 * 
 * State-of-the-art multi-pass document analysis using GPT-4o Vision.
 * Implements specialized passes for different document elements.
 * 
 * Features:
 * - Multi-pass extraction (text, tables, forms, signatures)
 * - Intelligent page type detection
 * - Layout-aware text extraction
 * - Table structure preservation
 * - Handwriting recognition
 * - Signature detection
 * - Document structure analysis
 */

import OpenAI from 'openai';
import { optionalImport } from '@/lib/server/optional-module';

// ============================================================================
// Types
// ============================================================================

export interface VisionAnalysisResult {
  text: string;
  confidence: number;
  pages: VisionPage[];
  tables: VisionTable[];
  signatures: VisionSignature[];
  handwriting: VisionHandwriting[];
  documentStructure: DocumentStructure;
  processingTimeMs: number;
  passesUsed: string[];
}

export interface VisionPage {
  pageNumber: number;
  text: string;
  pageType: 'text' | 'form' | 'table' | 'mixed' | 'cover' | 'signature';
  layout: PageLayout;
  confidence: number;
}

export interface PageLayout {
  hasHeader: boolean;
  hasFooter: boolean;
  hasPageNumber: boolean;
  columns: number;
  orientation: 'portrait' | 'landscape';
  marginNotes: boolean;
}

export interface VisionTable {
  pageNumber: number;
  headers: string[];
  rows: string[][];
  confidence: number;
  tableType: 'pricing' | 'schedule' | 'terms' | 'data' | 'unknown';
  position: { top: number; left: number; width: number; height: number };
}

export interface VisionSignature {
  pageNumber: number;
  signerName?: string;
  signatureDate?: string;
  signatureType: 'handwritten' | 'digital' | 'initials' | 'stamp';
  isSigned: boolean;
  confidence: number;
  position: { top: number; left: number };
}

export interface VisionHandwriting {
  pageNumber: number;
  text: string;
  confidence: number;
  type: 'annotation' | 'signature' | 'note' | 'correction';
}

export interface DocumentStructure {
  documentType: string;
  title?: string;
  parties: string[];
  sections: DocumentSection[];
  hasTableOfContents: boolean;
  hasExhibits: boolean;
  language: string;
}

export interface DocumentSection {
  title: string;
  pageStart: number;
  pageEnd: number;
  level: number;
}

export interface VisionAnalysisOptions {
  /** Run specific passes only */
  passes?: ('text' | 'tables' | 'forms' | 'signatures' | 'structure')[];
  /** High detail mode for scanned documents */
  highDetail?: boolean;
  /** Target language for better OCR */
  language?: string;
  /** Maximum pages to process */
  maxPages?: number;
  /** Use GPT-4o (high quality) or GPT-4o-mini (faster) */
  model?: 'gpt-4o' | 'gpt-4o-mini';
  /** Include page images in response */
  includeImages?: boolean;
}

// ============================================================================
// Vision Document Analyzer Class
// ============================================================================

export class VisionDocumentAnalyzer {
  private openai: OpenAI;
  private model: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key required for Vision Document Analyzer');
    }

    this.openai = new OpenAI({ apiKey });
    this.model = options?.model || 'gpt-4o'; // Default to GPT-4o for best quality
  }

  /**
   * Analyze document with multi-pass extraction
   */
  async analyzeDocument(
    documentBuffer: Buffer,
    mimeType: string,
    options: VisionAnalysisOptions = {}
  ): Promise<VisionAnalysisResult> {
    const startTime = Date.now();
    const passesUsed: string[] = [];
    const model = options.model || this.model;

    // Convert document to images if PDF
    const images = await this.prepareImages(documentBuffer, mimeType, options.maxPages);
    
    if (images.length === 0) {
      throw new Error('No images could be extracted from document');
    }

    // Determine which passes to run
    const passes = options.passes || ['text', 'tables', 'forms', 'signatures', 'structure'];

    // Initialize results
    let fullText = '';
    const pages: VisionPage[] = [];
    const tables: VisionTable[] = [];
    const signatures: VisionSignature[] = [];
    const handwriting: VisionHandwriting[] = [];
    let documentStructure: DocumentStructure = {
      documentType: 'unknown',
      parties: [],
      sections: [],
      hasTableOfContents: false,
      hasExhibits: false,
      language: 'en',
    };

    // Pass 1: Text extraction (always run)
    if (passes.includes('text')) {
      passesUsed.push('text');
      const textResult = await this.extractText(images, model, options);
      fullText = textResult.text;
      pages.push(...textResult.pages);
    }

    // Pass 2: Table extraction
    if (passes.includes('tables')) {
      passesUsed.push('tables');
      const tableResult = await this.extractTables(images, model, options);
      tables.push(...tableResult);
    }

    // Pass 3: Form/signature detection
    if (passes.includes('signatures') || passes.includes('forms')) {
      passesUsed.push('signatures');
      const sigResult = await this.detectSignatures(images, model, options);
      signatures.push(...sigResult.signatures);
      handwriting.push(...sigResult.handwriting);
    }

    // Pass 4: Document structure analysis
    if (passes.includes('structure')) {
      passesUsed.push('structure');
      documentStructure = await this.analyzeStructure(fullText, images[0], model);
    }

    // Calculate overall confidence
    const confidences = pages.map(p => p.confidence).filter(c => c > 0);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.85;

    return {
      text: fullText,
      confidence: avgConfidence,
      pages,
      tables,
      signatures,
      handwriting,
      documentStructure,
      processingTimeMs: Date.now() - startTime,
      passesUsed,
    };
  }

  /**
   * Prepare images from document buffer
   */
  private async prepareImages(
    buffer: Buffer,
    mimeType: string,
    maxPages?: number
  ): Promise<{ base64: string; mimeType: string; pageNumber: number }[]> {
    const images: { base64: string; mimeType: string; pageNumber: number }[] = [];

    if (mimeType === 'application/pdf') {
      // Convert PDF to images
      try {
        const pdfImages = await this.pdfToImages(buffer, maxPages);
        images.push(...pdfImages);
      } catch {
        // Fallback: try to use PDF directly with Vision API
        console.warn('PDF to image conversion failed, attempting direct PDF analysis');
        images.push({
          base64: buffer.toString('base64'),
          mimeType: 'application/pdf',
          pageNumber: 1,
        });
      }
    } else if (mimeType.startsWith('image/')) {
      images.push({
        base64: buffer.toString('base64'),
        mimeType,
        pageNumber: 1,
      });
    } else {
      throw new Error(`Unsupported document type: ${mimeType}`);
    }

    return images;
  }

  /**
   * Convert PDF to images
   */
  private async pdfToImages(
    pdfBuffer: Buffer,
    maxPages?: number
  ): Promise<{ base64: string; mimeType: string; pageNumber: number }[]> {
    const images: { base64: string; mimeType: string; pageNumber: number }[] = [];

    try {
      // Try pdf-poppler for high-quality conversion
      const pdfPoppler = await optionalImport<any>('pdf-poppler');
      
      if (pdfPoppler?.convert) {
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        
        // Write PDF to temp file
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-'));
        const tempPdf = path.join(tempDir, 'input.pdf');
        await fs.writeFile(tempPdf, pdfBuffer);

        // Convert
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        await pdfPoppler.convert(tempPdf, {
          format: 'png',
          out_dir: outputDir,
          out_prefix: 'page',
          scale: 2048, // High resolution
        });

        // Read converted images
        const files = await fs.readdir(outputDir);
        const pngFiles = files.filter(f => f.endsWith('.png')).sort();

        const pagesToProcess = maxPages ? pngFiles.slice(0, maxPages) : pngFiles;

        for (let i = 0; i < pagesToProcess.length; i++) {
          const imageBuffer = await fs.readFile(path.join(outputDir, pagesToProcess[i]));
          images.push({
            base64: imageBuffer.toString('base64'),
            mimeType: 'image/png',
            pageNumber: i + 1,
          });
        }

        // Cleanup
        await fs.rm(tempDir, { recursive: true });
      }
    } catch {
      // Fallback: use sharp for image processing
      try {
        const sharp = await optionalImport<any>('sharp');
        if (sharp?.default) {
          const sharpInstance = sharp.default(pdfBuffer, { density: 300 });
          const metadata = await sharpInstance.metadata();
          const pageCount = metadata.pages || 1;

          const pagesToProcess = maxPages ? Math.min(pageCount, maxPages) : pageCount;

          for (let i = 0; i < pagesToProcess; i++) {
            const imageBuffer = await sharp.default(pdfBuffer, { page: i, density: 300 })
              .png()
              .toBuffer();

            images.push({
              base64: imageBuffer.toString('base64'),
              mimeType: 'image/png',
              pageNumber: i + 1,
            });
          }
        }
      } catch {
        // Final fallback: send PDF as-is to Vision API
        console.warn('PDF conversion not available, sending raw PDF');
      }
    }

    // If no images were extracted, return the raw buffer for direct Vision API processing
    if (images.length === 0) {
      images.push({
        base64: pdfBuffer.toString('base64'),
        mimeType: 'image/png', // Assume it can be processed
        pageNumber: 1,
      });
    }

    return images;
  }

  /**
   * Pass 1: Extract text from images
   */
  private async extractText(
    images: { base64: string; mimeType: string; pageNumber: number }[],
    model: string,
    options: VisionAnalysisOptions
  ): Promise<{ text: string; pages: VisionPage[] }> {
    const pages: VisionPage[] = [];
    const textParts: string[] = [];

    // Process pages in batches of 4 for efficiency
    const batchSize = 4;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      
      const content: any[] = [
        {
          type: 'text',
          text: `Extract ALL text from these ${batch.length} document page(s). 
Preserve the exact formatting, structure, and layout.
Include:
- All headings and subheadings with their hierarchy
- All paragraphs with proper spacing
- All lists (numbered and bulleted)
- Table data (format as markdown tables)
- Headers and footers
- Page numbers
- Any handwritten annotations

For each page, provide:
1. The extracted text in markdown format
2. Page type (text/form/table/mixed/cover/signature)
3. Layout info (columns, orientation, margins)
4. Confidence score (0-100)

Format response as JSON:
{
  "pages": [
    {
      "pageNumber": 1,
      "text": "extracted text...",
      "pageType": "text",
      "layout": { "hasHeader": true, "hasFooter": true, "hasPageNumber": true, "columns": 1, "orientation": "portrait", "marginNotes": false },
      "confidence": 95
    }
  ]
}`,
        },
      ];

      // Add images
      for (const img of batch) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`,
            detail: options.highDetail ? 'high' : 'auto',
          },
        });
      }

      try {
        const response = await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'user',
              content,
            },
          ],
          max_tokens: 16000,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });

        const result = JSON.parse(response.choices[0]?.message?.content || '{"pages":[]}');
        
        for (const page of result.pages || []) {
          pages.push({
            pageNumber: page.pageNumber || (i + pages.length + 1),
            text: page.text || '',
            pageType: page.pageType || 'text',
            layout: page.layout || {
              hasHeader: false,
              hasFooter: false,
              hasPageNumber: false,
              columns: 1,
              orientation: 'portrait',
              marginNotes: false,
            },
            confidence: (page.confidence || 85) / 100,
          });
          textParts.push(page.text || '');
        }
      } catch (error) {
        console.error('Text extraction failed for batch:', error);
        // Add placeholder pages for failed batch
        for (const img of batch) {
          pages.push({
            pageNumber: img.pageNumber,
            text: '[Text extraction failed]',
            pageType: 'text',
            layout: {
              hasHeader: false,
              hasFooter: false,
              hasPageNumber: false,
              columns: 1,
              orientation: 'portrait',
              marginNotes: false,
            },
            confidence: 0,
          });
        }
      }
    }

    return {
      text: textParts.join('\n\n---\n\n'),
      pages,
    };
  }

  /**
   * Pass 2: Extract tables
   */
  private async extractTables(
    images: { base64: string; mimeType: string; pageNumber: number }[],
    model: string,
    _options: VisionAnalysisOptions
  ): Promise<VisionTable[]> {
    const tables: VisionTable[] = [];

    for (const img of images) {
      try {
        const response = await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this document page and extract ALL tables.
For each table found:
1. Extract headers (column names)
2. Extract all data rows
3. Identify the table type (pricing/schedule/terms/data/unknown)
4. Estimate position on page (top/left as percentages 0-100)

Return JSON:
{
  "tables": [
    {
      "headers": ["Column1", "Column2"],
      "rows": [["val1", "val2"], ["val3", "val4"]],
      "tableType": "pricing",
      "position": { "top": 30, "left": 10, "width": 80, "height": 40 },
      "confidence": 95
    }
  ]
}

If no tables found, return { "tables": [] }`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${img.mimeType};base64,${img.base64}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 8000,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });

        const result = JSON.parse(response.choices[0]?.message?.content || '{"tables":[]}');
        
        for (const table of result.tables || []) {
          tables.push({
            pageNumber: img.pageNumber,
            headers: table.headers || [],
            rows: table.rows || [],
            confidence: (table.confidence || 85) / 100,
            tableType: table.tableType || 'unknown',
            position: {
              top: table.position?.top || 0,
              left: table.position?.left || 0,
              width: table.position?.width || 100,
              height: table.position?.height || 50,
            },
          });
        }
      } catch (error) {
        console.error('Table extraction failed for page:', img.pageNumber, error);
      }
    }

    return tables;
  }

  /**
   * Pass 3: Detect signatures and handwriting
   */
  private async detectSignatures(
    images: { base64: string; mimeType: string; pageNumber: number }[],
    model: string,
    _options: VisionAnalysisOptions
  ): Promise<{ signatures: VisionSignature[]; handwriting: VisionHandwriting[] }> {
    const signatures: VisionSignature[] = [];
    const handwriting: VisionHandwriting[] = [];

    // Only check last few pages (signatures usually at end)
    const pagesToCheck = images.slice(-Math.min(5, images.length));

    for (const img of pagesToCheck) {
      try {
        const response = await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this document page for signatures and handwriting.

Detect:
1. Signature blocks (signed or unsigned)
2. Handwritten text/annotations
3. Initials
4. Date fields near signatures
5. Stamps or seals

For each signature found:
- signerName: Name printed near/under signature (if visible)
- signatureDate: Date near signature (if visible)
- signatureType: handwritten/digital/initials/stamp
- isSigned: true if signature present, false if blank signature line
- confidence: 0-100
- position: { top: %, left: % }

For handwritten text:
- text: What it says
- type: annotation/signature/note/correction
- confidence: 0-100

Return JSON:
{
  "signatures": [...],
  "handwriting": [...]
}`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${img.mimeType};base64,${img.base64}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });

        const result = JSON.parse(response.choices[0]?.message?.content || '{"signatures":[],"handwriting":[]}');
        
        for (const sig of result.signatures || []) {
          signatures.push({
            pageNumber: img.pageNumber,
            signerName: sig.signerName,
            signatureDate: sig.signatureDate,
            signatureType: sig.signatureType || 'handwritten',
            isSigned: sig.isSigned ?? true,
            confidence: (sig.confidence || 80) / 100,
            position: {
              top: sig.position?.top || 0,
              left: sig.position?.left || 0,
            },
          });
        }

        for (const hw of result.handwriting || []) {
          handwriting.push({
            pageNumber: img.pageNumber,
            text: hw.text || '',
            confidence: (hw.confidence || 70) / 100,
            type: hw.type || 'annotation',
          });
        }
      } catch (error) {
        console.error('Signature detection failed for page:', img.pageNumber, error);
      }
    }

    return { signatures, handwriting };
  }

  /**
   * Pass 4: Analyze document structure
   */
  private async analyzeStructure(
    fullText: string,
    _firstImage: { base64: string; mimeType: string },
    _model: string
  ): Promise<DocumentStructure> {
    try {
      // Use text for structure analysis (faster and cheaper than vision)
      const textSample = fullText.substring(0, 8000);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use mini for structure analysis (cost efficient)
        messages: [
          {
            role: 'system',
            content: 'You are a contract analysis expert. Analyze document structure.',
          },
          {
            role: 'user',
            content: `Analyze this document and extract its structure:

${textSample}

Return JSON:
{
  "documentType": "NDA/MSA/SOW/Employment/Lease/Purchase/License/Amendment/Other",
  "title": "Document title if found",
  "parties": ["Party 1 name", "Party 2 name"],
  "sections": [
    { "title": "Section name", "pageStart": 1, "pageEnd": 2, "level": 1 }
  ],
  "hasTableOfContents": true/false,
  "hasExhibits": true/false,
  "language": "en/de/fr/etc"
}`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        documentType: result.documentType || 'unknown',
        title: result.title,
        parties: result.parties || [],
        sections: result.sections || [],
        hasTableOfContents: result.hasTableOfContents || false,
        hasExhibits: result.hasExhibits || false,
        language: result.language || 'en',
      };
    } catch (error) {
      console.error('Structure analysis failed:', error);
      return {
        documentType: 'unknown',
        parties: [],
        sections: [],
        hasTableOfContents: false,
        hasExhibits: false,
        language: 'en',
      };
    }
  }

  /**
   * Quick text extraction (single pass, faster)
   */
  async quickExtract(
    documentBuffer: Buffer,
    mimeType: string
  ): Promise<{ text: string; confidence: number }> {
    const images = await this.prepareImages(documentBuffer, mimeType, 10);
    
    const allText: string[] = [];
    let totalConfidence = 0;
    let pageCount = 0;

    for (const img of images) {
      try {
        const response = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this document page. Return the text exactly as it appears, preserving formatting. Do not add any commentary.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${img.mimeType};base64,${img.base64}`,
                    detail: 'auto',
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
          temperature: 0,
        });

        const text = response.choices[0]?.message?.content || '';
        allText.push(text);
        totalConfidence += 0.9; // Assume high confidence for successful extraction
        pageCount++;
      } catch (error) {
        console.error('Quick extract failed for page:', img.pageNumber, error);
      }
    }

    return {
      text: allText.join('\n\n'),
      confidence: pageCount > 0 ? totalConfidence / pageCount : 0,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Full document analysis with all passes
 */
export async function analyzeDocumentWithVision(
  documentBuffer: Buffer,
  mimeType: string,
  options?: VisionAnalysisOptions
): Promise<VisionAnalysisResult> {
  const analyzer = new VisionDocumentAnalyzer({ model: options?.model || 'gpt-4o' });
  return analyzer.analyzeDocument(documentBuffer, mimeType, options);
}

/**
 * Quick text extraction
 */
export async function extractTextWithVision(
  documentBuffer: Buffer,
  mimeType: string
): Promise<{ text: string; confidence: number }> {
  const analyzer = new VisionDocumentAnalyzer({ model: 'gpt-4o' });
  return analyzer.quickExtract(documentBuffer, mimeType);
}

/**
 * Tables-focused extraction
 */
export async function extractTablesWithVision(
  documentBuffer: Buffer,
  mimeType: string
): Promise<VisionTable[]> {
  const analyzer = new VisionDocumentAnalyzer({ model: 'gpt-4o' });
  const result = await analyzer.analyzeDocument(documentBuffer, mimeType, {
    passes: ['tables'],
  });
  return result.tables;
}

/**
 * Signature detection
 */
export async function detectSignaturesWithVision(
  documentBuffer: Buffer,
  mimeType: string
): Promise<VisionSignature[]> {
  const analyzer = new VisionDocumentAnalyzer({ model: 'gpt-4o' });
  const result = await analyzer.analyzeDocument(documentBuffer, mimeType, {
    passes: ['signatures'],
  });
  return result.signatures;
}

// ============================================================================
// Export singleton for convenience
// ============================================================================

let defaultAnalyzer: VisionDocumentAnalyzer | null = null;

export function getVisionAnalyzer(): VisionDocumentAnalyzer {
  if (!defaultAnalyzer) {
    defaultAnalyzer = new VisionDocumentAnalyzer();
  }
  return defaultAnalyzer;
}

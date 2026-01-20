/**
 * Multi-Modal Document Analysis Service
 * 
 * Uses GPT-4o Vision to analyze scanned PDFs, images, and documents:
 * - OCR for scanned contracts
 * - Table extraction from images
 * - Signature detection
 * - Document layout understanding
 * - Handwritten text recognition
 * 
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export interface DocumentImage {
  url?: string;
  base64?: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

export interface AnalysisOptions {
  extractText?: boolean;
  extractTables?: boolean;
  detectSignatures?: boolean;
  analyzeLayout?: boolean;
  extractEntities?: boolean;
  customPrompt?: string;
}

export interface DocumentAnalysisResult {
  success: boolean;
  extractedText?: string;
  tables?: ExtractedTable[];
  signatures?: SignatureInfo[];
  layout?: DocumentLayout;
  entities?: ExtractedEntity[];
  rawAnalysis?: string;
  confidence: number;
  processingTimeMs: number;
  error?: string;
}

export interface ExtractedTable {
  tableIndex: number;
  headers: string[];
  rows: string[][];
  summary?: string;
}

export interface SignatureInfo {
  location: string;
  signedBy?: string;
  date?: string;
  type: 'handwritten' | 'digital' | 'stamp' | 'initials';
}

export interface DocumentLayout {
  pageType: 'contract' | 'invoice' | 'letter' | 'form' | 'report' | 'other';
  sections: Array<{
    title?: string;
    type: 'header' | 'body' | 'footer' | 'sidebar' | 'table' | 'signature_block';
    content?: string;
  }>;
  hasLetterhead: boolean;
  hasWatermark: boolean;
  pageOrientation: 'portrait' | 'landscape';
}

export interface ExtractedEntity {
  type: 'date' | 'money' | 'party' | 'address' | 'phone' | 'email' | 'reference_number';
  value: string;
  context?: string;
  confidence: number;
}

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyze a document image using GPT-4o Vision
 */
export async function analyzeDocumentImage(
  image: DocumentImage,
  options: AnalysisOptions = {}
): Promise<DocumentAnalysisResult> {
  const startTime = Date.now();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      confidence: 0,
      processingTimeMs: 0,
      error: 'OpenAI API key not configured',
    };
  }

  const openai = new OpenAI({ apiKey });

  const {
    extractText = true,
    extractTables = true,
    detectSignatures = true,
    analyzeLayout = true,
    extractEntities = true,
    customPrompt,
  } = options;

  try {
    // Build the analysis prompt
    const prompt = buildAnalysisPrompt({
      extractText,
      extractTables,
      detectSignatures,
      analyzeLayout,
      extractEntities,
      customPrompt,
    });

    // Prepare image content
    const imageContent = image.base64
      ? { type: 'image_url' as const, image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }
      : { type: 'image_url' as const, image_url: { url: image.url! } };

    // Call GPT-4o Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert document analyst specializing in contract and legal document analysis. Analyze images with precision and extract structured information. Always respond with valid JSON.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            imageContent,
          ],
        },
      ],
      max_tokens: 4000,
      temperature: 0.1, // Low temperature for factual extraction
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Parse the JSON response
    const analysis = parseAnalysisResponse(content, {
      extractText,
      extractTables,
      detectSignatures,
      analyzeLayout,
      extractEntities,
    });

    return {
      success: true,
      ...analysis,
      rawAnalysis: content,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[MultiModal] Analysis error:', error);
    return {
      success: false,
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Analyze multiple pages of a document
 */
export async function analyzeMultiPageDocument(
  images: DocumentImage[],
  options: AnalysisOptions = {}
): Promise<{
  pages: DocumentAnalysisResult[];
  combinedText?: string;
  totalTables?: ExtractedTable[];
  allSignatures?: SignatureInfo[];
  allEntities?: ExtractedEntity[];
}> {
  // Process pages in parallel (with concurrency limit)
  const CONCURRENCY = 3;
  const results: DocumentAnalysisResult[] = [];

  for (let i = 0; i < images.length; i += CONCURRENCY) {
    const batch = images.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(img => analyzeDocumentImage(img, options))
    );
    results.push(...batchResults);
  }

  // Combine results
  const successfulResults = results.filter(r => r.success);

  return {
    pages: results,
    combinedText: successfulResults
      .map((r, i) => `--- Page ${i + 1} ---\n${r.extractedText || ''}`)
      .join('\n\n'),
    totalTables: successfulResults.flatMap(r => r.tables || []),
    allSignatures: successfulResults.flatMap(r => r.signatures || []),
    allEntities: deduplicateEntities(successfulResults.flatMap(r => r.entities || [])),
  };
}

// =============================================================================
// SPECIALIZED ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Extract text from a scanned document (OCR)
 */
export async function ocrDocument(image: DocumentImage): Promise<{
  text: string;
  confidence: number;
  language?: string;
}> {
  const result = await analyzeDocumentImage(image, {
    extractText: true,
    extractTables: false,
    detectSignatures: false,
    analyzeLayout: false,
    extractEntities: false,
    customPrompt: `Extract ALL text from this scanned document verbatim. Preserve paragraph structure and formatting. Include headers, footers, and any visible text. Also identify the primary language.`,
  });

  return {
    text: result.extractedText || '',
    confidence: result.confidence,
    language: undefined, // Could be extracted from response
  };
}

/**
 * Extract tables from a document image
 */
export async function extractDocumentTables(image: DocumentImage): Promise<ExtractedTable[]> {
  const result = await analyzeDocumentImage(image, {
    extractText: false,
    extractTables: true,
    detectSignatures: false,
    analyzeLayout: false,
    extractEntities: false,
    customPrompt: `Focus ONLY on extracting tables from this document. For each table, identify headers and all data rows. Convert to structured format.`,
  });

  return result.tables || [];
}

/**
 * Detect and analyze signatures in a document
 */
export async function detectDocumentSignatures(image: DocumentImage): Promise<SignatureInfo[]> {
  const result = await analyzeDocumentImage(image, {
    extractText: false,
    extractTables: false,
    detectSignatures: true,
    analyzeLayout: false,
    extractEntities: false,
    customPrompt: `Focus ONLY on identifying signatures in this document. For each signature found, determine:
1. Location in the document (e.g., "bottom right", "after section 3")
2. Type (handwritten, digital signature, stamp, or initials)
3. If a name is printed nearby, include it
4. If a date is near the signature, include it`,
  });

  return result.signatures || [];
}

/**
 * Compare two document versions visually
 */
export async function compareDocumentVersions(
  image1: DocumentImage,
  image2: DocumentImage
): Promise<{
  differences: Array<{
    section: string;
    description: string;
    significance: 'minor' | 'moderate' | 'major';
  }>;
  overallSimilarity: number;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { differences: [], overallSimilarity: 0 };
  }

  const openai = new OpenAI({ apiKey });

  try {
    const images = [image1, image2].map(img => 
      img.base64
        ? { type: 'image_url' as const, image_url: { url: `data:${img.mimeType};base64,${img.base64}` } }
        : { type: 'image_url' as const, image_url: { url: img.url! } }
    );

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Compare these two document versions and identify differences. Return JSON with:
{
  "differences": [
    { "section": "...", "description": "...", "significance": "minor|moderate|major" }
  ],
  "overallSimilarity": 0.0-1.0
}

First image is version 1, second is version 2.`,
            },
            images[0],
            images[1],
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const cleaned = content.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('[MultiModal] Comparison error:', error);
    return { differences: [], overallSimilarity: 0 };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildAnalysisPrompt(options: {
  extractText: boolean;
  extractTables: boolean;
  detectSignatures: boolean;
  analyzeLayout: boolean;
  extractEntities: boolean;
  customPrompt?: string;
}): string {
  if (options.customPrompt) {
    return options.customPrompt + '\n\nReturn your analysis as JSON.';
  }

  const sections: string[] = [];

  if (options.extractText) {
    sections.push(`"extractedText": "<all text from document>"`);
  }

  if (options.extractTables) {
    sections.push(`"tables": [{ "tableIndex": 0, "headers": ["..."], "rows": [["...", "..."]], "summary": "..." }]`);
  }

  if (options.detectSignatures) {
    sections.push(`"signatures": [{ "location": "...", "signedBy": "...", "date": "...", "type": "handwritten|digital|stamp|initials" }]`);
  }

  if (options.analyzeLayout) {
    sections.push(`"layout": {
      "pageType": "contract|invoice|letter|form|report|other",
      "sections": [{ "title": "...", "type": "header|body|footer|sidebar|table|signature_block", "content": "..." }],
      "hasLetterhead": true/false,
      "hasWatermark": true/false,
      "pageOrientation": "portrait|landscape"
    }`);
  }

  if (options.extractEntities) {
    sections.push(`"entities": [{ "type": "date|money|party|address|phone|email|reference_number", "value": "...", "context": "...", "confidence": 0.0-1.0 }]`);
  }

  sections.push(`"confidence": 0.0-1.0`);

  return `Analyze this document image and extract the following information. Return ONLY valid JSON with this structure:
{
  ${sections.join(',\n  ')}
}

Be thorough and precise. For confidence, estimate how certain you are about the accuracy of your extraction.`;
}

function parseAnalysisResponse(
  content: string,
  expectedFields: {
    extractText: boolean;
    extractTables: boolean;
    detectSignatures: boolean;
    analyzeLayout: boolean;
    extractEntities: boolean;
  }
): Partial<DocumentAnalysisResult> {
  try {
    // Clean the response (remove markdown code blocks if present)
    const cleaned = content.replace(/```json\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      extractedText: expectedFields.extractText ? parsed.extractedText : undefined,
      tables: expectedFields.extractTables ? parsed.tables : undefined,
      signatures: expectedFields.detectSignatures ? parsed.signatures : undefined,
      layout: expectedFields.analyzeLayout ? parsed.layout : undefined,
      entities: expectedFields.extractEntities ? parsed.entities : undefined,
      confidence: parsed.confidence || 0.7,
    };
  } catch (error) {
    console.error('[MultiModal] Failed to parse response:', error);
    
    // Fall back to extracting text from unparsed content
    return {
      extractedText: content,
      confidence: 0.3,
    };
  }
}

function deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();
  
  for (const entity of entities) {
    const key = `${entity.type}:${entity.value}`;
    const existing = seen.get(key);
    
    if (!existing || entity.confidence > existing.confidence) {
      seen.set(key, entity);
    }
  }
  
  return Array.from(seen.values());
}

// =============================================================================
// STORAGE FUNCTIONS
// =============================================================================

/**
 * Store analysis results for a contract
 */
export async function storeDocumentAnalysis(
  contractId: string,
  tenantId: string,
  pageNumber: number,
  result: DocumentAnalysisResult
): Promise<void> {
  try {
    await prisma.contractAnalysis.create({
      data: {
        contractId,
        tenantId,
        pageNumber,
        extractedText: result.extractedText || '',
        tables: result.tables ? JSON.stringify(result.tables) : null,
        signatures: result.signatures ? JSON.stringify(result.signatures) : null,
        layout: result.layout ? JSON.stringify(result.layout) : null,
        entities: result.entities ? JSON.stringify(result.entities) : null,
        confidence: result.confidence,
        analysisType: 'multimodal_vision',
        processingTimeMs: result.processingTimeMs,
      },
    });
  } catch (error) {
    console.error('[MultiModal] Failed to store analysis:', error);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  buildAnalysisPrompt,
  parseAnalysisResponse,
  deduplicateEntities,
};

/**
 * Hybrid OCR Strategy
 * 
 * Intelligent document extraction that optimizes for cost vs accuracy.
 * Automatically selects the best extraction method based on document complexity.
 * 
 * Modes:
 * - fast: Basic text extraction (pdf-parse) - $0.001/doc
 * - balanced: Vision AI for complex docs, basic for simple - $0.023/doc avg
 * - high: Vision AI + Textract for maximum accuracy - $0.048/doc
 * 
 * Expected accuracy:
 * - fast: 60-70%
 * - balanced: 85-90%
 * - high: 95-99%
 * 
 * @see UPLOAD_OCR_AUDIT_REPORT.md for implementation details
 */

import { 
  analyzeDocumentWithVision, 
  assessDocumentComplexity,
  DocumentAnalysis 
} from './vision-document-analyzer';
import { 
  analyzeDocumentWithTextract,
  extractTablesWithTextract,
  TextractResult 
} from './textract-client';
import {
  analyzeDocumentWithMistral,
  MistralOcrResult
} from './mistral-client';
import { 
  preprocessDocument,
  shouldPreprocess,
  PreprocessingResult 
} from './document-preprocessor';
import fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export type OcrQuality = 'fast' | 'balanced' | 'high' | 'mistral';

export interface HybridOcrOptions {
  quality?: OcrQuality;
  usePreprocessing?: boolean;
  forceVision?: boolean;
  forceTextract?: boolean;
  forceMistral?: boolean;
  awsRegion?: string;
  visionModel?: 'gpt-4o' | 'gpt-4-vision-preview' | 'gpt-4-turbo';
  mistralModel?: string;
}

export interface HybridOcrResult {
  // Unified document analysis
  analysis: DocumentAnalysis;
  
  // Additional data from Textract (if used)
  textractData?: TextractResult;
  
  // Additional data from Mistral (if used)
  mistralData?: MistralOcrResult;
  
  // Metadata about the extraction
  metadata: {
    methodUsed: 'pdf-parse' | 'vision' | 'textract' | 'hybrid' | 'mistral';
    quality: OcrQuality;
    complexity: number; // 0.0-1.0
    preprocessed: boolean;
    preprocessing?: PreprocessingResult;
    costs: {
      vision?: number;
      textract?: number;
      mistral?: number;
      total: number;
    };
    timing: {
      preprocessing?: number;
      extraction: number;
      total: number;
    };
    confidence: number;
  };
}

/**
 * Main entry point for hybrid OCR
 */
export async function extractDocumentData(
  filePath: string,
  options: HybridOcrOptions = {}
): Promise<HybridOcrResult> {
  const startTime = Date.now();
  
  const {
    quality = 'balanced',
    usePreprocessing = true,
    forceVision = false,
    forceTextract = false,
    forceMistral = false,
    awsRegion = 'us-east-1',
    visionModel = 'gpt-4o',
    mistralModel = 'mistral-ocr-latest',
  } = options;

  let preprocessingResult: PreprocessingResult | undefined;
  let preprocessingTime = 0;
  let processedFilePath = filePath;

  // Step 1: Preprocessing (if needed and enabled)
  if (usePreprocessing) {
    const preprocessStart = Date.now();
    const shouldPreproc = await shouldPreprocess(filePath);
    
    if (shouldPreproc.needed) {
      console.log(`Preprocessing document: ${shouldPreproc.reasons.join(', ')}`);
      preprocessingResult = await preprocessDocument(filePath, shouldPreproc.recommendedOptions);
      processedFilePath = preprocessingResult.filePath;
      preprocessingTime = Date.now() - preprocessStart;
    }
  }

  // Step 2: Assess complexity
  const extractionStart = Date.now();
  const complexity = await assessDocumentComplexity(processedFilePath);

  // Step 3: Select extraction strategy based on quality mode
  let result: HybridOcrResult;

  if (forceMistral || quality === 'mistral') {
    result = await extractMistral(processedFilePath, complexity, { mistralModel });
  } else {
    switch (quality) {
      case 'fast':
        result = await extractFast(processedFilePath, complexity);
        break;
        
      case 'balanced':
        result = await extractBalanced(processedFilePath, complexity, {
          forceVision,
          visionModel,
        });
        break;
        
      case 'high':
        result = await extractHigh(processedFilePath, complexity, {
          forceVision,
          forceTextract,
          awsRegion,
          visionModel,
        });
        break;
      default:
        // Fallback to balanced if quality is unknown (though TS should prevent this)
        result = await extractBalanced(processedFilePath, complexity, {
          forceVision,
          visionModel,
        });
    }
  }

  // Step 4: Add timing and preprocessing metadata
  const extractionTime = Date.now() - extractionStart;
  const totalTime = Date.now() - startTime;

  result.metadata.quality = quality;
  result.metadata.preprocessed = !!preprocessingResult;
  result.metadata.preprocessing = preprocessingResult;
  result.metadata.timing = {
    preprocessing: preprocessingTime,
    extraction: extractionTime,
    total: totalTime,
  };

  return result;
}

/**
 * Mistral extraction: High quality OCR with Mistral
 */
async function extractMistral(
  filePath: string,
  complexity: Awaited<ReturnType<typeof assessDocumentComplexity>>,
  options: { mistralModel?: string }
): Promise<HybridOcrResult> {
  const { mistralModel = 'mistral-ocr-latest' } = options;
  console.log(`Using MISTRAL extraction (${mistralModel})`);

  try {
    const mistralResult = await analyzeDocumentWithMistral(filePath, { model: mistralModel });
    
    // Convert Mistral markdown to DocumentAnalysis
    // This is a simplified conversion. In a real app, we might want to parse the markdown
    // or pass it to an LLM for structuring.
    
    const analysis: DocumentAnalysis = {
      overview: {
        documentType: 'Contract (Mistral OCR)',
        title: 'Extracted Document',
        parties: [],
        dates: {},
        summary: mistralResult.markdown.substring(0, 2000), // Truncate for summary
      },
      financial: {
        ratecards: [],
      },
      clauses: [], // We could parse headers as clauses
      tables: [], // We could parse markdown tables
      metadata: {
        pageCount: mistralResult.pages.length,
        language: 'en',
        confidence: 0.95, // Mistral OCR is usually high quality
        processingTime: 0,
        model: mistralModel,
      },
    };

    return {
      analysis,
      mistralData: mistralResult,
      metadata: {
        methodUsed: 'mistral',
        quality: 'mistral',
        complexity: complexity.complexity,
        preprocessed: false,
        costs: {
          mistral: mistralResult.usage.pagesProcessed * 0.01, // Estimate cost
          total: mistralResult.usage.pagesProcessed * 0.01,
        },
        timing: {
          extraction: 0,
          total: 0,
        },
        confidence: 0.95,
      },
    };
  } catch (error) {
    console.error('Mistral extraction failed:', error);
    // Fallback to fast extraction
    return extractFast(filePath, complexity);
  }
}

/**
 * Fast extraction: Basic text extraction with pdf-parse
 */
async function extractFast(
  filePath: string,
  complexity: Awaited<ReturnType<typeof assessDocumentComplexity>>
): Promise<HybridOcrResult> {
  console.log('Using FAST extraction (pdf-parse)');
  
  const pdfParse = require('pdf-parse');
  const dataBuffer = await readFile(filePath);
  const pdfData = await pdfParse(dataBuffer);
  const text = pdfData.text || '';

  // Basic parsing for contract information
  const analysis: DocumentAnalysis = {
    overview: {
      documentType: 'Contract',
      title: 'Extracted Document',
      parties: [],
      dates: {},
      summary: text.substring(0, 500),
    },
    financial: {
      ratecards: [],
    },
    clauses: [],
    tables: [],
    metadata: {
      pageCount: pdfData.numpages || 1,
      language: 'en',
      confidence: 0.6, // Low confidence for basic extraction
      processingTime: 0,
      model: 'pdf-parse',
    },
  };

  return {
    analysis,
    metadata: {
      methodUsed: 'pdf-parse',
      quality: 'fast',
      complexity: complexity.complexity,
      preprocessed: false,
      costs: {
        total: 0.001, // Minimal compute cost
      },
      timing: {
        extraction: 0,
        total: 0,
      },
      confidence: 0.6,
    },
  };
}

type VisionModel = 'gpt-4o' | 'gpt-4-vision-preview' | 'gpt-4-turbo';

/**
 * Balanced extraction: Vision AI for complex docs, basic for simple
 */
async function extractBalanced(
  filePath: string,
  complexity: Awaited<ReturnType<typeof assessDocumentComplexity>>,
  options: { forceVision?: boolean; visionModel?: VisionModel }
): Promise<HybridOcrResult> {
  const { forceVision = false, visionModel = 'gpt-4o' } = options;

  // Use vision AI if complex or forced
  if (forceVision || complexity.needsVision || complexity.complexity > 0.4) {
    console.log(`Using VISION extraction (${visionModel}): ${complexity.reason}`);
    
    const analysis = await analyzeDocumentWithVision(filePath, {
      model: visionModel,
      detail: 'high',
    });

    return {
      analysis,
      metadata: {
        methodUsed: 'vision',
        quality: 'balanced',
        complexity: complexity.complexity,
        preprocessed: false,
        costs: {
          vision: 0.03, // ~$0.03 per document with GPT-4 Vision
          total: 0.03,
        },
        timing: {
          extraction: 0,
          total: 0,
        },
        confidence: analysis.metadata.confidence,
      },
    };
  }

  // Use fast extraction for simple documents
  console.log('Using FAST extraction (simple document)');
  return extractFast(filePath, complexity);
}

/**
 * High-quality extraction: Vision AI + Textract
 */
async function extractHigh(
  filePath: string,
  complexity: Awaited<ReturnType<typeof assessDocumentComplexity>>,
  options: {
    forceVision?: boolean;
    forceTextract?: boolean;
    awsRegion?: string;
    visionModel?: VisionModel;
  }
): Promise<HybridOcrResult> {
  const {
    forceVision = false,
    forceTextract = false,
    awsRegion = 'us-east-1',
    visionModel = 'gpt-4o',
  } = options;

  console.log(`Using HIGH-QUALITY extraction (Vision + Textract)`);

  // Check if AWS credentials are available
  const hasAwsCredentials = 
    process.env.AWS_ACCESS_KEY_ID && 
    process.env.AWS_SECRET_ACCESS_KEY;

  let visionAnalysis: DocumentAnalysis | undefined;
  let textractResult: TextractResult | undefined;
  let visionCost = 0;
  let textractCost = 0;

  // Run Vision AI and Textract in parallel
  const [visionPromise, textractPromise] = [
    // Vision AI analysis
    analyzeDocumentWithVision(filePath, {
      model: visionModel,
      detail: 'high',
      extractTables: true,
      extractClauses: true,
    }).then(result => {
      visionAnalysis = result;
      visionCost = 0.03;
      return result;
    }).catch(error => {
      console.error('Vision AI failed:', error);
      return undefined;
    }),
    
    // Textract analysis (if credentials available)
    hasAwsCredentials && (forceTextract || complexity.complexity > 0.5)
      ? analyzeDocumentWithTextract(filePath, {
          region: awsRegion,
          extractTables: true,
          extractForms: true,
          extractSignatures: true,
        }).then(result => {
          textractResult = result;
          // Calculate Textract cost: ~$0.015 per page for tables
          textractCost = result.pageCount * 0.015;
          return result;
        }).catch(error => {
          console.error('Textract failed:', error);
          return undefined;
        })
      : Promise.resolve(undefined),
  ];

  await Promise.all([visionPromise, textractPromise]);

  // Merge results if both succeeded
  if (visionAnalysis && textractResult) {
    console.log('Merging Vision and Textract results');
    const mergedAnalysis = mergeVisionAndTextract(visionAnalysis, textractResult);
    
    return {
      analysis: mergedAnalysis,
      textractData: textractResult,
      metadata: {
        methodUsed: 'hybrid',
        quality: 'high',
        complexity: complexity.complexity,
        preprocessed: false,
        costs: {
          vision: visionCost,
          textract: textractCost,
          total: visionCost + textractCost,
        },
        timing: {
          extraction: 0,
          total: 0,
        },
        confidence: (visionAnalysis.metadata.confidence + textractResult.confidence) / 2,
      },
    };
  }

  // Fallback to vision-only if Textract failed
  if (visionAnalysis) {
    return {
      analysis: visionAnalysis,
      textractData: textractResult,
      metadata: {
        methodUsed: 'vision',
        quality: 'high',
        complexity: complexity.complexity,
        preprocessed: false,
        costs: {
          vision: visionCost,
          total: visionCost,
        },
        timing: {
          extraction: 0,
          total: 0,
        },
        confidence: visionAnalysis.metadata.confidence,
      },
    };
  }

  // Last resort: fast extraction
  console.warn('Both Vision and Textract failed, falling back to fast extraction');
  return extractFast(filePath, complexity);
}

/**
 * Merge Vision AI and Textract results for maximum accuracy
 */
function mergeVisionAndTextract(
  vision: DocumentAnalysis,
  textract: TextractResult
): DocumentAnalysis {
  // Use Vision for high-level understanding
  const merged: DocumentAnalysis = {
    ...vision,
    
    // Use Textract tables (higher accuracy)
    tables: textract.tables.map(t => ({
      title: undefined,
      headers: t.headers,
      rows: t.rows,
      location: `Page ${t.pageNumber}`,
      confidence: t.confidence,
    })),
    
    // Add Textract form fields to clauses
    clauses: [
      ...vision.clauses,
      ...textract.forms.map(f => ({
        type: 'form-field',
        title: f.key,
        content: f.value,
        importance: 'medium' as const,
      })),
    ],
    
    // Update metadata
    metadata: {
      ...vision.metadata,
      confidence: Math.max(vision.metadata.confidence, textract.confidence),
      model: 'vision + textract (hybrid)',
    },
  };

  return merged;
}

/**
 * Batch process multiple documents with hybrid OCR
 */
export async function batchExtractDocuments(
  filePaths: string[],
  options: HybridOcrOptions = {}
): Promise<Map<string, HybridOcrResult>> {
  const results = new Map<string, HybridOcrResult>();

  // Process in parallel with concurrency limit
  const concurrency = 3;
  const chunks: string[][] = [];
  for (let i = 0; i < filePaths.length; i += concurrency) {
    chunks.push(filePaths.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const extracted = await Promise.allSettled(
      chunk.map(filePath => extractDocumentData(filePath, options))
    );

    chunk.forEach((filePath, index) => {
      const result = extracted[index];
      if (result.status === 'fulfilled') {
        results.set(filePath, result.value);
      } else {
        console.error(`Failed to extract ${filePath}:`, result.reason);
      }
    });
  }

  return results;
}

/**
 * Cost estimator for batch processing
 */
export function estimateBatchCost(
  documentCount: number,
  quality: OcrQuality,
  avgComplexity: number = 0.5
): {
  perDocument: number;
  total: number;
  breakdown: {
    fast: number;
    vision: number;
    textract: number;
    mistral: number;
  };
} {
  const costs = {
    fast: 0.001,
    vision: 0.03,
    textract: 0.015,
    mistral: 0.01, // Estimated cost
  };

  let perDocument: number;
  let breakdown = { fast: 0, vision: 0, textract: 0, mistral: 0 };

  switch (quality) {
    case 'fast':
      perDocument = costs.fast;
      breakdown.fast = documentCount;
      break;
      
    case 'balanced':
      // Assume 40% need vision based on complexity
      const visionRatio = Math.max(0.4, avgComplexity);
      const fastRatio = 1 - visionRatio;
      perDocument = (costs.fast * fastRatio) + (costs.vision * visionRatio);
      breakdown.fast = Math.floor(documentCount * fastRatio);
      breakdown.vision = Math.ceil(documentCount * visionRatio);
      break;
      
    case 'high':
      perDocument = costs.vision + costs.textract;
      breakdown.vision = documentCount;
      breakdown.textract = documentCount;
      break;

    case 'mistral':
      perDocument = costs.mistral;
      breakdown.mistral = documentCount;
      break;
  }

  return {
    perDocument,
    total: perDocument * documentCount,
    breakdown,
  };
}

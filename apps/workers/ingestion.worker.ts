/**
 * Enhanced Ingestion Worker with LLM and RAG Integration
 * Provides intelligent document processing with content analysis and best practices
 */

// Import shared utilities
import { 
  getSharedLLMClient, 
  EXPERT_PERSONAS, 
  createProvenance,
  isLLMAvailable 
} from './shared/llm-utils';
import { 
  getSharedDatabaseClient, 
  createDatabaseProvenance 
} from './shared/database-utils';
import { 
  ContentProcessor, 
  RAGIntegration 
} from './shared/rag-utils';
import { 
  BestPracticesGenerator, 
  BestPracticesCategory 
} from './shared/best-practices-utils';

// Import schemas
import pkg from 'schemas';
const { IngestionArtifactV1Schema } = pkg;

// Import storage utilities with fallback
let getFileStream: any;
let getObjectBuffer: any;
try {
  const s = require('clients-storage');
  getFileStream = s.getFileStream;
  getObjectBuffer = s.getObjectBuffer;
} catch {
  const s = require('../../packages/clients/storage');
  getFileStream = s.getFileStream;
  getObjectBuffer = s.getObjectBuffer;
}

// Import PDF processing
const pdf = require('pdf-parse');

// Initialize shared clients
const llmClient = getSharedLLMClient();
const dbClient = getSharedDatabaseClient();

export type IngestionJob = { docId: string; tenantId?: string };

export async function runIngestion(job: { data: IngestionJob }): Promise<{ docId: string }> {
  const { docId, tenantId } = job.data;
  console.log(`📄 [worker:ingestion] Starting enhanced ingestion for ${docId}`);
  const startTime = Date.now();

  try {
    // Get contract information
    const contractResult = await dbClient.findContract(docId, false);
    if (!contractResult.success || !contractResult.data) {
      throw new Error(`Contract ${docId} not found`);
    }
    
    const contract = contractResult.data;
    const contractTenantId = tenantId || contract.tenantId;

    // Extract document content from storage
    console.log(`📥 Extracting content from storage: ${contract.storagePath}`);
    const buf: Buffer = typeof getObjectBuffer === 'function'
      ? await getObjectBuffer(contract.storagePath)
      : await (async () => {
          const s = await getFileStream(contract.storagePath);
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve, reject) => {
            s.on('data', (c: Buffer) => chunks.push(c));
            s.on('error', reject);
            s.on('end', () => resolve());
          });
          return Buffer.concat(chunks);
        })();

    // Enhanced content extraction with intelligent processing
    const extractionResult = await extractDocumentContent(buf, contract.storagePath, docId);
    const { content, fileType, totalPages, ocrRate, extractionMetadata } = extractionResult;
    
    console.log(`📊 Content extracted: ${content.length} characters, ${totalPages} pages, OCR rate: ${Math.round(ocrRate * 100)}%`);

    // LLM-powered content analysis and enhancement
    let contentAnalysis: any = null;
    let documentInsights: any = null;
    let bestPractices: any = null;
    let confidence = 85; // Base confidence

    if (isLLMAvailable() && content.trim().length > 100) {
      console.log(`🧠 Analyzing content with LLM expert system...`);
      
      try {
        // Analyze document structure and content quality
        contentAnalysis = await analyzeDocumentContent(content, fileType, totalPages);
        confidence = contentAnalysis.confidence || 85;
        
        // Generate document insights and recommendations
        documentInsights = await generateDocumentInsights(content, contentAnalysis);
        
        // Generate ingestion best practices
        bestPractices = await generateIngestionBestPractices(contentAnalysis, extractionMetadata);
        
        console.log(`✅ LLM analysis complete: ${confidence}% confidence, ${documentInsights?.insights?.length || 0} insights`);
        
      } catch (error) {
        console.warn(`⚠️ LLM analysis failed, using fallback: ${error}`);
        contentAnalysis = createFallbackAnalysis(content, fileType, totalPages);
        confidence = 70;
      }
    } else {
      console.log(`📝 Using heuristic analysis (LLM not available)`);
      contentAnalysis = createFallbackAnalysis(content, fileType, totalPages);
      confidence = 70;
    }

    // Create enhanced ingestion artifact
    const artifact = IngestionArtifactV1Schema.parse({
      metadata: {
        docId: docId,
        fileType,
        totalPages,
        ocrRate,
        provenance: [createProvenance('ingestion', contentAnalysis, {
          extractionMethod: extractionMetadata.method,
          documentQuality: contentAnalysis?.quality || 'good',
          processingTime: Date.now() - startTime
        })],
      },
      content,
      // Enhanced fields
      contentAnalysis,
      documentInsights,
      bestPractices,
      extractionMetadata
    });

    // Store enhanced artifact
    const artifactResult = await dbClient.createArtifact({
      contractId: docId,
      type: 'INGESTION',
      data: artifact,
      tenantId: contractTenantId,
      metadata: {
        confidence,
        processingTime: Date.now() - startTime,
        llmEnhanced: isLLMAvailable(),
        contentQuality: contentAnalysis?.quality || 'good'
      }
    });

    if (!artifactResult.success) {
      throw new Error(`Failed to store artifact: ${artifactResult.error}`);
    }

    // Update contract status
    await dbClient.updateContractMetadata(docId, {
      status: 'INGESTED',
      ingestionComplete: true,
      contentLength: content.length,
      documentQuality: contentAnalysis?.quality || 'good',
      lastProcessed: new Date().toISOString()
    });

    // Enhanced RAG processing with automatic indexation
    try {
      console.log(`🔍 Processing content for RAG indexation...`);
      
      // Trigger automatic search indexation
      await RAGIntegration.triggerAutoIndexation(docId, contractTenantId, 'ingestion_complete');
      
      // Process content for vector embeddings if enabled
      const ragEnabled = (process.env['RAG_ENABLED'] || '').toLowerCase() === 'true';
      if (ragEnabled && content && content.length > 100) {
        console.log(`🔗 Creating vector embeddings for semantic search...`);
        
        // Use shared RAG utilities for content processing
        const searchableContent = ContentProcessor.extractSearchableContent(
          docId,
          contractTenantId,
          [{ type: 'INGESTION', data: artifact }]
        );
        
        // Process for vector embeddings (placeholder for future implementation)
        console.log(`📊 Prepared ${ContentProcessor.countSearchableFields(searchableContent)} searchable fields`);
      }
      
    } catch (error) {
      console.warn(`⚠️ RAG processing failed: ${error}`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Enhanced ingestion complete for ${docId} in ${processingTime}ms`);
    console.log(`📊 Results: ${content.length} chars, ${confidence}% confidence, ${contentAnalysis?.insights?.length || 0} insights`);
    
    return { docId };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Enhanced ingestion failed for ${docId}:`, error);
    
    // Update contract status to failed
    try {
      await dbClient.updateContractMetadata(docId, {
        status: 'FAILED',
        statusReason: 'Enhanced ingestion failed',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date().toISOString()
      });
    } catch (updateError) {
      console.warn('Failed to update contract status:', updateError);
    }
    
    throw error;
  }
}

/**
 * Enhanced document content extraction with intelligent processing
 */
async function extractDocumentContent(
  buffer: Buffer, 
  storagePath: string, 
  docId: string
): Promise<{
  content: string;
  fileType: 'pdf' | 'txt' | 'docx';
  totalPages: number;
  ocrRate: number;
  extractionMetadata: any;
}> {
  const path = String(storagePath || '').toLowerCase();
  const looksPdf = /\.pdf$/.test(path);
  const looksDocx = /\.docx?$/.test(path);
  
  let fileType: 'pdf' | 'txt' | 'docx' = looksPdf ? 'pdf' : looksDocx ? 'docx' : 'txt';
  let totalPages = 1;
  let content = '';
  let ocrRate = 0;
  let extractionMethod = 'text';

  if (looksPdf) {
    try {
      console.log(`📄 Processing PDF: ${buffer.length} bytes`);
      const pdfData = await pdf(buffer);
      totalPages = Number(pdfData?.numpages) || 1;
      content = String(pdfData?.text || '');
      extractionMethod = 'pdf-parse';
      
      // Estimate OCR rate based on content characteristics
      ocrRate = estimateOCRRate(content, totalPages);
      
      console.log(`✅ PDF processed: ${totalPages} pages, ${content.length} chars, ${Math.round(ocrRate * 100)}% OCR`);
      
    } catch (error) {
      console.warn(`⚠️ PDF parsing failed, trying text fallback: ${error}`);
      try {
        content = buffer.toString('utf8');
        fileType = 'txt';
        totalPages = 1;
        extractionMethod = 'utf8-fallback';
        ocrRate = 0.5; // Uncertain quality
      } catch {
        content = '';
        extractionMethod = 'failed';
      }
    }
  } else {
    try {
      content = buffer.toString('utf8');
      extractionMethod = 'utf8';
      ocrRate = 1.0; // Text files have perfect "OCR"
    } catch {
      content = '';
      extractionMethod = 'failed';
    }
  }

  return {
    content,
    fileType,
    totalPages,
    ocrRate,
    extractionMetadata: {
      method: extractionMethod,
      bufferSize: buffer.length,
      processingTime: Date.now(),
      quality: content.length > 100 ? 'good' : content.length > 10 ? 'fair' : 'poor'
    }
  };
}

/**
 * Estimate OCR rate based on content characteristics
 */
function estimateOCRRate(content: string, pages: number): number {
  if (!content || content.length === 0) return 0;
  
  const avgCharsPerPage = content.length / pages;
  const hasStructure = /\n\s*\n/.test(content); // Paragraphs
  const hasFormatting = /[A-Z][A-Z\s]{10,}/.test(content); // Headers
  const specialChars = (content.match(/[^\w\s\n\r\t.,;:!?()-]/g) || []).length;
  const specialCharRatio = specialChars / content.length;
  
  let ocrRate = 0.8; // Base rate
  
  // Adjust based on characteristics
  if (avgCharsPerPage > 2000) ocrRate += 0.1; // Good extraction
  if (hasStructure) ocrRate += 0.05;
  if (hasFormatting) ocrRate += 0.05;
  if (specialCharRatio < 0.02) ocrRate += 0.1; // Clean text
  if (specialCharRatio > 0.1) ocrRate -= 0.2; // Lots of OCR errors
  
  return Math.max(0, Math.min(1, ocrRate));
}

/**
 * LLM-powered document content analysis
 */
async function analyzeDocumentContent(
  content: string, 
  fileType: string, 
  totalPages: number
): Promise<any> {
  try {
    const analysisPrompt = `
Analyze this document content for quality, structure, and characteristics:

DOCUMENT INFO:
- File Type: ${fileType}
- Pages: ${totalPages}
- Content Length: ${content.length} characters

CONTENT SAMPLE:
${content.substring(0, 2000)}

Provide analysis in JSON format:
{
  "quality": "excellent|good|fair|poor",
  "confidence": 0-100,
  "documentType": "contract|agreement|policy|other",
  "structure": "well-structured|moderately-structured|poorly-structured",
  "readability": "high|medium|low",
  "completeness": "complete|partial|fragment",
  "insights": ["insight1", "insight2", ...],
  "recommendations": ["rec1", "rec2", ...]
}
`;

    const response = await llmClient.generateExpertAnalysis(
      'CONTRACT_SPECIALIST',
      'document content analysis',
      analysisPrompt,
      { responseFormat: 'json' }
    );

    return response.data;
    
  } catch (error) {
    console.warn('LLM content analysis failed:', error);
    return createFallbackAnalysis(content, fileType, totalPages);
  }
}

/**
 * Generate document insights and recommendations
 */
async function generateDocumentInsights(content: string, contentAnalysis: any): Promise<any> {
  try {
    const insightsPrompt = `
Based on the document analysis, provide strategic insights and recommendations:

DOCUMENT ANALYSIS:
${JSON.stringify(contentAnalysis, null, 2)}

CONTENT PREVIEW:
${content.substring(0, 1500)}

Generate insights in JSON format:
{
  "insights": [
    {
      "category": "content_quality|structure|completeness|readability",
      "insight": "description",
      "impact": "high|medium|low",
      "recommendation": "specific action"
    }
  ],
  "processingRecommendations": ["rec1", "rec2", ...],
  "nextSteps": ["step1", "step2", ...]
}
`;

    const response = await llmClient.generateExpertAnalysis(
      'BUSINESS_STRATEGIST',
      'document insights generation',
      insightsPrompt,
      { responseFormat: 'json' }
    );

    return response.data;
    
  } catch (error) {
    console.warn('Document insights generation failed:', error);
    return {
      insights: [
        {
          category: 'content_quality',
          insight: 'Document successfully processed',
          impact: 'medium',
          recommendation: 'Proceed with standard analysis workflow'
        }
      ],
      processingRecommendations: ['Continue with clause analysis', 'Perform risk assessment'],
      nextSteps: ['Run clauses worker', 'Run financial worker', 'Run risk worker']
    };
  }
}

/**
 * Generate ingestion best practices
 */
async function generateIngestionBestPractices(contentAnalysis: any, extractionMetadata: any): Promise<any> {
  try {
    const practicesContext = `
Document Quality: ${contentAnalysis?.quality || 'unknown'}
Extraction Method: ${extractionMetadata?.method || 'unknown'}
Content Length: ${extractionMetadata?.contentLength || 0}
Processing Quality: ${extractionMetadata?.quality || 'unknown'}
`;

    const practices = BestPracticesGenerator.generateContextualPractices(
      { 
        documentQuality: contentAnalysis?.quality,
        extractionMethod: extractionMetadata?.method,
        complexity: contentAnalysis?.structure === 'well-structured' ? 'simple' : 'moderate'
      },
      'document-ingestion'
    );

    return practices;
    
  } catch (error) {
    console.warn('Best practices generation failed:', error);
    return {
      category: 'ingestion',
      practices: [
        {
          id: 'ING-001',
          title: 'Regular Content Quality Monitoring',
          description: 'Monitor document ingestion quality and optimize extraction processes',
          priority: 'medium',
          complexity: 'simple'
        }
      ],
      overallRecommendation: 'Continue with standard document processing workflow'
    };
  }
}

/**
 * Create fallback analysis when LLM is not available
 */
function createFallbackAnalysis(content: string, fileType: string, totalPages: number): any {
  const contentLength = content.length;
  const hasStructure = /\n\s*\n/.test(content);
  const hasHeaders = /[A-Z][A-Z\s]{10,}/.test(content);
  
  let quality = 'fair';
  if (contentLength > 5000 && hasStructure && hasHeaders) quality = 'good';
  if (contentLength > 10000 && hasStructure && hasHeaders) quality = 'excellent';
  if (contentLength < 500) quality = 'poor';
  
  return {
    quality,
    confidence: 70,
    documentType: 'contract',
    structure: hasStructure ? 'moderately-structured' : 'poorly-structured',
    readability: hasHeaders ? 'medium' : 'low',
    completeness: contentLength > 1000 ? 'complete' : 'partial',
    insights: [
      `Document contains ${contentLength} characters across ${totalPages} pages`,
      `File type: ${fileType}`,
      `Structure: ${hasStructure ? 'Has paragraph breaks' : 'Limited structure'}`,
      `Headers: ${hasHeaders ? 'Contains headers' : 'No clear headers detected'}`
    ],
    recommendations: [
      'Proceed with standard contract analysis',
      'Monitor extraction quality for future improvements',
      'Consider OCR enhancement if text quality is poor'
    ]
  };
}

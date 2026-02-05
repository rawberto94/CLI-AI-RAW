/**
 * Real Artifact Generator
 * 
 * This module provides a standalone artifact generation function that can be used
 * by the legacy worker script when the queue system (Redis) is not available.
 * 
 * It extracts text from the contract file and generates AI-powered artifacts.
 */

import { PrismaClient, ArtifactType } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import pino from 'pino';

const logger = pino({ name: 'real-artifact-generator' });

// Artifact types to generate
const ARTIFACT_TYPES: ArtifactType[] = [
  'OVERVIEW',
  'CLAUSES', 
  'FINANCIAL',
  'RISK',
  'COMPLIANCE',
  'OBLIGATIONS',
  'RENEWAL',
];

interface ArtifactData {
  type: ArtifactType;
  content: Record<string, any>;
}

/**
 * Extract text content from a buffer based on file type
 */
async function extractTextFromBuffer(
  fileContent: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();

  // PDF extraction using pdf-parse
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(fileContent);
      logger.info({ pages: data.numpages, chars: data.text.length }, 'PDF parsed successfully');
      return data.text;
    } catch (error) {
      logger.warn({ error }, 'pdf-parse failed, trying alternative method');
      // Fallback: Try extracting text patterns from raw PDF
      const rawText = fileContent.toString('utf8');
      const textMatches = rawText.match(/\(([^)]+)\)/g) || [];
      if (textMatches.length > 50) {
        return textMatches.map(m => m.slice(1, -1)).join(' ');
      }
      throw new Error('Failed to extract text from PDF');
    }
  }

  // Word documents using mammoth
  if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: fileContent });
      logger.info({ chars: result.value.length }, 'DOCX parsed successfully');
      return result.value;
    } catch (error) {
      logger.error({ error }, 'mammoth failed to parse DOCX');
      throw new Error('Failed to extract text from DOCX');
    }
  }

  // Plain text files
  if (['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm'].includes(ext)) {
    return fileContent.toString('utf8');
  }

  // RTF files - basic extraction
  if (ext === '.rtf') {
    const text = fileContent.toString('utf8');
    return text
      .replace(/\\[a-z]+\d*\s?/gi, '')
      .replace(/[{}]/g, '')
      .replace(/\\\\/g, '\\')
      .trim();
  }

  // Image files - return placeholder (would need OCR)
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
    return '[Image file - text extraction requires OCR processing]';
  }

  // Unknown format - try as text
  logger.warn({ ext, mimeType }, 'Unknown file format, attempting text extraction');
  const textContent = fileContent.toString('utf8');
  const printableRatio = textContent.replace(/[^\x20-\x7E\n\r\t]/g, '').length / textContent.length;
  if (printableRatio > 0.8) {
    return textContent;
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

/**
 * Extract text content from a file based on its type
 */
async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<string> {
  const fileContent = await fs.readFile(filePath);
  return extractTextFromBuffer(fileContent, filePath, mimeType);
}

/**
 * Generate basic artifact data without AI (fallback mode)
 */
function generateBasicArtifact(type: ArtifactType, contractText: string, contractId: string): Record<string, any> {
  const now = new Date().toISOString();
  const textPreview = contractText.substring(0, 500);
  const wordCount = contractText.split(/\s+/).length;
  
  const baseData = {
    _generated: now,
    _mode: 'basic',
    _contractId: contractId,
    _wordCount: wordCount,
  };

  switch (type) {
    case 'OVERVIEW':
      return {
        ...baseData,
        summary: `Contract document with ${wordCount} words. Detailed AI analysis pending.`,
        keyPoints: ['Document uploaded and processed', 'Full analysis requires AI processing'],
        documentInfo: {
          estimatedPages: Math.ceil(wordCount / 250),
          hasText: contractText.length > 0,
          preview: textPreview,
        },
      };

    case 'CLAUSES':
      return {
        ...baseData,
        clauses: [],
        totalClauses: 0,
        note: 'Clause extraction requires AI analysis',
      };

    case 'FINANCIAL':
      return {
        ...baseData,
        amounts: [],
        currency: null,
        totalValue: null,
        paymentTerms: null,
        note: 'Financial extraction requires AI analysis',
      };

    case 'RISK':
      return {
        ...baseData,
        riskLevel: 'UNKNOWN',
        risks: [],
        note: 'Risk analysis requires AI processing',
      };

    case 'COMPLIANCE':
      return {
        ...baseData,
        complianceStatus: 'PENDING_REVIEW',
        requirements: [],
        note: 'Compliance analysis requires AI processing',
      };

    case 'OBLIGATIONS':
      return {
        ...baseData,
        obligations: [],
        partyObligations: {},
        note: 'Obligation extraction requires AI analysis',
      };

    case 'RENEWAL':
      return {
        ...baseData,
        renewalTerms: null,
        autoRenewal: null,
        noticePeriod: null,
        note: 'Renewal analysis requires AI processing',
      };

    default:
      return {
        ...baseData,
        note: `${type} artifact - analysis pending`,
      };
  }
}

/**
 * Try to generate an artifact using OpenAI
 */
async function generateAIArtifact(
  type: ArtifactType,
  contractText: string,
  contractId: string
): Promise<Record<string, any> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    logger.warn('No OPENAI_API_KEY found, using basic artifact generation');
    return null;
  }

  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });

    // Truncate text if too long (approximately 100k tokens ~ 400k chars)
    const maxChars = 100000;
    const truncatedText = contractText.length > maxChars 
      ? contractText.substring(0, maxChars) + '\n\n[... text truncated for analysis ...]'
      : contractText;

    const prompts: Record<ArtifactType, string> = {
      OVERVIEW: `Analyze this contract and provide a JSON response with:
        - summary: A brief summary (2-3 sentences)
        - keyPoints: Array of key points (max 5)
        - parties: Array of party names mentioned
        - effectiveDate: Date if found (ISO format or null)
        - contractType: Type of contract if identifiable`,
      
      CLAUSES: `Extract the main clauses from this contract. Return JSON with:
        - clauses: Array of objects with {title, content, type, importance}
        - totalClauses: Number of clauses found`,
      
      FINANCIAL: `Extract financial information from this contract. Return JSON with:
        - amounts: Array of {value, currency, description}
        - totalValue: Total contract value if stated
        - currency: Primary currency
        - paymentTerms: Payment terms if specified`,
      
      RISK: `Analyze risks in this contract. Return JSON with:
        - riskLevel: 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'
        - risks: Array of {category, description, severity, mitigation}`,
      
      COMPLIANCE: `Analyze compliance aspects of this contract. Return JSON with:
        - complianceStatus: 'COMPLIANT', 'NEEDS_REVIEW', or 'NON_COMPLIANT'
        - requirements: Array of compliance requirements found
        - standards: Any standards or regulations referenced`,
      
      OBLIGATIONS: `Extract obligations from this contract. Return JSON with:
        - obligations: Array of {party, obligation, deadline, type}
        - partyObligations: Object mapping party names to their obligations`,
      
      RENEWAL: `Extract renewal information from this contract. Return JSON with:
        - renewalTerms: Description of renewal terms
        - autoRenewal: Boolean if auto-renewal exists
        - noticePeriod: Notice period for renewal/termination
        - expirationDate: Contract expiration date if found`,

      // Other artifact types with basic prompts
      PARTIES: 'Extract all parties mentioned in the contract with their roles.',
      DATES: 'Extract all important dates from the contract.',
      TERMS: 'Extract key terms and definitions from the contract.',
      AMENDMENTS: 'Identify any amendments or modifications referenced.',
      NEGOTIATION_POINTS: 'Identify potential negotiation points in the contract.',
      CONTACTS: 'Extract contact information for all parties.',
      METADATA: 'Extract metadata about this contract document.',
      SUMMARY: 'Provide a comprehensive summary of this contract.',
    };

    const prompt = prompts[type] || `Analyze the ${type} aspects of this contract and return relevant information as JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a contract analysis expert. Always respond with valid JSON only, no markdown or explanation.',
        },
        {
          role: 'user',
          content: `${prompt}\n\nContract text:\n${truncatedText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content);
    return {
      ...parsed,
      _generated: new Date().toISOString(),
      _mode: 'ai',
      _model: 'gpt-4o-mini',
      _contractId: contractId,
    };
  } catch (error) {
    logger.error({ error, type, contractId }, 'AI artifact generation failed');
    return null;
  }
}

/**
 * Create or update an artifact in the database
 */
async function saveArtifact(
  prisma: PrismaClient,
  contractId: string,
  tenantId: string,
  type: ArtifactType,
  data: Record<string, any>
): Promise<string> {
  const now = new Date();
  
  // Try to upsert the artifact
  const artifact = await prisma.artifact.upsert({
    where: {
      contractId_type: {
        contractId,
        type,
      },
    },
    create: {
      contractId,
      tenantId,
      type,
      data,
      validationStatus: data._mode === 'ai' ? 'valid' : 'needs_review',
      createdAt: now,
      updatedAt: now,
    },
    update: {
      data,
      validationStatus: data._mode === 'ai' ? 'valid' : 'needs_review',
      updatedAt: now,
    },
  });

  return artifact.id;
}

/**
 * Main artifact generation function
 * Called by the legacy worker script
 */
export async function generateRealArtifacts(
  contractId: string,
  tenantId: string,
  filePath: string,
  mimeType: string,
  prisma: PrismaClient
): Promise<{ success: boolean; artifactsCreated: number; errors?: string[] }> {
  const errors: string[] = [];
  const artifactIds: string[] = [];

  logger.info({ contractId, tenantId, filePath }, 'Starting artifact generation');

  try {
    // Update contract status to PROCESSING
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'PROCESSING' },
    });

    // Update processing job if exists
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        status: 'RUNNING',
        currentStep: 'extracting_text',
        progress: 10,
      },
    });

    // Determine actual file path
    let actualPath = filePath;
    let fileContent: Buffer | null = null;
    
    // Check if it's a relative path from storage (S3/MinIO path)
    if (!filePath.startsWith('/')) {
      // Try local uploads directory first
      const localPath = path.join(process.cwd(), 'uploads', filePath);
      const webLocalPath = path.join(process.cwd(), 'apps', 'web', 'uploads', filePath);
      const rootLocalPath = path.join(process.cwd(), '..', '..', 'uploads', filePath);
      
      if (await fs.access(localPath).then(() => true).catch(() => false)) {
        actualPath = localPath;
        logger.info({ actualPath }, 'Found file in local uploads');
      } else if (await fs.access(webLocalPath).then(() => true).catch(() => false)) {
        actualPath = webLocalPath;
        logger.info({ actualPath }, 'Found file in web uploads');
      } else if (await fs.access(rootLocalPath).then(() => true).catch(() => false)) {
        actualPath = rootLocalPath;
        logger.info({ actualPath }, 'Found file in root uploads');
      } else {
        // File is in S3/MinIO - try to download it
        logger.info({ filePath }, 'File appears to be in S3/MinIO, attempting download');
        
        try {
          // Try to use the S3 client to download
          const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
          
          // Build the endpoint URL from components
          let endpoint = process.env.S3_ENDPOINT;
          if (!endpoint) {
            const minioHost = process.env.MINIO_ENDPOINT || 'localhost';
            const minioPort = process.env.MINIO_PORT || '9000';
            const useSSL = process.env.MINIO_USE_SSL === 'true';
            const protocol = useSSL ? 'https' : 'http';
            endpoint = `${protocol}://${minioHost}:${minioPort}`;
          }
          
          logger.info({ endpoint }, 'Using S3 endpoint');
          
          const s3Client = new S3Client({
            endpoint,
            region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
              secretAccessKey: process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
            },
            forcePathStyle: true, // Required for MinIO
          });
          
          const bucket = process.env.S3_BUCKET || process.env.MINIO_BUCKET || 'contracts';
          
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: filePath,
          });
          
          const response = await s3Client.send(command);
          
          if (response.Body) {
            const chunks: Buffer[] = [];
            // @ts-expect-error - Body is a Readable stream
            for await (const chunk of response.Body) {
              chunks.push(Buffer.from(chunk));
            }
            fileContent = Buffer.concat(chunks);
            logger.info({ filePath, size: fileContent.length }, 'Downloaded file from S3/MinIO');
          } else {
            throw new Error('No body in S3 response');
          }
        } catch (s3Error) {
          logger.error({ s3Error, filePath }, 'Failed to download from S3/MinIO');
          
          // Last resort - check contract record for storage path
          const contract = await prisma.contract.findUnique({
            where: { id: contractId },
            select: { storagePath: true, storageProvider: true },
          });
          
          if (contract?.storageProvider === 'local' && contract.storagePath) {
            actualPath = contract.storagePath;
            logger.info({ actualPath }, 'Using storage path from contract record');
          } else {
            throw new Error(`Cannot access file: ${filePath}. S3 download failed and no local fallback available.`);
          }
        }
      }
    }

    // Extract text from the file
    logger.info({ actualPath, mimeType, hasBuffer: !!fileContent }, 'Extracting text from file');
    const contractText = fileContent 
      ? await extractTextFromBuffer(fileContent, filePath, mimeType)
      : await extractTextFromFile(actualPath, mimeType);
    
    if (!contractText || contractText.length < 10) {
      throw new Error('Failed to extract meaningful text from file');
    }

    logger.info({ textLength: contractText.length }, 'Text extracted successfully');

    // Update progress
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        currentStep: 'generating_artifacts',
        progress: 30,
      },
    });

    // Generate each artifact type
    const totalTypes = ARTIFACT_TYPES.length;
    let completed = 0;

    for (const type of ARTIFACT_TYPES) {
      try {
        logger.info({ contractId, type }, `Generating ${type} artifact`);
        
        // Try AI generation first, fall back to basic
        let artifactData = await generateAIArtifact(type, contractText, contractId);
        
        if (!artifactData) {
          logger.info({ type }, 'Using basic artifact generation (no AI)');
          artifactData = generateBasicArtifact(type, contractText, contractId);
        }

        // Save the artifact
        const artifactId = await saveArtifact(prisma, contractId, tenantId, type, artifactData);
        artifactIds.push(artifactId);
        
        logger.info({ contractId, type, artifactId }, `${type} artifact saved`);
        
        completed++;
        const progress = 30 + Math.floor((completed / totalTypes) * 60);
        
        await prisma.processingJob.updateMany({
          where: { contractId, tenantId },
          data: { 
            currentStep: `artifact_${type.toLowerCase()}`,
            progress,
          },
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMsg, type, contractId }, `Failed to generate ${type} artifact`);
        errors.push(`${type}: ${errorMsg}`);
      }
    }

    // Determine final status
    const finalStatus = artifactIds.length > 0 ? 'COMPLETED' : 'FAILED';

    // Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: { 
        status: finalStatus,
        updatedAt: new Date(),
      },
    });

    // Update processing job
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        status: finalStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        currentStep: 'complete',
        progress: 100,
        completedAt: new Date(),
        error: errors.length > 0 ? errors.join('; ') : null,
      },
    });

    logger.info({ 
      contractId, 
      artifactsCreated: artifactIds.length,
      errors: errors.length,
      status: finalStatus,
    }, 'Artifact generation completed');

    return {
      success: artifactIds.length > 0,
      artifactsCreated: artifactIds.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMsg, contractId }, 'Artifact generation failed');

    // Update contract status to FAILED
    await prisma.contract.update({
      where: { id: contractId },
      data: { 
        status: 'FAILED',
        updatedAt: new Date(),
      },
    }).catch(() => {});

    // Update processing job
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        status: 'FAILED',
        currentStep: 'failed',
        progress: 100,
        completedAt: new Date(),
        error: errorMsg,
      },
    }).catch(() => {});

    return {
      success: false,
      artifactsCreated: 0,
      errors: [errorMsg],
    };
  }
}

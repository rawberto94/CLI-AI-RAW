/**
 * Metadata Extraction API
 * 
 * Extracts metadata from contract documents using the tenant's custom schema.
 * Supports:
 * - Full extraction with multi-pass improvement
 * - Specific field extraction
 * - Re-extraction of low-confidence fields
 */

import { NextRequest, NextResponse } from 'next/server';
import cors from '@/lib/security/cors';
import type { Prisma } from '@prisma/client';
import { 
  SchemaAwareMetadataExtractor,
  ExtractionOptions,
  MetadataExtractionResult,
  type ExtractionResult
} from '@/lib/ai/metadata-extractor';
import { MetadataSchemaService } from '@/lib/services/metadata-schema.service';
import { getApiTenantId } from '@/lib/tenant-server';
import { queueRAGReindex } from '@/lib/rag/reindex-helper';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

interface ExtractRequest {
  documentText?: string;
  useContractText?: boolean;
  options?: ExtractionOptions;
  fieldIds?: string[]; // Extract specific fields only
  reExtractLowConfidence?: boolean;
  previousResultsId?: string;
}

/**
 * Field data with confidence for applying metadata
 */
interface FieldConfidenceData {
  value?: unknown;
  confidence: number;
}

/**
 * POST /api/contracts/[id]/extract-metadata - Extract metadata from contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params;
  
  const ctx = getAuthenticatedApiContext(request);
  
  if (!ctx) {
  
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  
  }
  try {
    const body: ExtractRequest = await request.json();
    const tenantId = await getApiTenantId(request);
    
    let documentText = body.documentText;

    // If no text provided, try to get from contract
    if (!documentText || body.useContractText) {
      const fetchedText = await getContractText(contractId);
      if (!fetchedText) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'No document text available for extraction', 400);
      }
      documentText = fetchedText;
    }

    // Get tenant's metadata schema
    const schemaService = MetadataSchemaService.getInstance();
    const schema = await schemaService.getSchema(tenantId);

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'AI extraction service not configured. Please set OPENAI_API_KEY.', 503);
    }

    // Create extractor
    const extractor = new SchemaAwareMetadataExtractor();

    // Configure extraction options
    const options: ExtractionOptions = {
      maxPasses: body.options?.maxPasses ?? 2,
      confidenceThreshold: body.options?.confidenceThreshold ?? 0.7,
      enableMultiPass: body.options?.enableMultiPass ?? true,
      priorityFields: body.options?.priorityFields,
      skipFields: body.options?.skipFields,
      includeAlternatives: body.options?.includeAlternatives ?? true,
    };

    // If specific fields requested, filter schema
    let targetSchema = schema;
    if (body.fieldIds && body.fieldIds.length > 0) {
      targetSchema = {
        ...schema,
        fields: schema.fields.filter(f => body.fieldIds!.includes(f.id))
      };
    }

    // Perform extraction
    const result = await extractor.extractMetadata(
      documentText,
      targetSchema,
      options
    );

    const extractionResult = {
      ...result,
      contractId,
      tenantId,
    };

    // Save extraction results
    await saveExtractionResults(contractId, extractionResult);

    return createSuccessResponse(ctx, {
      success: true,
      data: extractionResult
    });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

/**
 * GET /api/contracts/[id]/extract-metadata - Get previous extraction results
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const _tenantId = await getApiTenantId(request);

  try {
    const results = await getExtractionResults(contractId);
    
    if (!results) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'An error occurred', 404);
    }

    return createSuccessResponse(ctx, {
      success: true,
      data: results
    });

  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * PUT /api/contracts/[id]/extract-metadata - Apply extracted metadata to contract
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const tenantId = await getApiTenantId(request);

  try {
    const body = await request.json();
    const { 
      fields, 
      applyHighConfidenceOnly = false,
      confidenceThreshold = 0.8,
      markAsValidated = false 
    } = body;

    if (!fields || typeof fields !== 'object') {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'No fields provided to apply', 400);
    }

    // Filter by confidence if requested
    let fieldsToApply = fields;
    if (applyHighConfidenceOnly) {
      fieldsToApply = Object.fromEntries(
        Object.entries(fields).filter(([_, data]: [string, FieldConfidenceData]) => 
          data.confidence >= confidenceThreshold
        )
      );
    }

    // Apply metadata to contract
    await applyMetadataToContract(
      contractId,
      tenantId,
      fieldsToApply,
      markAsValidated
    );

    // Queue RAG re-indexing when metadata fields are applied
    await queueRAGReindex({
      contractId,
      tenantId,
      reason: 'metadata extraction applied',
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: `Applied ${Object.keys(fieldsToApply).length} fields to contract`,
      data: {
        appliedFields: Object.keys(fieldsToApply),
        skippedFields: Object.keys(fields).filter(k => !fieldsToApply[k]),
        ragReindexQueued: true
      }
    });

  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getContractText(contractId: string): Promise<string | null> {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    // Try to get raw text from contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { 
        rawText: true,
        searchableText: true,
      }
    });

    if (contract?.rawText) {
      return contract.rawText;
    }

    // If no raw text, try searchableText
    if (contract?.searchableText) {
      return contract.searchableText;
    }

    return null;
  } catch {
    return null;
  }
}

async function saveExtractionResults(
  contractId: string,
  results: MetadataExtractionResult & { contractId: string; tenantId: string }
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    const existing = await prisma.contractMetadata.findUnique({
      where: { contractId }
    });

    const extractionData = {
      lastExtraction: {
        extractedAt: results.extractedAt,
        schemaId: results.schemaId,
        schemaVersion: results.schemaVersion,
        summary: results.summary,
        warnings: results.warnings,
      },
      extractedFields: results.rawExtractions,
      fieldDetails: results.results.reduce((acc, r) => ({
        ...acc,
        [r.fieldName]: {
          value: r.value,
          confidence: r.confidence,
          validationStatus: r.validationStatus,
          requiresReview: r.requiresHumanReview,
          source: r.source.text?.slice(0, 200),
        }
      }), {}),
    };

    if (existing) {
      await prisma.contractMetadata.update({
        where: { contractId },
        data: {
          customFields: JSON.parse(JSON.stringify({
            ...((existing.customFields as Record<string, unknown>) || {}),
            _aiExtraction: extractionData,
          })),
          lastUpdated: new Date(),
          updatedBy: 'ai-extractor',
        }
      });
    } else {
      await prisma.contractMetadata.create({
        data: {
          contractId,
          tenantId: results.tenantId,
          customFields: JSON.parse(JSON.stringify({
            _aiExtraction: extractionData,
          })),
          systemFields: {},
          tags: [],
          lastUpdated: new Date(),
          updatedBy: 'ai-extractor',
        }
      });
    }
  } catch {
    // Don't throw - extraction was still successful
  }
}

async function getExtractionResults(
  contractId: string
): Promise<Record<string, unknown> | null> {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    const metadata = await prisma.contractMetadata.findUnique({
      where: { contractId },
      select: { customFields: true }
    });

    const customFields = metadata?.customFields as Record<string, unknown> | null;
    return (customFields?._aiExtraction as Record<string, unknown>) || null;
  } catch {
    return null;
  }
}

async function applyMetadataToContract(
  contractId: string,
  tenantId: string,
  fields: Record<string, unknown>,
  markAsValidated: boolean
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    const existing = await prisma.contractMetadata.findUnique({
      where: { contractId }
    });

    const now = new Date();
    const appliedFields: Record<string, unknown> = {};
    
    for (const [key, data] of Object.entries(fields)) {
      const typedData = data as { value?: unknown } | unknown;
      appliedFields[key] = typeof typedData === 'object' && typedData !== null && 'value' in typedData
        ? typedData.value 
        : typedData;
    }

    // Normalize common legacy keys
    if (appliedFields.contract_name !== undefined && appliedFields.contract_title === undefined) {
      appliedFields.contract_title = appliedFields.contract_name;
      delete appliedFields.contract_name;
    }
    if (appliedFields.notice_period_days !== undefined && appliedFields.notice_period === undefined) {
      appliedFields.notice_period = appliedFields.notice_period_days;
      delete appliedFields.notice_period_days;
    }
    if (appliedFields.party_a_name !== undefined && appliedFields.client_name === undefined) {
      appliedFields.client_name = appliedFields.party_a_name;
    }
    if (appliedFields.party_b_name !== undefined && appliedFields.supplier_name === undefined) {
      appliedFields.supplier_name = appliedFields.party_b_name;
    }

    const customFields: Record<string, unknown> = {
      ...((existing?.customFields as Record<string, unknown>) || {}),
      ...appliedFields,
      _metadata: {
        appliedAt: now.toISOString(),
        appliedBy: 'ai-extractor',
        fieldCount: Object.keys(appliedFields).length,
        validated: markAsValidated,
      }
    };

    const contractUpdates: Record<string, unknown> = {};
    if (typeof appliedFields.contract_title === 'string') contractUpdates.contractTitle = appliedFields.contract_title;
    if (typeof appliedFields.client_name === 'string') contractUpdates.clientName = appliedFields.client_name;
    if (typeof appliedFields.supplier_name === 'string') contractUpdates.supplierName = appliedFields.supplier_name;
    if (typeof appliedFields.contract_type === 'string') contractUpdates.contractType = appliedFields.contract_type;
    if (appliedFields.total_value !== undefined && appliedFields.total_value !== null && !Number.isNaN(Number(appliedFields.total_value))) {
      contractUpdates.totalValue = Number(appliedFields.total_value);
    }
    if (typeof appliedFields.currency === 'string') contractUpdates.currency = appliedFields.currency;
    if (typeof appliedFields.payment_terms === 'string') contractUpdates.paymentTerms = appliedFields.payment_terms;
    if (typeof appliedFields.jurisdiction === 'string') contractUpdates.jurisdiction = appliedFields.jurisdiction;

    if (typeof appliedFields.effective_date === 'string' || appliedFields.effective_date instanceof Date) {
      const d = new Date(appliedFields.effective_date);
      if (!Number.isNaN(d.getTime())) contractUpdates.effectiveDate = d;
    }
    if (typeof appliedFields.expiration_date === 'string' || appliedFields.expiration_date instanceof Date) {
      const d = new Date(appliedFields.expiration_date);
      if (!Number.isNaN(d.getTime())) contractUpdates.expirationDate = d;
    }

    if (typeof appliedFields.notice_period === 'number' && Number.isFinite(appliedFields.notice_period)) {
      contractUpdates.noticePeriodDays = Math.max(0, Math.round(appliedFields.notice_period));
    }
    if (typeof appliedFields.auto_renewal === 'boolean') {
      contractUpdates.autoRenewalEnabled = appliedFields.auto_renewal;
    }

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.contractMetadata.update({
          where: { contractId },
          data: {
            customFields: customFields as Prisma.InputJsonValue,
            lastUpdated: now,
            updatedBy: 'ai-extractor',
          }
        });
      } else {
        await tx.contractMetadata.create({
          data: {
            contractId,
            tenantId,
            customFields: customFields as Prisma.InputJsonValue,
            systemFields: {} as Prisma.InputJsonValue,
            tags: [],
            lastUpdated: now,
            updatedBy: 'ai-extractor',
          }
        });
      }

      if (Object.keys(contractUpdates).length > 0) {
        await tx.contract.update({
          where: { id: contractId },
          data: contractUpdates,
        });
      }
    });
  } catch (error: unknown) {
    throw error;
  }
}

interface SchemaField {
  id: string;
  name: string;
  label: string;
  type: string;
  category?: string;
  aiExtractionEnabled?: boolean;
  hidden?: boolean;
  options?: Array<{ value: string; label: string }>;
}

interface MetadataSchema {
  id: string;
  version: number;
  fields: SchemaField[];
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return cors.optionsResponse(request, 'GET, POST, PUT, OPTIONS');
}

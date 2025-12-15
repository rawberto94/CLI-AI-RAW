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
import { 
  SchemaAwareMetadataExtractor,
  ExtractionOptions,
  MetadataExtractionResult
} from '@/lib/ai/metadata-extractor';
import { MetadataSchemaService } from '@/lib/services/metadata-schema.service';
import { getApiTenantId } from '@/lib/tenant-server';

interface ExtractRequest {
  documentText?: string;
  useContractText?: boolean;
  options?: ExtractionOptions;
  fieldIds?: string[]; // Extract specific fields only
  reExtractLowConfidence?: boolean;
  previousResultsId?: string;
}

/**
 * POST /api/contracts/[id]/extract-metadata - Extract metadata from contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params;
  
  try {
    const body: ExtractRequest = await request.json();
    const tenantId = await getApiTenantId(request);
    
    let documentText = body.documentText;

    // If no text provided, try to get from contract
    if (!documentText || body.useContractText) {
      const fetchedText = await getContractText(contractId);
      if (!fetchedText) {
        return NextResponse.json(
          { error: 'No document text available for extraction' },
          { status: 400 }
        );
      }
      documentText = fetchedText;
    }

    // Get tenant's metadata schema
    const schemaService = MetadataSchemaService.getInstance();
    const schema = await schemaService.getSchema(tenantId);

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        data: generateMockExtraction(schema, documentText),
        message: 'Extraction completed using mock data (OpenAI not configured)'
      });
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
    console.log(`🔍 Extracting metadata for contract ${contractId} using tenant schema`);
    const startTime = Date.now();
    
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

    console.log(`✅ Extraction completed in ${Date.now() - startTime}ms`);
    console.log(`   - Fields: ${result.summary.extractedFields}/${result.summary.totalFields}`);
    console.log(`   - Avg Confidence: ${Math.round(result.summary.averageConfidence * 100)}%`);

    return NextResponse.json({
      success: true,
      data: extractionResult
    });

  } catch (error) {
    console.error('Metadata extraction error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to extract metadata',
        details: (error as Error).message 
      },
      { status: 500 }
    );
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
  const tenantId = await getApiTenantId(request);

  try {
    const results = await getExtractionResults(contractId);
    
    if (!results) {
      return NextResponse.json({
        success: false,
        message: 'No extraction results found for this contract'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error retrieving extraction results:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve extraction results' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: 'No fields provided to apply' },
        { status: 400 }
      );
    }

    // Filter by confidence if requested
    let fieldsToApply = fields;
    if (applyHighConfidenceOnly) {
      fieldsToApply = Object.fromEntries(
        Object.entries(fields).filter(([_, data]: [string, any]) => 
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

    return NextResponse.json({
      success: true,
      message: `Applied ${Object.keys(fieldsToApply).length} fields to contract`,
      data: {
        appliedFields: Object.keys(fieldsToApply),
        skippedFields: Object.keys(fields).filter(k => !fieldsToApply[k])
      }
    });

  } catch (error) {
    console.error('Error applying metadata:', error);
    return NextResponse.json(
      { error: 'Failed to apply metadata' },
      { status: 500 }
    );
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
  } catch (error) {
    console.error('Error getting contract text:', error);
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
            ...(existing.customFields as any || {}),
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

    console.log(`💾 Saved extraction results for contract ${contractId}`);
  } catch (error) {
    console.error('Error saving extraction results:', error);
    // Don't throw - extraction was still successful
  }
}

async function getExtractionResults(
  contractId: string
): Promise<any | null> {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    const metadata = await prisma.contractMetadata.findUnique({
      where: { contractId },
      select: { customFields: true }
    });

    const customFields = metadata?.customFields as any;
    return customFields?._aiExtraction || null;
  } catch (error) {
    console.error('Error getting extraction results:', error);
    return null;
  }
}

async function applyMetadataToContract(
  contractId: string,
  tenantId: string,
  fields: Record<string, any>,
  markAsValidated: boolean
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    const existing = await prisma.contractMetadata.findUnique({
      where: { contractId }
    });

    const now = new Date();
    const appliedFields: Record<string, any> = {};
    
    for (const [key, data] of Object.entries(fields)) {
      appliedFields[key] = typeof data === 'object' && data.value !== undefined 
        ? data.value 
        : data;
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

    const customFields = {
      ...(existing?.customFields as any || {}),
      ...appliedFields,
      _metadata: {
        appliedAt: now.toISOString(),
        appliedBy: 'ai-extractor',
        fieldCount: Object.keys(appliedFields).length,
        validated: markAsValidated,
      }
    };

    const contractUpdates: Record<string, any> = {};
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
            customFields,
            lastUpdated: now,
            updatedBy: 'ai-extractor',
          }
        });
      } else {
        await tx.contractMetadata.create({
          data: {
            contractId,
            tenantId,
            customFields,
            systemFields: {},
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

    console.log(`✅ Applied ${Object.keys(appliedFields).length} fields to contract ${contractId}`);
  } catch (error) {
    console.error('Error applying metadata:', error);
    throw error;
  }
}

function generateMockExtraction(
  schema: any,
  documentText: string
): MetadataExtractionResult {
  const results = schema.fields
    .filter((f: any) => f.aiExtractionEnabled && !f.hidden)
    .map((field: any) => {
      // Generate mock value based on field type
      const mockValue = generateMockValue(field, documentText);
      const confidence = Math.random() * 0.4 + 0.5; // 50-90%

      return {
        fieldId: field.id,
        fieldName: field.name,
        fieldLabel: field.label,
        fieldType: field.type,
        category: field.category,
        value: mockValue,
        rawValue: String(mockValue || ''),
        confidence,
        confidenceExplanation: 'Mock extraction (OpenAI not configured)',
        source: { text: 'Mock source' },
        alternatives: [],
        validationStatus: confidence >= 0.7 ? 'valid' : 'needs_review',
        validationMessages: [],
        suggestions: [],
        requiresHumanReview: confidence < 0.7,
      };
    });

  const extracted = results.filter((r: any) => r.value !== null);

  return {
    schemaId: schema.id,
    schemaVersion: schema.version,
    extractedAt: new Date(),
    results,
    summary: {
      totalFields: results.length,
      extractedFields: extracted.length,
      highConfidenceFields: results.filter((r: any) => r.confidence >= 0.8).length,
      lowConfidenceFields: results.filter((r: any) => r.confidence < 0.6).length,
      failedFields: results.filter((r: any) => r.value === null).length,
      averageConfidence: extracted.length > 0
        ? extracted.reduce((sum: number, r: any) => sum + r.confidence, 0) / extracted.length
        : 0,
      extractionTime: 100,
      passesCompleted: 1,
    },
    rawExtractions: results.reduce((acc: any, r: any) => ({
      ...acc,
      [r.fieldName]: r.value
    }), {}),
    warnings: ['Mock extraction - OpenAI not configured'],
    processingNotes: ['Using mock data for demonstration'],
  };
}

function generateMockValue(field: any, documentText: string): any {
  switch (field.type) {
    case 'date':
      return new Date().toISOString().split('T')[0];
    case 'datetime':
      return new Date().toISOString();
    case 'number':
      return Math.floor(Math.random() * 1000);
    case 'currency':
      return Math.floor(Math.random() * 100000);
    case 'percentage':
      return Math.floor(Math.random() * 100);
    case 'boolean':
      return Math.random() > 0.5;
    case 'select':
      if (field.options && field.options.length > 0) {
        return field.options[Math.floor(Math.random() * field.options.length)].value;
      }
      return null;
    case 'multiselect':
      if (field.options && field.options.length > 0) {
        const count = Math.floor(Math.random() * 3) + 1;
        return field.options.slice(0, count).map((o: any) => o.value);
      }
      return [];
    case 'email':
      return 'contact@example.com';
    case 'url':
      return 'https://example.com';
    case 'phone':
      return '+1-555-123-4567';
    case 'duration':
      return 365; // days
    default:
      // Try to extract something from document text
      if (field.name.includes('name') || field.name.includes('title')) {
        const match = documentText.match(/(?:agreement|contract)\s+(?:for|between|with)?\s*([A-Z][A-Za-z\s]+)/);
        return match && match[1] ? match[1].trim() : 'Sample Contract';
      }
      return `Sample ${field.label}`;
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * Contract Metadata API v2.0
 * Manages contract metadata, tags, and custom fields
 * Supports the new 24-field enterprise metadata schema
 * 
 * Now includes automatic RAG re-indexing when critical fields are updated
 */

import { NextRequest, NextResponse } from "next/server";
import cors from "@/lib/security/cors";
import { prisma } from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { getContractQueue } from "@repo/utils/queue/contract-queue";

// Fields that should trigger RAG re-indexing when updated
const RAG_TRIGGER_FIELDS = [
  'document_title',
  'contract_short_description',
  'external_parties',
  'tcv_amount',
  'start_date',
  'end_date',
  'tags',
  'jurisdiction',
] as const;

// Type definition for enterprise metadata schema
interface EnterpriseMetadata {
  // Identification
  document_number?: string;
  document_title?: string;
  contract_short_description?: string;
  
  // Parties
  external_parties?: Array<{
    legalName: string;
    role: string;
    registeredAddress?: string;
  }>;
  
  // Commercials
  tcv_amount?: number;
  tcv_text?: string;
  payment_type?: string;
  billing_frequency_type?: string;
  periodicity?: string;
  currency?: string;
  
  // Dates
  signature_date?: string | null;
  start_date?: string;
  end_date?: string | null;
  termination_date?: string | null;
  
  // Reminders
  reminder_enabled?: boolean;
  reminder_days_before_end?: number;
  notice_period?: number;
  
  // Ownership
  jurisdiction?: string;
  contract_language?: string;
  created_by_user_id?: string;
  contract_owner_user_ids?: string[];
  access_group_ids?: string[];
  
  // Tags
  tags?: string[];
  
  // Confidence tracking
  field_confidence?: Record<string, number>;
  last_ai_extraction?: string;
}

/**
 * GET /api/contracts/[id]/metadata - Get contract metadata with enterprise schema
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = request.headers.get("x-tenant-id");

    // Require tenant ID for data isolation
    if (!tenantId) {
      return NextResponse.json({
        success: false,
        error: "Tenant ID is required"
      }, { status: 400 });
    }

    if (!contractId) {
      return NextResponse.json({
        success: false,
        error: "Contract ID is required"
      }, { status: 400 });
    }

    // Get contract with full metadata fields
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        fileName: true,
        contractTitle: true,
        contractType: true,
        contractCategoryId: true,
        categoryL1: true,
        categoryL2: true,
        status: true,
        effectiveDate: true,
        expirationDate: true,
        startDate: true,
        endDate: true,
        totalValue: true,
        currency: true,
        supplierName: true,
        clientName: true,
        description: true,
        tags: true,
        jurisdiction: true,
        paymentTerms: true,
        paymentFrequency: true,
        billingCycle: true,
        noticePeriodDays: true,
        terminationClause: true,
        autoRenewalEnabled: true,
        metadata: true,
        aiMetadata: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: true,
      }
    });

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: "Contract not found"
      }, { status: 404 });
    }

    // Parse aiMetadata as enterprise schema
    const aiMetadata = (contract.aiMetadata as EnterpriseMetadata) || {};
    
    // Normalize external_parties to handle both legacy (company_name) and new (legalName) formats
    let normalizedParties: Array<{ legalName: string; role: string; registeredAddress?: string }> = [];
    if (aiMetadata.external_parties && Array.isArray(aiMetadata.external_parties)) {
      normalizedParties = aiMetadata.external_parties.map((party: any) => ({
        legalName: party.legalName || party.company_name || '',
        role: party.role || 'Party',
        registeredAddress: party.registeredAddress || party.contact_info || '',
      })).filter((p: any) => p.legalName);
    }
    
    // If no parties from aiMetadata, try legacy fields
    if (normalizedParties.length === 0) {
      if (contract.clientName) {
        normalizedParties.push({ legalName: contract.clientName, role: 'Client' });
      }
      if (contract.supplierName) {
        normalizedParties.push({ legalName: contract.supplierName, role: 'Service Provider' });
      }
    }
    
    // Build enterprise metadata response
    const enterpriseMetadata: EnterpriseMetadata = {
      // Identification
      document_number: aiMetadata.document_number || contract.id,
      document_title: aiMetadata.document_title || contract.contractTitle || contract.fileName || '',
      contract_short_description: aiMetadata.contract_short_description || contract.description || '',
      
      // Parties - use normalized parties
      external_parties: normalizedParties,
      
      // Commercials
      tcv_amount: aiMetadata.tcv_amount || (contract.totalValue ? Number(contract.totalValue) : 0),
      tcv_text: aiMetadata.tcv_text || '',
      payment_type: aiMetadata.payment_type || '',
      billing_frequency_type: aiMetadata.billing_frequency_type || contract.paymentFrequency || '',
      periodicity: aiMetadata.periodicity || contract.billingCycle || '',
      currency: aiMetadata.currency || contract.currency || 'USD',
      
      // Dates
      signature_date: aiMetadata.signature_date || null,
      start_date: aiMetadata.start_date || contract.effectiveDate?.toISOString().split('T')[0] || contract.startDate?.toISOString().split('T')[0] || '',
      end_date: aiMetadata.end_date || contract.expirationDate?.toISOString().split('T')[0] || contract.endDate?.toISOString().split('T')[0] || null,
      termination_date: aiMetadata.termination_date || null,
      
      // Reminders
      reminder_enabled: aiMetadata.reminder_enabled ?? false,
      reminder_days_before_end: aiMetadata.reminder_days_before_end || 30,
      notice_period: aiMetadata.notice_period || contract.noticePeriodDays || 30,
      
      // Ownership
      jurisdiction: aiMetadata.jurisdiction || contract.jurisdiction || '',
      contract_language: aiMetadata.contract_language || 'en',
      created_by_user_id: aiMetadata.created_by_user_id || contract.uploadedBy || '',
      contract_owner_user_ids: aiMetadata.contract_owner_user_ids || [],
      access_group_ids: aiMetadata.access_group_ids || [],
      
      // Tags
      tags: aiMetadata.tags || (Array.isArray(contract.tags) ? contract.tags as string[] : []),
      
      // Confidence tracking
      field_confidence: aiMetadata.field_confidence || {},
      last_ai_extraction: aiMetadata.last_ai_extraction || '',
    };
    
    // Build confidence map (convert to structured format if needed)
    const confidenceMap: Record<string, { value: number; source?: string; needsVerification: boolean; message?: string }> = {};
    
    // If we have field_confidence data, structure it properly
    if (aiMetadata.field_confidence && typeof aiMetadata.field_confidence === 'object') {
      Object.entries(aiMetadata.field_confidence).forEach(([key, value]) => {
        if (typeof value === 'number') {
          confidenceMap[key] = {
            value: value,
            source: 'AI Extraction',
            needsVerification: value < 0.8,
            message: value < 0.8 ? 'Low confidence - please verify' : undefined
          };
        } else if (typeof value === 'object' && value !== null) {
          confidenceMap[key] = value as any;
        }
      });
    }

    // Get taxonomy category details if assigned
    let taxonomyClassification: {
      categoryL1: { id: string; name: string; path: string; color?: string } | null;
      categoryL2: { id: string; name: string; path: string; color?: string } | null;
      contractType: string | null;
      classifiedAt: string | null;
      confidence: number | null;
    } | null = null;

    const contractMeta = (contract.metadata as any) || {};
    const categorization = contractMeta._categorization || contractMeta._pendingCategorization;

    if (contract.contractCategoryId) {
      // Fetch the assigned category with parent
      const assignedCategory = await prisma.taxonomyCategory.findUnique({
        where: { id: contract.contractCategoryId },
        select: {
          id: true,
          name: true,
          path: true,
          color: true,
          level: true,
          parentId: true,
          parent: {
            select: {
              id: true,
              name: true,
              path: true,
              color: true,
            }
          }
        }
      });

      if (assignedCategory) {
        const isL2 = assignedCategory.level === 1;
        taxonomyClassification = {
          categoryL1: isL2 && assignedCategory.parent 
            ? { id: assignedCategory.parent.id, name: assignedCategory.parent.name, path: assignedCategory.parent.path, color: assignedCategory.parent.color }
            : !isL2 
              ? { id: assignedCategory.id, name: assignedCategory.name, path: assignedCategory.path, color: assignedCategory.color }
              : null,
          categoryL2: isL2 
            ? { id: assignedCategory.id, name: assignedCategory.name, path: assignedCategory.path, color: assignedCategory.color }
            : null,
          contractType: contract.contractType,
          classifiedAt: categorization?.categorizedAt || null,
          confidence: categorization?.overallConfidence || null,
        };
      }
    } else if (categorization?.taxonomy || categorization?.suggestedTaxonomy) {
      // Use data from metadata if not yet applied
      const taxData = categorization.taxonomy || categorization.suggestedTaxonomy;
      taxonomyClassification = {
        categoryL1: taxData.categoryL1 || null,
        categoryL2: taxData.categoryL2 || null,
        contractType: categorization.contractType?.value || contract.contractType,
        classifiedAt: categorization.categorizedAt || null,
        confidence: categorization.overallConfidence || null,
      };
    }

    return NextResponse.json({
      success: true,
      metadata: {
        ...enterpriseMetadata,
        _field_confidence: confidenceMap
      },
      classification: {
        contractType: contract.contractType,
        categoryL1: contract.categoryL1,
        categoryL2: contract.categoryL2,
        contractCategoryId: contract.contractCategoryId,
        taxonomy: taxonomyClassification,
      },
      data: {
        ...contract,
        enterpriseMetadata,
      }
    });

  } catch (error) {
    console.error("Get contract metadata error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to get contract metadata",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * PUT /api/contracts/[id]/metadata - Update contract metadata with enterprise schema
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = request.headers.get("x-tenant-id");
    
    // Require tenant ID for data isolation
    if (!tenantId) {
      return NextResponse.json({
        success: false,
        error: "Tenant ID is required"
      }, { status: 400 });
    }
    
    const body = await request.json();
    const metadata = body.metadata || body;

    if (!contractId) {
      return NextResponse.json({
        success: false,
        error: "Contract ID is required"
      }, { status: 400 });
    }

    // Get existing contract
    const existingContract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { aiMetadata: true, metadata: true }
    });

    if (!existingContract) {
      return NextResponse.json({
        success: false,
        error: "Contract not found"
      }, { status: 404 });
    }

    // Validate category ownership if categoryId is being updated
    if (metadata.contractCategoryId) {
      const category = await prisma.taxonomyCategory.findFirst({
        where: { id: metadata.contractCategoryId, tenantId },
      });
      if (!category) {
        return NextResponse.json({
          success: false,
          error: "Invalid category: belongs to different tenant or does not exist"
        }, { status: 403 });
      }
    }

    // Merge with existing aiMetadata
    const existingAiMetadata = (existingContract.aiMetadata as EnterpriseMetadata) || {};
    const updatedAiMetadata: EnterpriseMetadata = {
      ...existingAiMetadata,
      // Update enterprise fields from request
      ...(metadata.document_number !== undefined && { document_number: metadata.document_number }),
      ...(metadata.document_title !== undefined && { document_title: metadata.document_title }),
      ...(metadata.contract_short_description !== undefined && { contract_short_description: metadata.contract_short_description }),
      ...(metadata.external_parties !== undefined && { external_parties: metadata.external_parties }),
      ...(metadata.tcv_amount !== undefined && { tcv_amount: metadata.tcv_amount }),
      ...(metadata.tcv_text !== undefined && { tcv_text: metadata.tcv_text }),
      ...(metadata.payment_type !== undefined && { payment_type: metadata.payment_type }),
      ...(metadata.billing_frequency_type !== undefined && { billing_frequency_type: metadata.billing_frequency_type }),
      ...(metadata.periodicity !== undefined && { periodicity: metadata.periodicity }),
      ...(metadata.currency !== undefined && { currency: metadata.currency }),
      ...(metadata.signature_date !== undefined && { signature_date: metadata.signature_date }),
      ...(metadata.start_date !== undefined && { start_date: metadata.start_date }),
      ...(metadata.end_date !== undefined && { end_date: metadata.end_date }),
      ...(metadata.termination_date !== undefined && { termination_date: metadata.termination_date }),
      ...(metadata.reminder_enabled !== undefined && { reminder_enabled: metadata.reminder_enabled }),
      ...(metadata.reminder_days_before_end !== undefined && { reminder_days_before_end: metadata.reminder_days_before_end }),
      ...(metadata.notice_period !== undefined && { notice_period: metadata.notice_period }),
      ...(metadata.jurisdiction !== undefined && { jurisdiction: metadata.jurisdiction }),
      ...(metadata.contract_language !== undefined && { contract_language: metadata.contract_language }),
      ...(metadata.created_by_user_id !== undefined && { created_by_user_id: metadata.created_by_user_id }),
      ...(metadata.contract_owner_user_ids !== undefined && { contract_owner_user_ids: metadata.contract_owner_user_ids }),
      ...(metadata.access_group_ids !== undefined && { access_group_ids: metadata.access_group_ids }),
      ...(metadata.tags !== undefined && { tags: metadata.tags }),
      ...(metadata.field_confidence !== undefined && { field_confidence: metadata.field_confidence }),
      last_ai_extraction: existingAiMetadata.last_ai_extraction,
    };

    // Also update legacy fields for backward compatibility
    const legacyUpdates: Record<string, any> = {};
    
    if (metadata.document_title) legacyUpdates.contractTitle = metadata.document_title;
    if (metadata.contract_short_description) legacyUpdates.description = metadata.contract_short_description;
    if (metadata.tcv_amount !== undefined) legacyUpdates.totalValue = metadata.tcv_amount;
    if (metadata.currency) legacyUpdates.currency = metadata.currency;
    if (metadata.start_date) legacyUpdates.effectiveDate = new Date(metadata.start_date);
    if (metadata.end_date) legacyUpdates.expirationDate = new Date(metadata.end_date);
    if (metadata.jurisdiction) legacyUpdates.jurisdiction = metadata.jurisdiction;
    if (metadata.notice_period) legacyUpdates.noticePeriodDays = metadata.notice_period;
    if (metadata.billing_frequency_type) legacyUpdates.paymentFrequency = metadata.billing_frequency_type;
    if (metadata.periodicity) legacyUpdates.billingCycle = metadata.periodicity;
    if (metadata.tags) legacyUpdates.tags = metadata.tags;
    
    // Map external parties to legacy client/supplier fields
    if (metadata.external_parties && Array.isArray(metadata.external_parties)) {
      const client = metadata.external_parties.find((p: { role?: string; legalName?: string }) => 
        p.role?.toLowerCase().includes('client') || p.role?.toLowerCase().includes('buyer')
      );
      const supplier = metadata.external_parties.find((p: { role?: string; legalName?: string }) => 
        p.role?.toLowerCase().includes('supplier') || p.role?.toLowerCase().includes('vendor') || p.role?.toLowerCase().includes('provider')
      );
      if (client) legacyUpdates.clientName = client.legalName;
      if (supplier) legacyUpdates.supplierName = supplier.legalName;
    }

    // Update contract with both aiMetadata and legacy fields
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        aiMetadata: updatedAiMetadata as any,
        ...legacyUpdates,
        updatedAt: new Date(),
      }
    });

    await publishRealtimeEvent({
      event: "contract:updated",
      data: {
        tenantId,
        contractId: updatedContract.id,
      },
      source: "api:contracts/[id]/metadata",
    });

    // Check if any RAG-triggering fields were updated and queue re-indexing
    const updatedFields = Object.keys(metadata);
    const shouldReindexRAG = updatedFields.some(field => 
      RAG_TRIGGER_FIELDS.includes(field as typeof RAG_TRIGGER_FIELDS[number])
    );

    let ragReindexQueued = false;
    if (shouldReindexRAG) {
      try {
        const contractQueue = getContractQueue();
        await contractQueue.queueRAGIndexing(
          {
            contractId,
            tenantId,
            artifactIds: [], // Will re-index based on current contract state
          },
          {
            priority: 15, // Normal priority for metadata updates
            delay: 2000,  // 2 second delay to allow any other updates to complete
          }
        );
        ragReindexQueued = true;
        console.log(`📚 RAG re-indexing queued for contract ${contractId} due to metadata update`);
      } catch (ragError) {
        // Log but don't fail the request if RAG queuing fails
        console.error('Failed to queue RAG re-indexing:', ragError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedContract.id,
        enterpriseMetadata: updatedAiMetadata,
        ragReindexQueued,
      },
      message: ragReindexQueued 
        ? "Contract metadata updated successfully. AI search index will be updated shortly."
        : "Contract metadata updated successfully"
    });

  } catch (error) {
    console.error("Update contract metadata error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to update contract metadata",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return cors.optionsResponse(request, "GET, PUT, OPTIONS");
}
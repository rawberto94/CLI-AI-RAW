import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { createOpenAIClient, getOpenAIApiKey, hasAIClientConfig } from '@/lib/openai-client';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { getContractQueue } from '@repo/utils/queue/contract-queue';
import { semanticCache } from '@/lib/ai/semantic-cache.service';
import { checkContractWritePermission } from '@/lib/security/contract-acl';
import { CONTRACT_METADATA_FIELDS, MetadataFieldDefinition } from '@/lib/types/contract-metadata-schema';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

import type { ContractApiContext } from '@/lib/contracts/server/context';

let openAiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openAiClient) {
    const key = getOpenAIApiKey();
    if (!key) throw new Error('OPENAI_API_KEY is not configured');
    openAiClient = createOpenAIClient(key);
  }

  return openAiClient;
}

const openai = new Proxy({} as OpenAI, {
  get: (_target, prop) => (getOpenAI() as any)[prop],
});

interface MetadataField {
  key: string;
  value: unknown;
  status: 'pending' | 'validated' | 'rejected' | 'modified';
  aiConfidence: number;
  humanValidated: boolean;
  suggestions?: string[];
  validationErrors?: string[];
}

interface ValidationRequest {
  fields: Record<string, unknown>;
  contractText?: string;
  validateAll?: boolean;
  fieldsToValidate?: string[];
}

interface AIValidationItem {
  key: string;
  isValid: boolean;
  confidence: number;
  suggestedValue?: unknown;
  notes?: string;
}

interface ValidationResult {
  fields: MetadataField[];
  summary: {
    total: number;
    validated: number;
    pending: number;
    rejected: number;
    modified: number;
    overallConfidence: number;
  };
  suggestions: string[];
}

const isoDateLike = z
  .union([z.string(), z.null()])
  .optional()
  .refine(
    (value) => value === undefined || value === null || value === '' || !Number.isNaN(Date.parse(value)),
    { message: 'Must be a valid ISO date string, null, or empty' },
  );

const externalPartySchema = z.object({
  legalName: z.string().optional(),
  role: z.string().optional(),
  legalForm: z.string().optional(),
  registeredAddress: z.string().optional(),
  registeredSeat: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().or(z.literal('')).optional(),
}).passthrough();

const metadataPutSchema = z.object({
  document_number: z.string().optional(),
  document_title: z.string().optional(),
  document_classification: z.string().optional(),
  document_classification_confidence: z.number().min(0).max(1).optional(),
  document_classification_warning: z.string().optional(),
  contract_short_description: z.string().optional(),
  external_parties: z.array(externalPartySchema).optional(),
  tcv_amount: z.number().nonnegative().optional(),
  tcv_text: z.string().optional(),
  payment_type: z.string().optional(),
  billing_frequency_type: z.string().optional(),
  periodicity: z.string().optional(),
  currency: z.string().max(8).optional(),
  signature_date: isoDateLike,
  signature_status: z.string().optional(),
  signature_required_flag: z.boolean().optional(),
  start_date: isoDateLike,
  end_date: isoDateLike,
  termination_date: isoDateLike,
  reminder_enabled: z.boolean().optional(),
  reminder_days_before_end: z.number().int().min(0).max(3650).optional(),
  notice_period: z.string().optional(),
  notice_period_days: z.number().int().min(0).max(3650).optional(),
  jurisdiction: z.string().optional(),
  contract_language: z.string().optional(),
  created_by_user_id: z.string().optional(),
  contract_owner_user_ids: z.array(z.string()).optional(),
  access_group_ids: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  field_confidence: z.record(z.string(), z.unknown()).optional(),
  contractCategoryId: z.string().optional(),
}).passthrough();

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

interface EnterpriseMetadata {
  document_number?: string;
  document_title?: string;
  document_classification?: 'contract' | 'purchase_order' | 'invoice' | 'quote' | 'proposal' | 'work_order' | 'letter_of_intent' | 'memorandum' | 'amendment' | 'addendum' | 'unknown';
  document_classification_confidence?: number;
  document_classification_warning?: string;
  contract_short_description?: string;
  external_parties?: Array<{
    legalName: string;
    role?: string;
    legalForm?: string;
    registeredAddress?: string;
    registeredSeat?: string;
    contactName?: string;
    contactEmail?: string;
  }>;
  tcv_amount?: number;
  tcv_text?: string;
  payment_type?: string;
  billing_frequency_type?: string;
  periodicity?: string;
  currency?: string;
  signature_date?: string | null;
  signature_status?: 'signed' | 'partially_signed' | 'unsigned' | 'unknown';
  signature_required_flag?: boolean;
  start_date?: string;
  end_date?: string | null;
  termination_date?: string | null;
  reminder_enabled?: boolean;
  reminder_days_before_end?: number | null;
  notice_period?: string;
  notice_period_days?: number;
  jurisdiction?: string;
  contract_language?: string;
  created_by_user_id?: string;
  contract_owner_user_ids?: string[];
  access_group_ids?: string[];
  tags?: string[];
  field_confidence?: Record<string, number>;
  last_ai_extraction?: string;
}

async function findTenantContract(contractId: string, tenantId: string) {
  return prisma.contract.findFirst({
    where: {
      id: contractId,
      tenantId,
    },
    select: { id: true },
  });
}

export async function postBulkContractMetadataUpdate(
  request: NextRequest,
  context: ContractApiContext,
) {
  const { metadataEditorService } = await import('data-orchestration/services');
  const body = await request.json();
  const { contractIds, updates } = body;

  if (!contractIds || !Array.isArray(contractIds)) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'contractIds array is required', 400);
  }

  if (!updates) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'updates object is required', 400);
  }

  const ownedContracts = await prisma.contract.findMany({
    where: {
      id: { in: contractIds },
      tenantId: context.tenantId,
    },
    select: { id: true },
  });

  if (ownedContracts.length !== contractIds.length) {
    return createErrorResponse(context, 'NOT_FOUND', 'One or more contracts were not found', 404);
  }

  const result = await metadataEditorService.bulkUpdateMetadata({
    contractIds,
    updates: {
      ...updates,
      tenantId: context.tenantId,
    },
    userId: context.userId,
  });

  // Fire-and-forget: emit contract.updated for each successfully updated contract.
  if (result.successful && Array.isArray(result.successful) && context.tenantId) {
    const tenantId = context.tenantId;
    const updatedBy = context.userId ?? null;
    const changedFields = Object.keys(updates ?? {});
    const successfulIds: string[] = result.successful
      .map((s: unknown) => (typeof s === 'string' ? s : (s as { id?: string })?.id))
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (successfulIds.length > 0) {
      import('@/lib/webhook-triggers')
        .then(({ triggerContractUpdated }) => {
          for (const id of successfulIds) {
            triggerContractUpdated(tenantId, id, { changedFields, updatedBy, bulk: true }).catch(() => {});
          }
        })
        .catch(() => {});
      import('@/lib/events/integration-events')
        .then(({ recordIntegrationEvent }) => {
          for (const id of successfulIds) {
            recordIntegrationEvent({
              tenantId,
              eventType: 'contract.updated',
              resourceId: id,
              payload: { contractId: id, changedFields, updatedBy, bulk: true },
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }

  return createSuccessResponse(context, {
    message: 'Bulk metadata update completed',
    successful: result.successful,
    failed: result.failed,
    totalProcessed: contractIds.length,
  });
}

export async function getContractTagSuggestions(
  request: NextRequest,
  context: ContractApiContext,
) {
  const query = request.nextUrl.searchParams.get('q') || '';
  if (query.length < 2) {
    return createSuccessResponse(context, { suggestions: [] });
  }

  const normalizedQuery = query.toLowerCase().replace(/\s+/g, '-');
  const existingTags = await prisma.contract.findMany({
    where: {
      tenantId: context.tenantId,
    },
    select: {
      tags: true,
    },
    take: 100,
  }).catch(() => []);

  const tagCounts = new Map<string, number>();
  for (const contract of existingTags) {
    for (const tag of (contract.tags as string[]) || []) {
      if (tag.toLowerCase().includes(normalizedQuery)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  const matchingTags = Array.from(tagCounts.entries())
    .sort((first, second) => second[1] - first[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const smartSuggestions: string[] = [];
  const commonSuffixes = ['-consulting', '-services', '-contract', '-agreement', '-vendor'];

  for (const suffix of commonSuffixes) {
    const suggestion = `${normalizedQuery}${suffix}`;
    if (!matchingTags.includes(suggestion) && !smartSuggestions.includes(suggestion)) {
      smartSuggestions.push(suggestion);
    }
  }

  const suggestions = [
    ...matchingTags,
    ...smartSuggestions.slice(0, 5 - matchingTags.length),
  ].slice(0, 8);

  return createSuccessResponse(context, {
    suggestions,
    query: normalizedQuery,
  });
}

export async function getContractMetadata(
  context: ContractApiContext,
  contractId: string,
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
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
    },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  let fieldValidations: Record<string, { status: string; validatedAt?: string }> = {};
  try {
    const contractMetadata = await prisma.contractMetadata.findUnique({
      where: { contractId },
      select: { customFields: true },
    });
    if (contractMetadata?.customFields) {
      const customFields = contractMetadata.customFields as Record<string, any>;
      fieldValidations = customFields._fieldValidations || {};
    }
  } catch {
    // Optional enrichment.
  }

  const aiMetadata = (contract.aiMetadata as EnterpriseMetadata) || {};
  let normalizedParties: Array<{
    legalName: string;
    role?: string;
    legalForm?: string;
    registeredAddress?: string;
    registeredSeat?: string;
    contactName?: string;
    contactEmail?: string;
  }> = [];

  if (aiMetadata.external_parties && Array.isArray(aiMetadata.external_parties)) {
    normalizedParties = aiMetadata.external_parties.map((party: any) => ({
      legalName: party.legalName || party.company_name || '',
      role: party.role || 'Party',
      legalForm: party.legalForm || '',
      registeredAddress: party.registeredAddress || party.contact_info || '',
      registeredSeat: party.registeredSeat || '',
      contactName: party.contactName || '',
      contactEmail: party.contactEmail || '',
    })).filter((party: any) => party.legalName);
  }

  if (normalizedParties.length === 0) {
    if (contract.clientName) {
      normalizedParties.push({ legalName: contract.clientName, role: 'Client' });
    }
    if (contract.supplierName) {
      normalizedParties.push({ legalName: contract.supplierName, role: 'Service Provider' });
    }
  }

  let artifactOverview: Record<string, any> | null = null;
  if (normalizedParties.length === 0 || !aiMetadata.contract_short_description || !aiMetadata.jurisdiction) {
    try {
      const artifacts = await prisma.artifact.findMany({
        where: { contractId, tenantId: context.tenantId },
        select: { type: true, data: true },
      });

      for (const artifact of artifacts) {
        const artifactType = artifact.type.toLowerCase();
        const artifactData = artifact.data as Record<string, any> | null;
        if (!artifactData) continue;

        if ((artifactType === 'overview' || artifactType === 'metadata') && !artifactOverview) {
          artifactOverview = artifactData;
        }

        if (
          normalizedParties.length === 0 &&
          (artifactType === 'overview' || artifactType === 'metadata' || artifactType === 'parties') &&
          artifactData.parties &&
          Array.isArray(artifactData.parties)
        ) {
          for (const party of artifactData.parties) {
            const name = party.legalName || party.name;
            if (name) {
              normalizedParties.push({
                legalName: name,
                role: party.role || party.type || 'Party',
                legalForm: party.legalForm || party.entityType || '',
                registeredAddress: party.address || party.registeredAddress || '',
                registeredSeat: party.registeredSeat || '',
              });
            }
          }
        }
      }
    } catch {
      // Best-effort fallback.
    }
  }

  const enterpriseMetadata: EnterpriseMetadata = {
    document_number: aiMetadata.document_number || contract.id,
    document_title: aiMetadata.document_title || contract.contractTitle || contract.fileName || '',
    document_classification: aiMetadata.document_classification || 'contract',
    document_classification_confidence: aiMetadata.document_classification_confidence,
    document_classification_warning: aiMetadata.document_classification_warning,
    contract_short_description: aiMetadata.contract_short_description || contract.description || artifactOverview?.summary || '',
    external_parties: normalizedParties,
    tcv_amount: aiMetadata.tcv_amount || (contract.totalValue ? Number(contract.totalValue) : 0) || (artifactOverview?.totalValue ? Number(artifactOverview.totalValue) : 0),
    tcv_text: aiMetadata.tcv_text || '',
    payment_type: aiMetadata.payment_type || '',
    billing_frequency_type: aiMetadata.billing_frequency_type || contract.paymentFrequency || '',
    periodicity: aiMetadata.periodicity || contract.billingCycle || '',
    currency: aiMetadata.currency || contract.currency || artifactOverview?.currency || 'USD',
    signature_date: aiMetadata.signature_date || null,
    signature_status: aiMetadata.signature_status || 'unknown',
    signature_required_flag: aiMetadata.signature_required_flag ?? (
      aiMetadata.signature_status === 'unsigned' ||
      aiMetadata.signature_status === 'partially_signed' ||
      (!aiMetadata.signature_date && aiMetadata.signature_status !== 'signed')
    ),
    start_date: aiMetadata.start_date || contract.effectiveDate?.toISOString().split('T')[0] || contract.startDate?.toISOString().split('T')[0] || artifactOverview?.effectiveDate || artifactOverview?.effective_date || artifactOverview?.startDate || artifactOverview?.start_date || '',
    end_date: aiMetadata.end_date || contract.expirationDate?.toISOString().split('T')[0] || contract.endDate?.toISOString().split('T')[0] || artifactOverview?.expirationDate || artifactOverview?.expiration_date || artifactOverview?.endDate || artifactOverview?.end_date || null,
    termination_date: aiMetadata.termination_date || null,
    reminder_enabled: aiMetadata.reminder_enabled ?? false,
    reminder_days_before_end: aiMetadata.reminder_days_before_end || 30,
    notice_period: aiMetadata.notice_period || (contract.noticePeriodDays ? `${contract.noticePeriodDays} days` : ''),
    notice_period_days: aiMetadata.notice_period_days || contract.noticePeriodDays || undefined,
    jurisdiction: aiMetadata.jurisdiction || contract.jurisdiction || artifactOverview?.jurisdiction || '',
    contract_language: aiMetadata.contract_language || artifactOverview?.language || 'en',
    created_by_user_id: aiMetadata.created_by_user_id || contract.uploadedBy || '',
    contract_owner_user_ids: aiMetadata.contract_owner_user_ids || [],
    access_group_ids: aiMetadata.access_group_ids || [],
    tags: aiMetadata.tags || (Array.isArray(contract.tags) ? contract.tags as string[] : []),
    field_confidence: aiMetadata.field_confidence || {},
    last_ai_extraction: aiMetadata.last_ai_extraction || '',
  };

  const confidenceMap: Record<string, { value: number; source?: string; needsVerification: boolean; message?: string }> = {};
  if (aiMetadata.field_confidence && typeof aiMetadata.field_confidence === 'object') {
    Object.entries(aiMetadata.field_confidence).forEach(([key, value]) => {
      if (typeof value === 'number') {
        confidenceMap[key] = {
          value,
          source: 'AI Extraction',
          needsVerification: value < 0.8,
          message: value < 0.8 ? 'Low confidence - please verify' : undefined,
        };
      } else if (typeof value === 'object' && value !== null) {
        confidenceMap[key] = value as any;
      }
    });
  }

  let taxonomyClassification: {
    categoryL1: { id: string; name: string; path: string; color?: string | null } | null;
    categoryL2: { id: string; name: string; path: string; color?: string | null } | null;
    contractType: string | null;
    classifiedAt: string | null;
    confidence: number | null;
  } | null = null;

  const contractMeta = (contract.metadata as any) || {};
  const categorization = contractMeta._categorization || contractMeta._pendingCategorization;

  if (contract.contractCategoryId) {
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
          },
        },
      },
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
    const taxonomy = categorization.taxonomy || categorization.suggestedTaxonomy;
    taxonomyClassification = {
      categoryL1: taxonomy.categoryL1 || null,
      categoryL2: taxonomy.categoryL2 || null,
      contractType: categorization.contractType?.value || contract.contractType,
      classifiedAt: categorization.categorizedAt || null,
      confidence: categorization.overallConfidence || null,
    };
  }

  return createSuccessResponse(context, {
    success: true,
    metadata: {
      ...enterpriseMetadata,
      _field_confidence: confidenceMap,
      _fieldValidations: fieldValidations,
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
    },
  });
}

export async function putContractMetadata(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const body = await request.json();
  const rawMetadata = body.metadata || body;
  const parsed = metadataPutSchema.safeParse(rawMetadata);

  if (!parsed.success) {
    return createErrorResponse(
      context,
      'VALIDATION_ERROR',
      'Invalid metadata payload',
      400,
      { details: parsed.error.flatten() },
    );
  }

  const metadata: Record<string, any> = { ...parsed.data };
  if (metadata.reminder_enabled === false) {
    metadata.reminder_days_before_end = null;
  }

  const existingContract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
    select: { aiMetadata: true, metadata: true },
  });

  if (!existingContract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const aclDecision = await checkContractWritePermission({
    contractId,
    tenantId: context.tenantId,
    userId: context.userId,
    userRole: context.userRole,
    required: 'EDIT',
  });
  if (!aclDecision.allowed) {
    return createErrorResponse(
      context,
      'FORBIDDEN',
      'You do not have permission to edit this contract metadata',
      403,
    );
  }

  if (metadata.contractCategoryId) {
    const category = await prisma.taxonomyCategory.findFirst({
      where: { id: metadata.contractCategoryId, tenantId: context.tenantId },
    });
    if (!category) {
      return createErrorResponse(context, 'FORBIDDEN', 'Invalid category: belongs to different tenant or does not exist', 403);
    }
  }

  const existingAiMetadata = (existingContract.aiMetadata as EnterpriseMetadata) || {};
  const updatedAiMetadata: EnterpriseMetadata = {
    ...existingAiMetadata,
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
    ...(metadata.signature_status !== undefined && { signature_status: metadata.signature_status }),
    ...(metadata.signature_required_flag !== undefined && { signature_required_flag: metadata.signature_required_flag }),
    ...(metadata.start_date !== undefined && { start_date: metadata.start_date }),
    ...(metadata.end_date !== undefined && { end_date: metadata.end_date }),
    ...(metadata.termination_date !== undefined && { termination_date: metadata.termination_date }),
    ...(metadata.reminder_enabled !== undefined && { reminder_enabled: metadata.reminder_enabled }),
    ...(metadata.reminder_days_before_end !== undefined && { reminder_days_before_end: metadata.reminder_days_before_end }),
    ...(metadata.notice_period !== undefined && { notice_period: metadata.notice_period }),
    ...(metadata.notice_period_days !== undefined && { notice_period_days: metadata.notice_period_days }),
    ...(metadata.jurisdiction !== undefined && { jurisdiction: metadata.jurisdiction }),
    ...(metadata.contract_language !== undefined && { contract_language: metadata.contract_language }),
    ...(metadata.created_by_user_id !== undefined && { created_by_user_id: metadata.created_by_user_id }),
    ...(metadata.contract_owner_user_ids !== undefined && { contract_owner_user_ids: metadata.contract_owner_user_ids }),
    ...(metadata.access_group_ids !== undefined && { access_group_ids: metadata.access_group_ids }),
    ...(metadata.tags !== undefined && { tags: metadata.tags }),
    ...(metadata.field_confidence !== undefined && { field_confidence: metadata.field_confidence }),
    ...(metadata.document_classification !== undefined && { document_classification: metadata.document_classification }),
    ...(metadata.document_classification_confidence !== undefined && { document_classification_confidence: metadata.document_classification_confidence }),
    ...(metadata.document_classification_warning !== undefined && { document_classification_warning: metadata.document_classification_warning }),
    last_ai_extraction: existingAiMetadata.last_ai_extraction,
  };

  const legacyUpdates: Record<string, any> = {};
  if (metadata.document_title) legacyUpdates.contractTitle = metadata.document_title;
  if (metadata.contract_short_description) legacyUpdates.description = metadata.contract_short_description;
  if (metadata.tcv_amount !== undefined) legacyUpdates.totalValue = metadata.tcv_amount;
  if (metadata.currency) legacyUpdates.currency = metadata.currency;
  if (metadata.start_date) legacyUpdates.effectiveDate = new Date(metadata.start_date);
  if (metadata.end_date) legacyUpdates.expirationDate = new Date(metadata.end_date);
  if (metadata.jurisdiction) legacyUpdates.jurisdiction = metadata.jurisdiction;
  if (metadata.notice_period_days) legacyUpdates.noticePeriodDays = metadata.notice_period_days;
  if (metadata.billing_frequency_type) legacyUpdates.paymentFrequency = metadata.billing_frequency_type;
  if (metadata.periodicity) legacyUpdates.billingCycle = metadata.periodicity;
  if (metadata.tags) legacyUpdates.tags = metadata.tags;

  if (metadata.external_parties && Array.isArray(metadata.external_parties)) {
    const client = metadata.external_parties.find((party: { role?: string; legalName?: string }) =>
      party.role?.toLowerCase().includes('client') || party.role?.toLowerCase().includes('buyer'),
    );
    const supplier = metadata.external_parties.find((party: { role?: string; legalName?: string }) =>
      party.role?.toLowerCase().includes('supplier') ||
      party.role?.toLowerCase().includes('vendor') ||
      party.role?.toLowerCase().includes('provider'),
    );
    if (client) legacyUpdates.clientName = client.legalName;
    if (supplier) legacyUpdates.supplierName = supplier.legalName;
  }

  const updatedContract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      aiMetadata: updatedAiMetadata as any,
      ...legacyUpdates,
      updatedAt: new Date(),
    },
  });

  semanticCache.invalidate(context.tenantId, contractId).catch((error) => {
    logger.error('[MetadataUpdate] Semantic cache invalidation error:', error);
  });

  await publishRealtimeEvent({
    event: 'contract:updated',
    data: {
      tenantId: context.tenantId,
      contractId: updatedContract.id,
    },
    source: 'api:contracts/[id]/metadata',
  });

  const updatedFields = Object.keys(metadata);
  const shouldReindexRag = updatedFields.some((field) =>
    RAG_TRIGGER_FIELDS.includes(field as typeof RAG_TRIGGER_FIELDS[number]),
  );

  let ragReindexQueued = false;
  if (shouldReindexRag) {
    try {
      const contractQueue = getContractQueue();
      await contractQueue.queueRAGIndexing(
        {
          contractId,
          tenantId: context.tenantId,
          artifactIds: [],
        },
        {
          priority: 15,
          delay: 2000,
        },
      );
      ragReindexQueued = true;
    } catch {
      // Non-fatal queue failure.
    }
  }

  return createSuccessResponse(context, {
    success: true,
    data: {
      id: updatedContract.id,
      enterpriseMetadata: updatedAiMetadata,
      ragReindexQueued,
    },
    message: ragReindexQueued
      ? 'Contract metadata updated successfully. AI search index will be updated shortly.'
      : 'Contract metadata updated successfully',
  });
}

export async function postContractTags(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const { metadataEditorService } = await import('data-orchestration/services');
  const body = await request.json();
  const { tags } = body;

  if (!tags || !Array.isArray(tags)) {
    return createErrorResponse(context, 'BAD_REQUEST', 'tags array is required', 400);
  }

  const contract = await findTenantContract(contractId, context.tenantId);
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  await metadataEditorService.addTags(
    contractId,
    context.tenantId,
    tags,
    context.userId,
  );

  return createSuccessResponse(context, {
    message: 'Tags added successfully',
    tags,
  });
}

export async function deleteContractTag(
  context: ContractApiContext,
  contractId: string,
  rawTagName: string,
) {
  const { metadataEditorService } = await import('data-orchestration/services');
  const contract = await findTenantContract(contractId, context.tenantId);
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  await metadataEditorService.removeTag(
    contractId,
    context.tenantId,
    decodeURIComponent(rawTagName),
    context.userId,
  );

  return createSuccessResponse(context, {
    message: 'Tag removed successfully',
  });
}

export async function postContractMetadataValidation(
  request: NextRequest,
  context: ContractApiContext,
) {
  const body: ValidationRequest = await request.json();
  const { fields, contractText, validateAll = true, fieldsToValidate } = body;

  if (!fields || Object.keys(fields).length === 0) {
    return createErrorResponse(context, 'BAD_REQUEST', 'No fields provided for validation', 400);
  }

  const fieldsToProcess = validateAll
    ? Object.entries(fields)
    : Object.entries(fields).filter(([key]) => fieldsToValidate?.includes(key));

  if (!hasAIClientConfig()) {
    return createSuccessResponse(context, {
      success: true,
      data: generateFallbackValidation(fieldsToProcess),
      message: 'Validation completed using rule-based validation (OpenAI not configured)',
    });
  }

  if (contractText) {
    const aiValidation = await validateWithAI(fieldsToProcess, contractText);
    return createSuccessResponse(context, {
      success: true,
      data: aiValidation,
    });
  }

  return createSuccessResponse(context, {
    success: true,
    data: validateWithRules(fieldsToProcess),
  });
}

export async function putContractMetadataValidation(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const body = await request.json();
  const { fieldKey, action, newValue, reason, allFields, resetAll } = body;

  const contract = await findTenantContract(contractId, context.tenantId);
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  if (resetAll === true) {
    const existing = await prisma.contractMetadata.findUnique({
      where: { contractId },
    });

    if (existing) {
      const customFields = (existing.customFields as Record<string, unknown>) || {};
      customFields._fieldValidations = {};

      await prisma.contractMetadata.update({
        where: { contractId },
        data: {
          customFields: customFields as Prisma.InputJsonValue,
          lastUpdated: new Date(),
          updatedBy: 'human-validator',
        },
      });
    }

    return createSuccessResponse(context, {
      success: true,
      message: 'All verifications have been reset',
      data: { contractId },
    });
  }

  if (allFields && typeof allFields === 'object') {
    try {
      const existing = await prisma.contractMetadata.findUnique({
        where: { contractId },
      });

      const now = new Date();
      const customFields = {
        ...((existing?.customFields as Record<string, unknown>) || {}),
        ...allFields,
        _validationStatus: {
          validatedAt: now.toISOString(),
          validatedBy: 'human',
          fieldCount: Object.keys(allFields).length,
        },
      };

      if (existing) {
        await prisma.contractMetadata.update({
          where: { contractId },
          data: {
            customFields,
            lastUpdated: now,
            updatedBy: 'human-validator',
          },
        });
      } else {
        await prisma.contractMetadata.create({
          data: {
            contractId,
            tenantId: context.tenantId,
            customFields,
            systemFields: {},
            tags: [],
            lastUpdated: now,
            updatedBy: 'human-validator',
          },
        });
      }

      return createSuccessResponse(context, {
        success: true,
        message: 'All validated metadata saved successfully',
        data: { contractId, fieldCount: Object.keys(allFields).length },
      });
    } catch {
      // Demo mode fallback — continue with non-persistent response below.
    }
  }

  if (!fieldKey || !action) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Field key and action are required', 400);
  }

  const validationRecord = {
    contractId,
    tenantId: context.tenantId,
    fieldKey,
    action,
    newValue: action === 'modify' ? newValue : undefined,
    reason,
    timestamp: new Date().toISOString(),
    validatedBy: 'human',
  };

  try {
    const existing = await prisma.contractMetadata.findUnique({
      where: { contractId },
    });

    if (existing) {
      const customFields = ((existing.customFields as Record<string, unknown>) || {}) as Record<string, any>;
      customFields[fieldKey] = action === 'modify' ? newValue : customFields[fieldKey];
      customFields._fieldValidations = customFields._fieldValidations || {};
      customFields._fieldValidations[fieldKey] = {
        status: action,
        validatedAt: new Date().toISOString(),
        reason,
      };

      await prisma.contractMetadata.update({
        where: { contractId },
        data: {
          customFields,
          lastUpdated: new Date(),
          updatedBy: 'human-validator',
        },
      });
    } else {
      const customFields: Record<string, unknown> & {
        _fieldValidations: Record<string, unknown>;
      } = {
        _fieldValidations: {
          [fieldKey]: {
            status: action,
            validatedAt: new Date().toISOString(),
            reason,
          },
        },
      };

      if (action === 'modify') {
        customFields[fieldKey] = newValue;
      }

      await prisma.contractMetadata.create({
        data: {
          contractId,
          tenantId: context.tenantId,
          customFields,
          systemFields: {},
          tags: [],
          lastUpdated: new Date(),
          updatedBy: 'human-validator',
        },
      });
    }
  } catch (dbError) {
    logger.error('Failed to persist field validation:', dbError);
  }

  return createSuccessResponse(context, {
    success: true,
    data: validationRecord,
    message: `Field "${fieldKey}" ${action}d successfully`,
  });
}

export async function postBulkContractMetadataExtraction(
  request: NextRequest,
  context: ContractApiContext,
) {
  const isTenantAdmin = context.userRole === 'admin' || context.userRole === 'owner';
  const tenantId = context.tenantId;

  if (!isTenantAdmin) {
    return createErrorResponse(context, 'FORBIDDEN', 'Forbidden - Admin access required', 403);
  }

  const body = await request.json();
  const {
    contractIds,
    filter,
    autoApply = true,
    autoApplyThreshold = 0.85,
    priority = 'low',
    skipExisting = true,
  } = body;

  let targetContracts: Array<{ id: string; hasMetadata: boolean }> = [];

  if (contractIds && Array.isArray(contractIds)) {
    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        tenantId,
      },
      select: {
        id: true,
        contractMetadata: {
          select: { id: true },
        },
        rawText: true,
      },
    });

    targetContracts = contracts
      .filter((contract) => contract.rawText && contract.rawText.length >= 100)
      .map((contract) => ({
        id: contract.id,
        hasMetadata: !!contract.contractMetadata,
      }));
  } else if (filter) {
    const where: Prisma.ContractWhereInput = { tenantId };

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.missingMetadata) {
      where.contractMetadata = { is: null };
    }
    if (filter.contractType) {
      where.contractType = filter.contractType;
    }
    if (filter.createdAfter) {
      where.createdAt = { gte: new Date(filter.createdAfter) };
    }
    if (filter.createdBefore) {
      const current = (where.createdAt ?? {}) as Prisma.DateTimeFilter<'Contract'>;
      where.createdAt = { ...current, lte: new Date(filter.createdBefore) };
    }

    const contracts = await prisma.contract.findMany({
      where,
      select: {
        id: true,
        contractMetadata: {
          select: { id: true },
        },
        rawText: true,
      },
      take: 500,
    });

    targetContracts = contracts
      .filter((contract) => contract.rawText && contract.rawText.length >= 100)
      .map((contract) => ({
        id: contract.id,
        hasMetadata: !!contract.contractMetadata,
      }));
  } else {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Either contractIds or filter must be provided', 400);
  }

  const contractsToProcess = skipExisting
    ? targetContracts.filter((contract) => !contract.hasMetadata)
    : targetContracts;

  if (contractsToProcess.length === 0) {
    return createSuccessResponse(context, {
      queued: 0,
      skipped: targetContracts.length,
      message: 'No contracts need metadata extraction',
    });
  }

  try {
    const { getContractQueue: getAppContractQueue } = await import('@/lib/queue/contract-queue');
    const queue = getAppContractQueue();
    const jobIds: string[] = [];
    const priorityValue = priority as 'high' | 'normal' | 'low';

    for (let index = 0; index < contractsToProcess.length; index += 1) {
      const contract = contractsToProcess[index];
      if (!contract) {
        continue;
      }

      const jobId = await queue.queueMetadataExtraction(
        {
          contractId: contract.id,
          tenantId,
          autoApply,
          autoApplyThreshold,
          source: 'bulk' as any,
          priority: priorityValue,
        },
        {
          delay: index * 1000,
        },
      );

      if (jobId) {
        jobIds.push(jobId);
      }
    }

    return createSuccessResponse(context, {
      queued: jobIds.length,
      skipped: targetContracts.length - contractsToProcess.length,
      message: `Queued ${jobIds.length} contracts for metadata extraction`,
      estimatedTime: `${Math.ceil((jobIds.length * 30) / 60)} minutes`,
      jobIds: jobIds.slice(0, 10),
    });
  } catch (queueError: unknown) {
    return createErrorResponse(
      context,
      'SERVICE_UNAVAILABLE',
      queueError instanceof Error ? queueError.message : 'Failed to queue contracts for processing',
      503,
    );
  }
}

export async function getBulkContractMetadataExtractionStatus(
  context: ContractApiContext,
) {
  const isTenantAdmin = context.userRole === 'admin' || context.userRole === 'owner';
  const tenantId = context.tenantId;

  if (!isTenantAdmin) {
    return createErrorResponse(context, 'FORBIDDEN', 'Forbidden - Admin access required', 403);
  }

  const [
    totalContracts,
    contractsWithMetadata,
    contractsProcessing,
    recentExtractions,
  ] = await Promise.all([
    prisma.contract.count({
      where: { tenantId, status: 'COMPLETED' },
    }),
    prisma.contract.count({
      where: {
        tenantId,
        status: 'COMPLETED',
        contractMetadata: { isNot: null },
      },
    }),
    prisma.contract.count({
      where: { tenantId, status: 'PROCESSING' },
    }),
    prisma.contract.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        contractMetadata: { isNot: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        contractTitle: true,
        updatedAt: true,
        contractMetadata: {
          select: {
            systemFields: true,
            customFields: true,
          },
        },
      },
    }),
  ]);

  return createSuccessResponse(context, {
    statistics: {
      totalContracts,
      contractsWithMetadata,
      contractsWithoutMetadata: totalContracts - contractsWithMetadata,
      coveragePercentage: totalContracts > 0
        ? Math.round((contractsWithMetadata / totalContracts) * 100)
        : 0,
      processing: contractsProcessing,
    },
    queue: null,
    recentExtractions: recentExtractions.map((contract) => ({
      id: contract.id,
      title: contract.contractTitle,
      updatedAt: contract.updatedAt,
      fieldCount: contract.contractMetadata
        ? Object.keys((contract.contractMetadata.systemFields as object) || {}).length
          + Object.keys((contract.contractMetadata.customFields as object) || {}).length
        : 0,
    })),
  });
}

async function validateWithAI(
  fields: [string, any][],
  contractText: string,
): Promise<ValidationResult> {
  const fieldsList = fields.map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
  }));

  const prompt = `Analyze the following contract text and validate these extracted metadata fields.
For each field, provide:
1. A confidence score (0-100) indicating how accurately the value matches the contract
2. Any corrections or alternative values found in the contract
3. Validation notes or concerns

Contract text:
${contractText.slice(0, 8000)}

Fields to validate:
${JSON.stringify(fieldsList, null, 2)}

Respond in JSON format:
{
  "validations": [
    {
      "key": "field_key",
      "confidence": 85,
      "isValid": true,
      "suggestedValue": "corrected value if different",
      "notes": "validation notes",
      "source": "quote or location in contract"
    }
  ],
  "overallConfidence": 80,
  "suggestions": ["general suggestions for improvement"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a contract metadata validator. Analyze extracted metadata against contract text and provide confidence scores and corrections.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}') as {
      validations?: AIValidationItem[];
      overallConfidence?: number;
      suggestions?: string[];
    };

    const validatedFields: MetadataField[] = fields.map(([key, value]) => {
      const aiValidation = result.validations?.find((validation) => validation.key === key);
      const suggestedValue = aiValidation?.suggestedValue;
      const suggestions =
        typeof suggestedValue === 'string' &&
        suggestedValue.length > 0 &&
        suggestedValue !== String(value ?? '')
          ? [suggestedValue]
          : undefined;

      return {
        key,
        value,
        status: aiValidation?.isValid ? 'validated' : 'pending',
        aiConfidence: aiValidation?.confidence || 50,
        humanValidated: false,
        suggestions,
        validationErrors: aiValidation?.notes ? [aiValidation.notes] : undefined,
      };
    });

    const validated = validatedFields.filter((field) => field.status === 'validated').length;

    return {
      fields: validatedFields,
      summary: {
        total: validatedFields.length,
        validated,
        pending: validatedFields.length - validated,
        rejected: 0,
        modified: 0,
        overallConfidence:
          result.overallConfidence ||
          validatedFields.reduce((sum, field) => sum + field.aiConfidence, 0) / validatedFields.length,
      },
      suggestions: result.suggestions || [],
    };
  } catch {
    return validateWithRules(fields);
  }
}

function validateWithRules(fields: [string, unknown][]): ValidationResult {
  const validatedFields: MetadataField[] = fields.map(([key, value]) => {
    const confidence = calculateRuleBasedConfidence(key, value);
    const suggestions = generateSuggestions(key, value);
    const errors = validateField(key, value);

    return {
      key,
      value,
      status: errors.length === 0 && confidence >= 70 ? 'validated' : 'pending',
      aiConfidence: confidence,
      humanValidated: false,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      validationErrors: errors.length > 0 ? errors : undefined,
    };
  });

  const validated = validatedFields.filter((field) => field.status === 'validated').length;

  return {
    fields: validatedFields,
    summary: {
      total: validatedFields.length,
      validated,
      pending: validatedFields.length - validated,
      rejected: 0,
      modified: 0,
      overallConfidence:
        validatedFields.reduce((sum, field) => sum + field.aiConfidence, 0) / validatedFields.length,
    },
    suggestions: [
      'Review fields with confidence below 70%',
      'Verify date formats match your organization standards',
      'Ensure all required fields are populated',
    ],
  };
}

function calculateRuleBasedConfidence(key: string, value: unknown): number {
  const fieldDef = CONTRACT_METADATA_FIELDS.find(
    (field) => field.key === key || field.key === key.replace(/_/g, ''),
  );

  let confidence = fieldDef ? 55 : 45;

  if (value === null || value === undefined || value === '') {
    if (fieldDef?.required) {
      return 15;
    }
    return 30;
  }

  if (fieldDef) {
    confidence += validateByFieldType(fieldDef, value);

    if (fieldDef.ui_attention === 'none') {
      confidence += 5;
    }

    if (fieldDef.ui_attention === 'error') {
      confidence -= 10;
    } else if (fieldDef.ui_attention === 'warning') {
      confidence -= 5;
    }
  } else {
    confidence += validateByKeyName(key, value);
  }

  return Math.min(100, Math.max(10, confidence));
}

function validateByFieldType(fieldDef: MetadataFieldDefinition, value: unknown): number {
  let bonus = 0;

  switch (fieldDef.type) {
    case 'date':
      if (isValidDate(value)) {
        bonus += 30;
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          bonus += 10;
        }
      } else {
        bonus -= 25;
      }
      break;

    case 'decimal':
    case 'integer':
      if (typeof value === 'number') {
        bonus += 25;
        if (fieldDef.key.includes('amount') || fieldDef.key.includes('value')) {
          bonus += value >= 0 ? 10 : -15;
        }
      } else if (!isNaN(parseFloat(String(value)))) {
        bonus += 15;
      } else {
        bonus -= 20;
      }
      break;

    case 'enum':
      if (fieldDef.enum?.includes(String(value))) {
        bonus += 35;
      } else {
        bonus -= 30;
      }
      break;

    case 'boolean':
      if (typeof value === 'boolean' || value === 'true' || value === 'false') {
        bonus += 30;
      } else {
        bonus -= 20;
      }
      break;

    case 'string':
      const strValue = String(value);
      if (strValue.length >= 1 && strValue.length <= 1000) {
        bonus += 15;

        if (fieldDef.format === 'ISO4217' && isValidCurrencyCode(strValue)) {
          bonus += 20;
        } else if (fieldDef.format === 'ISO639-1_or_name' && isValidLanguageCode(strValue)) {
          bonus += 20;
        } else if (fieldDef.format === 'ISO3166-1-alpha2_or_name' && strValue.length >= 2) {
          bonus += 15;
        }
      }
      break;

    case 'fk':
    case 'array_fk':
      if (Array.isArray(value)) {
        bonus += value.length > 0 ? 20 : 0;
      } else if (typeof value === 'string' && value.length > 0) {
        bonus += 20;
      }
      break;
  }

  return bonus;
}

function validateByKeyName(key: string, value: unknown): number {
  let bonus = 0;
  const keyLower = key.toLowerCase();

  if (keyLower.includes('date') || keyLower.includes('expir')) {
    bonus += isValidDate(value) ? 25 : -20;
  }

  if (keyLower.includes('email')) {
    bonus += isValidEmail(String(value)) ? 30 : -20;
  }

  if (keyLower.includes('value') || keyLower.includes('amount') || keyLower.includes('price')) {
    if (typeof value === 'number' || !isNaN(parseFloat(String(value)))) {
      bonus += 20;
    }
  }

  if (keyLower.includes('name') || keyLower.includes('party')) {
    if (String(value).length >= 2 && String(value).length <= 200) {
      bonus += 15;
    }
  }

  return bonus;
}

function isValidCurrencyCode(value: string): boolean {
  const commonCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'CNY', 'INR', 'BRL', 'MXN', 'KRW', 'SGD', 'HKD', 'SEK', 'NOK', 'DKK', 'NZD', 'ZAR', 'RUB'];
  return commonCurrencies.includes(value.toUpperCase()) || /^[A-Z]{3}$/.test(value.toUpperCase());
}

function isValidLanguageCode(value: string): boolean {
  const commonLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'ru', 'nl', 'pl', 'sv', 'da', 'no', 'fi'];
  const languageNames = ['english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'chinese', 'japanese', 'korean', 'arabic', 'russian', 'dutch'];
  return commonLanguages.includes(value.toLowerCase()) ||
    languageNames.includes(value.toLowerCase()) ||
    /^[a-z]{2}(-[A-Z]{2})?$/.test(value);
}

function generateSuggestions(key: string, value: unknown): string[] {
  const suggestions: string[] = [];
  const keyLower = key.toLowerCase();
  const fieldDef = CONTRACT_METADATA_FIELDS.find(
    (field) => field.key === key || field.key === key.replace(/_/g, ''),
  );

  if (!value || value === '') {
    if (fieldDef?.required) {
      suggestions.push(`${fieldDef.label || key} is required - please provide a value`);
    } else {
      suggestions.push('Value is empty - please provide a value or confirm as N/A');
    }
    return suggestions;
  }

  if (fieldDef) {
    if (fieldDef.type === 'date') {
      const dateStr = String(value);
      if (!dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        suggestions.push('Consider using ISO 8601 date format (YYYY-MM-DD) for consistency');
      }
    }

    if (fieldDef.type === 'enum' && fieldDef.enum && !fieldDef.enum.includes(String(value))) {
      suggestions.push(`Value should be one of: ${fieldDef.enum.join(', ')}`);
    }

    if (fieldDef.format === 'ISO4217') {
      const currValue = String(value).toUpperCase();
      if (!/^[A-Z]{3}$/.test(currValue)) {
        suggestions.push('Currency should be a 3-letter ISO 4217 code (e.g., USD, EUR)');
      }
    }

    if (fieldDef.extraction_hint) {
      suggestions.push(`Tip: ${fieldDef.extraction_hint}`);
    }
  } else if (keyLower.includes('date') && value) {
    const dateStr = String(value);
    if (!dateStr.includes('-') && !dateStr.includes('/')) {
      suggestions.push('Consider using ISO 8601 date format (YYYY-MM-DD)');
    }
  }

  return suggestions;
}

function validateField(key: string, value: unknown): string[] {
  const errors: string[] = [];
  const keyLower = key.toLowerCase();
  const fieldDef = CONTRACT_METADATA_FIELDS.find(
    (field) => field.key === key || field.key === key.replace(/_/g, ''),
  );

  if (fieldDef?.required && (!value || value === '' || (Array.isArray(value) && value.length === 0))) {
    errors.push(`${fieldDef.label || key} is a required field`);
  } else if (!fieldDef && isRequiredField(key) && (!value || value === '')) {
    errors.push(`${key} is a required field`);
  }

  if (fieldDef && value) {
    switch (fieldDef.type) {
      case 'date':
        if (!isValidDate(value)) {
          errors.push(`Invalid date format for ${fieldDef.label || key}`);
        }
        break;

      case 'decimal':
      case 'integer':
        const numVal = typeof value === 'number' ? value : parseFloat(String(value));
        if (isNaN(numVal)) {
          errors.push(`${fieldDef.label || key} must be a valid number`);
        }
        if (fieldDef.type === 'integer' && !Number.isInteger(numVal)) {
          errors.push(`${fieldDef.label || key} must be a whole number`);
        }
        break;

      case 'enum':
        if (fieldDef.enum && !fieldDef.enum.includes(String(value))) {
          errors.push(`Invalid value for ${fieldDef.label || key}. Expected one of: ${fieldDef.enum.join(', ')}`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(`${fieldDef.label || key} must be a boolean value`);
        }
        break;
    }

    if (fieldDef.format === 'ISO4217' && value && !/^[A-Z]{3}$/i.test(String(value))) {
      errors.push('Currency should be a valid ISO 4217 code (3 letters)');
    }
  } else {
    if (keyLower.includes('date') && value && !isValidDate(value)) {
      errors.push('Invalid date format');
    }
    if (keyLower.includes('email') && value && !isValidEmail(String(value))) {
      errors.push('Invalid email format');
    }
  }

  return errors;
}

function isRequiredField(key: string): boolean {
  const requiredFields = [
    'contractTitle', 'title', 'name',
    'startDate', 'effectiveDate',
    'partyA', 'partyB', 'vendor', 'client',
  ];

  return requiredFields.some((field) => key.toLowerCase().includes(field.toLowerCase()));
}

function isValidDate(value: unknown): boolean {
  if (!value) return false;
  const date = new Date(value as string | number | Date);
  return !isNaN(date.getTime());
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function generateFallbackValidation(fields: [string, unknown][]): ValidationResult {
  return validateWithRules(fields);
}

export function optionsContractMetadataValidation(request: NextRequest): Promise<NextResponse> {
  return import('@/lib/security/cors').then(({ default: cors }) =>
    cors.optionsResponse(request, 'GET, POST, PUT, OPTIONS'),
  );
}
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { createOpenAIClient, getOpenAIApiKey, hasAIClientConfig } from '@/lib/openai-client';
import { getContractQueue } from '@repo/utils/queue/contract-queue';
import { checkContractWritePermission } from '@/lib/security/contract-acl';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { CONTRACT_METADATA_FIELDS, MetadataFieldDefinition } from '@/lib/types/contract-metadata-schema';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { applyContractChangeSideEffects } from './contract-change-side-effects';
import {
  getTenantTagNameSet,
  normalizeTagName,
  validateOrRegisterTenantTags,
} from './tag-registry';

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
});

const metadataPutSchema = z.object({
  document_number: z.string().optional(),
  document_title: z.string().optional(),
  contractType: z.string().optional(),
  document_classification: z.string().optional(),
  document_classification_confidence: z.number().min(0).max(1).optional(),
  document_classification_warning: z.string().nullable().optional(),
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
});

function toNullableMetadataDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value);
}

function applyExpirationState(updates: Record<string, any>, expirationDate: Date | null) {
  if (expirationDate) {
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUntil = Math.ceil((expirationDate.getTime() - now.getTime()) / msPerDay);
    updates.daysUntilExpiry = daysUntil;
    updates.isExpired = daysUntil < 0;
    if (daysUntil < 0) updates.expirationRisk = 'EXPIRED';
    else if (daysUntil <= 7) updates.expirationRisk = 'CRITICAL';
    else if (daysUntil <= 30) updates.expirationRisk = 'HIGH';
    else if (daysUntil <= 90) updates.expirationRisk = 'MEDIUM';
    else updates.expirationRisk = 'LOW';
  } else {
    updates.daysUntilExpiry = null;
    updates.isExpired = false;
    updates.expirationRisk = null;
  }
}

export interface EnterpriseMetadata {
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

  // Enforce EDIT ACL per contract in the batch.
  const allowedIds: string[] = [];
  for (const contract of ownedContracts) {
    const aclDecision = await checkContractWritePermission({
      contractId: contract.id,
      tenantId: context.tenantId,
      userId: context.userId,
      userRole: context.userRole,
      required: 'EDIT',
    });
    if (aclDecision.allowed) {
      allowedIds.push(contract.id);
    }
  }

  if (allowedIds.length === 0) {
    return createErrorResponse(
      context,
      'FORBIDDEN',
      'You do not have permission to edit metadata on these contracts',
      403,
    );
  }

  const result = await metadataEditorService.bulkUpdateMetadata({
    contractIds: allowedIds,
    updates: {
      ...updates,
      tenantId: context.tenantId,
    },
    userId: context.userId,
  });

  // Propagate side effects for every successfully updated contract.
  const changedFields = Object.keys(updates ?? {});
  const successfulIds: string[] = (result.successful || [])
    .map((s: unknown) => (typeof s === 'string' ? s : (s as { id?: string })?.id))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  for (const id of successfulIds) {
    applyContractChangeSideEffects({
      tenantId: context.tenantId,
      contractId: id,
      userId: context.userId,
      changedFields,
      source: 'api:contracts/metadata/bulk-update',
    }).catch(() => {});
  }

  return createSuccessResponse(context, {
    message: 'Bulk metadata update completed',
    successful: result.successful,
    failed: result.failed,
    forbiddenCount: contractIds.length - allowedIds.length,
    totalProcessed: allowedIds.length,
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
  const [metadataTags, predefinedTagSet] = await Promise.all([
    prisma.contractMetadata.findMany({
      where: { tenantId: context.tenantId },
      select: { tags: true },
      take: 500,
    }).catch(() => []),
    getTenantTagNameSet(context.tenantId),
  ]);

  const tagCounts = new Map<string, number>();
  for (const metadataRecord of metadataTags) {
    for (const tag of metadataRecord.tags || []) {
      if (tag.toLowerCase().includes(normalizedQuery)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  for (const predefinedTag of predefinedTagSet) {
    if (predefinedTag.includes(normalizedQuery)) {
      tagCounts.set(predefinedTag, Math.max(tagCounts.get(predefinedTag) || 0, 1));
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

function appendRecommendation(
  target: Map<string, { score: number; reasons: string[] }>,
  tag: string,
  score: number,
  reason: string,
) {
  const normalized = normalizeTagName(tag);
  if (!normalized) return;

  const current = target.get(normalized);
  if (!current) {
    target.set(normalized, { score, reasons: [reason] });
    return;
  }

  current.score += score;
  if (!current.reasons.includes(reason)) {
    current.reasons.push(reason);
  }
}

export async function getContractTagRecommendations(
  context: ContractApiContext,
  contractId: string,
  limit = 8,
) {
  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
    },
    select: {
      id: true,
      status: true,
      contractType: true,
      categoryL1: true,
      categoryL2: true,
      clientName: true,
      supplierName: true,
      totalValue: true,
      expirationDate: true,
      signatureStatus: true,
      aiMetadata: true,
      tags: true,
    },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const existingTags = Array.isArray(contract.tags) ? (contract.tags as string[]) : [];
  const existingTagSet = new Set<string>(existingTags.map((tag) => normalizeTagName(tag)).filter(Boolean));
  const recommendations = new Map<string, { score: number; reasons: string[] }>();

  if (contract.contractType) {
    appendRecommendation(recommendations, contract.contractType, 18, 'contract type');
  }
  if (contract.status) {
    appendRecommendation(recommendations, contract.status, 12, 'status');
  }
  if (contract.categoryL1) {
    appendRecommendation(recommendations, contract.categoryL1, 14, 'category');
  }
  if (contract.categoryL2) {
    appendRecommendation(recommendations, contract.categoryL2, 10, 'subcategory');
  }

  const aiMetadata = (contract.aiMetadata as EnterpriseMetadata) || {};
  if (aiMetadata.jurisdiction) {
    appendRecommendation(recommendations, `jurisdiction-${aiMetadata.jurisdiction}`, 8, 'jurisdiction');
  }
  if (aiMetadata.payment_type) {
    appendRecommendation(recommendations, aiMetadata.payment_type, 6, 'payment type');
  }
  if (aiMetadata.billing_frequency_type) {
    appendRecommendation(recommendations, aiMetadata.billing_frequency_type, 6, 'billing frequency');
  }

  if (contract.signatureStatus === 'unsigned' || contract.signatureStatus === 'partially_signed') {
    appendRecommendation(recommendations, 'pending-signature', 12, 'signature status');
  }

  if (contract.expirationDate) {
    const daysUntilExpiry = Math.ceil((contract.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 30) {
      appendRecommendation(recommendations, 'expiring-soon', 20, 'expiration timeline');
    } else if (daysUntilExpiry <= 90) {
      appendRecommendation(recommendations, 'renewal-window', 12, 'expiration timeline');
    }
  }

  const totalValue = contract.totalValue ? Number(contract.totalValue) : 0;
  if (totalValue >= 1_000_000) {
    appendRecommendation(recommendations, 'high-value', 10, 'contract value');
  } else if (totalValue > 0 && totalValue <= 50_000) {
    appendRecommendation(recommendations, 'low-value', 4, 'contract value');
  }

  const coOccurrenceFilters: Prisma.ContractMetadataWhereInput[] = [];
  if (contract.contractType) {
    coOccurrenceFilters.push({ contract: { contractType: contract.contractType } });
  }
  if (contract.categoryL1) {
    coOccurrenceFilters.push({ contract: { categoryL1: contract.categoryL1 } });
  }

  const metadataTags = await prisma.contractMetadata.findMany({
    where: {
      tenantId: context.tenantId,
      contractId: { not: contractId },
      ...(coOccurrenceFilters.length > 0 ? { OR: coOccurrenceFilters } : {}),
    },
    select: { tags: true },
    take: 200,
  }).catch(() => []);

  const coOccurrenceScores = new Map<string, number>();
  for (const row of metadataTags) {
    for (const tag of row.tags || []) {
      const normalized = normalizeTagName(tag);
      if (!normalized) continue;
      coOccurrenceScores.set(normalized, (coOccurrenceScores.get(normalized) || 0) + 1);
    }
  }

  for (const [tag, score] of coOccurrenceScores.entries()) {
    if (score < 2) continue;
    appendRecommendation(recommendations, tag, Math.min(score, 8), 'co-occurrence');
  }

  const tenantTagNames = await getTenantTagNameSet(context.tenantId);

  const result = Array.from(recommendations.entries())
    .filter(([tag]) => !existingTagSet.has(tag))
    .map(([tag, value]) => ({
      name: tag,
      score: value.score + (tenantTagNames.has(tag) ? 3 : 0),
      reasons: value.reasons,
      source: tenantTagNames.has(tag) ? 'tenant-registry' : 'inference',
    }))
    .sort((first, second) => second.score - first.score)
    .slice(0, Math.max(1, Math.min(20, limit)));

  return createSuccessResponse(context, {
    contractId,
    recommendations: result,
    existingTags: Array.from(existingTagSet),
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
      classificationConf: true,
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
      signatureStatus: true,
      signatureDate: true,
      signatureRequiredFlag: true,
      noticePeriodDays: true,
      terminationClause: true,
      autoRenewalEnabled: true,
      metadata: true,
      aiMetadata: true,
      documentClassification: true,
      documentClassificationConf: true,
      documentClassificationWarning: true,
      createdAt: true,
      updatedAt: true,
      uploadedBy: true,
      metadataVersion: true,
    },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const metadataRecord = await prisma.contractMetadata.findUnique({
    where: { contractId },
    select: { customFields: true, tags: true },
  }).catch(() => null);

  let fieldValidations: Record<string, { status: string; validatedAt?: string }> = {};
  let reviewStatus: { reviewedBy: string; reviewedAt: string } | null = null;
  if (metadataRecord?.customFields) {
    const customFields = metadataRecord.customFields as Record<string, any>;
    fieldValidations = customFields._fieldValidations || {};
    reviewStatus = customFields._reviewStatus || null;
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

  const normalizedSignatureStatus = contract.signatureStatus === 'signed'
    ? 'signed'
    : aiMetadata.signature_status || contract.signatureStatus || 'unknown';
  const normalizedSignatureRequiredFlag = normalizedSignatureStatus === 'signed'
    ? false
    : aiMetadata.signature_required_flag ?? contract.signatureRequiredFlag ?? (
      normalizedSignatureStatus === 'unsigned' ||
      normalizedSignatureStatus === 'partially_signed' ||
      (!aiMetadata.signature_date && normalizedSignatureStatus !== 'signed')
    );

  const enterpriseMetadata: EnterpriseMetadata = {
    document_number: aiMetadata.document_number || contract.id,
    document_title: aiMetadata.document_title || contract.contractTitle || contract.fileName || '',
    document_classification: (aiMetadata.document_classification || contract.documentClassification || 'contract') as EnterpriseMetadata['document_classification'],
    document_classification_confidence: aiMetadata.document_classification_confidence ?? contract.documentClassificationConf ?? contract.classificationConf ?? undefined,
    document_classification_warning: (aiMetadata.document_classification_warning || contract.documentClassificationWarning) ?? undefined,
    contract_short_description: aiMetadata.contract_short_description || contract.description || artifactOverview?.summary || '',
    external_parties: normalizedParties,
    tcv_amount: aiMetadata.tcv_amount || (contract.totalValue ? Number(contract.totalValue) : 0) || (artifactOverview?.totalValue ? Number(artifactOverview.totalValue) : 0),
    tcv_text: aiMetadata.tcv_text || '',
    payment_type: aiMetadata.payment_type || '',
    billing_frequency_type: aiMetadata.billing_frequency_type || contract.paymentFrequency || '',
    periodicity: aiMetadata.periodicity || contract.billingCycle || '',
    currency: aiMetadata.currency || contract.currency || artifactOverview?.currency || 'USD',
    signature_date: aiMetadata.signature_date || contract.signatureDate?.toISOString().split('T')[0] || null,
    signature_status: normalizedSignatureStatus as EnterpriseMetadata['signature_status'],
    signature_required_flag: normalizedSignatureRequiredFlag,
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
    tags: metadataRecord?.tags || aiMetadata.tags || (Array.isArray(contract.tags) ? contract.tags as string[] : []),
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
    reviewStatus,
    metadataVersion: contract.metadataVersion ?? 1,
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
  const metadataVersionFromRequest = body.metadataVersion; // Client sends current version for optimistic locking
  const parsed = metadataPutSchema.safeParse(rawMetadata);

  if (!parsed.success) {
    return createErrorResponse(
      context,
      'VALIDATION_ERROR',
      'Invalid metadata payload',
      400,
      { details: JSON.stringify(parsed.error.flatten()) },
    );
  }

  const metadata: Record<string, any> = { ...parsed.data };
  if (metadata.tags !== undefined) {
    metadata.tags = await validateOrRegisterTenantTags(context.tenantId, metadata.tags, {
      createdBy: context.userId,
    });
  }
  const existingContract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
    select: { aiMetadata: true, metadata: true, signatureStatus: true, signatureRequiredFlag: true, metadataVersion: true },
  });

  if (!existingContract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  // Optimistic locking: check if version matches
  if (metadataVersionFromRequest !== undefined && metadataVersionFromRequest !== existingContract.metadataVersion) {
    return createErrorResponse(
      context,
      'CONFLICT',
      'Metadata has been modified by another user. Please refresh and try again.',
      409,
      { details: JSON.stringify({ currentVersion: existingContract.metadataVersion, providedVersion: metadataVersionFromRequest }) },
    );
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
  const effectiveSignatureStatus = metadata.signature_status !== undefined
    ? (metadata.signature_status || 'unknown')
    : (existingContract.signatureStatus === 'signed'
      ? 'signed'
      : existingAiMetadata.signature_status || existingContract.signatureStatus || 'unknown');
  const shouldWriteSignatureRequiredFlag = metadata.signature_required_flag !== undefined || effectiveSignatureStatus === 'signed';
  const effectiveSignatureRequiredFlag = effectiveSignatureStatus === 'signed'
    ? false
    : metadata.signature_required_flag;
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
    ...(metadata.signature_status !== undefined && { signature_status: effectiveSignatureStatus }),
    ...(shouldWriteSignatureRequiredFlag && { signature_required_flag: effectiveSignatureRequiredFlag ?? false }),
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
  if (metadata.document_title !== undefined) legacyUpdates.contractTitle = metadata.document_title || null;
  if (metadata.contractType !== undefined) {
    const normalizedContractType = metadata.contractType.trim();
    legacyUpdates.contractType = normalizedContractType ? normalizedContractType : null;
  }
  if (metadata.contract_short_description !== undefined) legacyUpdates.description = metadata.contract_short_description || null;
  if (metadata.tcv_amount !== undefined) legacyUpdates.totalValue = metadata.tcv_amount;
  if (metadata.currency !== undefined) legacyUpdates.currency = metadata.currency || null;
  if (metadata.signature_date !== undefined) legacyUpdates.signatureDate = toNullableMetadataDate(metadata.signature_date);
  if (metadata.signature_status !== undefined) legacyUpdates.signatureStatus = effectiveSignatureStatus;
  if (shouldWriteSignatureRequiredFlag) legacyUpdates.signatureRequiredFlag = effectiveSignatureRequiredFlag ?? false;
  if (metadata.start_date !== undefined) {
    const startDate = toNullableMetadataDate(metadata.start_date);
    legacyUpdates.effectiveDate = startDate;
    legacyUpdates.startDate = startDate;
  }
  if (metadata.end_date !== undefined) {
    const endDate = toNullableMetadataDate(metadata.end_date);
    legacyUpdates.expirationDate = endDate;
    legacyUpdates.endDate = endDate;
    applyExpirationState(legacyUpdates, endDate);
  }
  if (metadata.jurisdiction !== undefined) legacyUpdates.jurisdiction = metadata.jurisdiction || null;
  if (metadata.notice_period_days !== undefined) legacyUpdates.noticePeriodDays = metadata.notice_period_days;
  if (metadata.billing_frequency_type !== undefined) legacyUpdates.paymentFrequency = metadata.billing_frequency_type || null;
  if (metadata.periodicity !== undefined) legacyUpdates.billingCycle = metadata.periodicity || null;
  if (metadata.tags !== undefined) legacyUpdates.tags = metadata.tags;
  if (metadata.document_classification !== undefined) legacyUpdates.documentClassification = metadata.document_classification;
  if (metadata.document_classification_confidence !== undefined) legacyUpdates.documentClassificationConf = metadata.document_classification_confidence;
  if (metadata.document_classification_warning !== undefined) legacyUpdates.documentClassificationWarning = metadata.document_classification_warning || null;

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

  if (metadata.contractCategoryId !== undefined) {
    legacyUpdates.contractCategoryId = metadata.contractCategoryId || null;
  }

  const updatedContract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      aiMetadata: updatedAiMetadata as any,
      ...legacyUpdates,
      metadataVersion: (existingContract.metadataVersion || 1) + 1, // Increment version on update
      updatedAt: new Date(),
    },
  });

  // Keep ContractMetadata.tags in sync with the scalar tags array.
  if (metadata.tags !== undefined) {
    try {
      await prisma.contractMetadata.upsert({
        where: { contractId },
        create: {
          contractId,
          tenantId: context.tenantId,
          tags: metadata.tags || [],
          updatedBy: context.userId ?? 'system',
        },
        update: {
          tags: metadata.tags || [],
          updatedBy: context.userId ?? 'system',
          lastUpdated: new Date(),
        },
      });
    } catch (error) {
      logger.warn('Failed to sync ContractMetadata.tags', { error: (error as Error).message, contractId });
    }
  }

  // Any metadata edit invalidates a prior contract-level review sign-off —
  // a stale review must not linger after values change.
  try {
    const metadataRecord = await prisma.contractMetadata.findUnique({
      where: { contractId },
      select: { customFields: true },
    });
    const reviewCustomFields = (metadataRecord?.customFields as Record<string, any>) || null;
    if (reviewCustomFields && reviewCustomFields._reviewStatus) {
      delete reviewCustomFields._reviewStatus;
      await prisma.contractMetadata.update({
        where: { contractId },
        data: {
          customFields: reviewCustomFields as Prisma.InputJsonValue,
          lastUpdated: new Date(),
          updatedBy: context.userId ?? 'system',
        },
      });
    }
  } catch (error) {
    logger.warn('Failed to clear metadata review status', { error: (error as Error).message, contractId });
  }

  const updatedFields = Object.keys(metadata).filter((field) =>
    Object.keys(metadataPutSchema.shape).includes(field),
  );

  const sideEffects = await applyContractChangeSideEffects({
    tenantId: context.tenantId,
    contractId: updatedContract.id,
    userId: context.userId,
    changedFields: updatedFields,
    source: 'api:contracts/[id]/metadata',
    audit: {
      action: AuditAction.CONTRACT_UPDATED,
      changes: legacyUpdates,
    },
  });

  return createSuccessResponse(context, {
    success: true,
    data: {
      id: updatedContract.id,
      enterpriseMetadata: updatedAiMetadata,
      metadataVersion: updatedContract.metadataVersion,
      ragReindexQueued: sideEffects.ragReindexQueued,
    },
    message: sideEffects.ragReindexQueued
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

  const normalizedTags = await validateOrRegisterTenantTags(context.tenantId, tags, {
    createdBy: context.userId,
  });
  if (normalizedTags.length === 0) {
    return createErrorResponse(context, 'BAD_REQUEST', 'tags array must include at least one valid tag', 400);
  }

  const contract = await findTenantContract(contractId, context.tenantId);
  if (!contract) {
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
      'You do not have permission to edit tags on this contract',
      403,
    );
  }

  await metadataEditorService.addTags(
    contractId,
    context.tenantId,
    normalizedTags,
    context.userId,
  );

  // Keep the legacy Contract.tags array in sync with ContractMetadata.tags.
  const metadataRecord = await prisma.contractMetadata.findUnique({
    where: { contractId },
    select: { tags: true },
  });
  const contractRecord = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { aiMetadata: true },
  });
  const currentAiMetadata = (contractRecord?.aiMetadata as Record<string, unknown>) || {};

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      tags: metadataRecord?.tags || [],
      aiMetadata: {
        ...currentAiMetadata,
        tags: metadataRecord?.tags || [],
      } as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });

  await applyContractChangeSideEffects({
    tenantId: context.tenantId,
    contractId,
    userId: context.userId,
    changedFields: ['tags'],
    source: 'api:contracts/[id]/metadata/tags',
  });

  return createSuccessResponse(context, {
    message: 'Tags added successfully',
    tags: normalizedTags,
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
      'You do not have permission to edit tags on this contract',
      403,
    );
  }

  const tagName = normalizeTagName(decodeURIComponent(rawTagName));
  await metadataEditorService.removeTag(
    contractId,
    context.tenantId,
    tagName,
    context.userId,
  );

  const metadataRecord = await prisma.contractMetadata.findUnique({
    where: { contractId },
    select: { tags: true },
  });
  const contractRecord = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { aiMetadata: true },
  });
  const currentAiMetadata = (contractRecord?.aiMetadata as Record<string, unknown>) || {};

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      tags: metadataRecord?.tags || [],
      aiMetadata: {
        ...currentAiMetadata,
        tags: metadataRecord?.tags || [],
      } as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });

  await applyContractChangeSideEffects({
    tenantId: context.tenantId,
    contractId,
    userId: context.userId,
    changedFields: ['tags'],
    source: 'api:contracts/[id]/metadata/tags',
  });

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

async function mirrorValidatedFieldToContract(
  contractId: string,
  fieldKey: string,
  newValue: unknown,
): Promise<string[]> {
  const aiUpdates: Record<string, unknown> = {};
  const legacyUpdates: Record<string, unknown> = {};

  switch (fieldKey) {
    case 'document_title':
      aiUpdates.document_title = newValue;
      legacyUpdates.contractTitle = newValue;
      break;
    case 'contract_short_description':
      aiUpdates.contract_short_description = newValue;
      legacyUpdates.description = newValue;
      break;
    case 'tcv_amount':
      aiUpdates.tcv_amount = newValue;
      legacyUpdates.totalValue = newValue;
      break;
    case 'currency':
      aiUpdates.currency = newValue;
      legacyUpdates.currency = newValue;
      break;
    case 'start_date':
      aiUpdates.start_date = newValue;
      legacyUpdates.effectiveDate = toNullableMetadataDate(String(newValue));
      legacyUpdates.startDate = toNullableMetadataDate(String(newValue));
      break;
    case 'end_date':
      aiUpdates.end_date = newValue;
      legacyUpdates.expirationDate = toNullableMetadataDate(String(newValue));
      legacyUpdates.endDate = toNullableMetadataDate(String(newValue));
      break;
    case 'termination_date':
      aiUpdates.termination_date = newValue;
      break;
    case 'jurisdiction':
      aiUpdates.jurisdiction = newValue;
      legacyUpdates.jurisdiction = newValue;
      break;
    case 'tags':
      aiUpdates.tags = Array.isArray(newValue) ? newValue : [];
      legacyUpdates.tags = Array.isArray(newValue) ? newValue : [];
      break;
    case 'signature_date':
      aiUpdates.signature_date = newValue;
      legacyUpdates.signatureDate = toNullableMetadataDate(String(newValue));
      break;
    case 'signature_status':
      aiUpdates.signature_status = newValue;
      legacyUpdates.signatureStatus = newValue;
      break;
    case 'notice_period_days':
      aiUpdates.notice_period_days = newValue;
      legacyUpdates.noticePeriodDays = newValue;
      break;
    case 'contract_language':
      aiUpdates.contract_language = newValue;
      break;
    case 'document_classification':
      aiUpdates.document_classification = newValue;
      legacyUpdates.documentClassification = newValue;
      break;
    case 'document_classification_confidence':
      aiUpdates.document_classification_confidence = newValue;
      legacyUpdates.documentClassificationConf = newValue;
      break;
    case 'document_classification_warning':
      aiUpdates.document_classification_warning = newValue;
      legacyUpdates.documentClassificationWarning = newValue;
      break;
    default:
      return [];
  }

  if (Object.keys(aiUpdates).length === 0) return [];

  const existing = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { aiMetadata: true },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      aiMetadata: {
        ...((existing?.aiMetadata as Record<string, unknown>) || {}),
        ...aiUpdates,
      } as Prisma.InputJsonValue,
      ...legacyUpdates,
      updatedAt: new Date(),
    },
  });

  return Object.keys(legacyUpdates).concat(Object.keys(aiUpdates));
}

export async function putContractMetadataValidation(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const body = await request.json();
  const { fieldKey, action, newValue, reason, allFields, resetAll, fieldKeys, markReviewed } = body;

  const contract = await findTenantContract(contractId, context.tenantId);
  if (!contract) {
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
      'You do not have permission to validate metadata on this contract',
      403,
    );
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
          customFields: customFields as any,
          lastUpdated: new Date(),
          updatedBy: context.userId ?? 'system',
        },
      });
    }

    return createSuccessResponse(context, {
      success: true,
      message: 'All verifications have been reset',
      data: { contractId },
    });
  }

  // Bulk verify: persist one _fieldValidations entry per key — the only thing
  // the GET endpoint reads back. `allFields` is accepted for one release for
  // backward compatibility, but its values are ignored (keys only); field
  // values are never merged into customFields.
  const bulkKeys: string[] = Array.isArray(fieldKeys)
    ? fieldKeys.filter((key): key is string => typeof key === 'string' && key.length > 0)
    : allFields && typeof allFields === 'object'
      ? Object.keys(allFields)
      : [];

  if (bulkKeys.length > 0) {
    try {
      const existing = await prisma.contractMetadata.findUnique({
        where: { contractId },
      });

      const now = new Date();
      const customFields = ((existing?.customFields as Record<string, any>) || {}) as Record<string, any>;
      const validations = (customFields._fieldValidations || {}) as Record<string, unknown>;
      for (const key of bulkKeys) {
        validations[key] = {
          status: 'validate',
          validatedAt: now.toISOString(),
          validatedBy: context.userId ?? 'system',
        };
      }
      customFields._fieldValidations = validations;

      if (existing) {
        await prisma.contractMetadata.update({
          where: { contractId },
          data: {
            customFields: customFields as Prisma.InputJsonValue,
            lastUpdated: now,
            updatedBy: context.userId ?? 'system',
          },
        });
      } else {
        await prisma.contractMetadata.create({
          data: {
            contractId,
            tenantId: context.tenantId,
            customFields: customFields as Prisma.InputJsonValue,
            systemFields: {},
            tags: [],
            lastUpdated: now,
            updatedBy: context.userId ?? 'system',
          },
        });
      }

      return createSuccessResponse(context, {
        success: true,
        message: 'All validated metadata saved successfully',
        data: { contractId, fieldCount: bulkKeys.length },
      });
    } catch {
      // Demo mode fallback — continue with non-persistent response below.
    }
  }

  // Contract-level review sign-off (exception-based review model): records
  // that a human reviewed all flagged fields. Cleared server-side by
  // putContractMetadata() whenever metadata is edited afterwards.
  if (markReviewed === true) {
    try {
      const existing = await prisma.contractMetadata.findUnique({
        where: { contractId },
      });

      const now = new Date();
      const reviewStatus = {
        reviewedBy: context.userId ?? 'system',
        reviewedAt: now.toISOString(),
      };
      const customFields = {
        ...((existing?.customFields as Record<string, unknown>) || {}),
        _reviewStatus: reviewStatus,
      };

      if (existing) {
        await prisma.contractMetadata.update({
          where: { contractId },
          data: {
            customFields: customFields as Prisma.InputJsonValue,
            lastUpdated: now,
            updatedBy: context.userId ?? 'system',
          },
        });
      } else {
        await prisma.contractMetadata.create({
          data: {
            contractId,
            tenantId: context.tenantId,
            customFields: customFields as Prisma.InputJsonValue,
            systemFields: {},
            tags: [],
            lastUpdated: now,
            updatedBy: context.userId ?? 'system',
          },
        });
      }

      try {
        await auditLog({
          tenantId: context.tenantId,
          userId: context.userId,
          action: AuditAction.CONTRACT_UPDATED,
          resourceType: 'Contract',
          resourceId: contractId,
          metadata: { review: 'metadata_confirmed_reviewed', reviewedAt: reviewStatus.reviewedAt },
        });
      } catch (auditError) {
        logger.warn('Failed to write metadata review audit entry', { error: (auditError as Error).message, contractId });
      }

      return createSuccessResponse(context, {
        success: true,
        message: 'Contract metadata marked as reviewed',
        data: { contractId, reviewStatus },
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
    validatedBy: context.userId ?? 'system',
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
          updatedBy: context.userId ?? 'system',
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
          customFields: customFields as any,
          systemFields: {},
          tags: [],
          lastUpdated: new Date(),
          updatedBy: context.userId ?? 'system',
        },
      });
    }
  } catch (dbError) {
    logger.error('Failed to persist field validation:', dbError);
  }

  // When a validator corrects a known metadata field, mirror the value back to
  // the contract scalars and aiMetadata so it is visible everywhere.
  let mirroredFields: string[] = [];
  if (action === 'modify') {
    try {
      mirroredFields = await mirrorValidatedFieldToContract(contractId, fieldKey, newValue);
    } catch (error) {
      logger.warn('Failed to mirror validated field to contract', { error: (error as Error).message, contractId, fieldKey });
    }
  }

  if (mirroredFields.length > 0) {
    await applyContractChangeSideEffects({
      tenantId: context.tenantId,
      contractId,
      userId: context.userId,
      changedFields: mirroredFields,
      source: 'api:contracts/[id]/metadata/validate',
    });
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
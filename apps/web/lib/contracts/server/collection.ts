import { ContractStatus, type Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  type ContractApiContext,
} from '@/lib/api-middleware';
import { checkETagMatch, CacheDuration } from '@/lib/api-cache-headers';
import { withCache, CacheKeys } from '@/lib/cache';
import { apiCache, etagHeaders } from '@/lib/cache/etag-cache';
import { logger } from '@/lib/logger';

const UI_STATUS_ALIASES: Record<string, ContractStatus[]> = {
  uploaded: [ContractStatus.UPLOADED, ContractStatus.PENDING, ContractStatus.DRAFT],
  pending: [ContractStatus.UPLOADED, ContractStatus.PENDING, ContractStatus.DRAFT],
  processing: [ContractStatus.PROCESSING, ContractStatus.QUEUED],
  queued: [ContractStatus.QUEUED, ContractStatus.PROCESSING],
  completed: [ContractStatus.COMPLETED, ContractStatus.ACTIVE],
  active: [ContractStatus.ACTIVE, ContractStatus.COMPLETED],
  failed: [ContractStatus.FAILED],
  archived: [ContractStatus.ARCHIVED, ContractStatus.CANCELLED, ContractStatus.EXPIRED],
  cancelled: [ContractStatus.CANCELLED],
  expired: [ContractStatus.EXPIRED],
  draft: [ContractStatus.DRAFT],
};

type OrganizeGroupBy =
  | 'status'
  | 'contractType'
  | 'category'
  | 'clientName'
  | 'supplierName'
  | 'expirationMonth'
  | 'uploadMonth'
  | 'valueRange';

interface OrganizedGroup {
  key: string;
  label: string;
  count: number;
  totalValue: number;
  contracts: Array<{
    id: string;
    title: string;
    status: string;
    totalValue: number | null;
    expirationDate: string | null;
  }>;
}

function mapOrganizedContract(contract: {
  id: string;
  contractTitle: string | null;
  originalName: string | null;
  fileName: string;
  status: string;
  totalValue: Prisma.Decimal | number | null;
  expirationDate: Date | null;
}) {
  return {
    id: contract.id,
    title: contract.contractTitle || contract.originalName || contract.fileName,
    status: contract.status.toLowerCase(),
    totalValue: contract.totalValue ? Number(contract.totalValue) : null,
    expirationDate: contract.expirationDate?.toISOString() || null,
  };
}

function getOrganizeConfig(groupBy: OrganizeGroupBy) {
  switch (groupBy) {
    case 'status':
      return {
        groupField: 'status',
        labelGenerator: (key: string | null) => key?.toLowerCase() || 'unknown',
      };
    case 'contractType':
      return {
        groupField: 'contractType',
        labelGenerator: (key: string | null) => key || 'Unspecified',
      };
    case 'category':
      return {
        groupField: 'category',
        labelGenerator: (key: string | null) => key || 'Uncategorized',
      };
    case 'clientName':
      return {
        groupField: 'clientName',
        labelGenerator: (key: string | null) => key || 'Unknown Client',
      };
    case 'supplierName':
      return {
        groupField: 'supplierName',
        labelGenerator: (key: string | null) => key || 'Unknown Supplier',
      };
    case 'expirationMonth':
    case 'uploadMonth':
    case 'valueRange':
      return {
        groupField: 'custom',
        labelGenerator: (key: string | null) => key || 'Unknown',
      };
    default:
      return {
        groupField: 'status',
        labelGenerator: (key: string | null) => key?.toLowerCase() || 'unknown',
      };
  }
}

function mapContractStatusToUi(status: ContractStatus): string {
  switch (status) {
    case ContractStatus.COMPLETED:
    case ContractStatus.ACTIVE:
      return 'completed';
    case ContractStatus.PROCESSING:
    case ContractStatus.QUEUED:
      return 'processing';
    case ContractStatus.FAILED:
      return 'failed';
    case ContractStatus.ARCHIVED:
    case ContractStatus.CANCELLED:
    case ContractStatus.EXPIRED:
      return 'archived';
    case ContractStatus.UPLOADED:
    case ContractStatus.PENDING:
    case ContractStatus.DRAFT:
    default:
      return 'uploaded';
  }
}

export async function getContractsCollection(
  request: NextRequest,
  context: ContractApiContext,
) {
  try {
    const startTime = Date.now();
    const { searchParams } = new URL(request.url);

    const tenantId = context.tenantId;
    if (!tenantId) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const search = searchParams.get('search') || undefined;
    const statuses = searchParams.getAll('status');
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20;

    const validSortFields = [
      'createdAt', 'updatedAt', 'uploadedAt', 'totalValue',
      'expirationDate', 'effectiveDate', 'contractTitle',
      'clientName', 'supplierName', 'viewCount', 'lastViewedAt',
    ];
    const requestedSortBy = searchParams.get('sortBy') || 'createdAt';
    const sortBy = validSortFields.includes(requestedSortBy) ? requestedSortBy : 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const cursor = searchParams.get('cursor') || undefined;

    const contractTypes = searchParams.getAll('contractType');
    const categories = searchParams.getAll('category');
    const documentRoles = searchParams.getAll('documentRole');
    const riskLevels = searchParams.getAll('riskLevel');
    const clientNames = searchParams.getAll('clientName');
    const supplierNames = searchParams.getAll('supplierName');
    const currencies = searchParams.getAll('currency');
    const jurisdictions = searchParams.getAll('jurisdiction');
    const paymentTerms = searchParams.getAll('paymentTerms');
    const signatureStatuses = searchParams.getAll('signatureStatus');
    const documentClassifications = searchParams.getAll('documentClassification');
    const expirationFilters = searchParams.getAll('expirationFilter');
    const minValue = searchParams.get('minValue') ? Number(searchParams.get('minValue')) : undefined;
    const maxValue = searchParams.get('maxValue') ? Number(searchParams.get('maxValue')) : undefined;
    const expiringBefore = searchParams.get('expiringBefore');
    const expiringAfter = searchParams.get('expiringAfter');
    const uploadedAfter = searchParams.get('uploadedAfter');
    const uploadedBefore = searchParams.get('uploadedBefore');
    const hasDeadline = searchParams.get('hasDeadline') === 'true';
    const isExpiring = searchParams.get('isExpiring') === 'true';

    if (page < 1) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Page must be greater than 0', 400);
    }
    if (limit < 1 || limit > 100) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Limit must be between 1 and 100', 400);
    }

    const validStatuses: ContractStatus[] = Array.from(
      new Set(
        statuses.flatMap((status) => {
          const normalized = status.trim().toLowerCase();
          if (UI_STATUS_ALIASES[normalized]) {
            return UI_STATUS_ALIASES[normalized];
          }

          return Object.values(ContractStatus).includes(status as ContractStatus)
            ? [status as ContractStatus]
            : [];
        }),
      ),
    );

    const where: Prisma.ContractWhereInput = {
      tenantId,
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
        { contractTitle: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { contractType: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (validStatuses.length > 0) {
      where.status = { in: validStatuses };
    }
    if (contractTypes.length > 0) {
      where.contractType = { in: contractTypes };
    }
    if (categories.length > 0) {
      const existingAnd = where.AND;
      const categoryFilter: Prisma.ContractWhereInput = {
        OR: [
          { contractCategoryId: { in: categories } },
          { category: { in: categories } },
          { categoryL1: { in: categories } },
          { categoryL2: { in: categories } },
        ],
      };
      where.AND = existingAnd
        ? [...(Array.isArray(existingAnd) ? existingAnd : [existingAnd]), categoryFilter]
        : [categoryFilter];
    }
    if (documentRoles.length > 0) {
      where.documentRole = { in: documentRoles };
    }
    if (clientNames.length > 0) {
      where.clientName = { in: clientNames };
    }
    if (supplierNames.length > 0) {
      where.supplierName = { in: supplierNames };
    }
    if (currencies.length > 0) {
      where.currency = { in: currencies };
    }
    if (jurisdictions.length > 0) {
      where.jurisdiction = { in: jurisdictions };
    }
    if (paymentTerms.length > 0) {
      where.paymentTerms = { in: paymentTerms };
    }
    if (signatureStatuses.length > 0) {
      where.signatureStatus = { in: signatureStatuses };
    }
    if (documentClassifications.length > 0) {
      where.documentClassification = { in: documentClassifications };
    }

    if (minValue !== undefined || maxValue !== undefined) {
      where.totalValue = {};
      if (minValue !== undefined) where.totalValue.gte = minValue;
      if (maxValue !== undefined) where.totalValue.lte = maxValue;
    }

    if (expiringBefore || expiringAfter) {
      where.expirationDate = {};
      if (expiringBefore) where.expirationDate.lte = new Date(expiringBefore);
      if (expiringAfter) where.expirationDate.gte = new Date(expiringAfter);
    }

    if (uploadedAfter || uploadedBefore) {
      where.uploadedAt = {};
      if (uploadedAfter) where.uploadedAt.gte = new Date(uploadedAfter);
      if (uploadedBefore) where.uploadedAt.lte = new Date(uploadedBefore);
    }

    const andFilters: Prisma.ContractWhereInput[] = [];

    if (riskLevels.length > 0) {
      const riskClauses: Prisma.ContractWhereInput[] = [];
      if (riskLevels.includes('low')) {
        riskClauses.push({ contractMetadata: { riskScore: { gte: 0, lt: 30 } } });
      }
      if (riskLevels.includes('medium')) {
        riskClauses.push({ contractMetadata: { riskScore: { gte: 30, lt: 70 } } });
      }
      if (riskLevels.includes('high')) {
        riskClauses.push({ contractMetadata: { riskScore: { gte: 70 } } });
      }
      if (riskClauses.length > 0) {
        andFilters.push({ OR: riskClauses });
      }
    }

    if (expirationFilters.length > 0) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const in7Days = new Date(today);
      in7Days.setDate(in7Days.getDate() + 7);
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);
      const in90Days = new Date(today);
      in90Days.setDate(in90Days.getDate() + 90);

      const expirationClauses: Prisma.ContractWhereInput[] = [];
      if (expirationFilters.includes('expired')) {
        expirationClauses.push({ expirationDate: { lt: today } });
      }
      if (expirationFilters.includes('expiring-7')) {
        expirationClauses.push({ expirationDate: { gte: today, lte: in7Days } });
      }
      if (expirationFilters.includes('expiring-30')) {
        expirationClauses.push({ expirationDate: { gte: today, lte: in30Days } });
      }
      if (expirationFilters.includes('expiring-90')) {
        expirationClauses.push({ expirationDate: { gte: today, lte: in90Days } });
      }
      if (expirationFilters.includes('no-expiry')) {
        expirationClauses.push({ expirationDate: null });
      }
      if (expirationClauses.length > 0) {
        andFilters.push({ OR: expirationClauses });
      }
    }

    if (hasDeadline) {
      andFilters.push({ expirationDate: { not: null } });
    }

    if (isExpiring) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);
      andFilters.push({ expirationDate: { gte: today, lte: in30Days } });
    }

    if (andFilters.length > 0) {
      const existingAnd = where.AND;
      where.AND = existingAnd
        ? [...(Array.isArray(existingAnd) ? existingAnd : [existingAnd]), ...andFilters]
        : andFilters;
    }

    let skipAmount = (page - 1) * limit;
    if (cursor) {
      if (sortBy !== 'createdAt') {
        logger.warn('[ContractList] Cursor pagination requested with non-createdAt sort, falling back to offset', { sortBy });
      } else {
        try {
          const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
          const { createdAt: cursorCreatedAt, id: cursorId } = decoded;
          const cursorWhere: Prisma.ContractWhereInput = {
            OR: sortOrder === 'desc'
              ? [
                  { createdAt: { lt: new Date(cursorCreatedAt) } },
                  { createdAt: new Date(cursorCreatedAt), id: { lt: cursorId } },
                ]
              : [
                  { createdAt: { gt: new Date(cursorCreatedAt) } },
                  { createdAt: new Date(cursorCreatedAt), id: { gt: cursorId } },
                ],
          };
          const existingAnd = where.AND;
          where.AND = existingAnd
            ? [...(Array.isArray(existingAnd) ? existingAnd : [existingAnd]), cursorWhere]
            : [cursorWhere];
          skipAmount = 0;
        } catch {
          return createErrorResponse(context, 'VALIDATION_ERROR', 'Invalid cursor', 400);
        }
      }
    }

    const orderBy: Record<string, string> = {};
    orderBy[sortBy] = sortOrder;

    const cacheKey = CacheKeys.contractsList({
      tenantId,
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      statuses,
      contractTypes,
      categories,
      documentRoles,
      riskLevels,
      clientNames,
      supplierNames,
      currencies,
      jurisdictions,
      paymentTerms,
      signatureStatuses,
      documentClassifications,
      expirationFilters,
      minValue,
      maxValue,
      expiringBefore,
      expiringAfter,
      uploadedAfter,
      uploadedBefore,
      hasDeadline,
      isExpiring,
    });

    const cachedResult = await withCache(
      cacheKey,
      async () => {
        const { prisma } = await import('@/lib/prisma');

        const [contracts, total] = await Promise.all([
          prisma.contract.findMany({
            where,
            orderBy,
            skip: skipAmount,
            take: limit,
            select: {
              id: true,
              tenantId: true,
              fileName: true,
              originalName: true,
              fileSize: true,
              mimeType: true,
              createdAt: true,
              updatedAt: true,
              uploadedAt: true,
              status: true,
              contractType: true,
              contractTitle: true,
              contractCategoryId: true,
              documentRole: true,
              clientName: true,
              supplierName: true,
              category: true,
              categoryL1: true,
              categoryL2: true,
              totalValue: true,
              currency: true,
              effectiveDate: true,
              expirationDate: true,
              description: true,
              tags: true,
              viewCount: true,
              lastViewedAt: true,
              jurisdiction: true,
              paymentTerms: true,
              paymentFrequency: true,
              aiMetadata: true,
              parentContractId: true,
              relationshipType: true,
              signatureStatus: true,
              signatureDate: true,
              signatureRequiredFlag: true,
              documentClassification: true,
              documentClassificationConf: true,
              documentClassificationWarning: true,
              parentContract: {
                select: {
                  id: true,
                  contractTitle: true,
                  fileName: true,
                  contractType: true,
                },
              },
              contractMetadata: {
                select: {
                  riskScore: true,
                },
              },
              _count: {
                select: {
                  childContracts: true,
                  artifacts: true,
                },
              },
            },
          }),
          prisma.contract.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);
        const categoryKeys = [...new Set(contracts
          .filter((contract) => contract.contractCategoryId || contract.category || (contract as any).categoryL1)
          .map((contract) => contract.contractCategoryId || contract.category || (contract as any).categoryL1!))];
        const categoryMap: Map<string, { id: string; name: string; color: string; icon: string; path: string }> = new Map();

        if (categoryKeys.length > 0) {
          const taxonomyCategories = await prisma.taxonomyCategory.findMany({
            where: {
              tenantId,
              OR: [
                { id: { in: categoryKeys } },
                { name: { in: categoryKeys } },
              ],
            },
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
              path: true,
            },
          });

          for (const category of taxonomyCategories) {
            categoryMap.set(category.id, category);
            categoryMap.set(category.name, category);
          }
        }

        const staleNoArtifactsMs = 90 * 1000;
        const staleHardCeilingMs = 10 * 60 * 1000;
        const runningJobContractIds = new Set<string>();
        try {
          const runningJobs = await prisma.processingJob.findMany({
            where: {
              tenantId,
              status: 'RUNNING',
              startedAt: { gte: new Date(Date.now() - 3 * 60 * 1000) },
            },
            select: { contractId: true },
          });
          for (const job of runningJobs) runningJobContractIds.add(job.contractId);
        } catch {
          // Best-effort protection against resolving active work.
        }

        const staleContractIds: string[] = [];
        for (const contract of contracts) {
          if (contract.status !== 'PROCESSING') continue;
          if (runningJobContractIds.has(contract.id)) continue;
          const meta = contract.aiMetadata as any;
          const expected = meta?.expectedArtifactCount || 15;
          const actual = (contract as any)._count?.artifacts || 0;
          const artifactProgress = Math.min(Math.round((actual / expected) * 100), 99);
          const lastTouch = contract.updatedAt || contract.createdAt;
          const staleSinceMs = Date.now() - new Date(lastTouch).getTime();
          const isStaleNoArtifacts = artifactProgress === 0 && staleSinceMs > staleNoArtifactsMs;
          const isStaleHardCeiling = staleSinceMs > staleHardCeilingMs;
          if (isStaleNoArtifacts || isStaleHardCeiling) {
            staleContractIds.push(contract.id);
          }
        }

        const staleWithArtifacts: string[] = [];
        const staleWithoutArtifacts: string[] = [];
        for (const contract of contracts) {
          if (!staleContractIds.includes(contract.id)) continue;
          const count = (contract as any)._count?.artifacts || 0;
          if (count > 0) staleWithArtifacts.push(contract.id);
          else staleWithoutArtifacts.push(contract.id);
        }

        if (staleWithArtifacts.length > 0) {
          try {
            await prisma.contract.updateMany({
              where: { id: { in: staleWithArtifacts }, tenantId, status: 'PROCESSING' },
              data: { status: 'COMPLETED', updatedAt: new Date() },
            });
          } catch (error) {
            logger.warn('Failed to auto-resolve stale contracts', { tenantId, staleContractIds: staleWithArtifacts, error });
          }
        }
        if (staleWithoutArtifacts.length > 0) {
          try {
            await prisma.contract.updateMany({
              where: { id: { in: staleWithoutArtifacts }, tenantId, status: 'PROCESSING' },
              data: { status: 'FAILED', updatedAt: new Date() },
            });
          } catch (error) {
            logger.warn('Failed to auto-resolve stale contracts as FAILED', { tenantId, staleContractIds: staleWithoutArtifacts, error });
          }
        }
        if (staleContractIds.length > 0) {
          logger.info(`Auto-resolved ${staleContractIds.length} stale processing contract(s)`, {
            tenantId,
            completed: staleWithArtifacts.length,
            failed: staleWithoutArtifacts.length,
          });
        }

        const staleIdSet = new Set(staleContractIds);
        const failedIdSet = new Set(staleWithoutArtifacts);

        return {
          success: true,
          data: {
            contracts: contracts.map((contract) => {
              const categoryInfo = (contract.contractCategoryId ? categoryMap.get(contract.contractCategoryId) : null)
                || (contract.category ? categoryMap.get(contract.category) : null)
                || ((contract as any).categoryL1 ? categoryMap.get((contract as any).categoryL1) : null);

              let effectiveStatus = mapContractStatusToUi(contract.status);
              if (staleIdSet.has(contract.id)) {
                effectiveStatus = failedIdSet.has(contract.id) ? 'failed' : 'completed';
              }

              return {
                id: contract.id,
                title: contract.contractTitle || contract.originalName || contract.fileName,
                filename: contract.fileName,
                originalName: contract.originalName || contract.fileName,
                status: effectiveStatus,
                fileSize: contract.fileSize.toString(),
                mimeType: contract.mimeType,
                uploadedAt: contract.uploadedAt?.toISOString() || contract.createdAt.toISOString(),
                createdAt: contract.createdAt.toISOString(),
                type: contract.contractType || 'Unknown',
                contractType: contract.contractType || 'Unknown',
                parties: {
                  client: contract.clientName || null,
                  supplier: contract.supplierName || null,
                },
                documentRole: contract.documentRole,
                clientName: contract.clientName,
                supplierName: contract.supplierName,
                vendor: contract.supplierName || contract.clientName,
                counterparty: contract.clientName || contract.supplierName,
                category: categoryInfo
                  ? {
                      id: categoryInfo.id,
                      name: categoryInfo.name,
                      color: categoryInfo.color,
                      icon: categoryInfo.icon,
                      path: categoryInfo.path,
                    }
                  : null,
                value: contract.totalValue ? Number(contract.totalValue) : null,
                riskScore: (contract as any).contractMetadata?.riskScore ?? null,
                totalValue: contract.totalValue ? Number(contract.totalValue) : null,
                currency: contract.currency,
                effectiveDate: contract.effectiveDate?.toISOString(),
                expirationDate: contract.expirationDate?.toISOString(),
                description: contract.description,
                tags: contract.tags,
                viewCount: contract.viewCount,
                updatedAt: contract.updatedAt?.toISOString() || null,
                fileName: contract.fileName,
                lastViewedAt: contract.lastViewedAt?.toISOString(),
                jurisdiction: contract.jurisdiction || (contract.aiMetadata as any)?.jurisdiction || null,
                paymentTerms: contract.paymentTerms || (contract.aiMetadata as any)?.payment_type || null,
                paymentFrequency: contract.paymentFrequency || (contract.aiMetadata as any)?.billing_frequency_type || null,
                autoRenewing: (contract.aiMetadata as any)?.auto_renewing ?? null,
                noticePeriod: (contract.aiMetadata as any)?.notice_period || null,
                externalParties: (contract.aiMetadata as any)?.external_parties || [],
                extractionConfidence: (contract.aiMetadata as any)?._confidence?.overall ?? null,
                parentContractId: (contract as any).parentContractId || null,
                relationshipType: (contract as any).relationshipType || null,
                parentContract: (contract as any).parentContract
                  ? {
                      id: (contract as any).parentContract.id,
                      title: (contract as any).parentContract.originalName || (contract as any).parentContract.fileName,
                      type: (contract as any).parentContract.contractType,
                    }
                  : null,
                childContractCount: (contract as any)._count?.childContracts || 0,
                hasHierarchy: !!(contract as any).parentContractId || ((contract as any)._count?.childContracts || 0) > 0,
                processing: (contract.status === 'PROCESSING' && !staleIdSet.has(contract.id))
                  ? (() => {
                      const meta = contract.aiMetadata as any;
                      const expected = meta?.expectedArtifactCount || 15;
                      const actual = (contract as any)._count?.artifacts || 0;
                      const artifactProgress = Math.min(Math.round((actual / expected) * 100), 99);
                      const lastTouch = contract.updatedAt || contract.createdAt;
                      const staleSinceMs = Date.now() - new Date(lastTouch).getTime();
                      const timeFraction = Math.min(staleSinceMs / (90 * 1000), 1);
                      const timeProgress = Math.round(5 + 75 * (1 - Math.pow(1 - timeFraction, 2)));
                      const progress = Math.max(artifactProgress, timeProgress);
                      const stages = [
                        'Analyzing document structure…',
                        'Extracting key information…',
                        'Identifying contract clauses…',
                        'Building contract profile…',
                      ];
                      const stageIdx = Math.min(Math.floor(timeFraction * stages.length), stages.length - 1);
                      return {
                        progress,
                        currentStage: meta?.currentStage || (actual > 0 ? `Generating artifacts (${actual}/${expected})` : stages[stageIdx]),
                        stale: false,
                        autoResolved: false,
                      };
                    })()
                  : undefined,
                signatureStatus: (contract as any).signatureStatus || (contract.aiMetadata as any)?.signature_status || 'unknown',
                signatureDate: (contract as any).signatureDate?.toISOString() || (contract.aiMetadata as any)?.signature_date || null,
                signatureRequiredFlag: (contract as any).signatureRequiredFlag ?? false,
                documentClassification: (contract as any).documentClassification || (contract.aiMetadata as any)?.document_classification || 'contract',
                documentClassificationConfidence: (contract as any).documentClassificationConf || null,
                documentClassificationWarning: (contract as any).documentClassificationWarning || (contract.aiMetadata as any)?.document_classification_warning || null,
              };
            }),
            pagination: {
              total,
              limit,
              page,
              totalPages,
              hasMore: page < totalPages,
              hasPrevious: page > 1,
              nextCursor: contracts.length === limit
                ? Buffer.from(JSON.stringify({
                    createdAt: contracts[contracts.length - 1].createdAt.toISOString(),
                    id: contracts[contracts.length - 1].id,
                  })).toString('base64')
                : null,
            },
            filters: {
              applied: {
                search: search || null,
                statuses: validStatuses,
                contractTypes,
                categories,
                documentRoles,
                riskLevels,
                clientNames,
                supplierNames,
                currencies,
                jurisdictions,
                paymentTerms,
                signatureStatuses,
                documentClassifications,
                expirationFilters,
                hasDeadline: hasDeadline || null,
                isExpiring: isExpiring || null,
                valueRange: minValue || maxValue ? { min: minValue, max: maxValue } : null,
              },
              sortBy,
              sortOrder,
            },
            meta: {
              cached: false,
              source: 'database',
            },
          },
        };
      },
      { ttl: (validStatuses.length === 0 || validStatuses.includes(ContractStatus.PROCESSING)) ? 0 : 120 },
    );

    const responseTime = Date.now() - startTime;
    const listCacheKey = `contracts:${tenantId}:${searchParams.toString()}`;
    const responseData = {
      ...cachedResult.data,
      meta: {
        ...cachedResult.data.meta,
        responseTime: `${responseTime}ms`,
        cached: responseTime < 100,
      },
    };

    const etag = apiCache.set(listCacheKey, responseData, CacheDuration.SHORT * 1000);
    if (apiCache.matches(listCacheKey, request.headers.get('If-None-Match'))) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': `private, max-age=${CacheDuration.SHORT}, stale-while-revalidate=${CacheDuration.MEDIUM}`,
        },
      });
    }

    return createSuccessResponse(context, responseData, {
      status: 200,
      dataSource: responseTime < 100 ? 'cache' : 'database',
      cached: responseTime < 100,
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Data-Source': responseTime < 100 ? 'cache' : 'database',
        ...etagHeaders(etag, { maxAge: CacheDuration.SHORT }),
      },
    });
  } catch (error) {
    logger.error('Contracts GET error:', error);
    return createErrorResponse(context, 'INTERNAL_ERROR', 'Failed to fetch contracts. Please try again.', 500);
  }
}

export async function getContractsOrganized(
  request: NextRequest,
  context: ContractApiContext,
) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;

  try {
    const tenantId = context.tenantId;
    if (!tenantId) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const groupBy = (searchParams.get('groupBy') || 'status') as OrganizeGroupBy;
    const includeContracts = searchParams.get('includeContracts') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const { groupField, labelGenerator } = getOrganizeConfig(groupBy);
    const { prisma } = await import('@/lib/prisma');

    let groups: OrganizedGroup[] = [];

    if (groupBy === 'expirationMonth') {
      const contracts = await prisma.contract.findMany({
        where: { tenantId, isDeleted: false },
        select: {
          id: true,
          contractTitle: true,
          originalName: true,
          fileName: true,
          status: true,
          totalValue: true,
          expirationDate: true,
        },
        orderBy: { expirationDate: sortOrder },
        take: limit,
      });

      const monthGroups = new Map<string, typeof contracts>();
      for (const contract of contracts) {
        const monthKey = contract.expirationDate
          ? `${contract.expirationDate.getFullYear()}-${String(contract.expirationDate.getMonth() + 1).padStart(2, '0')}`
          : 'no-expiration';
        const existing = monthGroups.get(monthKey) || [];
        existing.push(contract);
        monthGroups.set(monthKey, existing);
      }

      groups = Array.from(monthGroups.entries())
        .sort((first, second) => sortOrder === 'desc'
          ? second[0].localeCompare(first[0])
          : first[0].localeCompare(second[0]))
        .map(([key, contractsInGroup]) => ({
          key,
          label: key === 'no-expiration'
            ? 'No Expiration Date'
            : new Date(`${key}-01`).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
          count: contractsInGroup.length,
          totalValue: contractsInGroup.reduce((sum, contract) => sum + (Number(contract.totalValue) || 0), 0),
          contracts: includeContracts ? contractsInGroup.map(mapOrganizedContract) : [],
        }));
    } else if (groupBy === 'uploadMonth') {
      const contracts = await prisma.contract.findMany({
        where: { tenantId, isDeleted: false },
        select: {
          id: true,
          contractTitle: true,
          originalName: true,
          fileName: true,
          status: true,
          totalValue: true,
          uploadedAt: true,
          expirationDate: true,
        },
        orderBy: { uploadedAt: sortOrder },
        take: limit,
      });

      const monthGroups = new Map<string, typeof contracts>();
      for (const contract of contracts) {
        const uploadedAt = contract.uploadedAt || new Date();
        const monthKey = `${uploadedAt.getFullYear()}-${String(uploadedAt.getMonth() + 1).padStart(2, '0')}`;
        const existing = monthGroups.get(monthKey) || [];
        existing.push(contract);
        monthGroups.set(monthKey, existing);
      }

      groups = Array.from(monthGroups.entries())
        .sort((first, second) => sortOrder === 'desc'
          ? second[0].localeCompare(first[0])
          : first[0].localeCompare(second[0]))
        .map(([key, contractsInGroup]) => ({
          key,
          label: new Date(`${key}-01`).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
          count: contractsInGroup.length,
          totalValue: contractsInGroup.reduce((sum, contract) => sum + (Number(contract.totalValue) || 0), 0),
          contracts: includeContracts ? contractsInGroup.map(mapOrganizedContract) : [],
        }));
    } else if (groupBy === 'valueRange') {
      const valueRanges = [
        { key: 'under-10k', label: 'Under $10,000', min: 0, max: 10000 },
        { key: '10k-50k', label: '$10,000 - $50,000', min: 10000, max: 50000 },
        { key: '50k-100k', label: '$50,000 - $100,000', min: 50000, max: 100000 },
        { key: '100k-500k', label: '$100,000 - $500,000', min: 100000, max: 500000 },
        { key: 'over-500k', label: 'Over $500,000', min: 500000, max: Infinity },
        { key: 'no-value', label: 'No Value Specified', min: null, max: null },
      ];

      groups = await Promise.all(
        valueRanges.map(async (range) => {
          const where: Prisma.ContractWhereInput = { tenantId, isDeleted: false };
          if (range.min === null) {
            where.totalValue = null;
          } else if (range.max === Infinity) {
            where.totalValue = { gte: range.min };
          } else {
            where.totalValue = { gte: range.min, lt: range.max };
          }

          const [count, aggregate, contracts] = await Promise.all([
            prisma.contract.count({ where }),
            prisma.contract.aggregate({
              where,
              _sum: { totalValue: true },
            }),
            includeContracts
              ? prisma.contract.findMany({
                  where,
                  select: {
                    id: true,
                    contractTitle: true,
                    originalName: true,
                    fileName: true,
                    status: true,
                    totalValue: true,
                    expirationDate: true,
                  },
                  orderBy: { totalValue: sortOrder },
                  take: 20,
                })
              : Promise.resolve([]),
          ]);

          return {
            key: range.key,
            label: range.label,
            count,
            totalValue: Number(aggregate._sum.totalValue) || 0,
            contracts: contracts.map(mapOrganizedContract),
          };
        }),
      );
    } else {
      const grouped = await prisma.contract.groupBy({
        by: [groupField as never],
        where: { tenantId, isDeleted: false },
        _count: { id: true },
        _sum: { totalValue: true },
        orderBy: { _count: { id: sortOrder } },
        take: limit,
      });

      if (includeContracts) {
        groups = await Promise.all(
          grouped.map(async (group) => {
            const key = (group as Record<string, string | null>)[groupField] || null;
            const contracts = await prisma.contract.findMany({
              where: {
                tenantId,
                isDeleted: false,
                [groupField]: key,
              } as Prisma.ContractWhereInput,
              select: {
                id: true,
                contractTitle: true,
                originalName: true,
                fileName: true,
                status: true,
                totalValue: true,
                expirationDate: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 20,
            });

            return {
              key: key || 'unspecified',
              label: labelGenerator(key),
              count: group._count.id,
              totalValue: Number(group._sum.totalValue) || 0,
              contracts: contracts.map(mapOrganizedContract),
            };
          }),
        );
      } else {
        groups = grouped.map((group) => {
          const key = (group as Record<string, string | null>)[groupField] || null;
          return {
            key: key || 'unspecified',
            label: labelGenerator(key),
            count: group._count.id,
            totalValue: Number(group._sum.totalValue) || 0,
            contracts: [],
          };
        });
      }
    }

    const responseTime = Date.now() - startTime;
    return createSuccessResponse(context, {
      data: {
        groupBy,
        groups,
        summary: {
          totalGroups: groups.length,
          totalContracts: groups.reduce((sum, group) => sum + group.count, 0),
          totalValue: groups.reduce((sum, group) => sum + group.totalValue, 0),
        },
      },
      meta: {
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        tenantId,
      },
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api-middleware';
import { checkETagMatch, CacheDuration } from '@/lib/api-cache-headers';
import { semanticCache } from '@/lib/ai/semantic-cache.service';
import { deleteCachedByPattern } from '@/lib/cache';
import { apiCache, contractCache, etagHeaders } from '@/lib/cache/etag-cache';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { checkContractReadPermission, checkContractWritePermission } from '@/lib/security/contract-acl';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { safeDeleteContract } from '@/lib/services/contract-deletion.service';
import { getErrorMessage, type JsonRecord } from '@/lib/types/common';
import { contractUpdateSchema } from '@/lib/validation/contract.validation';

import type { ContractApiContext } from '@/lib/contracts/server/context';

interface ExtractedDataArtifact {
  type: string;
  data?: {
    clauses?: unknown[];
    riskFactors?: unknown[];
    complianceItems?: unknown[];
    [key: string]: unknown;
  };
}

interface BenchmarkResult {
  rateCardId?: string;
  totalSavingsOpportunity?: number;
  averageSavingsPercentage?: number;
  averageVariance?: number;
  ratesAboveMarket?: number;
  ratesBelowMarket?: number;
  marketPositionScore?: number;
  recommendations?: string[];
}

interface FinancialRateCard {
  id: string;
  name?: string;
  rates?: unknown[];
  insights?: RateCardInsights;
}

interface RateCardInsights {
  totalAnnualSavings?: string;
  averageVariance?: string;
  ratesAboveMarket?: number;
  ratesBelowMarket?: number;
  recommendation?: string;
}

interface ExtractedTable {
  type?: string;
  data?: unknown;
}

interface ProcessingData {
  completedAt?: string | Date;
  startTime?: string | Date;
}

interface ExtractedDataset {
  risk?: {
    riskLevel?: string;
    riskScore?: number;
    riskFactors?: unknown[];
  };
  compliance?: {
    complianceScore?: number;
    regulations?: unknown[];
  };
  financial?: {
    currency?: string;
    totalValue?: number;
    paymentTerms?: string;
    [key: string]: unknown;
  };
  clauses?: {
    clauses?: unknown[];
    completeness?: { score?: number };
  };
  [key: string]: unknown;
}

interface ContractDataForInsights {
  processing: ProcessingData;
  extractedData?: ExtractedDataset;
}

interface FinancialDataInput {
  paymentTerms?: unknown[] | string;
  extractedTables?: ExtractedTable[];
  penalties?: string[] | string;
  rateCards?: FinancialRateCard[];
  benchmarkingResults?: BenchmarkResult[];
  insights?: unknown;
  [key: string]: unknown;
}

function invalidateContractCaches(tenantId: string, contractId: string) {
  contractCache.invalidate(`contract:${tenantId}:${contractId}`);
  contractCache.invalidate('contracts:', true);
  apiCache.invalidate('contracts:', true);
}

function toJsonSafeContract(contract: Record<string, unknown>) {
  const safeContract: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(contract)) {
    if (typeof value === 'bigint') {
      safeContract[key] = Number(value);
    } else if (value instanceof Date) {
      safeContract[key] = value.toISOString();
    } else {
      safeContract[key] = value;
    }
  }

  return safeContract;
}

function mapContractStatus(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'PROCESSING':
      return 'processing';
    case 'FAILED':
      return 'error';
    case 'UPLOADED':
      return 'processing';
    default:
      return 'processing';
  }
}

function generateProcessingInsights(contractData: ContractDataForInsights) {
  const insights: Array<{ type: string; title: string; description: string; icon: string; color: string }> = [];

  if (contractData.processing.completedAt && contractData.processing.startTime) {
    const duration =
      new Date(contractData.processing.completedAt).getTime() -
      new Date(contractData.processing.startTime).getTime();
    const durationSeconds = Math.round(duration / 1000);

    insights.push({
      type: 'performance',
      title: 'Processing Performance',
      description: `Contract processed in ${durationSeconds} seconds`,
      icon: 'zap',
      color: 'green',
    });
  }

  if (contractData.extractedData?.risk) {
    const risk = contractData.extractedData.risk;
    insights.push({
      type: 'risk',
      title: `${risk.riskLevel} Risk Level`,
      description: `Risk score: ${risk.riskScore}/100 with ${risk.riskFactors?.length || 0} identified factors`,
      icon: 'shield',
      color:
        risk.riskLevel === 'LOW'
          ? 'green'
          : risk.riskLevel === 'MEDIUM'
            ? 'yellow'
            : 'red',
    });
  }

  if (contractData.extractedData?.compliance) {
    const compliance = contractData.extractedData.compliance;
    const score = compliance.complianceScore ?? 0;
    insights.push({
      type: 'compliance',
      title: 'Compliance Status',
      description: `${score}% compliant with ${compliance.regulations?.length || 0} regulations checked`,
      icon: 'award',
      color:
        score >= 90
          ? 'green'
          : score >= 70
            ? 'yellow'
            : 'red',
    });
  }

  if (contractData.extractedData?.financial) {
    const financial = contractData.extractedData.financial;
    insights.push({
      type: 'financial',
      title: 'Financial Terms',
      description: `Total value: ${financial.currency} ${financial.totalValue?.toLocaleString()} with ${financial.paymentTerms}`,
      icon: 'dollar-sign',
      color: 'blue',
    });
  }

  if (contractData.extractedData?.clauses) {
    const clauses = contractData.extractedData.clauses;
    insights.push({
      type: 'clauses',
      title: 'Clause Analysis',
      description: `${clauses.clauses?.length || 0} clauses extracted with ${clauses.completeness?.score || 0}% completeness`,
      icon: 'file-text',
      color: 'purple',
    });
  }

  return insights;
}

function transformFinancialData(financialData: FinancialDataInput | null | undefined) {
  if (!financialData) return null;

  let paymentTermsSummary = 'Not specified';
  if (Array.isArray(financialData.paymentTerms) && financialData.paymentTerms.length > 0) {
    paymentTermsSummary = `${financialData.paymentTerms.length} payment milestones`;
  } else if (typeof financialData.paymentTerms === 'string') {
    paymentTermsSummary = financialData.paymentTerms;
  }

  return {
    ...financialData,
    paymentTerms: paymentTermsSummary,
    paymentSchedule: Array.isArray(financialData.paymentTerms) ? financialData.paymentTerms : [],
    milestones:
      financialData.extractedTables?.filter((table: ExtractedTable) => table.type === 'payment_schedule').length || 0,
    penalties: Array.isArray(financialData.penalties)
      ? financialData.penalties.join(', ')
      : financialData.penalties || 'None specified',
    extractedTables: financialData.extractedTables || [],
    rateCards:
      financialData.rateCards?.map((rateCard: FinancialRateCard) => ({
        ...rateCard,
        insights: rateCard.insights || {
          totalAnnualSavings: financialData.benchmarkingResults?.find(
            (result: BenchmarkResult) => result.rateCardId === rateCard.id,
          )?.totalSavingsOpportunity
            ? `$${financialData.benchmarkingResults
                .find((result: BenchmarkResult) => result.rateCardId === rateCard.id)
                ?.totalSavingsOpportunity?.toLocaleString()}`
            : '$0',
          averageVariance: financialData.benchmarkingResults?.find(
            (result: BenchmarkResult) => result.rateCardId === rateCard.id,
          )?.averageVariance
            ? `${
                (financialData.benchmarkingResults.find(
                  (result: BenchmarkResult) => result.rateCardId === rateCard.id,
                )?.averageVariance ?? 0) > 0
                  ? '+'
                  : ''
              }${financialData.benchmarkingResults
                .find((result: BenchmarkResult) => result.rateCardId === rateCard.id)
                ?.averageVariance?.toFixed(1)}%`
            : '0%',
          ratesAboveMarket:
            financialData.benchmarkingResults?.find(
              (result: BenchmarkResult) => result.rateCardId === rateCard.id,
            )?.ratesAboveMarket || 0,
          ratesBelowMarket:
            financialData.benchmarkingResults?.find(
              (result: BenchmarkResult) => result.rateCardId === rateCard.id,
            )?.ratesBelowMarket || 0,
          recommendation:
            financialData.benchmarkingResults?.find(
              (result: BenchmarkResult) => result.rateCardId === rateCard.id,
            )?.recommendations?.[0] || 'No specific recommendations',
        },
      })) || [],
    benchmarkingResults: financialData.benchmarkingResults || [],
    insights: financialData.insights || {
      totalPotentialSavings: 0,
      highestSavingsOpportunity: { role: 'N/A', amount: 0 },
      rateAnalysisSummary: {
        totalRoles: 0,
        aboveMarketCount: 0,
        belowMarketCount: 0,
        averageVariance: 0,
      },
      recommendations: [],
      riskFactors: [],
    },
  };
}

export async function getContractDetails(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const startTime = Date.now();

  try {
    if (!contractId) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    const tenantId = context.tenantId;
    if (!tenantId) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    logger.info(`[GET /api/contracts/${contractId}] Resolved tenant: ${tenantId}`);

    const cacheKey = `contract:${tenantId}:${contractId}`;
    const ifNoneMatch = request.headers.get('If-None-Match');
    const cached = contractCache.get(cacheKey);
    if (cached) {
      const cachedStatus = String((cached.data as any)?.processing?.status || '').toLowerCase();
      const isCachedTerminal = cachedStatus === 'completed' || cachedStatus === 'failed';
      if (isCachedTerminal) {
        const cachedAcl = await checkContractReadPermission({
          contractId,
          tenantId,
          userId: context.userId,
          userRole: context.userRole,
        });
        if (!cachedAcl.allowed) {
          return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
        }
        if (contractCache.matches(cacheKey, ifNoneMatch)) {
          return new NextResponse(null, {
            status: 304,
            headers: { 'ETag': cached.etag, 'Cache-Control': `private, max-age=${CacheDuration.MEDIUM}` },
          });
        }
        return createSuccessResponse(context, cached.data, {
          cached: true,
          dataSource: 'server-cache',
          headers: {
            'X-Response-Time': `${Date.now() - startTime}ms`,
            'X-Data-Source': 'server-cache',
            'X-Cache-Status': 'HIT',
            ...etagHeaders(cached.etag, { maxAge: CacheDuration.MEDIUM }),
          },
        });
      }

      contractCache.invalidate(cacheKey);
    }

    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        tenantId,
      },
      include: {
        contractMetadata: {
          select: {
            dataQualityScore: true,
            riskScore: true,
            complexityScore: true,
            complianceStatus: true,
            artifactSummary: true,
            aiSummary: true,
            aiKeyInsights: true,
            aiRiskFactors: true,
            aiRecommendations: true,
            lastAiAnalysis: true,
            aiAnalysisVersion: true,
            priority: true,
            importance: true,
            department: true,
            negotiationStatus: true,
            performanceScore: true,
            renewalPriority: true,
            renewalDeadline: true,
            searchKeywords: true,
          },
        },
        parentContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            status: true,
            clientName: true,
            supplierName: true,
            effectiveDate: true,
            expirationDate: true,
          },
        },
        childContracts: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            status: true,
            relationshipType: true,
            clientName: true,
            supplierName: true,
            effectiveDate: true,
            expirationDate: true,
            totalValue: true,
            createdAt: true,
          },
          take: 50,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    let categoryInfo: Record<string, unknown> | null = null;
    if (contract?.contractCategoryId) {
      const category = await prisma.taxonomyCategory.findUnique({
        where: { id: contract.contractCategoryId },
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
            },
          },
        },
      });
      if (category) {
        categoryInfo = {
          id: category.id,
          name: category.name,
          color: category.color,
          icon: category.icon,
          level: category.level,
          path: category.path,
          parent: category.parent
            ? {
                id: category.parent.id,
                name: category.parent.name,
                color: category.parent.color,
                icon: category.parent.icon,
              }
            : null,
          l1: contract.categoryL1,
          l2: contract.categoryL2,
        };
      }
    }

    if (!contract) {
      return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
    }

    const viewDecision = await checkContractReadPermission({
      contractId,
      tenantId,
      userId: context.userId,
      userRole: context.userRole,
    });
    if (!viewDecision.allowed) {
      return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
    }

    const artifacts = await prisma.artifact.findMany({
      where: {
        contractId,
        tenantId,
      },
    });

    const processingJob = await prisma.processingJob.findFirst({
      where: { contractId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        progress: true,
        currentStep: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const artifactsByType = artifacts.reduce((acc, artifact) => {
      acc[artifact.type.toLowerCase()] = artifact.data;
      return acc;
    }, {} as Record<string, any>);

    const deriveProgress = (): number => {
      if (contract.status === 'COMPLETED') return 100;
      if (contract.status === 'FAILED') return 100;
      if (processingJob?.progress && processingJob.progress > 0) {
        return processingJob.progress;
      }
      if (artifacts.length > 0) {
        return Math.min(30 + Math.round((artifacts.length / 14) * 60), 99);
      }
      return 10;
    };

    const deriveStage = (): string => {
      if (contract.status === 'COMPLETED') return 'completed';
      if (contract.status === 'FAILED') return 'failed';
      if (processingJob?.currentStep) return processingJob.currentStep;
      if (artifacts.length > 0) return 'generating_artifacts';
      return 'processing';
    };

    const contractData = {
      id: contract.id,
      filename: contract.contractTitle || contract.originalName || contract.fileName || 'Unknown',
      uploadDate: contract.uploadedAt?.toISOString() || new Date().toISOString(),
      status: mapContractStatus(contract.status),
      tenantId: contract.tenantId,
      uploadedBy: contract.uploadedBy || 'user',
      fileSize: Number(contract.fileSize) || 0,
      mimeType: contract.mimeType || 'application/pdf',
      processing: {
        jobId: processingJob?.id || contract.id,
        status: (processingJob?.status || contract.status || 'PROCESSING').toLowerCase(),
        currentStage: deriveStage(),
        progress: deriveProgress(),
        startTime:
          processingJob?.startedAt?.toISOString() ||
          contract.uploadedAt?.toISOString() ||
          new Date().toISOString(),
        completedAt:
          processingJob?.completedAt?.toISOString() ||
          (contract.status === 'COMPLETED'
            ? contract.processedAt?.toISOString() || new Date().toISOString()
            : undefined),
      },
      extractedData: artifactsByType,
    };

    const enrichedData = {
      ...contractData,
      createdAt: contract.createdAt?.toISOString() || null,
      updatedAt: contract.updatedAt?.toISOString() || null,
      fileName: contract.fileName || null,
      originalName: contract.originalName || contract.fileName || null,
      signatureStatus: contract.signatureStatus || 'unknown',
      totalValue: contract.totalValue ? Number(contract.totalValue) : null,
      currency: contract.currency || null,
      clientName: contract.clientName || null,
      supplierName: contract.supplierName || null,
      contractTitle: contract.contractTitle || null,
      document_title: contract.contractTitle || null,
      description: contract.description || null,
      tags: contract.tags || [],
      searchableText: contract.searchableText || null,
      effectiveDate: contract.effectiveDate?.toISOString() || null,
      expirationDate: contract.expirationDate?.toISOString() || null,
      startDate: contract.startDate?.toISOString?.() ?? contract.effectiveDate?.toISOString() ?? null,
      endDate: contract.endDate?.toISOString?.() ?? contract.expirationDate?.toISOString() ?? null,
      start_date: contract.startDate?.toISOString?.() ?? contract.effectiveDate?.toISOString() ?? null,
      end_date: contract.endDate?.toISOString?.() ?? contract.expirationDate?.toISOString() ?? null,
      termination_date: (contract as any).terminationDate?.toISOString?.() ?? null,
      aiMetadata: (contract as any).aiMetadata || null,
      contractType: contract.contractType || null,
      contract_short_description: (() => {
        const overviewArtifact = artifactsByType.overview || artifactsByType.metadata;
        const executiveArtifact = artifactsByType.executive_summary;
        const executiveText = executiveArtifact?.executiveSummary || executiveArtifact?.summary;
        if (
          executiveText &&
          typeof executiveText === 'string' &&
          executiveText.length > 80 &&
          !executiveText.startsWith('STATEMENT OF WORK.')
        ) {
          return executiveText;
        }
        const overviewText = overviewArtifact?.summary;
        if (
          overviewText &&
          typeof overviewText === 'string' &&
          overviewText.length > 80 &&
          !overviewText.startsWith('STATEMENT OF WORK.')
        ) {
          return overviewText;
        }
        return contract.description || null;
      })(),
      external_parties: (() => {
        const parties: Array<{ legalName: string; role: string }> = [];
        const unwrapPartyValue = (value: any) => (value && typeof value === 'object' && 'value' in value ? value.value : value);
        const addParty = (name: any, role: string) => {
          const normalizedName = typeof name === 'string' ? name.trim() : '';
          if (normalizedName && normalizedName.length > 1 && !parties.some((party) => party.legalName === normalizedName)) {
            parties.push({ legalName: normalizedName, role });
          }
        };

        const overviewArtifact = artifactsByType.overview || artifactsByType.metadata;
        if (overviewArtifact?.parties && Array.isArray(overviewArtifact.parties)) {
          overviewArtifact.parties.forEach((party: any) => {
            const name = unwrapPartyValue(party.legalName) || unwrapPartyValue(party.name);
            if (name) addParty(name, unwrapPartyValue(party.role) || '');
          });
        }

        if (parties.length === 0) {
          const partiesArtifact = artifactsByType.parties;
          if (partiesArtifact?.parties && Array.isArray(partiesArtifact.parties)) {
            partiesArtifact.parties.forEach((party: any) => {
              const name = unwrapPartyValue(party.legalName) || unwrapPartyValue(party.name);
              if (name) addParty(name, unwrapPartyValue(party.role) || '');
            });
          }
        }

        if (parties.length === 0) {
          const aiMetadata = (contract as any).aiMetadata;
          if (aiMetadata?.external_parties && Array.isArray(aiMetadata.external_parties)) {
            aiMetadata.external_parties.forEach((party: any) => {
              const name = party.legalName || party.name;
              if (name) addParty(name, party.role || '');
            });
          }
        }

        if (parties.length === 0) {
          if (contract.clientName) addParty(contract.clientName, 'Client');
          if (contract.supplierName) addParty(contract.supplierName, 'Service Provider');
        }

        if (parties.length === 0) {
          const textSources = [
            overviewArtifact?.documentInfo?.preview,
            overviewArtifact?.rawText,
            overviewArtifact?.summary,
            artifactsByType.ingestion?.text,
            artifactsByType.ingestion?.rawText,
          ].filter(Boolean).join('\n');
          if (textSources.length > 10) {
            const betweenMatch = textSources.match(/(?:between|by and between|entered into by)\s+([A-Z][A-Za-z0-9\s&,.'()-]{2,80}?)\s*(?:\(.*?\))?\s*(?:,?\s*(?:and|&)\s+)([A-Z][A-Za-z0-9\s&,.'()-]{2,80}?)\s*(?:\(|,|\n)/i);
            if (betweenMatch) {
              addParty(betweenMatch[1].replace(/\s+$/, ''), 'Party');
              addParty(betweenMatch[2].replace(/\s+$/, ''), 'Party');
            }
            if (parties.length === 0) {
              const labelPatterns = [
                { re: /(?:Client|Buyer|Customer|Auftraggeber|Mandant)\s*[:.]\s*(.+?)(?:\n|$)/i, role: 'Client' },
                { re: /(?:Service Provider|Vendor|Supplier|Provider|Contractor|Auftragnehmer|Lieferant)\s*[:.]\s*(.+?)(?:\n|$)/i, role: 'Service Provider' },
                { re: /(?:Party\s*A|First Party|Licensor|Landlord)\s*[:.]\s*(.+?)(?:\n|$)/i, role: 'Party A' },
                { re: /(?:Party\s*B|Second Party|Licensee|Tenant)\s*[:.]\s*(.+?)(?:\n|$)/i, role: 'Party B' },
              ];
              for (const { re, role } of labelPatterns) {
                const match = textSources.match(re);
                if (match) addParty(match[1].replace(/[,;]+$/, '').trim(), role);
              }
            }
          }
        }

        return parties.length > 0 ? parties : undefined;
      })(),
      processingDuration: contractData.processing.completedAt
        ? new Date(contractData.processing.completedAt).getTime() - new Date(contractData.processing.startTime).getTime()
        : Date.now() - new Date(contractData.processing.startTime).getTime(),
      artifacts: Array.isArray(contractData.extractedData)
        ? contractData.extractedData
        : contractData.extractedData && typeof contractData.extractedData === 'object'
          ? Object.entries(contractData.extractedData).map(([type, data]) => ({ type, data }))
          : [],
      artifactCount: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.length
        : contractData.extractedData && typeof contractData.extractedData === 'object'
          ? Object.keys(contractData.extractedData).length
          : 0,
      summary: {
        totalClauses: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (artifact: ExtractedDataArtifact) => artifact.type === 'CLAUSES' || artifact.type === 'clauses',
            )?.data?.clauses?.length || 0
          : contractData.extractedData?.clauses?.clauses?.length || 0,
        riskFactors: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (artifact: ExtractedDataArtifact) => artifact.type === 'RISK' || artifact.type === 'risk',
            )?.data?.risks?.length || 0
          : contractData.extractedData?.risk?.risks?.length || 0,
        complianceIssues: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (artifact: ExtractedDataArtifact) => artifact.type === 'COMPLIANCE' || artifact.type === 'compliance',
            )?.data?.regulations?.length || 0
          : contractData.extractedData?.compliance?.regulations?.length || 0,
        financialTerms: Array.isArray(contractData.extractedData)
          ? Object.keys(
              contractData.extractedData.find(
                (artifact: ExtractedDataArtifact) => artifact.type === 'FINANCIAL' || artifact.type === 'financial',
              )?.data || {},
            ).filter((key) => key !== '_meta').length
          : Object.keys(contractData.extractedData?.financial || {}).length,
        keyParties: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (artifact: ExtractedDataArtifact) => artifact.type === 'OVERVIEW' || artifact.type === 'metadata',
            )?.data?.parties?.length || 0
          : contractData.extractedData?.metadata?.parties?.length ||
            contractData.extractedData?.overview?.parties?.length ||
            0,
        extractedTables: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (artifact: ExtractedDataArtifact) => artifact.type === 'financial',
            )?.data?.extractedTables?.length || 0
          : contractData.extractedData?.financial?.extractedTables?.length || 0,
        rateCards: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (artifact: ExtractedDataArtifact) => artifact.type === 'financial',
            )?.data?.rateCards?.length || 0
          : contractData.extractedData?.financial?.rateCards?.length || 0,
        totalSavingsOpportunity: Array.isArray(contractData.extractedData)
          ? contractData.extractedData
              .find((artifact: ExtractedDataArtifact) => artifact.type === 'financial')
              ?.data?.benchmarkingResults?.reduce(
                (sum: number, result: BenchmarkResult) => sum + (result.totalSavingsOpportunity || 0),
                0,
              ) || 0
          : contractData.extractedData?.financial?.benchmarkingResults?.reduce(
              (sum: number, result: BenchmarkResult) => sum + (result.totalSavingsOpportunity || 0),
              0,
            ) || 0,
      },
      insights: generateProcessingInsights(contractData),
      financial: transformFinancialData(
        Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (artifact: ExtractedDataArtifact) => artifact.type === 'FINANCIAL' || artifact.type === 'financial',
            )?.data
          : contractData.extractedData?.financial,
      ),
      metadata: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (artifact: ExtractedDataArtifact) => artifact.type === 'OVERVIEW' || artifact.type === 'metadata',
          )?.data
        : contractData.extractedData?.overview || contractData.extractedData?.metadata,
      risk: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (artifact: ExtractedDataArtifact) => artifact.type === 'RISK' || artifact.type === 'risk',
          )?.data
        : contractData.extractedData?.risk,
      compliance: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (artifact: ExtractedDataArtifact) => artifact.type === 'COMPLIANCE' || artifact.type === 'compliance',
          )?.data
        : contractData.extractedData?.compliance,
      clauses: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (artifact: ExtractedDataArtifact) => artifact.type === 'CLAUSES' || artifact.type === 'clauses',
          )?.data
        : contractData.extractedData?.clauses,
      obligations: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (artifact: ExtractedDataArtifact) => artifact.type === 'OBLIGATIONS' || artifact.type === 'obligations',
          )?.data
        : contractData.extractedData?.obligations,
      renewal: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (artifact: ExtractedDataArtifact) => artifact.type === 'RENEWAL' || artifact.type === 'renewal',
          )?.data
        : contractData.extractedData?.renewal,
      negotiationPoints: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (artifact: ExtractedDataArtifact) =>
              artifact.type === 'NEGOTIATION_POINTS' ||
              artifact.type === 'NEGOTIATION' ||
              artifact.type === 'negotiation_points' ||
              artifact.type === 'negotiation',
          )?.data
        : contractData.extractedData?.negotiation_points ||
          contractData.extractedData?.negotiation ||
          contractData.extractedData?.negotiationPoints,
      negotiation_points: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (artifact: ExtractedDataArtifact) =>
              artifact.type === 'NEGOTIATION_POINTS' ||
              artifact.type === 'NEGOTIATION' ||
              artifact.type === 'negotiation_points' ||
              artifact.type === 'negotiation',
          )?.data
        : contractData.extractedData?.negotiation_points ||
          contractData.extractedData?.negotiation ||
          contractData.extractedData?.negotiationPoints,
      amendments: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (artifact: ExtractedDataArtifact) => artifact.type === 'AMENDMENTS' || artifact.type === 'amendments',
          )?.data
        : contractData.extractedData?.amendments,
      contacts: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (artifact: ExtractedDataArtifact) => artifact.type === 'CONTACTS' || artifact.type === 'contacts',
          )?.data
        : contractData.extractedData?.contacts,
      parentContract: contract.parentContract
        ? {
            id: contract.parentContract.id,
            title: contract.parentContract.contractTitle || 'Untitled',
            type: contract.parentContract.contractType,
            status: contract.parentContract.status,
            clientName: contract.parentContract.clientName,
            supplierName: contract.parentContract.supplierName,
            effectiveDate: contract.parentContract.effectiveDate?.toISOString(),
            expirationDate: contract.parentContract.expirationDate?.toISOString(),
          }
        : null,
      childContracts: contract.childContracts?.map((child) => ({
        id: child.id,
        title: child.contractTitle || 'Untitled',
        type: child.contractType,
        status: child.status,
        relationshipType: child.relationshipType,
        clientName: child.clientName,
        supplierName: child.supplierName,
        effectiveDate: child.effectiveDate?.toISOString(),
        expirationDate: child.expirationDate?.toISOString(),
        totalValue: child.totalValue ? Number(child.totalValue) : null,
        createdAt: child.createdAt?.toISOString(),
      })) || [],
      parentContractId: contract.parentContractId,
      relationshipType: contract.relationshipType,
      relationshipNote: contract.relationshipNote,
      linkedAt: contract.linkedAt?.toISOString(),
      contractSubtype: contract.contractSubtype || null,
      classificationConf: contract.classificationConf || null,
      classificationMeta: contract.classificationMeta || null,
      signature_date: contract.signatureDate?.toISOString() || null,
      signature_status: contract.signatureStatus || 'unknown',
      signature_required_flag: contract.signatureRequiredFlag ?? false,
      document_classification: contract.documentClassification || 'contract',
      document_classification_warning: (contract as any).documentClassificationWarning || null,
      jurisdiction: contract.jurisdiction || null,
      notice_period: contract.noticePeriodDays ? `${contract.noticePeriodDays} days` : null,
      notice_period_days: contract.noticePeriodDays || null,
      category: categoryInfo,
      categoryL1: contract.categoryL1,
      categoryL2: contract.categoryL2,
      contractCategoryId: contract.contractCategoryId,
      classifiedAt: contract.classifiedAt?.toISOString(),
      rawText: contract.rawText || null,
      qualityMetrics: contract.contractMetadata
        ? {
            dataQualityScore: contract.contractMetadata.dataQualityScore,
            riskScore: contract.contractMetadata.riskScore,
            complexityScore: contract.contractMetadata.complexityScore,
            complianceStatus: contract.contractMetadata.complianceStatus,
            performanceScore: contract.contractMetadata.performanceScore,
            priority: contract.contractMetadata.priority,
            importance: contract.contractMetadata.importance,
            department: contract.contractMetadata.department,
            negotiationStatus: contract.contractMetadata.negotiationStatus,
            renewalPriority: contract.contractMetadata.renewalPriority,
            renewalDeadline: contract.contractMetadata.renewalDeadline,
            lastAiAnalysis: contract.contractMetadata.lastAiAnalysis,
            aiAnalysisVersion: contract.contractMetadata.aiAnalysisVersion,
          }
        : null,
      aiInsights: contract.contractMetadata
        ? {
            summary: contract.contractMetadata.aiSummary,
            keyInsights: contract.contractMetadata.aiKeyInsights,
            riskFactors: contract.contractMetadata.aiRiskFactors,
            recommendations: contract.contractMetadata.aiRecommendations,
            artifactSummary: contract.contractMetadata.artifactSummary,
            searchKeywords: contract.contractMetadata.searchKeywords,
          }
        : null,
    };

    const responseTime = Date.now() - startTime;
    const isTerminal = contract.status === 'COMPLETED' || contract.status === 'FAILED';
    let etag: string | undefined;

    if (isTerminal) {
      etag = contractCache.set(cacheKey, enrichedData);
      if (checkETagMatch(request, etag.replace(/"/g, ''))) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            'ETag': etag,
            'Cache-Control': `private, max-age=${CacheDuration.MEDIUM}, stale-while-revalidate=${CacheDuration.LONG}`,
          },
        });
      }
    } else {
      contractCache.invalidate(cacheKey);
    }

    return createSuccessResponse(context, enrichedData, {
      cached: false,
      dataSource: 'database',
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Data-Source': 'database',
        'X-Cache-Status': isTerminal ? 'MISS' : 'BYPASS',
        ...(etag ? etagHeaders(etag, { maxAge: CacheDuration.MEDIUM }) : { 'Cache-Control': 'no-store' }),
      },
    });
  } catch (error: unknown) {
    return handleApiError(context, error);
  }
}

export async function putContractDetails(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  try {
    const body = await request.json();
    const version = typeof body.version === 'string' ? body.version : undefined;
    const updates = contractUpdateSchema.parse(body);

    if (!contractId) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    const tenantId = context.tenantId;
    if (!tenantId) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const existingContract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId, isDeleted: false },
    });

    if (!existingContract) {
      return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
    }

    const aclDecision = await checkContractWritePermission({
      contractId,
      tenantId,
      userId: context.userId,
      userRole: context.userRole,
      required: 'EDIT',
    });
    if (!aclDecision.allowed) {
      return createErrorResponse(
        context,
        'FORBIDDEN',
        'You do not have permission to edit this contract',
        403,
      );
    }

    if (version && existingContract.updatedAt.toISOString() !== version) {
      return createErrorResponse(
        context,
        'CONFLICT',
        'Contract was modified by another user. Please refresh and retry.',
        409,
      );
    }

    const prismaUpdates: Record<string, unknown> = {};

    if (updates.clientId !== undefined) prismaUpdates.clientId = updates.clientId;
    if (updates.supplierId !== undefined) prismaUpdates.supplierId = updates.supplierId;
    if (updates.tags !== undefined) prismaUpdates.tags = updates.tags;
    if (updates.status !== undefined) prismaUpdates.status = updates.status;
    if (updates.effectiveDate !== undefined) prismaUpdates.effectiveDate = updates.effectiveDate ? new Date(updates.effectiveDate) : null;
    if (updates.expirationDate !== undefined) prismaUpdates.expirationDate = updates.expirationDate ? new Date(updates.expirationDate) : null;
    if (updates.totalValue !== undefined) prismaUpdates.totalValue = updates.totalValue;
    if (updates.currency !== undefined) prismaUpdates.currency = updates.currency;
    if (updates.description !== undefined) prismaUpdates.description = updates.description;
    if (updates.contractTitle !== undefined) prismaUpdates.contractTitle = updates.contractTitle;
    if (updates.clientName !== undefined) prismaUpdates.clientName = updates.clientName;
    if (updates.supplierName !== undefined) prismaUpdates.supplierName = updates.supplierName;
    if (updates.contractType !== undefined) prismaUpdates.contractType = updates.contractType;
    if (updates.jurisdiction !== undefined) prismaUpdates.jurisdiction = updates.jurisdiction;
    if (updates.paymentTerms !== undefined) prismaUpdates.paymentTerms = updates.paymentTerms;
    if (updates.paymentFrequency !== undefined) prismaUpdates.paymentFrequency = updates.paymentFrequency;
    if (updates.billingCycle !== undefined) prismaUpdates.billingCycle = updates.billingCycle;
    if (updates.autoRenewalEnabled !== undefined) prismaUpdates.autoRenewalEnabled = updates.autoRenewalEnabled;
    if (updates.noticePeriodDays !== undefined) prismaUpdates.noticePeriodDays = updates.noticePeriodDays;
    if (updates.annualValue !== undefined) prismaUpdates.annualValue = updates.annualValue;
    if (updates.monthlyValue !== undefined) prismaUpdates.monthlyValue = updates.monthlyValue;

    if (updates.notes !== undefined) {
      const existingMetadata = (existingContract.metadata as JsonRecord) || {};
      prismaUpdates.metadata = { ...existingMetadata, notes: updates.notes };
    }

    if (updates.category !== undefined || updates.priority !== undefined) {
      const existingMetadata = (existingContract.metadata as JsonRecord) || {};
      prismaUpdates.metadata = {
        ...existingMetadata,
        ...(prismaUpdates.metadata as JsonRecord | undefined),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
      };
    }

    if (updates.categoryId !== undefined) {
      prismaUpdates.contractCategoryId = updates.categoryId || null;
    }

    if (updates.reminder_enabled !== undefined || updates.reminder_days_before_end !== undefined) {
      const existingMetadata = (existingContract.metadata as JsonRecord) || {};
      prismaUpdates.metadata = {
        ...existingMetadata,
        ...(prismaUpdates.metadata as JsonRecord | undefined),
        ...(updates.reminder_enabled !== undefined && { reminder_enabled: updates.reminder_enabled }),
        ...(updates.reminder_days_before_end !== undefined && { reminder_days_before_end: updates.reminder_days_before_end }),
      };
    }

    if (prismaUpdates.expirationDate !== undefined) {
      const expirationDate = prismaUpdates.expirationDate as Date | null;
      if (expirationDate) {
        const now = new Date();
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysUntil = Math.ceil((expirationDate.getTime() - now.getTime()) / msPerDay);
        prismaUpdates.daysUntilExpiry = daysUntil;
        prismaUpdates.isExpired = daysUntil < 0;
        if (daysUntil < 0) prismaUpdates.expirationRisk = 'EXPIRED';
        else if (daysUntil <= 7) prismaUpdates.expirationRisk = 'CRITICAL';
        else if (daysUntil <= 30) prismaUpdates.expirationRisk = 'HIGH';
        else if (daysUntil <= 90) prismaUpdates.expirationRisk = 'MEDIUM';
        else prismaUpdates.expirationRisk = 'LOW';
      } else {
        prismaUpdates.daysUntilExpiry = null;
        prismaUpdates.isExpired = false;
        prismaUpdates.expirationRisk = null;
      }
    }

    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        ...prismaUpdates,
        updatedAt: new Date(),
      },
    });

    invalidateContractCaches(tenantId, contractId);
    await deleteCachedByPattern('contracts:list:*').catch(() => {});
    semanticCache.invalidate(tenantId, contractId).catch((error) => {
      logger.error('[ContractUpdate] Semantic cache invalidation error:', error);
    });

    await auditLog({
      action: AuditAction.CONTRACT_UPDATED,
      resourceType: 'contract',
      resourceId: contractId,
      userId: context.userId,
      tenantId,
      metadata: { changes: prismaUpdates },
    }).catch((error) => logger.error('[ContractUpdate] Audit log failed:', error));

    const aiFields = [
      'contractType',
      'clientName',
      'supplierName',
      'contractTitle',
      'jurisdiction',
      'totalValue',
      'currency',
      'effectiveDate',
      'expirationDate',
      'paymentTerms',
    ];
    const changedAiFields = aiFields.filter((field) => prismaUpdates[field] !== undefined);

    if (changedAiFields.length > 0) {
      try {
        await Promise.all(
          changedAiFields.map((field) =>
            prisma.learningRecord.create({
              data: {
                tenantId,
                artifactType: 'contract_metadata',
                contractType: existingContract.contractType || undefined,
                field,
                aiExtracted: String((existingContract as Record<string, unknown>)[field] ?? ''),
                userCorrected: String(prismaUpdates[field] ?? ''),
                correctionType: (existingContract as Record<string, unknown>)[field] ? 'value' : 'missing',
                confidence: 1.0,
              },
            }),
          ),
        );
      } catch {
        // Learning records are best-effort.
      }
    }

    return createSuccessResponse(context, toJsonSafeContract(updatedContract as Record<string, unknown>));
  } catch (error: unknown) {
    logger.error('[ContractPUT] Unhandled error', getErrorMessage(error));
    return handleApiError(context, error);
  }
}

export async function deleteContractDetails(
  context: ContractApiContext,
  contractId: string,
) {
  try {
    if (!contractId) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    const tenantId = context.tenantId;
    if (!tenantId) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const aclDecision = await checkContractWritePermission({
      contractId,
      tenantId,
      userId: context.userId,
      userRole: context.userRole,
      required: 'ADMIN',
    });
    if (!aclDecision.allowed) {
      return createErrorResponse(
        context,
        'FORBIDDEN',
        'You do not have permission to delete this contract',
        403,
      );
    }

    const result = await safeDeleteContract(contractId, tenantId);
    if (!result.success) {
      return createErrorResponse(context, 'BAD_REQUEST', result.error || 'Delete failed', 400);
    }

    invalidateContractCaches(tenantId, contractId);
    await deleteCachedByPattern('contracts:list:*').catch(() => {});
    await deleteCachedByPattern('contracts:stats').catch(() => {});
    semanticCache.invalidate(tenantId, contractId).catch((error) => {
      logger.error('[ContractDelete] Semantic cache invalidation error:', error);
    });

    try {
      const contractDataPath = join(process.cwd(), 'data', 'contracts', `${contractId}.json`);
      if (existsSync(contractDataPath)) {
        await unlink(contractDataPath);
      }
    } catch {
      // Legacy file cleanup is optional.
    }

    await auditLog({
      action: AuditAction.CONTRACT_DELETED,
      resourceType: 'contract',
      resourceId: contractId,
      userId: context.userId,
      tenantId,
      metadata: { deletedAt: new Date().toISOString(), isDeleted: true },
    }).catch((error) => logger.error('[ContractDelete] Audit log failed:', error));

    return createSuccessResponse(context, {
      message: 'Contract deleted successfully',
      deletedRecords: result.deletedRecords,
    });
  } catch (error: unknown) {
    return handleApiError(context, error);
  }
}

export async function getContractFrontendDetails(
  context: ContractApiContext,
  contractId: string,
) {
  if (!contractId) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  const tenantId = context.tenantId;
  if (!tenantId) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: {
      artifacts: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const transformedArtifacts = contract.artifacts.map((artifact) => {
    const artifactData = (artifact.data as Record<string, unknown> | null) || {};
    return {
      type: artifact.type,
      data: artifact.data,
      confidence: Number(artifact.confidence || 0),
      completeness: Number(artifactData.completeness || 0),
      method: String(artifactData.method || 'ai'),
      processingTime: Number(artifactData.processingTime || 0),
      validationResults: artifactData.validationResults,
    };
  });

  let costSavings: Record<string, unknown> | null = null;
  try {
    const opportunities = await prisma.costSavingsOpportunity.findMany({
      where: {
        contractId,
        tenantId,
        status: 'identified',
      },
      orderBy: {
        potentialSavingsAmount: 'desc',
      },
    });

    if (opportunities.length > 0) {
      const totalSavings = opportunities.reduce((sum, opportunity) => sum + Number(opportunity.potentialSavingsAmount), 0);
      const transformedOpportunities = opportunities.map((opportunity) => ({
        id: opportunity.id,
        category: opportunity.category,
        title: opportunity.title,
        description: opportunity.description,
        potentialSavings: {
          amount: Number(opportunity.potentialSavingsAmount),
          currency: opportunity.potentialSavingsCurrency,
          percentage: Number(opportunity.potentialSavingsPercentage || 0),
          timeframe: opportunity.timeframe,
        },
        confidence: opportunity.confidence,
        effort: opportunity.effort,
        priority: opportunity.priority,
        actionItems: opportunity.actionItems as string[],
        implementationTimeline: opportunity.implementationTimeline,
        risks: opportunity.risks as string[],
      }));

      costSavings = {
        totalPotentialSavings: {
          amount: totalSavings,
          currency: 'USD',
          percentage: 0,
        },
        opportunities: transformedOpportunities,
        quickWins: transformedOpportunities.filter(
          (opportunity) => opportunity.confidence === 'high' && opportunity.effort === 'low',
        ),
        strategicInitiatives: transformedOpportunities.filter(
          (opportunity) => opportunity.potentialSavings.amount > 50000,
        ),
        summary: {
          opportunityCount: opportunities.length,
          averageSavingsPerOpportunity: opportunities.length > 0 ? totalSavings / opportunities.length : 0,
          highConfidenceOpportunities: opportunities.filter((opportunity) => opportunity.confidence === 'high').length,
        },
      };
    }
  } catch {
    // Cost savings enrichment is best-effort for the simplified detail view.
  }

  return createSuccessResponse(context, {
    success: true,
    data: {
      id: contract.id,
      name: contract.fileName || 'Untitled Contract',
      status: contract.status?.toLowerCase() || 'active',
      uploadedAt: contract.createdAt.toISOString(),
      artifacts: transformedArtifacts,
      costSavings,
    },
  });
}

export async function getContractFavorite(
  context: ContractApiContext,
  contractId: string,
) {
  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
      isDeleted: false,
    },
    select: { id: true },
  });
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const userPrefs = await prisma.userPreferences.findUnique({
    where: { userId: context.userId },
    select: { customSettings: true },
  });

  if (!userPrefs) {
    return createSuccessResponse(context, { favorite: false });
  }

  const customSettings = (userPrefs.customSettings as Record<string, unknown>) || {};
  const favoriteContracts = (customSettings.favoriteContracts as string[]) || [];

  return createSuccessResponse(context, {
    favorite: favoriteContracts.includes(contractId),
  });
}

export async function postContractFavorite(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const body = await request.json();
  const { favorite } = body;

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
      isDeleted: false,
    },
    select: { id: true },
  });
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  let userPrefs = await prisma.userPreferences.findUnique({
    where: { userId: context.userId },
  });

  if (!userPrefs) {
    userPrefs = await prisma.userPreferences.create({
      data: {
        user: { connect: { id: context.userId } },
      },
    });
  }

  const customSettings = (userPrefs.customSettings as Record<string, unknown>) || {};
  const favoriteContracts = (customSettings.favoriteContracts as string[]) || [];
  const updatedFavorites = favorite
    ? favoriteContracts.includes(contractId)
      ? favoriteContracts
      : [...favoriteContracts, contractId]
    : favoriteContracts.filter((id) => id !== contractId);

  await prisma.userPreferences.update({
    where: { userId: context.userId },
    data: {
      customSettings: {
        ...customSettings,
        favoriteContracts: updatedFavorites,
      },
    },
  });

  await prisma.contractActivity.create({
    data: {
      contractId,
      tenantId: context.tenantId,
      userId: context.userId,
      type: 'favorite',
      action: favorite ? 'Contract added to favorites' : 'Contract removed from favorites',
      metadata: {},
    },
  }).catch((error) => logger.error('[Favorite] Activity log failed:', error));

  return createSuccessResponse(context, {
    success: true,
    favorite,
    message: favorite ? 'Contract added to favorites' : 'Contract removed from favorites',
  });
}
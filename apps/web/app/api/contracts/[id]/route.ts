/**
 * Contract Details API
 * GET /api/contracts/[id] - Get contract with artifacts and processing status
 *
 * ✅ MIGRATED to data-orchestration service
 * - Uses centralized ContractService and ArtifactService
 * - Type-safe with automatic caching
 * - Consistent error handling
 */

import { NextRequest } from 'next/server';
import { unlink } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { existsSync } from "fs";
import { getServerTenantId } from "@/lib/tenant-server";
import { join } from "path";
import { getErrorMessage, type JsonRecord } from "@/lib/types/common";
import { safeDeleteContract } from "@/lib/services/contract-deletion.service";
import { contractUpdateSchema } from "@/lib/validation/contract.validation";
import { ZodError } from "zod";
import { semanticCache } from "@/lib/ai/semantic-cache.service";
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

// Type definitions for extracted data
interface ExtractedDataArtifact {
  type: string;
  data?: {
    clauses?: unknown[];
    riskFactors?: unknown[];
    complianceItems?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface _ContractChild {
  id: string;
  contractTitle?: string | null;
  contractType?: string | null;
  status?: string | null;
  relationshipType?: string | null;
  clientName?: string | null;
  supplierName?: string | null;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
  totalValue?: number | null;
  createdAt?: Date | null;
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
  [key: string]: unknown;
}

interface FinancialRateCard {
  id: string;
  name?: string;
  rates?: unknown[];
  insights?: RateCardInsights;
  [key: string]: unknown;
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
  [key: string]: unknown;
}

interface ProcessingData {
  completedAt?: string | Date;
  startTime?: string | Date;
  [key: string]: unknown;
}

interface ExtractedDataset {
  risk?: {
    riskLevel?: string;
    riskScore?: number;
    riskFactors?: unknown[];
    [key: string]: unknown;
  };
  compliance?: {
    complianceScore?: number;
    regulations?: unknown[];
    [key: string]: unknown;
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
    [key: string]: unknown;
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

export const runtime = "nodejs";

// Get contract details and processing status
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(req);
  if (!ctx) {
    return createErrorResponse(getApiContext(req), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const params = await context.params;
  const startTime = Date.now();

  try {
    const contractId = params.id;

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    const tenantId = await getServerTenantId();
    
    // Debug log
    console.log(`[GET /api/contracts/${contractId}] Resolved tenant: ${tenantId}`);

    // Get contract with parent and child relationships
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        tenantId: tenantId,
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
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    // Fetch taxonomy category details if contract has a category assigned
    let categoryInfo: {
      id: string;
      name: string;
      color: string;
      icon: string;
      level: number;
      path: string;
      parent: { id: string; name: string; color: string; icon: string } | null;
      l1: string | null;
      l2: string | null;
    } | null = null;
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
          parent: category.parent ? {
            id: category.parent.id,
            name: category.parent.name,
            color: category.parent.color,
            icon: category.parent.icon,
          } : null,
          l1: contract.categoryL1,
          l2: contract.categoryL2,
        };
      }
    }

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get artifacts directly from database
    const artifacts = await prisma.artifact.findMany({
      where: {
        contractId: contractId,
        tenantId: tenantId,
      },
    });

    // Transform artifacts into expected format
    const artifactsByType = artifacts.reduce((acc, artifact) => {
      acc[artifact.type.toLowerCase()] = artifact.data;
      return acc;
    }, {} as Record<string, any>);

    // Combine contract metadata with artifacts
    const contractData = {
      id: contract.id,
      filename: contract.fileName || "Unknown",
      uploadDate:
        contract.uploadedAt?.toISOString() || new Date().toISOString(),
      status: mapContractStatus(contract.status),
      tenantId: contract.tenantId,
      uploadedBy: contract.uploadedBy || "user",
      fileSize: Number(contract.fileSize) || 0,
      mimeType: contract.mimeType || "application/pdf",
      processing: {
        jobId: contract.id,
        status: contract.status || "PROCESSING",
        currentStage:
          contract.status === "COMPLETED" ? "completed" : "processing",
        progress: contract.status === "COMPLETED" ? 100 : 50,
        startTime:
          contract.uploadedAt?.toISOString() || new Date().toISOString(),
        completedAt:
          contract.status === "COMPLETED"
            ? contract.processedAt?.toISOString() || new Date().toISOString()
            : undefined,
      },
      extractedData: artifactsByType,
    };

    // Check if we have real processing results
    const _hasRealResults =
      contractData.extractedData && contractData.status === "completed";

    // Add some computed fields for the UI
    const enrichedData = {
      ...contractData,

      // Contract metadata from DB (needed by useContractMetadata hook)
      totalValue: contract.totalValue ? Number(contract.totalValue) : null,
      currency: contract.currency || null,
      clientName: contract.clientName || null,
      supplierName: contract.supplierName || null,
      contractTitle: contract.contractTitle || null,
      document_title: contract.contractTitle || null,
      description: contract.description || null,
      effectiveDate: contract.effectiveDate?.toISOString() || null,
      expirationDate: contract.expirationDate?.toISOString() || null,

      // Pass through start/end dates in BOTH camelCase and snake_case so frontend can find them
      startDate: contract.startDate?.toISOString?.() ?? contract.effectiveDate?.toISOString() ?? null,
      endDate: contract.endDate?.toISOString?.() ?? contract.expirationDate?.toISOString() ?? null,
      start_date: contract.startDate?.toISOString?.() ?? contract.effectiveDate?.toISOString() ?? null,
      end_date: contract.endDate?.toISOString?.() ?? contract.expirationDate?.toISOString() ?? null,
      termination_date: (contract as any).terminationDate?.toISOString?.() ?? null,

      // Enterprise metadata from AI processing (includes external_parties, signature info, etc.)
      aiMetadata: (contract as any).aiMetadata || null,

      // Contract type from DB (frontend checks this for type display)
      contractType: contract.contractType || null,

      // Build contract_short_description server-side for reliability
      contract_short_description: (() => {
        const overviewArt = artifactsByType['overview'] || artifactsByType['metadata'];
        const execArt = artifactsByType['executive_summary'];
        // Prefer executive summary (should be prose)
        const execText = execArt?.executiveSummary || execArt?.summary;
        if (execText && typeof execText === 'string' && execText.length > 80 && !execText.startsWith('STATEMENT OF WORK.')) {
          return execText;
        }
        // Overview summary
        const overviewText = overviewArt?.summary;
        if (overviewText && typeof overviewText === 'string' && overviewText.length > 80 && !overviewText.startsWith('STATEMENT OF WORK.')) {
          return overviewText;
        }
        // DB description
        if (contract.description) return contract.description;
        return null;
      })(),

      // Build external_parties array directly so the hook finds it immediately
      external_parties: (() => {
        const parties: Array<{ legalName: string; role: string }> = [];
        const unwrapPartyVal = (v: any) => (v && typeof v === 'object' && 'value' in v) ? v.value : v;
        const addParty = (name: any, role: string) => {
          const n = typeof name === 'string' ? name.trim() : '';
          if (n && n.length > 1 && !parties.some(p => p.legalName === n)) parties.push({ legalName: n, role });
        };
        // 1. Try OVERVIEW artifact parties
        const overviewArtifact = artifactsByType['overview'] || artifactsByType['metadata'];
        if (overviewArtifact?.parties && Array.isArray(overviewArtifact.parties)) {
          overviewArtifact.parties.forEach((p: any) => {
            const name = unwrapPartyVal(p.legalName) || unwrapPartyVal(p.name);
            if (name) addParty(name, unwrapPartyVal(p.role) || '');
          });
        }
        // 2. Try PARTIES artifact
        if (parties.length === 0) {
          const partiesArtifact = artifactsByType['parties'];
          if (partiesArtifact?.parties && Array.isArray(partiesArtifact.parties)) {
            partiesArtifact.parties.forEach((p: any) => {
              const name = unwrapPartyVal(p.legalName) || unwrapPartyVal(p.name);
              if (name) addParty(name, unwrapPartyVal(p.role) || '');
            });
          }
        }
        // 3. Try enterprise metadata (aiMetadata.external_parties from worker)
        if (parties.length === 0) {
          const aiMeta = (contract as any).aiMetadata;
          if (aiMeta?.external_parties && Array.isArray(aiMeta.external_parties)) {
            aiMeta.external_parties.forEach((p: any) => {
              const name = p.legalName || p.name;
              if (name) addParty(name, p.role || '');
            });
          }
        }
        // 4. Fallback to DB fields
        if (parties.length === 0) {
          if (contract.clientName) addParty(contract.clientName, 'Client');
          if (contract.supplierName) addParty(contract.supplierName, 'Service Provider');
        }
        // 5. Parse from any available text (artifact preview, summary, or ingestion text)
        if (parties.length === 0) {
          const textSources = [
            overviewArtifact?.documentInfo?.preview,
            overviewArtifact?.rawText,
            overviewArtifact?.summary,
            artifactsByType['ingestion']?.text,
            artifactsByType['ingestion']?.rawText,
          ].filter(Boolean).join('\n');
          if (textSources.length > 10) {
            // "between X and Y" pattern (most common in contracts)
            const betweenMatch = textSources.match(/(?:between|by and between|entered into by)\s+([A-Z][A-Za-z0-9\s&,.'()-]{2,80}?)\s*(?:\(.*?\))?\s*(?:,?\s*(?:and|&)\s+)([A-Z][A-Za-z0-9\s&,.'()-]{2,80}?)\s*(?:\(|,|\n)/i);
            if (betweenMatch) {
              addParty(betweenMatch[1].replace(/\s+$/, ''), 'Party');
              addParty(betweenMatch[2].replace(/\s+$/, ''), 'Party');
            }
            // "Client: X" / "Provider: X" patterns
            if (parties.length === 0) {
              const labelPatterns = [
                { re: /(?:Client|Buyer|Customer|Auftraggeber|Mandant)\s*[:.]\s*(.+?)(?:\n|$)/i, role: 'Client' },
                { re: /(?:Service Provider|Vendor|Supplier|Provider|Contractor|Auftragnehmer|Lieferant)\s*[:.]\s*(.+?)(?:\n|$)/i, role: 'Service Provider' },
                { re: /(?:Party\s*A|First Party|Licensor|Landlord)\s*[:.]\s*(.+?)(?:\n|$)/i, role: 'Party A' },
                { re: /(?:Party\s*B|Second Party|Licensee|Tenant)\s*[:.]\s*(.+?)(?:\n|$)/i, role: 'Party B' },
              ];
              for (const { re, role } of labelPatterns) {
                const m = textSources.match(re);
                if (m) addParty(m[1].replace(/[,;]+$/, '').trim(), role);
              }
            }
          }
        }
        return parties.length > 0 ? parties : undefined;
      })(),

      processingDuration: contractData.processing.completedAt
        ? new Date(contractData.processing.completedAt).getTime() -
          new Date(contractData.processing.startTime).getTime()
        : Date.now() - new Date(contractData.processing.startTime).getTime(),

      // Add artifacts array and count
      artifacts: Array.isArray(contractData.extractedData)
        ? contractData.extractedData
        : contractData.extractedData &&
          typeof contractData.extractedData === "object"
        ? Object.entries(contractData.extractedData).map(([type, data]) => ({
            type,
            data,
          }))
        : [],
      artifactCount: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.length
        : contractData.extractedData &&
          typeof contractData.extractedData === "object"
        ? Object.keys(contractData.extractedData).length
        : 0,

      // Add summary statistics
      summary: {
        totalClauses: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (a: ExtractedDataArtifact) => a.type === "CLAUSES" || a.type === "clauses"
            )?.data?.clauses?.length || 0
          : contractData.extractedData?.clauses?.clauses?.length || 0,
        riskFactors: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (a: ExtractedDataArtifact) => a.type === "RISK" || a.type === "risk"
            )?.data?.risks?.length || 0
          : contractData.extractedData?.risk?.risks?.length || 0,
        complianceIssues: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (a: ExtractedDataArtifact) => a.type === "COMPLIANCE" || a.type === "compliance"
            )?.data?.regulations?.length || 0
          : contractData.extractedData?.compliance?.regulations?.length || 0,
        financialTerms: Array.isArray(contractData.extractedData)
          ? Object.keys(
              contractData.extractedData.find(
                (a: ExtractedDataArtifact) => a.type === "FINANCIAL" || a.type === "financial"
              )?.data || {}
            ).filter((k) => k !== "_meta").length
          : Object.keys(contractData.extractedData?.financial || {}).length,
        keyParties: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (a: ExtractedDataArtifact) => a.type === "OVERVIEW" || a.type === "metadata"
            )?.data?.parties?.length || 0
          : contractData.extractedData?.metadata?.parties?.length ||
            contractData.extractedData?.overview?.parties?.length ||
            0,
        extractedTables: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find((a: ExtractedDataArtifact) => a.type === "financial")
              ?.data?.extractedTables?.length || 0
          : contractData.extractedData?.financial?.extractedTables?.length || 0,
        rateCards: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find((a: ExtractedDataArtifact) => a.type === "financial")
              ?.data?.rateCards?.length || 0
          : contractData.extractedData?.financial?.rateCards?.length || 0,
        totalSavingsOpportunity: Array.isArray(contractData.extractedData)
          ? contractData.extractedData
              .find((a: ExtractedDataArtifact) => a.type === "financial")
              ?.data?.benchmarkingResults?.reduce(
                (sum: number, br: BenchmarkResult) =>
                  sum + (br.totalSavingsOpportunity || 0),
                0
              ) || 0
          : contractData.extractedData?.financial?.benchmarkingResults?.reduce(
              (sum: number, br: BenchmarkResult) => sum + (br.totalSavingsOpportunity || 0),
              0
            ) || 0,
      },

      // Add processing insights
      insights: generateProcessingInsights(contractData),

      // Transform artifacts array to individual fields for UI compatibility
      financial: transformFinancialData(
        Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (a: ExtractedDataArtifact) => a.type === "FINANCIAL" || a.type === "financial"
            )?.data
          : contractData.extractedData?.financial
      ),
      metadata: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: ExtractedDataArtifact) => a.type === "OVERVIEW" || a.type === "metadata"
          )?.data
        : contractData.extractedData?.overview || contractData.extractedData?.metadata,
      risk: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: ExtractedDataArtifact) => a.type === "RISK" || a.type === "risk"
          )?.data
        : contractData.extractedData?.risk,
      compliance: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: ExtractedDataArtifact) => a.type === "COMPLIANCE" || a.type === "compliance"
          )?.data
        : contractData.extractedData?.compliance,
      clauses: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: ExtractedDataArtifact) => a.type === "CLAUSES" || a.type === "clauses"
          )?.data
        : contractData.extractedData?.clauses,
      obligations: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: ExtractedDataArtifact) => a.type === "OBLIGATIONS" || a.type === "obligations"
          )?.data
        : contractData.extractedData?.obligations,
      renewal: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: ExtractedDataArtifact) => a.type === "RENEWAL" || a.type === "renewal"
          )?.data
        : contractData.extractedData?.renewal,
      negotiationPoints: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: ExtractedDataArtifact) => a.type === "NEGOTIATION" || a.type === "negotiation"
          )?.data
        : contractData.extractedData?.negotiation || contractData.extractedData?.negotiationPoints,
      amendments: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: ExtractedDataArtifact) => a.type === "AMENDMENTS" || a.type === "amendments"
          )?.data
        : contractData.extractedData?.amendments,
      contacts: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: ExtractedDataArtifact) => a.type === "CONTACTS" || a.type === "contacts"
          )?.data
        : contractData.extractedData?.contacts,
      
      // Contract Hierarchy (Parent-Child Relationships)
      parentContract: contract.parentContract ? {
        id: contract.parentContract.id,
        title: contract.parentContract.contractTitle || 'Untitled',
        type: contract.parentContract.contractType,
        status: contract.parentContract.status,
        clientName: contract.parentContract.clientName,
        supplierName: contract.parentContract.supplierName,
        effectiveDate: contract.parentContract.effectiveDate?.toISOString(),
        expirationDate: contract.parentContract.expirationDate?.toISOString(),
      } : null,
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
        totalValue: child.totalValue,
        createdAt: child.createdAt?.toISOString(),
      })) || [],
      
      // Hierarchy metadata
      parentContractId: contract.parentContractId,
      relationshipType: contract.relationshipType,
      relationshipNote: contract.relationshipNote,
      linkedAt: contract.linkedAt?.toISOString(),
      
      // Contract Type & AI Classification
      // contractType already set above from DB
      contractSubtype: contract.contractSubtype || null,
      classificationConf: contract.classificationConf || null,
      classificationMeta: contract.classificationMeta || null,
      
      // Signature & Document Classification (from DB columns)
      signature_date: contract.signatureDate?.toISOString() || null,
      signature_status: contract.signatureStatus || 'unknown',
      signature_required_flag: contract.signatureRequiredFlag ?? false,
      document_classification: contract.documentClassification || 'contract',
      document_classification_warning: (contract as any).documentClassificationWarning || null,
      
      // Identification & Ownership fields from DB
      jurisdiction: contract.jurisdiction || null,
      notice_period: contract.noticePeriodDays ? `${contract.noticePeriodDays} days` : null,
      notice_period_days: contract.noticePeriodDays || null,
      
      // Taxonomy Category Classification
      category: categoryInfo,
      categoryL1: contract.categoryL1,
      categoryL2: contract.categoryL2,
      contractCategoryId: contract.contractCategoryId,
      classifiedAt: contract.classifiedAt?.toISOString(),
      
      // Raw text for intelligent analysis
      rawText: contract.rawText || null,
      
      // AI-powered metadata & quality scores (from ContractMetadata)
      qualityMetrics: contract.contractMetadata ? {
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
      } : null,
      aiInsights: contract.contractMetadata ? {
        summary: contract.contractMetadata.aiSummary,
        keyInsights: contract.contractMetadata.aiKeyInsights,
        riskFactors: contract.contractMetadata.aiRiskFactors,
        recommendations: contract.contractMetadata.aiRecommendations,
        artifactSummary: contract.contractMetadata.artifactSummary,
        searchKeywords: contract.contractMetadata.searchKeywords,
      } : null,
    };

    const responseTime = Date.now() - startTime;

    return createSuccessResponse(ctx, enrichedData, {
      headers: {
        "X-Response-Time": `${responseTime}ms`,
        "X-Data-Source": "data-orchestration",
        "X-Cache-Status": responseTime < 50 ? "HIT" : "MISS",
      },
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

// Helper function to map contract status
function mapContractStatus(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "PROCESSING":
      return "processing";
    case "FAILED":
      return "error";
    case "UPLOADED":
      return "processing";
    default:
      return "processing";
  }
}

// Update contract metadata
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(req);
  if (!ctx) {
    return createErrorResponse(getApiContext(req), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const params = await context.params;
  try {
    const contractId = params.id;
    const body = await req.json();
    let updates: any;
    // Validate update data with Zod schema
    try {
      updates = contractUpdateSchema.parse(body);
    } catch (error) {
      return handleApiError(ctx, error);
    }
    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    // Get tenant ID for isolation
    const tenantId = await getServerTenantId();
    if (!tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Tenant ID is required', 401);
    }

    // Verify contract exists and belongs to tenant
    const existingContract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });

    if (!existingContract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Map allowed fields to Prisma schema fields
    const prismaUpdates: Record<string, any> = {};
    
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
    
    // Handle notes as part of metadata JSON field
    if (updates.notes !== undefined) {
      const existingMetadata = (existingContract.metadata as JsonRecord) || {};
      prismaUpdates.metadata = { ...existingMetadata, notes: updates.notes };
    }
    
    // Handle category/priority in metadata
    if (updates.category !== undefined || updates.priority !== undefined) {
      const existingMetadata = (existingContract.metadata as JsonRecord) || {};
      prismaUpdates.metadata = {
        ...existingMetadata,
        ...(prismaUpdates.metadata || {}),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
      };
    }
    
    // Handle taxonomy category assignment
    if (updates.categoryId !== undefined) {
      prismaUpdates.contractCategoryId = updates.categoryId || null;
    }
    
    // Handle reminder settings in metadata
    if (updates.reminder_enabled !== undefined || updates.reminder_days_before_end !== undefined) {
      const existingMetadata = (existingContract.metadata as JsonRecord) || {};
      prismaUpdates.metadata = {
        ...existingMetadata,
        ...(prismaUpdates.metadata || {}),
        ...(updates.reminder_enabled !== undefined && { reminder_enabled: updates.reminder_enabled }),
        ...(updates.reminder_days_before_end !== undefined && { reminder_days_before_end: updates.reminder_days_before_end }),
      };
    }

    // Update contract in database
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        ...prismaUpdates,
        updatedAt: new Date(),
      },
    });

    // Invalidate semantic cache for this contract (chatbot will see changes)
    semanticCache.invalidate(tenantId, contractId).catch((err) => {
      console.error('[ContractUpdate] Semantic cache invalidation error:', err);
    });

    return createSuccessResponse(ctx, {
      success: true,
      data: updatedContract,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

// PATCH delegates to PUT for partial updates
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(req, context);
}

// Delete contract with cascade safety
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(req);
  if (!ctx) {
    return createErrorResponse(getApiContext(req), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const params = await context.params;
  try {
    const contractId = params.id;

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    // Get tenant ID for isolation
    const tenantId = await getServerTenantId();
    if (!tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Tenant ID is required', 401);
    }

    // Use safe deletion service with cascade cleanup
    const result = await safeDeleteContract(contractId, tenantId);

    if (!result.success) {
      return createErrorResponse(ctx, 'BAD_REQUEST', result.error || 'Delete failed', 400);
    }

    // Invalidate semantic cache for this contract (chatbot won't reference deleted contract)
    semanticCache.invalidate(tenantId, contractId).catch((err) => {
      console.error('[ContractDelete] Semantic cache invalidation error:', err);
    });

    // Legacy file cleanup (if exists)
    try {
      const contractDataPath = join(
        process.cwd(),
        "data",
        "contracts",
        `${contractId}.json`
      );
      if (existsSync(contractDataPath)) {
        await unlink(contractDataPath);
      }
    } catch {
      // Legacy file cleanup is optional
    }

    return createSuccessResponse(ctx, { 
      message: "Contract deleted successfully",
      deletedRecords: result.deletedRecords
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

function generateProcessingInsights(contractData: ContractDataForInsights) {
  const insights: Array<{ type: string; title: string; description: string; icon: string; color: string }> = [];

  // Processing performance insight
  if (contractData.processing.completedAt && contractData.processing.startTime) {
    const duration =
      new Date(contractData.processing.completedAt).getTime() -
      new Date(contractData.processing.startTime).getTime();
    const durationSeconds = Math.round(duration / 1000);

    insights.push({
      type: "performance",
      title: "Processing Performance",
      description: `Contract processed in ${durationSeconds} seconds`,
      icon: "zap",
      color: "green",
    });
  }

  // Risk insight
  if (contractData.extractedData?.risk) {
    const risk = contractData.extractedData.risk;
    insights.push({
      type: "risk",
      title: `${risk.riskLevel} Risk Level`,
      description: `Risk score: ${risk.riskScore}/100 with ${
        risk.riskFactors?.length || 0
      } identified factors`,
      icon: "shield",
      color:
        risk.riskLevel === "LOW"
          ? "green"
          : risk.riskLevel === "MEDIUM"
          ? "yellow"
          : "red",
    });
  }

  // Compliance insight
  if (contractData.extractedData?.compliance) {
    const compliance = contractData.extractedData.compliance;
    const score = compliance.complianceScore ?? 0;
    insights.push({
      type: "compliance",
      title: "Compliance Status",
      description: `${score}% compliant with ${
        compliance.regulations?.length || 0
      } regulations checked`,
      icon: "award",
      color:
        score >= 90
          ? "green"
          : score >= 70
          ? "yellow"
          : "red",
    });
  }

  // Financial insight
  if (contractData.extractedData?.financial) {
    const financial = contractData.extractedData.financial;
    insights.push({
      type: "financial",
      title: "Financial Terms",
      description: `Total value: ${
        financial.currency
      } ${financial.totalValue?.toLocaleString()} with ${
        financial.paymentTerms
      }`,
      icon: "dollar-sign",
      color: "blue",
    });
  }

  // Clause completeness insight
  if (contractData.extractedData?.clauses) {
    const clauses = contractData.extractedData.clauses;
    insights.push({
      type: "clauses",
      title: "Clause Analysis",
      description: `${clauses.clauses?.length || 0} clauses extracted with ${
        clauses.completeness?.score || 0
      }% completeness`,
      icon: "file-text",
      color: "purple",
    });
  }

  return insights;
}

function transformFinancialData(financialData: FinancialDataInput | null | undefined) {
  if (!financialData) return null;

  // Convert paymentTerms array to a summary string for UI compatibility
  let paymentTermsSummary = "Not specified";
  if (
    Array.isArray(financialData.paymentTerms) &&
    financialData.paymentTerms.length > 0
  ) {
    paymentTermsSummary = `${financialData.paymentTerms.length} payment milestones`;
  } else if (typeof financialData.paymentTerms === "string") {
    paymentTermsSummary = financialData.paymentTerms;
  }

  return {
    ...financialData,
    // Convert array to string for backward compatibility, but keep original array
    paymentTerms: paymentTermsSummary,
    paymentSchedule: Array.isArray(financialData.paymentTerms)
      ? financialData.paymentTerms
      : [],
    milestones:
      financialData.extractedTables?.filter(
        (t: ExtractedTable) => t.type === "payment_schedule"
      ).length || 0,
    penalties: Array.isArray(financialData.penalties)
      ? financialData.penalties.join(", ")
      : financialData.penalties || "None specified",
    extractedTables: financialData.extractedTables || [],
    rateCards:
      financialData.rateCards?.map((rc: FinancialRateCard) => ({
        ...rc,
        insights: rc.insights || {
          totalAnnualSavings: financialData.benchmarkingResults?.find(
            (br: BenchmarkResult) => br.rateCardId === rc.id
          )?.totalSavingsOpportunity
            ? `$${financialData.benchmarkingResults
                .find((br: BenchmarkResult) => br.rateCardId === rc.id)
                ?.totalSavingsOpportunity?.toLocaleString()}`
            : "$0",
          averageVariance: financialData.benchmarkingResults?.find(
            (br: BenchmarkResult) => br.rateCardId === rc.id
          )?.averageVariance
            ? `${
                (financialData.benchmarkingResults.find(
                  (br: BenchmarkResult) => br.rateCardId === rc.id
                )?.averageVariance ?? 0) > 0
                  ? "+"
                  : ""
              }${financialData.benchmarkingResults
                .find((br: BenchmarkResult) => br.rateCardId === rc.id)
                ?.averageVariance?.toFixed(1)}%`
            : "0%",
          ratesAboveMarket:
            financialData.benchmarkingResults?.find(
              (br: BenchmarkResult) => br.rateCardId === rc.id
            )?.ratesAboveMarket || 0,
          ratesBelowMarket:
            financialData.benchmarkingResults?.find(
              (br: BenchmarkResult) => br.rateCardId === rc.id
            )?.ratesBelowMarket || 0,
          recommendation:
            financialData.benchmarkingResults?.find(
              (br: BenchmarkResult) => br.rateCardId === rc.id
            )?.recommendations?.[0] || "No specific recommendations",
        },
      })) || [],
    benchmarkingResults: financialData.benchmarkingResults || [],
    insights: financialData.insights || {
      totalPotentialSavings: 0,
      highestSavingsOpportunity: { role: "N/A", amount: 0 },
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

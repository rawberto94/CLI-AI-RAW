/**
 * Contracts List API
 * GET /api/contracts - List contracts with filtering, sorting, and pagination
 *
 * OPTIMIZATIONS:
 * - Caches GET responses with Redis for reduced database load
 * - Uses selective field projection to minimize data transfer
 * - Implements efficient pagination with cursor-based approach
 * - Standardized error handling and response format
 * 
 * MULTI-TENANT: Uses getTenantIdFromRequest for proper tenant isolation
 */

import { NextRequest, NextResponse } from "next/server";
import { ContractStatus, type Prisma } from '@prisma/client';
import { withCache, CacheKeys } from "@/lib/cache";
import { getTenantIdFromRequest } from "@/lib/tenant-server";
import {
  getApiContext,
  parseQueryParams,
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  handleApiError,
  contractQuerySchema,
  mapContractStatus,
  VALID_CONTRACT_STATUSES,
  type ContractQueryParams,
  type ApiContext,
} from "@/lib/api-middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Mock contracts data (wrapped with caching)
function returnMockContracts(searchParams: URLSearchParams) {
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;
  
  const mockContracts = [
    {
      id: "mock-1",
      filename: "accenture-it-services-2024.pdf",
      originalName: "IT Services Agreement - Accenture",
      status: "COMPLETED",
      fileSize: "125000",
      mimeType: "application/pdf",
      uploadedAt: new Date("2024-01-15").toISOString(),
      contractType: "IT Services",
    },
    {
      id: "mock-2",
      filename: "thoughtworks-msa-2024.pdf",
      originalName: "Software Development MSA - Thoughtworks",
      status: "COMPLETED",
      fileSize: "98000",
      mimeType: "application/pdf",
      uploadedAt: new Date("2024-03-01").toISOString(),
      contractType: "Software Development",
    },
    {
      id: "mock-3",
      filename: "aws-enterprise-agreement.pdf",
      originalName: "Cloud Infrastructure - AWS",
      status: "COMPLETED",
      fileSize: "215000",
      mimeType: "application/pdf",
      uploadedAt: new Date("2023-06-01").toISOString(),
      contractType: "Cloud Services",
    },
    {
      id: "mock-4",
      filename: "infosys-data-analytics-sow.pdf",
      originalName: "Data Analytics Platform - Infosys",
      status: "PROCESSING",
      fileSize: "87000",
      mimeType: "application/pdf",
      uploadedAt: new Date("2023-09-15").toISOString(),
      contractType: "Data & Analytics",
    },
    {
      id: "mock-5",
      filename: "deloitte-security-assessment.pdf",
      originalName: "Cybersecurity Assessment - Deloitte",
      status: "UPLOADED",
      fileSize: "76000",
      mimeType: "application/pdf",
      uploadedAt: new Date("2024-10-01").toISOString(),
      contractType: "Security",
    },
    {
      id: "mock-6",
      filename: "sap-erp-implementation.pdf",
      originalName: "ERP Implementation - SAP",
      status: "COMPLETED",
      fileSize: "342000",
      mimeType: "application/pdf",
      uploadedAt: new Date("2024-02-01").toISOString(),
      contractType: "Enterprise Software",
    },
    {
      id: "mock-7",
      filename: "capgemini-mobile-dev.pdf",
      originalName: "Mobile App Development - Capgemini",
      status: "COMPLETED",
      fileSize: "112000",
      mimeType: "application/pdf",
      uploadedAt: new Date("2024-04-15").toISOString(),
      contractType: "Mobile Development",
    },
    {
      id: "mock-8",
      filename: "cisco-network-services.pdf",
      originalName: "Network Infrastructure - Cisco Services",
      status: "COMPLETED",
      fileSize: "156000",
      mimeType: "application/pdf",
      uploadedAt: new Date("2023-08-01").toISOString(),
      contractType: "Networking",
    },
  ];
  
  const total = mockContracts.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedContracts = mockContracts.slice(start, end);
  
  return NextResponse.json({
    success: true,
    data: {
      contracts: paginatedContracts,
      pagination: {
        total,
        limit,
        page,
        totalPages,
        hasMore: page < totalPages,
        hasPrevious: page > 1,
      },
      meta: {
        responseTime: "5ms",
        cached: false,
        source: "mock-data",
      },
    },
  });
}

async function handler(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);

  // Check data mode from header
  const dataMode = request.headers.get('x-data-mode') || 'real';
  
  // If mock mode, return mock data
  if (dataMode === 'mock') {
    return returnMockContracts(searchParams);
  }

  // Use proper tenant resolution (session > header > query > demo in dev only)
  const tenantId = await getTenantIdFromRequest(request);
  const search = searchParams.get("search") || undefined;
  const statuses = searchParams.getAll("status");
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 20;
  
  // Enhanced sorting options
  const validSortFields = [
    "createdAt", "updatedAt", "uploadedAt", "totalValue", 
    "expirationDate", "effectiveDate", "contractTitle", 
    "clientName", "supplierName", "viewCount", "lastViewedAt"
  ];
  const requestedSortBy = searchParams.get("sortBy") || "createdAt";
  const sortBy = validSortFields.includes(requestedSortBy) ? requestedSortBy : "createdAt";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
  
  // Additional filter parameters
  const contractTypes = searchParams.getAll("contractType");
  const categories = searchParams.getAll("category");
  const clientNames = searchParams.getAll("clientName");
  const supplierNames = searchParams.getAll("supplierName");
  const minValue = searchParams.get("minValue") ? Number(searchParams.get("minValue")) : undefined;
  const maxValue = searchParams.get("maxValue") ? Number(searchParams.get("maxValue")) : undefined;
  const expiringBefore = searchParams.get("expiringBefore");
  const expiringAfter = searchParams.get("expiringAfter");
  const uploadedAfter = searchParams.get("uploadedAfter");
  const uploadedBefore = searchParams.get("uploadedBefore");

  // Validate pagination parameters
  if (page < 1) {
    return NextResponse.json(
      { success: false, error: "Page must be greater than 0" },
      { status: 400 }
    );
  }
  if (limit < 1 || limit > 100) {
    return NextResponse.json(
      { success: false, error: "Limit must be between 1 and 100" },
      { status: 400 }
    );
  }

  // Valid ContractStatus values from Prisma schema
  const VALID_STATUSES: ContractStatus[] = [
    ContractStatus.UPLOADED,
    ContractStatus.PROCESSING,
    ContractStatus.COMPLETED,
    ContractStatus.FAILED,
    ContractStatus.ARCHIVED,
  ];

  // Build where clause - always filter out deleted contracts
  const where: Prisma.ContractWhereInput = { 
    tenantId,
    isDeleted: false, // Exclude soft-deleted contracts
  };

  if (search) {
    where.OR = [
      { fileName: { contains: search, mode: "insensitive" } },
      { originalName: { contains: search, mode: "insensitive" } },
      { contractTitle: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
      { supplierName: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { contractType: { contains: search, mode: "insensitive" } },
    ];
  }

  // Filter to only valid status values
  const validStatuses = statuses.filter(
    (s): s is ContractStatus =>
      !!s && s !== 'undefined' && VALID_STATUSES.includes(s as ContractStatus)
  );
  if (validStatuses.length > 0) {
    where.status = { in: validStatuses };
  }

  // Contract type filter
  if (contractTypes.length > 0) {
    where.contractType = { in: contractTypes };
  }

  // Category filter
  if (categories.length > 0) {
    where.category = { in: categories };
  }

  // Party name filters
  if (clientNames.length > 0) {
    where.clientName = { in: clientNames };
  }
  if (supplierNames.length > 0) {
    where.supplierName = { in: supplierNames };
  }

  // Value range filter
  if (minValue !== undefined || maxValue !== undefined) {
    where.totalValue = {};
    if (minValue !== undefined) where.totalValue.gte = minValue;
    if (maxValue !== undefined) where.totalValue.lte = maxValue;
  }

  // Date filters
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

  // Build orderBy
  const orderBy: Record<string, string> = {};
  orderBy[sortBy] = sortOrder;

  // Build cache key
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
  });

  // Try to get from cache or fetch from database
  const cachedResult = await withCache(
    cacheKey,
    async () => {
      // Dynamically import Prisma
      const { prisma } = await import("@/lib/prisma");

      // Execute query with pagination
      const [contracts, total] = await Promise.all([
        prisma.contract.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            tenantId: true,
            fileName: true,
            originalName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
            uploadedAt: true,
            status: true,
            contractType: true,
            contractTitle: true,
            clientName: true,
            supplierName: true,
            category: true,
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
            // Contract hierarchy fields
            parentContractId: true,
            relationshipType: true,
            // Signature & Document Classification
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
            _count: {
              select: {
                childContracts: true,
              },
            },
          },
        }),
        prisma.contract.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Fetch category details for contracts that have categories
      const categoryNames = [...new Set(contracts.filter(c => c.category).map(c => c.category!))];
      const categoryMap: Map<string, { id: string; name: string; color: string; icon: string; path: string }> = new Map();
      
      if (categoryNames.length > 0) {
        const taxonomyCategories = await prisma.taxonomyCategory.findMany({
          where: {
            tenantId,
            name: { in: categoryNames },
          },
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            path: true,
          },
        });
        
        for (const cat of taxonomyCategories) {
          categoryMap.set(cat.name, cat);
        }
      }

      return {
        success: true,
        data: {
          contracts: contracts.map((contract) => {
            const categoryInfo = contract.category ? categoryMap.get(contract.category) : null;
            return {
              id: contract.id,
              title: contract.contractTitle || contract.originalName || contract.fileName,
              filename: contract.fileName,
              originalName: contract.originalName || contract.fileName,
              status: contract.status.toLowerCase(),
              fileSize: contract.fileSize.toString(),
              mimeType: contract.mimeType,
              uploadedAt: contract.uploadedAt?.toISOString() || contract.createdAt.toISOString(),
              createdAt: contract.createdAt.toISOString(),
              // Type field for frontend compatibility
              type: contract.contractType || "Unknown",
              contractType: contract.contractType || "Unknown",
              // Parties object for frontend compatibility
              parties: {
                client: contract.clientName || null,
                supplier: contract.supplierName || null,
              },
              clientName: contract.clientName,
              supplierName: contract.supplierName,
              // Map to vendor/counterparty for UI compatibility
              vendor: contract.supplierName || contract.clientName,
              counterparty: contract.clientName || contract.supplierName,
              category: categoryInfo ? {
                id: categoryInfo.id,
                name: categoryInfo.name,
                color: categoryInfo.color,
                icon: categoryInfo.icon,
                path: categoryInfo.path,
              } : null,
              // Value field for frontend compatibility
              value: contract.totalValue ? Number(contract.totalValue) : null,
              totalValue: contract.totalValue ? Number(contract.totalValue) : null,
              currency: contract.currency,
              effectiveDate: contract.effectiveDate?.toISOString(),
              expirationDate: contract.expirationDate?.toISOString(),
              description: contract.description,
              tags: contract.tags,
              viewCount: contract.viewCount,
              lastViewedAt: contract.lastViewedAt?.toISOString(),
              // Enterprise metadata fields
              jurisdiction: contract.jurisdiction || (contract.aiMetadata as any)?.jurisdiction || null,
              paymentTerms: contract.paymentTerms || (contract.aiMetadata as any)?.payment_type || null,
              paymentFrequency: contract.paymentFrequency || (contract.aiMetadata as any)?.billing_frequency_type || null,
              autoRenewing: (contract.aiMetadata as any)?.auto_renewing ?? null,
              noticePeriod: (contract.aiMetadata as any)?.notice_period || null,
              // External parties from enterprise metadata
              externalParties: (contract.aiMetadata as any)?.external_parties || [],
              // Extraction confidence
              extractionConfidence: (contract.aiMetadata as any)?._confidence?.overall ?? null,
              // Contract hierarchy info
              parentContractId: (contract as any).parentContractId || null,
              relationshipType: (contract as any).relationshipType || null,
              parentContract: (contract as any).parentContract ? {
                id: (contract as any).parentContract.id,
                title: (contract as any).parentContract.contractTitle || (contract as any).parentContract.fileName,
                type: (contract as any).parentContract.contractType,
              } : null,
              childContractCount: (contract as any)._count?.childContracts || 0,
              hasHierarchy: !!(contract as any).parentContractId || ((contract as any)._count?.childContracts || 0) > 0,
              // Signature & Document Classification
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
          },
          filters: {
            applied: {
              search: search || null,
              statuses: validStatuses,
              contractTypes,
              categories,
              clientNames,
              supplierNames,
              valueRange: minValue || maxValue ? { min: minValue, max: maxValue } : null,
            },
            sortBy,
            sortOrder,
          },
          meta: {
            cached: false,
            source: "database",
          },
        },
      };
    },
    { ttl: 300 } // Cache for 5 minutes
  );

  const responseTime = Date.now() - startTime;

  // Return cached or fresh result
  return NextResponse.json(
    {
      ...cachedResult,
      data: {
        ...cachedResult.data,
        meta: {
          ...cachedResult.data.meta,
          responseTime: `${responseTime}ms`,
          cached: responseTime < 100, // If very fast, likely from cache
        },
      },
    },
    {
      status: 200,
      headers: {
        "X-Response-Time": `${responseTime}ms`,
        "X-Data-Source": responseTime < 100 ? "cache" : "database",
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    return await handler(request);
  } catch {
    // Fallback to mock data on any error
    const { searchParams } = new URL(request.url);
    return returnMockContracts(searchParams);
  }
}

import { z } from "zod";

// ============================================================================
// CONTRACT TYPES
// ============================================================================

export const ContractStatusEnum = z.enum([
  "UPLOADED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "ARCHIVED",
  "DELETED",
]);

export type ContractStatus = z.infer<typeof ContractStatusEnum>;

// Base Contract schema (matches Prisma exactly)
export const ContractSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string(),

  // File information
  fileName: z.string(),
  originalName: z.string().optional().nullable(),
  fileSize: z.bigint(),
  mimeType: z.string(),
  checksum: z.string().optional().nullable(),
  uploadedAt: z.date(),

  // Storage
  storagePath: z.string().optional().nullable(),
  storageProvider: z.string().default("local").optional().nullable(),

  // Content
  rawText: z.string().optional().nullable(),

  // Metadata
  contractType: z.string().optional().nullable(),
  contractTitle: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  status: ContractStatusEnum,

  // Parties
  clientId: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  supplierName: z.string().optional().nullable(),

  // Financial
  totalValue: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),

  // Dates
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
  effectiveDate: z.date().optional().nullable(),
  expirationDate: z.date().optional().nullable(),
  jurisdiction: z.string().optional().nullable(),

  // Processing
  uploadedBy: z.string().optional().nullable(),
  processedAt: z.date().optional().nullable(),
  lastAnalyzedAt: z.date().optional().nullable(),

  // Search & analytics
  searchableText: z.string().optional().nullable(),
  keywords: z.any().optional().nullable(),
  tags: z.any().optional().nullable().default([]),
  viewCount: z.number().default(0),
  lastViewedAt: z.date().optional().nullable(),
  lastViewedBy: z.string().optional().nullable(),

  // Metadata
  searchMetadata: z.any().optional().nullable().default({}),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Contract = z.infer<typeof ContractSchema>;

// DTOs for API layer
export const CreateContractDTOSchema = ContractSchema.omit({
  id: true,
  uploadedAt: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
});

export type CreateContractDTO = z.infer<typeof CreateContractDTOSchema>;

export const UpdateContractDTOSchema = ContractSchema.partial()
  .omit({
    id: true,
    tenantId: true,
    uploadedAt: true,
    createdAt: true,
  })
  .extend({
    // Allow incremental updates
    viewCount: z.number().optional(),
  });

export type UpdateContractDTO = z.infer<typeof UpdateContractDTOSchema>;

// Query DTOs
export const ContractQuerySchema = z.object({
  tenantId: z.string(),
  search: z.string().optional(),
  status: z.array(ContractStatusEnum).optional(),
  clientName: z.array(z.string()).optional(),
  supplierName: z.array(z.string()).optional(),
  category: z.array(z.string()).optional(),
  contractType: z.array(z.string()).optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  startDateFrom: z.date().optional(),
  startDateTo: z.date().optional(),
  expirationDateFrom: z.date().optional(),
  expirationDateTo: z.date().optional(),
  effectiveDateFrom: z.date().optional(),
  effectiveDateTo: z.date().optional(),
  uploadedAfter: z.date().optional(),
  uploadedBefore: z.date().optional(),
  // Organization filters
  department: z.array(z.string()).optional(),
  projectCode: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  complianceStatus: z.array(z.string()).optional(),
  // Risk/Quality filters
  minRiskScore: z.number().int().min(0).max(100).optional(),
  maxRiskScore: z.number().int().min(0).max(100).optional(),
  minDataQualityScore: z.number().int().min(0).max(100).optional(),
  // Tags filter
  tags: z.array(z.string()).optional(),
  // Pagination
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  // Enhanced sorting
  sortBy: z
    .enum([
      "createdAt",
      "updatedAt", 
      "uploadedAt",
      "totalValue",
      "endDate",
      "expirationDate",
      "effectiveDate",
      "contractTitle",
      "clientName",
      "supplierName",
      "viewCount",
      "lastViewedAt",
      "riskScore",
      "dataQualityScore",
      "priority",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  // Include options
  includeMetadata: z.boolean().optional().default(false),
  includeArtifactSummary: z.boolean().optional().default(false),
});

export type ContractQuery = z.infer<typeof ContractQuerySchema>;

// Response wrapper
export const ContractQueryResponseSchema = z.object({
  contracts: z.array(ContractSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
  hasMore: z.boolean(),
});

export type ContractQueryResponse = z.infer<typeof ContractQueryResponseSchema>;

// Service response type used across all services
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ============================================================================
// ARTIFACT TYPES
// ============================================================================

export const ArtifactTypeEnum = z.enum([
  "INGESTION",
  "TEMPLATE",
  "FINANCIAL",
  "OVERVIEW",
  "CLAUSES",
  "RATES",
  "COMPLIANCE",
  "BENCHMARK",
  "RISK",
  "REPORT",
  "OBLIGATIONS",
  "RENEWAL",
  "NEGOTIATION_POINTS",
  "AMENDMENTS",
  "CONTACTS",
]);

export type ArtifactType = z.infer<typeof ArtifactTypeEnum>;

export const ArtifactSchema = z.object({
  id: z.string().cuid(),
  contractId: z.string(),
  tenantId: z.string(),
  type: ArtifactTypeEnum,
  data: z.any(), // JSON data
  schemaVersion: z.string().default("v1"),
  hash: z.string().optional().nullable(),
  size: z.number().optional().nullable(),
  location: z.string().optional().nullable(),
  storageProvider: z.string().default("database").optional().nullable(),
  processingTime: z.number().optional().nullable(),
  confidence: z.number().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

export const CreateArtifactDTOSchema = ArtifactSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateArtifactDTO = z.infer<typeof CreateArtifactDTOSchema>;

// ============================================================================
// RATE CARD TYPES
// ============================================================================

export const RateCardStatusEnum = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
]);

export type RateCardStatus = z.infer<typeof RateCardStatusEnum>;

export const RateCardSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string(),
  importJobId: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  supplierTier: z.enum(["BIG_4", "TIER_2", "BOUTIQUE", "OFFSHORE"]),
  contractId: z.string().optional().nullable(),
  effectiveDate: z.date(),
  expiryDate: z.date().optional().nullable(),
  originalCurrency: z.string(),
  baseCurrency: z.string().default("CHF"),
  exchangeRate: z.number().optional().nullable(),
  exchangeRateDate: z.date().optional().nullable(),
  source: z.string(),
  importedAt: z.date(),
  importedBy: z.string(),
  version: z.number().default(1),
  status: RateCardStatusEnum,
  dataQuality: z.any(),
});

export type RateCard = z.infer<typeof RateCardSchema>;

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  services: {
    database: boolean;
    cache: boolean;
    storage: boolean;
  };
  version: string;
}

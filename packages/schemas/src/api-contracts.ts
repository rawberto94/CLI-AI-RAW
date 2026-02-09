/**
 * API Request/Response Schemas — ConTigo Platform
 * 
 * Zod schemas for validating API requests and typing responses.
 * Used by both route handlers (validation) and frontend (type generation).
 * 
 * @module api-contracts
 */

import { z } from 'zod';

// ============================================================================
// Common / Shared
// ============================================================================

/** Standard pagination parameters shared by all list endpoints */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Standard sort parameters */
export const sortSchema = z.object({
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** Standard date range filter */
export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/** Standard API success response envelope */
export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({
      requestId: z.string(),
      timestamp: z.string().datetime(),
      responseTime: z.string(),
      cached: z.boolean(),
      dataSource: z.string(),
    }),
  });

/** Standard API error response envelope */
export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.string().optional(),
    field: z.string().optional(),
    retryable: z.boolean(),
  }),
  meta: z.object({
    requestId: z.string(),
    timestamp: z.string().datetime(),
  }),
});

/** Standard pagination response metadata */
export const paginationResponseSchema = z.object({
  total: z.number(),
  limit: z.number(),
  page: z.number(),
  totalPages: z.number(),
  hasMore: z.boolean(),
  hasPrevious: z.boolean(),
});

// ============================================================================
// Contracts
// ============================================================================

/** GET /api/contracts — Query parameters */
export const contractListQuerySchema = z.object({
  ...paginationSchema.shape,
  search: z.string().optional(),
  status: z.array(z.enum([
    'UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED', 'ARCHIVED',
    'ACTIVE', 'PENDING', 'DRAFT', 'EXPIRED', 'CANCELLED',
  ])).optional(),
  sortBy: z.enum([
    'createdAt', 'updatedAt', 'uploadedAt', 'totalValue',
    'expirationDate', 'effectiveDate', 'contractTitle',
    'clientName', 'supplierName', 'viewCount', 'lastViewedAt',
  ]).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  contractType: z.array(z.string()).optional(),
  category: z.array(z.string()).optional(),
  clientName: z.array(z.string()).optional(),
  supplierName: z.array(z.string()).optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  expiringBefore: z.string().datetime().optional(),
  expiringAfter: z.string().datetime().optional(),
  uploadedAfter: z.string().datetime().optional(),
  uploadedBefore: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

/** Contract list item (response shape) */
export const contractListItemSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  filename: z.string(),
  originalName: z.string(),
  status: z.string(),
  fileSize: z.string(),
  mimeType: z.string(),
  uploadedAt: z.string(),
  createdAt: z.string(),
  contractType: z.string(),
  clientName: z.string().nullable(),
  supplierName: z.string().nullable(),
  category: z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    icon: z.string(),
    path: z.string(),
  }).nullable(),
  value: z.number().nullable(),
  totalValue: z.number().nullable(),
  currency: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  expirationDate: z.string().nullable(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  viewCount: z.number(),
});

/** GET /api/contracts — Response */
export const contractListResponseSchema = z.object({
  contracts: z.array(contractListItemSchema),
  pagination: paginationResponseSchema,
  filters: z.object({
    applied: z.record(z.unknown()),
    sortBy: z.string(),
    sortOrder: z.string(),
  }),
});

/** POST /api/contracts — Create contract request */
export const createContractSchema = z.object({
  fileName: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string(),
  fileSize: z.number().positive(),
  filePath: z.string().optional(),
  contractType: z.string().optional(),
  contractTitle: z.string().optional(),
  clientName: z.string().optional(),
  supplierName: z.string().optional(),
  description: z.string().optional(),
  effectiveDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  totalValue: z.number().optional(),
  currency: z.string().length(3).default('CHF'),
  tags: z.array(z.string()).optional(),
});

/** PUT /api/contracts/[id] — Update contract request */
export const updateContractSchema = z.object({
  contractTitle: z.string().optional(),
  contractType: z.string().optional(),
  clientName: z.string().optional(),
  supplierName: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  effectiveDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  totalValue: z.number().optional(),
  currency: z.string().length(3).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum([
    'UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED', 'ARCHIVED',
    'ACTIVE', 'PENDING', 'DRAFT', 'EXPIRED', 'CANCELLED',
  ]).optional(),
});

// ============================================================================
// Rate Cards
// ============================================================================

/** GET /api/rate-cards — Query parameters */
export const rateCardListQuerySchema = z.object({
  ...paginationSchema.shape,
  search: z.string().optional(),
  sortBy: z.enum([
    'createdAt', 'updatedAt', 'name', 'supplier', 'effectiveDate',
  ]).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  supplier: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  contractId: z.string().optional(),
});

/** POST /api/rate-cards — Create rate card */
export const createRateCardSchema = z.object({
  name: z.string().min(1).max(200),
  supplier: z.string().optional(),
  contractId: z.string().optional(),
  effectiveDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  currency: z.string().length(3).default('CHF'),
  rates: z.array(z.object({
    roleName: z.string(),
    level: z.string().optional(),
    location: z.string().optional(),
    dailyRate: z.number().positive(),
    currency: z.string().length(3).default('CHF'),
  })).optional(),
});

// ============================================================================
// AI / Chat
// ============================================================================

/** POST /api/ai/chat — Chat request */
export const aiChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().optional(),
  context: z.object({
    contractId: z.string().optional(),
    page: z.string().optional(),
    selection: z.string().optional(),
  }).optional(),
  model: z.enum(['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet']).optional(),
  stream: z.boolean().optional().default(false),
});

/** POST /api/ai/extract — Extraction request */
export const aiExtractRequestSchema = z.object({
  contractId: z.string(),
  artifactTypes: z.array(z.string()).optional(),
  force: z.boolean().optional().default(false),
});

/** POST /api/ai/compare — Contract comparison request */
export const aiCompareRequestSchema = z.object({
  contractIds: z.array(z.string()).min(2).max(10),
  dimensions: z.array(z.enum([
    'terms', 'pricing', 'risk', 'obligations', 'clauses', 'overall',
  ])).optional(),
});

// ============================================================================
// Admin
// ============================================================================

/** POST /api/admin/security/ip-allowlist — Add IP to allowlist */
export const ipAllowlistCreateSchema = z.object({
  ip: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  expiresAt: z.string().datetime().optional(),
});

/** POST /api/admin/audit/export — Export audit logs */
export const auditExportSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  format: z.enum(['csv', 'json', 'pdf']).default('csv'),
  actions: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
});

// ============================================================================
// Auth
// ============================================================================

/** POST /api/auth/mfa/verify — MFA verification */
export const mfaVerifySchema = z.object({
  code: z.string().length(6),
  method: z.enum(['totp', 'sms', 'email']).default('totp'),
});

// ============================================================================
// Webhooks
// ============================================================================

/** POST /api/webhooks — Register webhook */
export const webhookRegisterSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'contract.created', 'contract.updated', 'contract.deleted',
    'contract.signed', 'contract.expired',
    'extraction.completed', 'extraction.failed',
    'approval.requested', 'approval.completed',
    'obligation.due', 'obligation.overdue',
  ])),
  secret: z.string().min(16).optional(),
  active: z.boolean().default(true),
});

// ============================================================================
// Upload
// ============================================================================

/** POST /api/upload — File upload metadata */
export const uploadRequestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
  ]),
  fileSize: z.number().positive().max(100 * 1024 * 1024), // 100MB max
  contractId: z.string().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ContractListQuery = z.infer<typeof contractListQuerySchema>;
export type ContractListItem = z.infer<typeof contractListItemSchema>;
export type ContractListResponse = z.infer<typeof contractListResponseSchema>;
export type CreateContractRequest = z.infer<typeof createContractSchema>;
export type UpdateContractRequest = z.infer<typeof updateContractSchema>;

export type RateCardListQuery = z.infer<typeof rateCardListQuerySchema>;
export type CreateRateCardRequest = z.infer<typeof createRateCardSchema>;

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;
export type AiExtractRequest = z.infer<typeof aiExtractRequestSchema>;
export type AiCompareRequest = z.infer<typeof aiCompareRequestSchema>;

export type IpAllowlistCreate = z.infer<typeof ipAllowlistCreateSchema>;
export type AuditExportRequest = z.infer<typeof auditExportSchema>;
export type MfaVerifyRequest = z.infer<typeof mfaVerifySchema>;
export type WebhookRegisterRequest = z.infer<typeof webhookRegisterSchema>;
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export type PaginationParams = z.infer<typeof paginationSchema>;
export type PaginationResponse = z.infer<typeof paginationResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

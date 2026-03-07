/**
 * Validation Schemas
 * 
 * Comprehensive Zod schemas for all API inputs
 */

import { z } from 'zod';

// =========================================================================
// COMMON SCHEMAS
// =========================================================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const emailSchema = z.string().email('Invalid email format');

export const urlSchema = z.string().url('Invalid URL format');

export const dateSchema = z.string().datetime('Invalid datetime format');

export const positiveNumberSchema = z.number().positive('Must be a positive number');

export const nonNegativeNumberSchema = z.number().nonnegative('Must be non-negative');

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// =========================================================================
// CONTRACT SCHEMAS
// =========================================================================

const baseContractSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  supplierId: uuidSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  value: positiveNumberSchema.optional(),
  currency: z.string().length(3, 'Currency must be 3-letter code').optional(),
  status: z.enum(['draft', 'active', 'expired', 'terminated']).default('draft'),
  description: z.string().max(2000, 'Description too long').optional(),
  tenantId: uuidSchema,
});

export const createContractSchema = baseContractSchema.refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

export const updateContractSchema = baseContractSchema.partial().extend({
  id: uuidSchema,
});

export const contractQuerySchema = z.object({
  tenantId: uuidSchema,
  status: z.enum(['draft', 'active', 'expired', 'terminated']).optional(),
  supplierId: uuidSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  search: z.string().max(200).optional(),
}).merge(paginationSchema);

// =========================================================================
// RATE CARD SCHEMAS
// =========================================================================

const baseRateCardSchema = z.object({
  role: z.string().min(1, 'Role is required').max(100, 'Role too long'),
  rate: positiveNumberSchema,
  currency: z.string().length(3, 'Currency must be 3-letter code'),
  rateType: z.enum(['hourly', 'daily', 'monthly', 'fixed']),
  location: z.string().max(100, 'Location too long').optional(),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'principal']).optional(),
  supplierId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  effectiveDate: dateSchema,
  expiryDate: dateSchema.optional(),
  tenantId: uuidSchema,
});

export const createRateCardSchema = baseRateCardSchema.refine(
  (data) => !data.expiryDate || new Date(data.expiryDate) > new Date(data.effectiveDate),
  {
    message: 'Expiry date must be after effective date',
    path: ['expiryDate'],
  }
);

export const updateRateCardSchema = baseRateCardSchema.partial().extend({
  id: uuidSchema,
});

export const rateCardQuerySchema = z.object({
  tenantId: uuidSchema,
  role: z.string().max(100).optional(),
  supplierId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  location: z.string().max(100).optional(),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'principal']).optional(),
  minRate: nonNegativeNumberSchema.optional(),
  maxRate: positiveNumberSchema.optional(),
  currency: z.string().length(3).optional(),
  search: z.string().max(200).optional(),
}).merge(paginationSchema);

export const bulkRateCardUpdateSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'At least one ID required').max(100, 'Too many IDs'),
  updates: z.object({
    rate: positiveNumberSchema.optional(),
    currency: z.string().length(3).optional(),
    location: z.string().max(100).optional(),
    seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'principal']).optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    'At least one field must be updated'
  ),
  tenantId: uuidSchema,
});

// =========================================================================
// ARTIFACT SCHEMAS
// =========================================================================

export const createArtifactSchema = z.object({
  contractId: uuidSchema,
  type: z.enum(['metadata', 'rates', 'terms', 'obligations', 'risks']),
  data: z.record(z.any()),
  confidence: z.number().min(0).max(1).optional(),
  version: z.number().int().positive().default(1),
  tenantId: uuidSchema,
});

export const updateArtifactSchema = createArtifactSchema.partial().extend({
  id: uuidSchema,
});

export const artifactQuerySchema = z.object({
  tenantId: uuidSchema,
  contractId: uuidSchema.optional(),
  type: z.enum(['metadata', 'rates', 'terms', 'obligations', 'risks']).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
}).merge(paginationSchema);

// =========================================================================
// FILE UPLOAD SCHEMAS
// =========================================================================

export const fileUploadSchema = z.object({
  filename: z.string().min(1, 'Filename required').max(255, 'Filename too long'),
  mimeType: z.string().regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/i, 'Invalid MIME type'),
  size: z.number().int().positive().max(50 * 1024 * 1024, 'File too large (max 50MB)'),
  tenantId: uuidSchema,
});

export const allowedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
] as const;

export const fileUploadValidationSchema = fileUploadSchema.extend({
  mimeType: z.enum(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'text/csv']),
});

// =========================================================================
// USER SCHEMAS
// =========================================================================

export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(1, 'Name required').max(100, 'Name too long'),
  role: z.enum(['admin', 'user', 'viewer']).default('user'),
  tenantId: uuidSchema,
});

export const updateUserSchema = createUserSchema.partial().extend({
  id: uuidSchema,
});

export const userQuerySchema = z.object({
  tenantId: uuidSchema,
  role: z.enum(['admin', 'user', 'viewer']).optional(),
  search: z.string().max(200).optional(),
}).merge(paginationSchema);

// =========================================================================
// ANALYTICS SCHEMAS
// =========================================================================

export const analyticsQuerySchema = z.object({
  tenantId: uuidSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  metric: z.enum(['contracts', 'rates', 'savings', 'suppliers']).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

// =========================================================================
// SEARCH SCHEMAS
// =========================================================================

export const searchQuerySchema = z.object({
  tenantId: uuidSchema,
  query: z.string().min(1, 'Search query required').max(200, 'Query too long'),
  type: z.enum(['contracts', 'rates', 'suppliers', 'all']).default('all'),
  filters: z.record(z.any()).optional(),
}).merge(paginationSchema);

// =========================================================================
// NOTIFICATION SCHEMAS
// =========================================================================

export const createNotificationSchema = z.object({
  userId: uuidSchema,
  title: z.string().min(1, 'Title required').max(100, 'Title too long'),
  message: z.string().min(1, 'Message required').max(500, 'Message too long'),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  tenantId: uuidSchema,
});

// =========================================================================
// EXPORT SCHEMAS
// =========================================================================

export const exportRequestSchema = z.object({
  tenantId: uuidSchema,
  type: z.enum(['contracts', 'rates', 'analytics']),
  format: z.enum(['csv', 'xlsx', 'pdf', 'json']),
  filters: z.record(z.any()).optional(),
  includeArchived: z.boolean().default(false),
});

// =========================================================================
// WEBHOOK SCHEMAS
// =========================================================================

export const createWebhookSchema = z.object({
  url: urlSchema,
  events: z.array(z.string()).min(1, 'At least one event required'),
  secret: z.string().min(16, 'Secret too short').max(64, 'Secret too long').optional(),
  active: z.boolean().default(true),
  tenantId: uuidSchema,
});

export const updateWebhookSchema = createWebhookSchema.partial().extend({
  id: uuidSchema,
});

// =========================================================================
// BASELINE SCHEMAS
// =========================================================================

export const createBaselineSchema = z.object({
  role: z.string().min(1, 'Role required').max(100, 'Role too long'),
  targetRate: positiveNumberSchema,
  currency: z.string().length(3, 'Currency must be 3-letter code'),
  location: z.string().max(100, 'Location too long').optional(),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'principal']).optional(),
  effectiveDate: dateSchema,
  expiryDate: dateSchema.optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
  tenantId: uuidSchema,
});

export const updateBaselineSchema = createBaselineSchema.partial().extend({
  id: uuidSchema,
});

// =========================================================================
// SUPPLIER SCHEMAS
// =========================================================================

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Name required').max(200, 'Name too long'),
  email: emailSchema.optional(),
  phone: z.string().max(20, 'Phone too long').optional(),
  website: urlSchema.optional(),
  address: z.string().max(500, 'Address too long').optional(),
  country: z.string().length(2, 'Country must be 2-letter code').optional(),
  status: z.enum(['active', 'inactive', 'pending']).default('active'),
  tenantId: uuidSchema,
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  id: uuidSchema,
});

// =========================================================================
// TYPE EXPORTS
// =========================================================================

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type ContractQuery = z.infer<typeof contractQuerySchema>;

export type CreateRateCardInput = z.infer<typeof createRateCardSchema>;
export type UpdateRateCardInput = z.infer<typeof updateRateCardSchema>;
export type RateCardQuery = z.infer<typeof rateCardQuerySchema>;
export type BulkRateCardUpdate = z.infer<typeof bulkRateCardUpdateSchema>;

export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;
export type UpdateArtifactInput = z.infer<typeof updateArtifactSchema>;
export type ArtifactQuery = z.infer<typeof artifactQuerySchema>;

export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

export type CreateBaselineInput = z.infer<typeof createBaselineSchema>;
export type UpdateBaselineInput = z.infer<typeof updateBaselineSchema>;

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

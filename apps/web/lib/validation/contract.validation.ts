/**
 * Contract Input Validation Schemas
 * 
 * Zod schemas for validating contract operations
 */

import { z } from 'zod';

// ============================================================================
// TAXONOMY ENUMS
// ============================================================================

export const contractCategoryEnum = z.enum([
  'master_framework',
  'scope_work_authorization',
  'performance_operations',
  'purchase_supply',
  'data_security_privacy',
  'confidentiality_ip',
  'software_cloud',
  'partnerships_jv',
  'hr_employment',
  'compliance_regulatory',
]);

export const documentRoleEnum = z.enum([
  'primary',
  'supporting',
  'derivative',
  'reference',
  'amendment',
  'superseded',
  'template',
]);

export const relationshipTypeEnum = z.enum([
  'SOW_UNDER_MSA',
  'WORK_ORDER_UNDER_MSA',
  'TASK_ORDER_UNDER_MSA',
  'PO_UNDER_SUPPLY_AGREEMENT',
  'AMENDMENT',
  'ADDENDUM',
  'RENEWAL',
  'CHANGE_ORDER',
  'APPENDIX',
  'EXHIBIT',
  'SCHEDULE',
  'SLA_UNDER_MSA',
  'DPA_UNDER_MSA',
  'RATE_CARD_UNDER_MSA',
  'SUPERSEDES',
  'RELATED',
]);

export const contractStatusEnum = z.enum([
  'DRAFT',
  'PROCESSING',
  'ACTIVE',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
  'ARCHIVED',
  'FAILED',
  'DELETED',
]);

// ============================================================================
// CONTRACT UPLOAD VALIDATION
// ============================================================================

export const contractUploadSchema = z.object({
  contractType: z.string().max(100).optional(),
  contractTitle: z.string().min(1).max(500).optional(),
  clientName: z.string().max(200).optional(),
  supplierName: z.string().max(200).optional(),
  totalValue: z.coerce.number().positive().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  uploadedBy: z.string().max(200).optional(),
  priority: z.enum(['urgent', 'high', 'normal', 'low', 'background']).optional(),
  ocrMode: z.string().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate > data.startDate;
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

// ============================================================================
// CONTRACT UPDATE VALIDATION
// ============================================================================

export const contractUpdateSchema = z.object({
  contractTitle: z.string().min(1).max(500).optional(),
  contractType: z.string().max(100).optional(),
  clientName: z.string().max(200).optional(),
  supplierName: z.string().max(200).optional(),
  totalValue: z.coerce.number().positive().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  effectiveDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  status: contractStatusEnum.optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
  
  // Taxonomy fields
  contractCategoryId: contractCategoryEnum.optional(),
  contractSubtype: z.string().max(100).optional(),
  documentRole: documentRoleEnum.optional(),
  
  // Financial fields
  annualValue: z.coerce.number().positive().optional(),
  monthlyValue: z.coerce.number().positive().optional(),
  paymentTerms: z.string().max(100).optional(),
  paymentFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ONE_TIME']).optional(),
  
  // Renewal fields
  autoRenewalEnabled: z.boolean().optional(),
  noticePeriodDays: z.coerce.number().int().positive().max(365).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate > data.startDate;
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
).refine(
  (data) => {
    if (data.effectiveDate && data.expirationDate) {
      return data.expirationDate > data.effectiveDate;
    }
    return true;
  },
  {
    message: 'Expiration date must be after effective date',
    path: ['expirationDate'],
  }
);

// ============================================================================
// HIERARCHY LINKING VALIDATION
// ============================================================================

export const hierarchyLinkSchema = z.object({
  parentId: z.string().uuid('Invalid parent contract ID'),
  relationshipType: relationshipTypeEnum,
  relationshipNote: z.string().max(1000).optional(),
  validateCompatibility: z.boolean().default(true),
});

// ============================================================================
// BULK OPERATIONS VALIDATION
// ============================================================================

export const bulkOperationSchema = z.object({
  operation: z.enum([
    'update_status',
    'add_tags',
    'remove_tags',
    'set_tags',
    'archive',
    'delete',
    'export',
    'share',
  ]),
  contractIds: z.array(z.string().uuid()).min(1).max(100),
  
  // Operation-specific fields
  status: contractStatusEnum.optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// SEARCH/FILTER VALIDATION
// ============================================================================

export const contractSearchSchema = z.object({
  query: z.string().max(500).optional(),
  status: z.array(contractStatusEnum).optional(),
  categoryId: z.array(contractCategoryEnum).optional(),
  documentRole: z.array(documentRoleEnum).optional(),
  clientName: z.string().max(200).optional(),
  supplierName: z.string().max(200).optional(),
  startDateFrom: z.coerce.date().optional(),
  startDateTo: z.coerce.date().optional(),
  endDateFrom: z.coerce.date().optional(),
  endDateTo: z.coerce.date().optional(),
  minValue: z.coerce.number().positive().optional(),
  maxValue: z.coerce.number().positive().optional(),
  tags: z.array(z.string()).optional(),
  hasRiskFlags: z.array(z.string()).optional(),
  hasPricingModel: z.array(z.string()).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum([
    'createdAt',
    'updatedAt',
    'contractTitle',
    'totalValue',
    'startDate',
    'endDate',
    'expirationDate',
  ]).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).refine(
  (data) => {
    if (data.startDateFrom && data.startDateTo) {
      return data.startDateTo >= data.startDateFrom;
    }
    return true;
  },
  {
    message: 'Start date range is invalid',
    path: ['startDateTo'],
  }
).refine(
  (data) => {
    if (data.endDateFrom && data.endDateTo) {
      return data.endDateTo >= data.endDateFrom;
    }
    return true;
  },
  {
    message: 'End date range is invalid',
    path: ['endDateTo'],
  }
).refine(
  (data) => {
    if (data.minValue && data.maxValue) {
      return data.maxValue >= data.minValue;
    }
    return true;
  },
  {
    message: 'Value range is invalid',
    path: ['maxValue'],
  }
);

// ============================================================================
// METADATA UPDATE VALIDATION
// ============================================================================

export const metadataUpdateSchema = z.object({
  field: z.string().min(1).max(100),
  value: z.union([
    z.string().max(1000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string().max(200)),
    z.record(z.unknown()),
  ]),
  operation: z.enum(['set', 'append', 'remove', 'clear']).default('set'),
});

// ============================================================================
// DATE RANGE VALIDATION
// ============================================================================

export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

// ============================================================================
// FILE VALIDATION
// ============================================================================

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/html',
  'application/xhtml+xml',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp',
] as const;

export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.doc',
  '.txt',
  '.html',
  '.htm',
  '.jpeg',
  '.jpg',
  '.png',
  '.gif',
  '.bmp',
  '.tiff',
  '.tif',
  '.webp',
] as const;

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  // Check extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension as any)) {
    return {
      valid: false,
      error: `File extension ${extension} is not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  return { valid: true };
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type ContractUploadInput = z.infer<typeof contractUploadSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;
export type HierarchyLinkInput = z.infer<typeof hierarchyLinkSchema>;
export type BulkOperationInput = z.infer<typeof bulkOperationSchema>;
export type ContractSearchInput = z.infer<typeof contractSearchSchema>;
export type MetadataUpdateInput = z.infer<typeof metadataUpdateSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;

/**
 * Form Validation Schemas
 * 
 * Zod schemas for form validation across the application.
 * These can be used both client-side and server-side.
 */

import { z } from 'zod';

// ============================================================================
// COMMON VALIDATORS
// ============================================================================

/**
 * Email validation with proper format checking
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters');

/**
 * Password validation with strength requirements
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Strong password with special characters
 */
export const strongPasswordSchema = passwordSchema
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Slug validation (URL-friendly strings)
 */
export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(100, 'Slug must be less than 100 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only');

/**
 * URL validation
 */
export const urlSchema = z
  .string()
  .url('Please enter a valid URL')
  .max(2048, 'URL must be less than 2048 characters');

/**
 * Phone number validation (international format)
 */
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number');

/**
 * Date string validation (ISO format)
 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/**
 * Currency code validation (ISO 4217)
 */
export const currencyCodeSchema = z
  .string()
  .length(3, 'Currency code must be 3 characters')
  .regex(/^[A-Z]{3}$/, 'Currency code must be uppercase letters');

/**
 * Positive number validation
 */
export const positiveNumberSchema = z
  .number()
  .positive('Value must be positive');

/**
 * Percentage validation (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage must be at most 100');

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional().or(z.literal('')),
  avatarUrl: urlSchema.optional().or(z.literal('')),
});

// ============================================================================
// CONTRACT SCHEMAS
// ============================================================================

export const contractCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().max(5000, 'Description must be less than 5000 characters').optional(),
  client: z.string().min(1, 'Client is required').max(255),
  supplier: z.string().min(1, 'Supplier is required').max(255),
  contractType: z.enum(['msa', 'sow', 'nda', 'amendment', 'other'], {
    errorMap: () => ({ message: 'Please select a valid contract type' }),
  }),
  value: positiveNumberSchema.optional(),
  currency: currencyCodeSchema.optional().default('USD'),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  tags: z.array(z.string()).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'End date must be after start date', path: ['endDate'] }
);

export const contractUpdateSchema = contractCreateSchema.partial();

export const contractSearchSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['msa', 'sow', 'nda', 'amendment', 'other', 'all']).optional(),
  status: z.enum(['draft', 'active', 'expired', 'terminated', 'all']).optional(),
  client: z.string().optional(),
  supplier: z.string().optional(),
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional(),
  valueMin: positiveNumberSchema.optional(),
  valueMax: positiveNumberSchema.optional(),
  tags: z.array(z.string()).optional(),
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(['title', 'client', 'supplier', 'value', 'startDate', 'endDate', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ============================================================================
// RATE CARD SCHEMAS
// ============================================================================

export const roleRateSchema = z.object({
  role: z.string().min(1, 'Role name is required').max(100),
  level: z.string().max(50).optional(),
  location: z.string().max(100).optional(),
  dailyRate: positiveNumberSchema,
  hourlyRate: positiveNumberSchema.optional(),
  serviceLine: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

export const rateCardCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  supplierName: z.string().min(1, 'Supplier name is required').max(255),
  clientName: z.string().min(1, 'Client name is required').max(255),
  currency: currencyCodeSchema.default('USD'),
  validFrom: dateStringSchema.optional(),
  validTo: dateStringSchema.optional(),
  roles: z.array(roleRateSchema).min(1, 'At least one role is required'),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => {
    if (data.validFrom && data.validTo) {
      return new Date(data.validFrom) <= new Date(data.validTo);
    }
    return true;
  },
  { message: 'Valid to date must be after valid from date', path: ['validTo'] }
);

export const rateCardUpdateSchema = rateCardCreateSchema.partial();

// ============================================================================
// SETTINGS SCHEMAS
// ============================================================================

export const tagCreateSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50, 'Tag name must be less than 50 characters'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  description: z.string().max(200).optional(),
});

export const taxonomyCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(500).optional(),
  parentId: uuidSchema.optional().nullable(),
  keywords: z.array(z.string().max(50)).optional(),
  order: z.number().int().optional(),
});

// ============================================================================
// COLLABORATION SCHEMAS
// ============================================================================

export const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment must be less than 5000 characters'),
  parentId: uuidSchema.optional(),
});

export const shareSchema = z.object({
  emails: z.array(emailSchema).min(1, 'At least one email is required'),
  permission: z.enum(['view', 'comment', 'edit']),
  message: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const approvalRequestSchema = z.object({
  approvers: z.array(z.object({
    email: emailSchema,
    role: z.string().max(100).optional(),
    order: z.number().int().optional(),
  })).min(1, 'At least one approver is required'),
  dueDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  urgency: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
});

// ============================================================================
// SEARCH & FILTER SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const dateRangeSchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
}).refine(
  (data) => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  },
  { message: 'End date must be after start date' }
);

// ============================================================================
// FILE UPLOAD SCHEMAS
// ============================================================================

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];

export const fileUploadSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().max(MAX_FILE_SIZE, `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`),
  type: z.enum(ALLOWED_FILE_TYPES as [string, ...string[]], {
    errorMap: () => ({ message: 'File type not supported' }),
  }),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;
export type ContractSearchInput = z.infer<typeof contractSearchSchema>;
export type RoleRateInput = z.infer<typeof roleRateSchema>;
export type RateCardCreateInput = z.infer<typeof rateCardCreateSchema>;
export type RateCardUpdateInput = z.infer<typeof rateCardUpdateSchema>;
export type TagCreateInput = z.infer<typeof tagCreateSchema>;
export type TaxonomyCategoryInput = z.infer<typeof taxonomyCategorySchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type ShareInput = z.infer<typeof shareSchema>;
export type ApprovalRequestInput = z.infer<typeof approvalRequestSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SortInput = z.infer<typeof sortSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;

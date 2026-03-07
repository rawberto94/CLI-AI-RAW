import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const ImportSourceEnum = z.enum(['upload', 'email', 'api', 'scheduled']);
export const ImportStatusEnum = z.enum([
  'pending',
  'processing',
  'mapping',
  'validating',
  'completed',
  'failed',
  'requires_review'
]);
export const ImportPriorityEnum = z.enum(['high', 'normal', 'low']);
export const FileTypeEnum = z.enum(['xlsx', 'xls', 'csv', 'pdf', 'json']);
export const TransformationTypeEnum = z.enum(['direct', 'lookup', 'calculation', 'split', 'merge']);
export const SeniorityLevelEnum = z.enum(['Junior', 'Mid', 'Senior', 'Principal', 'Partner']);
export const RatePeriodEnum = z.enum(['hourly', 'daily', 'monthly', 'annual']);
export const CurrencyEnum = z.enum(['CHF', 'USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']);
export const SupplierTierEnum = z.enum(['Big 4', 'Tier 2', 'Boutique', 'Offshore']);
export const DataQualityLevelEnum = z.enum(['high', 'medium', 'low']);
export const RateCardStatusEnum = z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'archived']);
export const QualityCheckTypeEnum = z.enum([
  'missing_field',
  'invalid_format',
  'out_of_range',
  'duplicate',
  'outlier',
  'inconsistent'
]);
export const QualityCheckSeverityEnum = z.enum(['critical', 'warning', 'info']);
export const ImportErrorTypeEnum = z.enum(['parse_error', 'validation_error', 'mapping_error', 'system_error']);
export const ImportWarningTypeEnum = z.enum(['low_confidence', 'missing_optional', 'assumed_value', 'outlier']);

// ============================================================================
// CORE SCHEMAS
// ============================================================================

export const ImportErrorSchema = z.object({
  rowNumber: z.number().int().optional(),
  field: z.string().optional(),
  errorType: ImportErrorTypeEnum,
  message: z.string(),
  details: z.any().optional(),
});

export const ImportWarningSchema = z.object({
  rowNumber: z.number().int().optional(),
  field: z.string().optional(),
  warningType: ImportWarningTypeEnum,
  message: z.string(),
  suggestion: z.string().optional(),
});

export const ColumnMappingSchema = z.object({
  sourceColumn: z.string(),
  targetField: z.string(),
  confidence: z.number().min(0).max(1),
  transformationType: TransformationTypeEnum.optional(),
  transformationRule: z.string().optional(),
  examples: z.array(z.string()),
});

export const RawDataRowSchema = z.object({
  rowNumber: z.number().int(),
  data: z.record(z.any()),
  confidence: z.number().min(0).max(1),
  issues: z.array(z.string()),
});

export const RawRateCardDataSchema = z.object({
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  contractId: z.string().optional(),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
  currency: z.string().optional(),
  rows: z.array(RawDataRowSchema),
  sheetName: z.string().optional(),
  headerRow: z.number().int().optional(),
  dataStartRow: z.number().int().optional(),
  totalRows: z.number().int(),
});

export const ImportJobSchema = z.object({
  id: z.string(),
  source: ImportSourceEnum,
  status: ImportStatusEnum,
  priority: ImportPriorityEnum,
  
  // Source information
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  fileType: FileTypeEnum,
  emailFrom: z.string().optional(),
  emailSubject: z.string().optional(),
  apiSource: z.string().optional(),
  
  // Processing metadata
  createdAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  processedBy: z.string().optional(),
  
  // Results
  rowsProcessed: z.number().int(),
  rowsSucceeded: z.number().int(),
  rowsFailed: z.number().int(),
  errors: z.array(ImportErrorSchema),
  warnings: z.array(ImportWarningSchema),
  
  // Mapping
  mappingTemplateId: z.string().optional(),
  columnMappings: z.array(ColumnMappingSchema),
  mappingConfidence: z.number().min(0).max(1),
  
  // Extracted data
  extractedData: RawRateCardDataSchema,
  normalizedData: z.any().optional(), // Will be NormalizedRateCardSchema
  
  // Review
  requiresReview: z.boolean(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.date().optional(),
  reviewNotes: z.string().optional(),
});

export const VolumeDiscountSchema = z.object({
  minHours: z.number().optional(),
  minDays: z.number().optional(),
  discountPercent: z.number(),
  description: z.string().optional(),
});

export const NormalizedRoleRateSchema = z.object({
  id: z.string(),
  
  // Role identification
  originalRoleName: z.string(),
  standardizedRole: z.string(),
  roleCategory: z.string(),
  seniorityLevel: SeniorityLevelEnum,
  
  // Service classification
  serviceLine: z.string(),
  subCategory: z.string().optional(),
  skills: z.array(z.string()),
  certifications: z.array(z.string()),
  
  // Geography
  originalLocation: z.string(),
  geography: z.string(),
  region: z.string(),
  country: z.string(),
  city: z.string().optional(),
  
  // Rate information
  originalRate: z.number(),
  originalPeriod: RatePeriodEnum,
  originalCurrency: z.string(),
  
  // Normalized rates
  hourlyRate: z.number(),
  dailyRate: z.number(),
  monthlyRate: z.number(),
  annualRate: z.number(),
  baseCurrency: CurrencyEnum,
  
  // Volume discounts
  volumeDiscounts: z.array(VolumeDiscountSchema).optional(),
  minimumHours: z.number().optional(),
  minimumDays: z.number().optional(),
  
  // Quality indicators
  confidence: z.number().min(0).max(1),
  dataQuality: DataQualityLevelEnum,
  issues: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const QualityCheckSchema = z.object({
  type: QualityCheckTypeEnum,
  severity: QualityCheckSeverityEnum,
  field: z.string(),
  message: z.string(),
  suggestion: z.string().optional(),
  affectedRows: z.array(z.number().int()),
});

export const DataQualityMetricsSchema = z.object({
  overallScore: z.number().min(0).max(100),
  completeness: z.number().min(0).max(100),
  accuracy: z.number().min(0).max(100),
  consistency: z.number().min(0).max(100),
  freshness: z.number().min(0),
  issues: z.object({
    critical: z.number().int(),
    warnings: z.number().int(),
    info: z.number().int(),
  }),
  checks: z.array(QualityCheckSchema),
});

export const NormalizedRateCardSchema = z.object({
  id: z.string(),
  importJobId: z.string(),
  
  // Supplier information
  supplierId: z.string(),
  supplierName: z.string(),
  supplierTier: SupplierTierEnum,
  
  // Contract information
  contractId: z.string().optional(),
  effectiveDate: z.date(),
  expiryDate: z.date().optional(),
  
  // Currency
  originalCurrency: z.string(),
  baseCurrency: CurrencyEnum,
  exchangeRate: z.number().optional(),
  exchangeRateDate: z.date().optional(),
  
  // Roles and rates
  roles: z.array(NormalizedRoleRateSchema),
  
  // Metadata
  source: z.string(),
  importedAt: z.date(),
  importedBy: z.string(),
  version: z.number().int(),
  status: RateCardStatusEnum,
  
  // Quality metrics
  dataQuality: DataQualityMetricsSchema,
});

export const MappingTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  description: z.string(),
  
  // Template definition
  mappings: z.array(ColumnMappingSchema),
  requiredFields: z.array(z.string()),
  optionalFields: z.array(z.string()),
  
  // Pattern matching
  fileNamePattern: z.string().optional(),
  headerPatterns: z.array(z.string()),
  
  // Usage stats
  usageCount: z.number().int(),
  successRate: z.number().min(0).max(1),
  lastUsed: z.date().optional(),
  
  // Versioning
  version: z.number().int(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ImportSource = z.infer<typeof ImportSourceEnum>;
export type ImportStatus = z.infer<typeof ImportStatusEnum>;
export type ImportPriority = z.infer<typeof ImportPriorityEnum>;
export type FileType = z.infer<typeof FileTypeEnum>;
export type TransformationType = z.infer<typeof TransformationTypeEnum>;
export type SeniorityLevel = z.infer<typeof SeniorityLevelEnum>;
export type RatePeriod = z.infer<typeof RatePeriodEnum>;
export type Currency = z.infer<typeof CurrencyEnum>;
export type SupplierTier = z.infer<typeof SupplierTierEnum>;
export type DataQualityLevel = z.infer<typeof DataQualityLevelEnum>;
export type RateCardStatus = z.infer<typeof RateCardStatusEnum>;
export type QualityCheckType = z.infer<typeof QualityCheckTypeEnum>;
export type QualityCheckSeverity = z.infer<typeof QualityCheckSeverityEnum>;
export type ImportErrorType = z.infer<typeof ImportErrorTypeEnum>;
export type ImportWarningType = z.infer<typeof ImportWarningTypeEnum>;

export type ImportError = z.infer<typeof ImportErrorSchema>;
export type ImportWarning = z.infer<typeof ImportWarningSchema>;
export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;
export type RawDataRow = z.infer<typeof RawDataRowSchema>;
export type RawRateCardData = z.infer<typeof RawRateCardDataSchema>;
export type ImportJob = z.infer<typeof ImportJobSchema>;
export type VolumeDiscount = z.infer<typeof VolumeDiscountSchema>;
export type NormalizedRoleRate = z.infer<typeof NormalizedRoleRateSchema>;
export type QualityCheck = z.infer<typeof QualityCheckSchema>;
export type DataQualityMetrics = z.infer<typeof DataQualityMetricsSchema>;
export type NormalizedRateCard = z.infer<typeof NormalizedRateCardSchema>;
export type MappingTemplate = z.infer<typeof MappingTemplateSchema>;

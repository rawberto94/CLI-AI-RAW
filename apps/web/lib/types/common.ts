/**
 * Common Type Definitions
 * 
 * Shared type definitions to replace `any` types across the codebase.
 * Import these types instead of using `any` for better type safety.
 */

// ============================================================================
// Generic Types
// ============================================================================

/**
 * Generic record type - use instead of `any` for object types
 */
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonValue[] 
  | { [key: string]: JsonValue };

export type JsonRecord = Record<string, JsonValue>;

/**
 * Safe unknown type for external data
 */
export type UnknownData = unknown;

// ============================================================================
// API & Event Types
// ============================================================================

/**
 * Generic event handler payload
 */
export interface EventPayload<T = unknown> {
  type: string;
  data: T;
  timestamp?: Date;
  source?: string;
}

/**
 * Real-time event data types
 */
export interface ContractEventData {
  contractId: string;
  tenantId: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed';
  changes?: Partial<ContractData>;
  userId?: string;
}

export interface ArtifactEventData {
  artifactId: string;
  contractId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface RateCardEventData {
  rateCardId: string;
  tenantId: string;
  action: 'created' | 'updated' | 'imported' | 'deleted';
  changes?: Record<string, unknown>;
}

export interface BenchmarkEventData {
  benchmarkId: string;
  rateCardId: string;
  status: 'calculating' | 'completed' | 'invalidated';
  results?: BenchmarkResults;
}

export interface JobEventData {
  jobId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
}

export interface NotificationEventData {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  action?: {
    label: string;
    url: string;
  };
}

// ============================================================================
// Contract Types
// ============================================================================

export interface ContractData {
  id: string;
  title: string;
  description?: string | null;
  status: ContractStatus;
  approvalStatus?: ApprovalStatus;
  category?: string | null;
  supplierName?: string | null;
  totalValue?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  customFields?: ContractCustomFields;
  metadata?: ContractMetadata;
}

export type ContractStatus = 
  | 'DRAFT' 
  | 'PENDING' 
  | 'ACTIVE' 
  | 'EXPIRED' 
  | 'TERMINATED' 
  | 'RENEWED';

export type ApprovalStatus = 
  | 'none' 
  | 'pending' 
  | 'approved' 
  | 'rejected';

export interface ContractCustomFields {
  [key: string]: string | number | boolean | string[] | null;
}

export interface ContractMetadata {
  extractedAt?: Date;
  extractionConfidence?: number;
  aiProcessed?: boolean;
  [key: string]: unknown;
}

export interface ContractClause {
  id?: string;
  title: string;
  content: string;
  type?: string;
  confidence?: number;
  position?: number;
}

export interface ContractParty {
  name: string;
  role: 'vendor' | 'client' | 'other';
  address?: string;
  contact?: string;
}

// ============================================================================
// Artifact Types
// ============================================================================

export type ArtifactType = 
  | 'RISK' 
  | 'COMPLIANCE' 
  | 'FINANCIAL' 
  | 'OVERVIEW' 
  | 'OBLIGATIONS'
  | 'CLAUSES';

export interface ArtifactData {
  id: string;
  contractId: string;
  type: ArtifactType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: ArtifactContent;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskArtifactContent {
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  mitigations?: string[];
}

export interface RiskFactor {
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
}

export interface ComplianceArtifactContent {
  overallScore: number;
  complianceLevel: 'compliant' | 'partial' | 'non-compliant';
  findings: ComplianceFinding[];
  frameworks?: string[];
}

export interface ComplianceFinding {
  category: string;
  status: 'pass' | 'fail' | 'warning';
  description: string;
  recommendation?: string;
}

export interface FinancialArtifactContent {
  totalValue: number;
  currency: string;
  paymentTerms?: string;
  paymentSchedule?: PaymentScheduleItem[];
  breakdown?: FinancialBreakdown;
}

export interface PaymentScheduleItem {
  date: Date;
  amount: number;
  description?: string;
}

export interface FinancialBreakdown {
  baseAmount?: number;
  taxes?: number;
  fees?: number;
  discounts?: number;
}

export interface OverviewArtifactContent {
  summary: string;
  keyTerms: string[];
  parties: ContractParty[];
  effectiveDates: {
    start?: Date;
    end?: Date;
    renewalDate?: Date;
  };
}

export type ArtifactContent = 
  | RiskArtifactContent 
  | ComplianceArtifactContent 
  | FinancialArtifactContent 
  | OverviewArtifactContent
  | Record<string, unknown>;

// ============================================================================
// Rate Card Types
// ============================================================================

export interface RateCardData {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  supplierId?: string;
  effectiveDate?: Date;
  expirationDate?: Date;
  status: 'draft' | 'active' | 'expired' | 'archived';
  rates: RateCardRate[];
  metadata?: RateCardMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateCardRate {
  id?: string;
  roleTitle: string;
  level?: string;
  location?: string;
  hourlyRate: number;
  dailyRate?: number;
  currency: string;
  effectiveDate?: Date;
  expirationDate?: Date;
}

export interface RateCardMetadata {
  source?: 'manual' | 'imported' | 'extracted';
  lastBenchmarked?: Date;
  benchmarkStatus?: 'pending' | 'completed' | 'stale';
  [key: string]: unknown;
}

// ============================================================================
// Benchmark Types
// ============================================================================

export interface BenchmarkResults {
  id: string;
  rateCardId: string;
  calculatedAt: Date;
  overallScore: number;
  marketPosition: 'below' | 'at' | 'above';
  savings?: {
    potential: number;
    percentage: number;
  };
  rateComparisons: RateComparison[];
}

export interface RateComparison {
  roleTitle: string;
  currentRate: number;
  marketLow: number;
  marketMedian: number;
  marketHigh: number;
  percentile: number;
  recommendation?: string;
}

// ============================================================================
// Renewal Types
// ============================================================================

export interface RenewalData {
  id: string;
  contractId: string;
  contractTitle: string;
  supplierName?: string;
  expirationDate: Date;
  daysUntilExpiry: number;
  value?: number;
  status: 'upcoming' | 'urgent' | 'overdue';
  healthScore?: number;
  renewalType?: 'auto' | 'manual' | 'unknown';
}

// ============================================================================
// Form & Field Types
// ============================================================================

export interface CustomField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  required?: boolean;
  hidden?: boolean;
  aiExtractionEnabled?: boolean;
  options?: FieldOption[];
  validation?: FieldValidation;
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface ExtractionResult {
  fieldName: string;
  value: unknown;
  confidence: number;
  source?: string;
}

export interface FieldCorrection {
  fieldId: string;
  fieldName: string;
  originalValue: unknown;
  correctedValue: unknown;
  correctedAt: Date;
  correctedBy?: string;
}

// ============================================================================
// Search & Filter Types
// ============================================================================

export interface SearchParams {
  query?: string;
  filters?: FilterCriteria;
  sort?: SortCriteria;
  pagination?: PaginationParams;
}

export interface FilterCriteria {
  status?: ContractStatus[];
  category?: string[];
  supplier?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  valueRange?: {
    min?: number;
    max?: number;
  };
  tags?: string[];
  [key: string]: unknown;
}

export interface SortCriteria {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// Tag Types
// ============================================================================

export interface Tag {
  name: string;
  color?: string;
  category?: string;
}

export interface PredefinedTag extends Tag {
  id?: string;
  isSystem?: boolean;
}

// ============================================================================
// Taxonomy Types
// ============================================================================

export interface TaxonomyNode {
  id: string;
  name: string;
  code?: string;
  level: number;
  parentId?: string;
  children?: TaxonomyNode[];
  metadata?: Record<string, unknown>;
}

export interface TaxonomyImportRow {
  code: string;
  name: string;
  parentCode?: string;
  level?: number;
  [key: string]: string | number | undefined;
}

// ============================================================================
// Tenant & Settings Types
// ============================================================================

export interface TenantSettings {
  id: string;
  tenantId: string;
  customFields?: CustomField[];
  predefinedTags?: PredefinedTag[];
  branding?: BrandingSettings;
  features?: FeatureFlags;
  [key: string]: unknown;
}

export interface BrandingSettings {
  logo?: string;
  primaryColor?: string;
  companyName?: string;
}

export interface FeatureFlags {
  aiExtraction?: boolean;
  benchmarking?: boolean;
  approvals?: boolean;
  collaboration?: boolean;
  [key: string]: boolean | undefined;
}

// ============================================================================
// Bulk Operation Types
// ============================================================================

export interface BulkOperationPayload {
  contractIds?: string[];
  rateCardIds?: string[];
  action: string;
  data?: Record<string, unknown>;
}

export interface BulkOperationResult {
  id: string;
  success: boolean;
  error?: string;
  changes?: Record<string, unknown>;
}

export interface BulkOperationResponse {
  successCount: number;
  failedCount: number;
  results: BulkOperationResult[];
  errors: BulkOperationError[];
}

export interface BulkOperationError {
  contractId: string;
  message: string;
  code?: string;
}

// ============================================================================
// Alert Types
// ============================================================================

export interface AlertConfig {
  id: string;
  contractId: string;
  type: 'expiration' | 'renewal' | 'milestone' | 'custom';
  triggerDate: Date;
  leadDays: number;
  recipients: AlertRecipient[];
  sent?: boolean;
  sentAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface AlertRecipient {
  email: string;
  name?: string;
  notified?: boolean;
}

// ============================================================================
// Password Strength Types
// ============================================================================

export interface PasswordStrength {
  score: number;
  level: 'weak' | 'fair' | 'good' | 'strong';
  checks: PasswordChecks;
}

export interface PasswordChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

// ============================================================================
// Performance Types
// ============================================================================

export interface PerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  processingStart?: number;
  processingEnd?: number;
  transferSize?: number;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isContractData(value: unknown): value is ContractData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'status' in value
  );
}

export function isRateCardData(value: unknown): value is RateCardData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'rates' in value
  );
}

export function isArtifactData(value: unknown): value is ArtifactData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'contractId' in value &&
    'type' in value
  );
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (type === 'object') {
    return Object.values(value as object).every(isJsonValue);
  }
  return false;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract the type of array elements
 */
export type ArrayElement<T> = T extends (infer E)[] ? E : never;

/**
 * Safe record accessor
 */
export type SafeRecord<K extends string | number | symbol, V> = Partial<Record<K, V>>;

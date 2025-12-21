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

// ============================================================================
// API Route Helper Types
// ============================================================================

/**
 * Error with typed cause for catch blocks
 * Use instead of `catch (error: any)`
 */
export interface CaughtError extends Error {
  message: string;
  name: string;
  stack?: string;
  cause?: unknown;
  code?: string | number;
}

/**
 * Type guard for caught errors
 */
export function isCaughtError(error: unknown): error is CaughtError {
  return error instanceof Error;
}

/**
 * Get error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}

/**
 * Custom field schema definition
 */
export interface CustomFieldDefinition {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  label: string;
  required?: boolean;
  hidden?: boolean;
  aiExtractionEnabled?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

/**
 * Tenant settings custom fields
 */
export interface TenantCustomFields {
  predefinedTags?: Array<string | { name: string; color?: string }>;
  fieldSchema?: CustomFieldDefinition[];
  [key: string]: unknown;
}

/**
 * Import job data
 */
export interface ImportJobData {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  totalItems?: number;
  processedItems?: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportError {
  row?: number;
  field?: string;
  message: string;
  code?: string;
}

export interface ImportWarning {
  row?: number;
  field?: string;
  message: string;
  code?: string;
}

/**
 * Extraction result from AI processing
 */
export interface ExtractionResult {
  fieldName: string;
  value: string | number | boolean | string[] | null;
  confidence: number;
  source?: string;
}

/**
 * Metrics data from monitoring
 */
export interface MetricsData {
  cpu?: {
    usage: number;
    cores?: number;
  };
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  disk?: {
    used: number;
    total: number;
    percentage: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
  };
  [key: string]: unknown;
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
  id: string;
  name: string;
  type: string;
  threshold: number;
  enabled: boolean;
  recipients: string[];
  metadata?: JsonRecord;
}

/**
 * Alert notification
 */
export interface AlertNotification {
  id: string;
  ruleId: string;
  type: string;
  message: string;
  sentTo: string[];
  sentAt: Date;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

/**
 * Signature request data
 */
export interface SignatureRequest {
  id: string;
  contractId: string;
  status: 'pending' | 'signed' | 'declined' | 'expired';
  signers: SignatureRequestSigner[];
  createdAt: Date;
  expiresAt?: Date;
}

export interface SignatureRequestSigner {
  email: string;
  name?: string;
  status: 'pending' | 'signed' | 'declined';
  signedAt?: Date;
}

/**
 * File upload data
 */
export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

/**
 * Type guard for uploaded file
 */
export function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'arrayBuffer' in value &&
    typeof (value as UploadedFile).arrayBuffer === 'function'
  );
}

// ============================================================================
// AI Chat Types
// ============================================================================

/**
 * AI chat message
 */
export interface AIChatMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | null;
  name?: string;
  function_call?: AIFunctionCall;
  tool_calls?: AIToolCall[];
}

export interface AIFunctionCall {
  name: string;
  arguments: string;
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: AIFunctionCall;
}

/**
 * AI chat request body
 */
export interface AIChatRequestBody {
  messages: AIChatMessage[];
  contractId?: string;
  conversationId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: AITool[];
}

export interface AITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonRecord;
  };
}

/**
 * AI chat response
 */
export interface AIChatResponse {
  id: string;
  choices: AIChatChoice[];
  usage?: AIChatUsage;
  model: string;
  created: number;
}

export interface AIChatChoice {
  index: number;
  message: AIChatMessage;
  finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls' | null;
}

export interface AIChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Contract context for AI chat
 */
export interface AIContractContext {
  id: string;
  name: string;
  summary?: string;
  parties?: string[];
  startDate?: string;
  endDate?: string;
  value?: number;
  currency?: string;
  keyTerms?: string[];
  obligations?: AIObligationSummary[];
  risks?: AIRiskSummary[];
}

export interface AIObligationSummary {
  description: string;
  dueDate?: string;
  party?: string;
  status?: string;
}

export interface AIRiskSummary {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// ============================================================================
// Contract Export Types
// ============================================================================

/**
 * Contract export options
 */
export interface ContractExportOptions {
  format: 'pdf' | 'docx' | 'json' | 'csv';
  includeMetadata?: boolean;
  includeHistory?: boolean;
  includeArtifacts?: boolean;
  includeComments?: boolean;
  redactSensitive?: boolean;
  watermark?: string;
}

/**
 * Contract compare result
 */
export interface ContractCompareResult {
  similarity: number;
  differences: ContractDifference[];
  summary: string;
}

export interface ContractDifference {
  field: string;
  contract1Value: JsonValue;
  contract2Value: JsonValue;
  significance: 'low' | 'medium' | 'high';
}

// ============================================================================
// Events SSE Types  
// ============================================================================

/**
 * Server-Sent Event data
 */
export interface SSEEventData {
  type: string;
  data: JsonRecord;
  id?: string;
  retry?: number;
}

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string;
  tenantId: string;
  userId: string;
  channels: string[];
  createdAt: Date;
  lastPing?: Date;
}

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version?: string;
  checks: HealthCheckItem[];
}

export interface HealthCheckItem {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  latency?: number;
  message?: string;
  details?: JsonRecord;
}

// ============================================================================
// Rate Card Types
// ============================================================================

/**
 * Rate card negotiation brief
 */
export interface NegotiationBrief {
  rateCardId: string;
  rateCardName: string;
  supplier: string;
  summary: string;
  recommendations: NegotiationRecommendation[];
  marketComparison?: MarketComparisonData;
  historicalTrends?: TrendData[];
}

export interface NegotiationRecommendation {
  role: string;
  currentRate: number;
  recommendedRate: number;
  marketRate: number;
  savings: number;
  confidence: number;
  rationale: string;
}

export interface MarketComparisonData {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sampleSize: number;
}

export interface TrendData {
  period: string;
  value: number;
  change?: number;
}

// ============================================================================
// Intelligence Types
// ============================================================================

/**
 * Intelligence insights
 */
export interface IntelligenceInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'prediction';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  data: JsonRecord;
  createdAt: Date;
}

/**
 * Intelligence query
 */
export interface IntelligenceQuery {
  question: string;
  context?: string;
  filters?: IntelligenceFilters;
}

export interface IntelligenceFilters {
  dateRange?: { start: string; end: string };
  contractTypes?: string[];
  suppliers?: string[];
  regions?: string[];
}

// ============================================================================
// Metadata Extraction Types
// ============================================================================

/**
 * Extracted metadata
 */
export interface ExtractedMetadata {
  title?: string;
  parties?: ExtractedParty[];
  dates?: ExtractedDates;
  value?: ExtractedValue;
  terms?: ExtractedTerm[];
  clauses?: ExtractedClause[];
  risks?: ExtractedRisk[];
  obligations?: ExtractedObligation[];
  confidence: number;
}

export interface ExtractedParty {
  name: string;
  role: 'buyer' | 'seller' | 'vendor' | 'client' | 'other';
  address?: string;
  contact?: string;
}

export interface ExtractedDates {
  effective?: string;
  expiry?: string;
  renewal?: string;
  signed?: string;
}

export interface ExtractedValue {
  amount: number;
  currency: string;
  type: 'fixed' | 'variable' | 'estimated';
}

export interface ExtractedTerm {
  name: string;
  value: string;
  category?: string;
}

export interface ExtractedClause {
  type: string;
  text: string;
  page?: number;
  risk?: 'low' | 'medium' | 'high';
}

export interface ExtractedRisk {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  mitigation?: string;
}

export interface ExtractedObligation {
  party: string;
  description: string;
  dueDate?: string;
  recurring?: boolean;
  frequency?: string;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Type guard for checking if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for checking if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for checking if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for checking if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Safely get a string property from unknown data
 */
export function getString(obj: unknown, key: string, defaultValue = ''): string {
  if (isObject(obj) && key in obj) {
    const value = obj[key];
    return isString(value) ? value : defaultValue;
  }
  return defaultValue;
}

/**
 * Safely get a number property from unknown data
 */
export function getNumber(obj: unknown, key: string, defaultValue = 0): number {
  if (isObject(obj) && key in obj) {
    const value = obj[key];
    return isNumber(value) ? value : defaultValue;
  }
  return defaultValue;
}

/**
 * Safely get an array property from unknown data
 */
export function getArray<T>(obj: unknown, key: string, defaultValue: T[] = []): T[] {
  if (isObject(obj) && key in obj) {
    const value = obj[key];
    return isArray(value) ? (value as T[]) : defaultValue;
  }
  return defaultValue;
}


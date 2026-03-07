/**
 * API Response Types
 * Strict types for API responses to eliminate `any` usage
 */

// ============================================================================
// Common Types
// ============================================================================

export interface APIResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================================================
// Contract Types
// ============================================================================

export interface ContractParty {
  id: string;
  name: string;
  role: 'vendor' | 'client' | 'counterparty' | 'beneficiary';
  address?: string;
  contact?: string;
  email?: string;
}

export interface ContractOverview {
  title?: string;
  type?: string;
  status?: string;
  effectiveDate?: string;
  expirationDate?: string;
  totalValue?: number;
  currency?: string;
  parties?: ContractParty[];
  summary?: string;
  tags?: string[];
}

export interface ContractRiskData {
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  categories: Array<{
    name: string;
    level: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    issues: string[];
  }>;
  mitigationRecommendations?: string[];
}

export interface ContractFinancialData {
  totalContractValue?: number;
  currency?: string;
  paymentTerms?: string;
  paymentSchedule?: Array<{
    date: string;
    amount: number;
    description?: string;
  }>;
  penalties?: Array<{
    type: string;
    amount?: number;
    percentage?: number;
    condition: string;
  }>;
  discounts?: Array<{
    type: string;
    amount?: number;
    percentage?: number;
    condition: string;
  }>;
}

export interface ContractArtifact<T = unknown> {
  id: string;
  type: 'OVERVIEW' | 'RISK' | 'FINANCIAL' | 'OBLIGATIONS' | 'RATE_CARD' | 'AMENDMENTS' | 'CUSTOM';
  data: T;
  createdAt: string;
  updatedAt?: string;
  status?: 'pending' | 'processing' | 'completed' | 'error';
}

export interface Contract {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'expired' | 'terminated' | 'renewed';
  type?: string;
  vendor?: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  currency?: string;
  artifacts?: ContractArtifact[];
  createdAt: string;
  updatedAt?: string;
  userId: string;
}

// ============================================================================
// Rate Card Types
// ============================================================================

export type Seniority = 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'PRINCIPAL' | 'DIRECTOR';
export type SupplierTier = 'TIER_1' | 'TIER_2' | 'TIER_3';
export type RateType = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'FIXED';

export interface RateCardEntry {
  id: string;
  roleTitle: string;
  seniority: Seniority;
  hourlyRate: number;
  currency: string;
  region?: string;
  effectiveDate?: string;
  expirationDate?: string;
  supplierId?: string;
  supplierName?: string;
  supplierTier?: SupplierTier;
  rateType?: RateType;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface RateCardSupplier {
  id: string;
  name: string;
  tier: SupplierTier;
  region?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RateCardImportRow {
  roleTitle: string;
  seniority: string;
  hourlyRate: number | string;
  currency?: string;
  region?: string;
  supplierName?: string;
  supplierTier?: string;
  effectiveDate?: string;
  expirationDate?: string;
  notes?: string;
}

export interface RateCardImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{
    row: number;
    message: string;
    data?: RateCardImportRow;
  }>;
  warnings: Array<{
    row: number;
    message: string;
    data?: RateCardImportRow;
  }>;
  imported_records: RateCardEntry[];
}

// ============================================================================
// Renewal Types
// ============================================================================

export interface RenewalContract extends Contract {
  daysUntilExpiry: number;
  healthScore: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  renewalRecommendation?: 'renew' | 'renegotiate' | 'terminate' | 'review';
}

export interface RenewalsResponse {
  renewals: RenewalContract[];
  upcoming30Days: RenewalContract[];
  upcoming90Days: RenewalContract[];
  totalValue: number;
  summary: {
    total: number;
    byRisk: Record<string, number>;
    byRecommendation: Record<string, number>;
  };
}

// ============================================================================
// AI Types
// ============================================================================

export interface AIAnalysisRequest {
  contractId?: string;
  documentContent?: string;
  analysisType?: 'full' | 'risk' | 'financial' | 'obligations' | 'summary';
  options?: Record<string, unknown>;
}

export interface AIAnalysisResponse {
  success: boolean;
  analysisId?: string;
  result?: {
    summary?: string;
    risks?: ContractRiskData;
    financials?: ContractFinancialData;
    recommendations?: string[];
    confidence?: number;
  };
  error?: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AIChatRequest {
  contractId?: string;
  message: string;
  history?: AIChatMessage[];
}

export interface AIChatResponse {
  success: boolean;
  response?: {
    content: string;
    sources?: string[];
    confidence?: number;
  };
  error?: string;
}

export interface AIQueryHistory {
  queries: Array<{
    id: string;
    query: string;
    response: string;
    contractId?: string;
    timestamp: string;
  }>;
}

// ============================================================================
// Sharing Types
// ============================================================================

export interface ContractShare {
  id: string;
  contractId: string;
  userId?: string;
  email?: string;
  permission: 'view' | 'comment' | 'edit' | 'admin';
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface SharesResponse {
  shares: ContractShare[];
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationType = 
  | 'contract_expiring'
  | 'contract_expired'
  | 'rate_change'
  | 'approval_required'
  | 'approval_completed'
  | 'comment_added'
  | 'share_invite'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
  userId: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationErrorResponse {
  error: string;
  validationErrors: ValidationError[];
}

// ============================================================================
// Type Guards
// ============================================================================

export function isAPIError(value: unknown): value is APIError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

export function isValidationErrorResponse(value: unknown): value is ValidationErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    'validationErrors' in value &&
    Array.isArray((value as ValidationErrorResponse).validationErrors)
  );
}

export function isContract(value: unknown): value is Contract {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'status' in value
  );
}

export function isRateCardEntry(value: unknown): value is RateCardEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'roleTitle' in value &&
    'hourlyRate' in value
  );
}

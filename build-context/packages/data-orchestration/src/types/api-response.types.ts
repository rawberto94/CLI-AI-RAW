/**
 * Unified API Response Types
 * 
 * Standardizes response format across all contract APIs for consistency.
 * This is the single source of truth for API response structures.
 */

// ============================================================================
// BASE RESPONSE TYPES
// ============================================================================

/**
 * Standard API response envelope
 * All API responses should use this format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationInfo;
}

/**
 * Standardized error format
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: string;
  field?: string; // For validation errors
  stack?: string; // Only in development
  retryable?: boolean;
  retryAfter?: number; // Seconds to wait before retry
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  requestId?: string;
  timestamp: string;
  responseTime: string;
  cached: boolean;
  cacheHit?: boolean;
  dataSource: 'database' | 'cache' | 'mock';
  version: string;
  deprecation?: DeprecationWarning;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
  cursor?: string; // For cursor-based pagination
  nextCursor?: string;
}

/**
 * Deprecation warning for API endpoints
 */
export interface DeprecationWarning {
  message: string;
  replacement?: string;
  sunsetDate?: string;
}

// ============================================================================
// ERROR CODES
// ============================================================================

export type ErrorCode =
  // Client errors (4xx)
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'DUPLICATE'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'MISSING_PARAMETER'
  | 'INVALID_PARAMETER'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  // Server errors (5xx)
  | 'INTERNAL_ERROR'
  | 'DATABASE_ERROR'
  | 'STORAGE_ERROR'
  | 'QUEUE_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'CONNECTION_ERROR'
  | 'QUOTA_EXCEEDED';

// ============================================================================
// HTTP STATUS CODE MAPPING
// ============================================================================

export const ErrorCodeToStatus: Record<ErrorCode, number> = {
  // Client errors
  VALIDATION_ERROR: 400,
  INVALID_REQUEST: 400,
  MISSING_PARAMETER: 400,
  INVALID_PARAMETER: 400,
  FILE_TOO_LARGE: 400,
  UNSUPPORTED_FILE_TYPE: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE: 409,
  RATE_LIMITED: 429,
  // Server errors
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  STORAGE_ERROR: 500,
  QUEUE_ERROR: 500,
  AI_SERVICE_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
  CONNECTION_ERROR: 503,
  QUOTA_EXCEEDED: 507,
};

// ============================================================================
// CONTRACT-SPECIFIC TYPES
// ============================================================================

/**
 * Contract list response
 */
export interface ContractListResponse {
  contracts: ContractSummary[];
  filters: AppliedFilters;
}

/**
 * Contract summary for list views
 */
export interface ContractSummary {
  id: string;
  title: string;
  filename: string;
  originalName: string;
  status: ContractStatusType;
  fileSize: string;
  mimeType: string;
  uploadedAt: string;
  createdAt: string;
  contractType: string;
  clientName: string | null;
  supplierName: string | null;
  category: string | null;
  totalValue: number | null;
  currency: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  viewCount: number;
}

/**
 * Full contract details
 */
export interface ContractDetail extends ContractSummary {
  description: string | null;
  tags: string[];
  metadata: ContractMetadataType | null;
  artifacts: ArtifactSummary[];
  processing: ProcessingStatus;
  versions: VersionInfo[];
}

/**
 * Applied filters in response
 */
export interface AppliedFilters {
  search: string | null;
  statuses: string[];
  contractTypes: string[];
  categories: string[];
  clientNames: string[];
  supplierNames: string[];
  valueRange: { min?: number; max?: number } | null;
  dateRange: { from?: string; to?: string } | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Contract status types
 */
export type ContractStatusType =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'archived';

/**
 * Processing status information
 */
export interface ProcessingStatus {
  jobId: string;
  status: string;
  currentStage: string;
  progress: number;
  startTime: string;
  completedAt?: string;
  estimatedCompletion?: string;
  error?: string;
}

/**
 * Artifact summary
 */
export interface ArtifactSummary {
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  validationStatus: string;
}

/**
 * Version information
 */
export interface VersionInfo {
  id: string;
  versionNumber: number;
  uploadedAt: string;
  uploadedBy: string | null;
  isActive: boolean;
  summary: string | null;
}

/**
 * Contract metadata type - synced with Prisma schema
 */
export interface ContractMetadataType {
  id: string;
  contractId: string;
  tenantId: string;
  categoryId: string | null;
  tags: string[];
  systemFields: Record<string, unknown>;
  customFields: Record<string, unknown>;
  lastUpdated: Date;
  updatedBy: string;
  createdAt: Date;
  
  // Enhanced fields for artifact repository
  artifactSummary: Record<string, unknown> | null;
  searchKeywords: string[];
  relatedContracts: string[];
  dataQualityScore: number | null;
  indexedAt: Date | null;
  ragSyncedAt: Date | null;
  analyticsUpdatedAt: Date | null;
  
  // Organization & Classification
  priority: number;
  importance: string | null;
  department: string | null;
  projectCode: string | null;
  costCenter: string | null;
  businessUnit: string | null;
  
  // Lifecycle tracking
  renewalReminder: Date | null;
  reviewDate: Date | null;
  archiveDate: Date | null;
  retentionPeriod: number | null;
  
  // Compliance & Audit
  complianceStatus: string | null;
  lastAuditDate: Date | null;
  nextAuditDate: Date | null;
  auditNotes: string | null;
  
  // Analytics
  riskScore: number | null;
  valueScore: number | null;
  complexityScore: number | null;
  accessCount: number;
  
  // Renewal Tracking
  renewalPriority: string | null;
  renewalOwner: string | null;
  renewalDeadline: Date | null;
  renewalChecklistDone: boolean;
  renewalChecklist: Array<{ item: string; done: boolean; doneAt?: Date }> | null;
  lastRenewalDate: Date | null;
  renewalCount: number;
  
  // Negotiation Tracking
  negotiationStatus: string | null;
  negotiationStartedAt: Date | null;
  negotiationRound: number;
  negotiationNotes: string | null;
  lastNegotiatedBy: string | null;
  lastNegotiatedAt: Date | null;
  
  // Performance Tracking
  performanceScore: number | null;
  slaComplianceRate: number | null;
  issueCount: number;
  activeIssues: number;
  resolvedIssues: number;
  lastIssueAt: Date | null;
  performanceNotes: string | null;
  
  // AI/RAG Metadata
  aiSummary: string | null;
  aiKeyInsights: Array<{ insight: string; importance: string }> | null;
  aiRiskFactors: Array<{ factor: string; severity: string }> | null;
  aiRecommendations: Array<{ recommendation: string; priority: string }> | null;
  lastAiAnalysis: Date | null;
  aiAnalysisVersion: string | null;
  embeddingVersion: string | null;
  embeddingCount: number;
  lastEmbeddingAt: Date | null;
  
  // Expiration & Archive
  expirationHandled: boolean;
  expirationAction: string | null;
  expirationActionAt: Date | null;
  expirationActionBy: string | null;
  archiveReason: string | null;
  archivedAt: Date | null;
  archivedBy: string | null;
}

/**
 * Contract health score type
 */
export interface ContractHealthScoreType {
  id: string;
  contractId: string;
  tenantId: string;
  overallScore: number;
  riskScore: number;
  complianceScore: number;
  financialScore: number;
  operationalScore: number;
  renewalReadiness: number;
  documentQuality: number;
  factors: Array<{ name: string; score: number; weight: number }>;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  previousScore: number | null;
  scoreChange: number;
  trendDirection: 'improving' | 'declining' | 'stable';
  trendHistory: Array<{ date: Date; score: number }>;
  alertLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  activeAlerts: Array<{ type: string; message: string; severity: string }>;
  alertCount: number;
  lastAlertAt: Date | null;
  industryAverage: number | null;
  percentileRank: number | null;
  calculatedAt: Date;
}

/**
 * Contract expiration type
 */
export interface ContractExpirationType {
  id: string;
  contractId: string;
  tenantId: string;
  expirationDate: Date;
  daysUntilExpiry: number;
  isExpired: boolean;
  expiredAt: Date | null;
  expirationRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'EXPIRED';
  riskFactors: string[];
  impactScore: number;
  contractValue: number | null;
  annualValue: number | null;
  valueAtRisk: number | null;
  renewalStatus: 'PENDING' | 'UPCOMING' | 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'NOT_RENEWING';
  renewalProbability: number | null;
  recommendedAction: string | null;
  ownerId: string | null;
  ownerName: string | null;
  assignedTo: string | null;
  assignedAt: Date | null;
  alertsSent: Array<{ type: string; sentAt: Date; sentTo: string }>;
  lastAlertSent: Date | null;
  nextAlertDue: Date | null;
  alertsEnabled: boolean;
  noticePeriodDays: number | null;
  noticeDeadline: Date | null;
  noticeGiven: boolean;
  noticeGivenAt: Date | null;
  noticeGivenBy: string | null;
  autoRenewalEnabled: boolean;
  autoRenewalTerms: Record<string, unknown> | null;
  resolution: string | null;
  resolutionDate: Date | null;
  resolutionBy: string | null;
  resolutionNotes: string | null;
  newContractId: string | null;
  contractTitle: string | null;
  supplierName: string | null;
  clientName: string | null;
  contractType: string | null;
}

/**
 * Renewal history type
 */
export interface RenewalHistoryType {
  id: string;
  contractId: string;
  tenantId: string;
  renewalNumber: number;
  renewalType: 'STANDARD' | 'RENEGOTIATED' | 'EXTENDED' | 'AUTO_RENEWED';
  previousStartDate: Date | null;
  previousEndDate: Date | null;
  previousValue: number | null;
  previousTerms: Record<string, unknown> | null;
  newStartDate: Date;
  newEndDate: Date;
  newValue: number | null;
  newTerms: Record<string, unknown> | null;
  valueChange: number | null;
  valueChangePercent: number | null;
  termExtension: number | null;
  negotiationDays: number | null;
  negotiationRounds: number | null;
  keyChanges: string[];
  initiatedBy: string | null;
  initiatedAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  completedBy: string | null;
  completedAt: Date;
  status: 'COMPLETED' | 'CANCELLED' | 'SUPERSEDED';
  notes: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  meta?: Partial<ResponseMeta>
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      responseTime: '0ms',
      cached: false,
      dataSource: 'database',
      version: 'v1',
      ...meta,
    },
  };
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationInfo,
  meta?: Partial<ResponseMeta>
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination,
    meta: {
      timestamp: new Date().toISOString(),
      responseTime: '0ms',
      cached: false,
      dataSource: 'database',
      version: 'v1',
      ...meta,
    },
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: string
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      retryable: isRetryableError(code),
    },
    meta: {
      timestamp: new Date().toISOString(),
      responseTime: '0ms',
      cached: false,
      dataSource: 'database',
      version: 'v1',
    },
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(code: ErrorCode): boolean {
  return [
    'RATE_LIMITED',
    'SERVICE_UNAVAILABLE',
    'TIMEOUT',
    'CONNECTION_ERROR',
    'DATABASE_ERROR',
    'QUEUE_ERROR',
  ].includes(code);
}

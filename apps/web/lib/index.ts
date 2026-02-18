/**
 * Centralized Exports
 * 
 * Re-exports commonly used utilities, types, and components for easier imports.
 * Instead of: import { something } from '@/lib/some-deep-path/file';
 * Use: import { something } from '@/lib';
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Generic types
  JsonValue,
  JsonRecord,
  UnknownData,
  
  // Event types
  EventPayload,
  ContractEventData,
  ArtifactEventData,
  RateCardEventData,
  BenchmarkEventData,
  JobEventData,
  NotificationEventData,
  
  // Contract types
  ContractData,
  ContractStatus,
  ApprovalStatus,
  ContractCustomFields,
  ContractMetadata,
  ContractClause,
  ContractParty,
  
  // Artifact types
  ArtifactType,
  ArtifactData,
  RiskArtifactContent,
  RiskFactor,
  ComplianceArtifactContent,
  ComplianceFinding,
  FinancialArtifactContent,
  PaymentScheduleItem,
  FinancialBreakdown,
  OverviewArtifactContent,
  ArtifactContent,
  
  // Rate Card types
  RateCardData,
  RateCardRate,
  RateCardMetadata,
  
  // Benchmark types
  BenchmarkResults,
  RateComparison,
  
  // Renewal types
  RenewalData,
  
  // Form types
  CustomField,
  FieldOption,
  FieldValidation,
  ExtractionResult,
  FieldCorrection,
  
  // Search types
  SearchParams,
  FilterCriteria,
  SortCriteria,
  PaginationParams,
  PaginatedResponse,
  
  // Other types
  Tag,
  PredefinedTag,
  TaxonomyNode,
  TaxonomyImportRow,
  TenantSettings,
  BrandingSettings,
  FeatureFlags,
  BulkOperationPayload,
  BulkOperationResult,
  BulkOperationResponse,
  BulkOperationError,
  AlertConfig,
  AlertRecipient,
  PasswordStrength,
  PasswordChecks,
  PerformanceEntry,
  
  // Utility types
  PartialBy,
  RequiredBy,
  DeepPartial,
  ArrayElement,
  SafeRecord,
} from './types/common';

// Type guards
export {
  isContractData,
  isRateCardData,
  isArtifactData,
  isJsonValue,
} from './types/common';

// ============================================================================
// API Utilities
// ============================================================================

export {
  createApiHandler,
  withAuth,
  publicHandler,
  adminOnly,
  generateCsrfToken,
  validateCsrfToken,
  
  // Common schemas
  paginationSchema,
  createContractSchema,
  updateContractSchema,
  createRateCardSchema,
  uploadMetadataSchema,
  chatMessageSchema,
} from './api-handler';

export type {
  CreateContractInput,
  UpdateContractInput,
  CreateRateCardInput,
  UploadMetadataInput,
  ChatMessageInput,
} from './api-handler';

// ============================================================================
// API Response Utilities
// ============================================================================

export type { ApiResponse, ApiErrorResponse } from './api-response';

export {
  successResponse,
  errorResponse,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  serverError,
  handleApiError,
} from './api-response';

// ============================================================================
// Accessibility Utilities
// ============================================================================

export {
  generateAriaId,
  ariaPatterns,
  ScreenReaderOnly,
  useAnnounce,
  useFocusTrap,
  useFocusReturn,
  SkipLink,
  useArrowNavigation,
  withAccessibleClick,
  AccessibleButton,
  AccessibleLinkButton,
  validateAccessibility,
} from './accessibility.js';

// ============================================================================
// Rate Limiting
// ============================================================================

// TODO: Module './rate-limiter' does not exist
// export {
//   RateLimiter,
//   standardLimiter,
//   strictLimiter,
//   authLimiter,
//   uploadLimiter,
//   aiLimiter,
//   withRateLimit,
//   memoryRateLimit,
// } from './rate-limiter';

// export type {
//   RateLimitConfig,
//   RateLimitResult,
//   RateLimitHeaders,
// } from './rate-limiter';

// ============================================================================
// Utilities
// ============================================================================

export { cn } from './utils';

// ============================================================================
// Logging
// ============================================================================

export { 
  logger, 
  createRequestLogger, 
  logDebug, 
  logInfo, 
  logWarn, 
  logError, 
  logPerformance, 
  logUserAction 
} from './logger';

// ============================================================================
// Environment Configuration
// ============================================================================

export { env, config, requireEnv, getEnv, checkRequiredServices, getServiceStatus } from './env';

// ============================================================================
// Security Headers
// ============================================================================

export { 
  applySecurityHeaders, 
  getSecurityHeaders, 
  defaultSecurityConfig 
} from './security-headers';

export type { SecurityHeadersConfig, CSPDirectives } from './security-headers';

// ============================================================================
// Production Data Utilities
// ============================================================================

export {
  isDevelopment,
  isProduction,
  isMockDataEnabled,
  assertNotProduction,
  devOnlyMockData,
  serviceUnavailableResponse,
  configurationRequiredResponse,
  emptyDataResponse,
  withDatabaseFallback,
  withExternalService,
  shouldUseMockData,
  logMockDataUsage,
  logDataSourceUnavailable,
  isMockResponse,
  sanitizeResponse,
} from './production-data';

// ============================================================================
// Constants
// ============================================================================

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
export const ITEMS_PER_PAGE = 20;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
];

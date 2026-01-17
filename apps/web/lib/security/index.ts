/**
 * Security Module Exports
 * Central export for all security utilities
 * 
 * Swiss/EU Data Protection Compliant
 * FADP, GDPR, ISO 27001 aligned
 */

// Rate Limiter
export {
  RateLimiter,
  SlidingWindowRateLimiter,
  MemoryStore,
  RedisStore,
  rateLimiters,
  getClientIP,
  rateLimitResponse,
  withRateLimit,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitStore,
  type RedisClient,
} from './rate-limiter';

// Input Sanitization
export {
  sanitize,
  validate as validateInput,
  escapeHtml,
  unescapeHtml,
  sanitizeString,
  sanitizeHtml,
  sanitizeUrl,
  sanitizePath,
  stripHtml,
  escapeSql,
  hasSqlInjection,
  hasPathTraversal,
  DEFAULT_ALLOWED_TAGS,
  DEFAULT_ALLOWED_ATTRIBUTES,
  DEFAULT_ALLOWED_SCHEMES,
} from './sanitize';

// CSRF Protection
export {
  generateCsrfToken,
  getCsrfToken,
  validateCsrfToken,
  createDoubleSubmitToken,
  validateDoubleSubmitToken,
  withCsrfProtection,
  CsrfTokenStore,
  createCsrfFetch,
  handleCsrfRequest,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_FORM_FIELD,
  type CsrfOptions,
} from './csrf';

// Audit Logging
export {
  auditLog,
  queryAuditLogs,
  getAuditEntry,
  addAuditHook,
  setAuditStorage,
  getAuditContext,
  withAuditLog,
  AuditLogger,
  MemoryAuditStorage,
  AuditAction,
  AuditSeverity,
  type AuditEntry,
  type AuditLogOptions,
  type AuditStorage,
  type AuditQueryOptions,
} from './audit';

// Web Application Firewall (WAF)
export {
  wafMiddleware,
  configureWAF,
  getSecurityHeaders,
  addSecurityHeaders,
  DEFAULT_RULES,
  PATTERNS,
  type WAFConfig,
  type WAFResult,
  type WAFRule,
} from './waf';

// Secrets Rotation
export {
  SecretsRotationService,
  DualKeyRotation,
  updateSecretInEnvironment,
  SECRET_GENERATORS,
  DEFAULT_INTERVALS,
  type SecretConfig,
  type RotationResult,
  type RotationPolicy,
  type EnvUpdateStrategy,
} from './secrets-rotation';

// Intrusion Detection System (IDS)
export {
  IntrusionDetector,
  detectImpossibleTravel,
  DEFAULT_RULES as IDS_DEFAULT_RULES,
  type SecurityEvent,
  type SecurityEventType,
  type SecurityAlert,
  type AlertType,
  type DetectionRule,
  type DetectionContext,
  type DetectorConfig,
  type GeoLocation,
} from './intrusion-detection';

// Account Lockout
export {
  AccountLockout,
  getAccountLockout,
  checkLockoutStatus,
  type LockoutConfig,
  type LockoutStatus,
  type AttemptRecord,
} from './account-lockout';

// Backup Encryption
export {
  BackupEncryptionService,
  SwissBackupStorageProvider,
  DatabaseBackupService,
  FileBackupService,
  type BackupMetadata,
  type BackupKey,
  type EncryptedBackup,
  type BackupStorageProvider,
} from './backup-encryption';

// Database Security Hardening
export {
  DatabaseSecurityService,
  createEncryptionMiddleware,
  createRLSMiddleware,
  type ColumnEncryptionConfig,
  type RLSPolicy,
  type AuditTriggerConfig,
} from './database-security';

// Security Headers (CSP, HSTS, etc.)
export {
  SecurityHeadersMiddleware,
  createSecurityHeadersMiddleware,
  withSecurityHeaders,
  withAPISecurityHeaders,
  handleCSPReport,
  generateNonce,
  strictSecurityHeaders,
  relaxedSecurityHeaders,
  swissComplianceHeaders,
  type SecurityHeadersConfig,
  type CSPConfig,
  type CSPDirectives,
  type HSTSConfig,
  type ReferrerPolicy,
  type PermissionsPolicyConfig,
} from './security-headers';

// Tenant Security
export {
  getApiTenantId,
  getValidatedTenantId,
  hasAccessToTenant,
  tenantWhere,
  assertTenantMatch,
  getTenantFromHeaders,
  withTenantContext,
  logTenantOperation,
  getUserAccessibleTenants,
  TenantError,
} from './tenant';

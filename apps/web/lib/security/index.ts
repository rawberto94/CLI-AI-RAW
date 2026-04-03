/**
 * Security Module Exports
 * Central export for all security utilities
 * 
 * Swiss/EU Data Protection Compliant
 * FADP, GDPR, ISO 27001 aligned
 */

// Rate Limiter
// Rate limiting is implemented directly in middleware.ts with tiered
// per-endpoint limits (auth: 10/min anon, AI: 50/min user, etc.)
// backed by Redis with in-memory fallback.

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

// CSRF Protection — re-export canonical CSRF constants only.
// The authoritative CSRF implementation is lib/csrf.ts (HMAC-SHA256 signed tokens).
// Do NOT use lib/security/csrf.ts — it is a legacy implementation left for deletion.
export { CSRF_CONSTANTS } from '../csrf-constants';

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

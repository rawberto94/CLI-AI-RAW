/**
 * Security Module Exports
 * Central export for all security utilities
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

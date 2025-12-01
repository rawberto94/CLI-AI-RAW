/**
 * Application Constants
 * Centralized configuration and magic values
 */

// ============================================================================
// API Configuration
// ============================================================================

export const API = {
  // Timeouts (ms)
  TIMEOUT: {
    DEFAULT: 30_000,
    UPLOAD: 120_000,
    LONG_RUNNING: 300_000,
    ARTIFACT_GENERATION: 180_000,
    AI_PROCESSING: 60_000,
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 1000,
    MAX_DELAY: 10_000,
    BACKOFF_MULTIPLIER: 2,
  },

  // Rate limiting
  RATE_LIMIT: {
    MAX_REQUESTS: 100,
    WINDOW_MS: 60_000,
    UPLOAD_MAX_REQUESTS: 10,
    UPLOAD_WINDOW_MS: 60_000,
  },

  // Endpoints
  ENDPOINTS: {
    CONTRACTS: '/api/contracts',
    ARTIFACTS: '/api/artifacts',
    RATE_CARDS: '/api/rate-cards',
    ANALYTICS: '/api/analytics',
    USERS: '/api/users',
    WORKFLOWS: '/api/workflows',
    NOTIFICATIONS: '/api/notifications',
    EXPORT: '/api/export',
  },
} as const;

// ============================================================================
// File Upload
// ============================================================================

export const UPLOAD = {
  // Size limits (bytes)
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_CONTRACT_SIZE: 100 * 1024 * 1024, // 100MB
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB chunks

  // Allowed file types
  ALLOWED_TYPES: {
    CONTRACTS: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
    RATE_CARDS: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    IMAGES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
  },

  // File extensions
  EXTENSIONS: {
    CONTRACTS: ['.pdf', '.doc', '.docx', '.txt'],
    RATE_CARDS: ['.xlsx', '.xls', '.csv'],
    IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
} as const;

// ============================================================================
// Pagination
// ============================================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100] as const,
  MAX_PAGE_SIZE: 100,
} as const;

// ============================================================================
// Cache Configuration
// ============================================================================

export const CACHE = {
  // TTL (seconds)
  TTL: {
    SHORT: 60, // 1 minute
    MEDIUM: 300, // 5 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 24 hours
  },

  // Stale times (ms) for React Query
  STALE_TIME: {
    REALTIME: 0,
    SHORT: 30_000, // 30 seconds
    MEDIUM: 60_000, // 1 minute
    LONG: 300_000, // 5 minutes
  },

  // Keys
  KEYS: {
    CONTRACTS: 'contracts',
    CONTRACT: 'contract',
    ARTIFACTS: 'artifacts',
    RATE_CARDS: 'rate-cards',
    ANALYTICS: 'analytics',
    USER: 'user',
    NOTIFICATIONS: 'notifications',
  },
} as const;

// ============================================================================
// UI Configuration
// ============================================================================

export const UI = {
  // Debounce/throttle (ms)
  DEBOUNCE: {
    SEARCH: 300,
    INPUT: 150,
    RESIZE: 200,
    SCROLL: 100,
  },

  // Animation durations (ms)
  ANIMATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },

  // Toast durations (ms)
  TOAST: {
    DEFAULT: 4000,
    SUCCESS: 3000,
    ERROR: 6000,
    WARNING: 5000,
  },

  // Breakpoints (px)
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    '2XL': 1536,
  },

  // Z-index layers
  Z_INDEX: {
    DROPDOWN: 50,
    STICKY: 100,
    MODAL: 200,
    POPOVER: 300,
    TOOLTIP: 400,
    TOAST: 500,
  },
} as const;

// ============================================================================
// Contract Configuration
// ============================================================================

export const CONTRACT = {
  // Status
  STATUS: {
    DRAFT: 'draft',
    PENDING: 'pending',
    ACTIVE: 'active',
    EXPIRED: 'expired',
    TERMINATED: 'terminated',
  } as const,

  // Processing status
  PROCESSING_STATUS: {
    QUEUED: 'queued',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    PARTIAL: 'partial',
  } as const,

  // Artifact types
  ARTIFACT_TYPES: [
    'OVERVIEW',
    'FINANCIAL',
    'CLAUSES',
    'RATES',
    'COMPLIANCE',
    'RISK',
  ] as const,

  // Alert thresholds (days)
  ALERTS: {
    EXPIRY_WARNING: 90,
    EXPIRY_CRITICAL: 30,
    RENEWAL_NOTICE: 60,
  },
} as const;

// ============================================================================
// Validation
// ============================================================================

export const VALIDATION = {
  // String lengths
  LENGTH: {
    MIN_NAME: 2,
    MAX_NAME: 100,
    MIN_DESCRIPTION: 10,
    MAX_DESCRIPTION: 5000,
    MAX_NOTES: 10000,
    MIN_PASSWORD: 8,
    MAX_PASSWORD: 128,
  },

  // Patterns
  PATTERNS: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^\+?[\d\s-()]{10,}$/,
    URL: /^https?:\/\/.+/,
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  },
} as const;

// ============================================================================
// Feature Flags
// ============================================================================

export const FEATURES = {
  AI_GENERATION: true,
  BULK_OPERATIONS: true,
  EXPORT_PDF: true,
  EXPORT_EXCEL: true,
  REALTIME_UPDATES: true,
  NOTIFICATIONS: true,
  DARK_MODE: true,
  BETA_FEATURES: process.env.NEXT_PUBLIC_ENABLE_BETA === 'true',
} as const;

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  // Auth
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  FORBIDDEN: 'FORBIDDEN',

  // Resource
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // File
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_CORRUPTED: 'FILE_CORRUPTED',

  // Processing
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

// ============================================================================
// Local Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  DATA_MODE: 'dataMode',
  VIEW_MODE: 'viewMode',
  RECENT_CONTRACTS: 'recent_contracts',
  DRAFT_DATA: 'draft_data',
} as const;

// ============================================================================
// Date Formats
// ============================================================================

export const DATE_FORMATS = {
  SHORT: 'MMM d, yyyy',
  LONG: 'MMMM d, yyyy',
  WITH_TIME: 'MMM d, yyyy h:mm a',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  API: 'yyyy-MM-dd',
  DISPLAY: 'MM/dd/yyyy',
} as const;

// ============================================================================
// Currency
// ============================================================================

export const CURRENCY = {
  DEFAULT: 'USD',
  SUPPORTED: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR'] as const,
  SYMBOLS: {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'C$',
    AUD: 'A$',
    JPY: '¥',
    CHF: 'Fr',
    INR: '₹',
  } as const,
} as const;

// ============================================================================
// Export all as single object for convenience
// ============================================================================

export const CONSTANTS = {
  API,
  UPLOAD,
  PAGINATION,
  CACHE,
  UI,
  CONTRACT,
  VALIDATION,
  FEATURES,
  ERROR_CODES,
  STORAGE_KEYS,
  DATE_FORMATS,
  CURRENCY,
} as const;

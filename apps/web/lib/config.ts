/**
 * Application Configuration
 * Central configuration for API endpoints and app settings
 * All hardcoded values are now environment-configurable
 */

// ============ Environment Helpers ============
const getEnvNumber = (key: string, fallback: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : fallback;
};

// API Base URL - defaults to same origin in production
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Feature flags - all configurable via environment
export const FEATURES = {
  enableAIChat: process.env.NEXT_PUBLIC_ENABLE_AI_CHAT !== 'false',
  enableFileUpload: process.env.NEXT_PUBLIC_ENABLE_FILE_UPLOAD !== 'false',
  enableBatchOperations: process.env.NEXT_PUBLIC_ENABLE_BATCH_OPS !== 'false',
  enableExport: process.env.NEXT_PUBLIC_ENABLE_EXPORT !== 'false',
  enableCollaboration: process.env.NEXT_PUBLIC_ENABLE_COLLABORATION !== 'false',
  enableSignatures: process.env.NEXT_PUBLIC_ENABLE_SIGNATURES !== 'false',
  enableApprovals: process.env.NEXT_PUBLIC_ENABLE_APPROVALS !== 'false',
  enableRedlining: process.env.NEXT_PUBLIC_ENABLE_REDLINING !== 'false',
};

// Upload configuration - environment configurable
export const UPLOAD_CONFIG = {
  maxFileSize: getEnvNumber('NEXT_PUBLIC_MAX_FILE_SIZE', 100 * 1024 * 1024), // 100MB default
  maxFiles: getEnvNumber('NEXT_PUBLIC_MAX_UPLOAD_FILES', 10),
  acceptedFileTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  acceptedExtensions: ['.pdf', '.doc', '.docx', '.txt'],
};

// Cache TTL configuration (in seconds)
export const CACHE_CONFIG = {
  contracts: getEnvNumber('CONTRACTS_CACHE_TTL', 300), // 5 minutes
  rateCards: getEnvNumber('RATE_CARDS_CACHE_TTL', 300), // 5 minutes
  dashboard: getEnvNumber('DASHBOARD_CACHE_TTL', 60), // 1 minute
  search: getEnvNumber('SEARCH_CACHE_TTL', 120), // 2 minutes
};

// Polling/Refresh intervals (in milliseconds)
export const REFRESH_CONFIG = {
  dashboard: getEnvNumber('NEXT_PUBLIC_DASHBOARD_REFRESH', 30000), // 30 seconds
  contracts: getEnvNumber('NEXT_PUBLIC_CONTRACTS_REFRESH', 60000), // 1 minute
  notifications: getEnvNumber('NEXT_PUBLIC_NOTIFICATIONS_REFRESH', 15000), // 15 seconds
  processingPoll: getEnvNumber('NEXT_PUBLIC_PROCESSING_POLL', 2000), // 2 seconds
};

// AI/Chat configuration
export const AI_CONFIG = {
  conversationHistoryLimit: getEnvNumber('AI_CONVERSATION_HISTORY_LIMIT', 10),
  maxTokens: getEnvNumber('AI_MAX_TOKENS', 4000),
  debounceDelay: getEnvNumber('NEXT_PUBLIC_AI_DEBOUNCE', 500), // 500ms
};

// API endpoints
export const API_ENDPOINTS = {
  contracts: {
    list: `${API_BASE_URL}/contracts`,
    upload: `${API_BASE_URL}/contracts/upload`,
    detail: (id: string) => `${API_BASE_URL}/contracts/${id}`,
    export: (id: string) => `${API_BASE_URL}/contracts/${id}/export`,
    batch: `${API_BASE_URL}/contracts/batch`,
    search: `${API_BASE_URL}/contracts/search`,
  },
  rateCards: {
    list: `${API_BASE_URL}/rate-cards`,
    detail: (id: string) => `${API_BASE_URL}/rate-cards/${id}`,
    import: `${API_BASE_URL}/import/upload`,
  },
  chat: {
    rateBenchmarking: `${API_BASE_URL}/chat/rate-benchmarking`,
  },
  health: `${API_BASE_URL}/health`,
};

// Pagination defaults
export const PAGINATION = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
};

// Animation durations (ms)
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
};

// Toast notification defaults
export const TOAST_DURATION = getEnvNumber('NEXT_PUBLIC_TOAST_DURATION', 5000); // 5 seconds
export const MAX_TOASTS = getEnvNumber('NEXT_PUBLIC_MAX_TOASTS', 5);

// UI configuration
export const UI_CONFIG = {
  toastDuration: TOAST_DURATION,
  maxToasts: MAX_TOASTS,
  debounceDelay: getEnvNumber('NEXT_PUBLIC_DEBOUNCE_DELAY', 300),
  searchDebounce: getEnvNumber('NEXT_PUBLIC_SEARCH_DEBOUNCE', 500),
  animationDuration: ANIMATION.normal,
};

const appConfig = {
  API_BASE_URL,
  FEATURES,
  UPLOAD_CONFIG,
  CACHE_CONFIG,
  REFRESH_CONFIG,
  AI_CONFIG,
  API_ENDPOINTS,
  PAGINATION,
  ANIMATION,
  UI_CONFIG,
  TOAST_DURATION,
};
export default appConfig;

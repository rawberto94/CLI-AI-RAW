/**
 * Application Configuration
 * Central configuration for API endpoints and app settings
 */

// API Base URL - defaults to same origin in production
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Feature flags
export const FEATURES = {
  enableAIChat: process.env.NEXT_PUBLIC_ENABLE_AI_CHAT !== 'false',
  enableFileUpload: true,
  enableBatchOperations: true,
  enableExport: true,
};

// Upload configuration
export const UPLOAD_CONFIG = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 10,
  acceptedFileTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  acceptedExtensions: ['.pdf', '.doc', '.docx', '.txt'],
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
export const TOAST_DURATION = 5000; // 5 seconds

export default {
  API_BASE_URL,
  FEATURES,
  UPLOAD_CONFIG,
  API_ENDPOINTS,
  PAGINATION,
  ANIMATION,
  TOAST_DURATION,
};

/**
 * Production Data Utilities
 * 
 * Utilities for handling development vs production data modes.
 * Mock data should ONLY be used in development environments.
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Environment Check
// ============================================================================

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if mock data is explicitly enabled (for testing)
 */
export function isMockDataEnabled(): boolean {
  return process.env.ENABLE_MOCK_DATA === 'true' && !isProduction();
}

// ============================================================================
// Mock Data Guard
// ============================================================================

/**
 * Guard that prevents mock data from being used in production
 * @throws Error if trying to use mock data in production
 */
export function assertNotProduction(operation: string): void {
  if (isProduction()) {
    throw new Error(
      `[Security] ${operation} is not allowed in production. ` +
      `Mock data should only be used in development.`
    );
  }
}

/**
 * Wrapper that conditionally returns mock data only in development
 */
export function devOnlyMockData<T>(
  mockData: T,
  productionFallback: T | null = null
): T | null {
  if (isDevelopment() || isMockDataEnabled()) {
    return mockData;
  }
  return productionFallback;
}

// ============================================================================
// API Response Helpers for Missing Data
// ============================================================================

/**
 * Standard response when required service is unavailable
 */
export function serviceUnavailableResponse(serviceName: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: `${serviceName} is currently unavailable. Please try again later.`,
        retryAfter: 60,
      },
      data: null,
    },
    { 
      status: 503,
      headers: {
        'Retry-After': '60',
      },
    }
  );
}

/**
 * Standard response when feature requires configuration
 */
export function configurationRequiredResponse(feature: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'CONFIGURATION_REQUIRED',
        message: `${feature} requires additional configuration. Please contact your administrator.`,
      },
      data: null,
    },
    { status: 501 }
  );
}

/**
 * Standard response for empty data (instead of mock data)
 */
export function emptyDataResponse<T>(
  emptyValue: T,
  message: string = 'No data available'
): NextResponse {
  return NextResponse.json({
    success: true,
    data: emptyValue,
    message,
    meta: {
      isEmpty: true,
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// Database Fallback Handler
// ============================================================================

interface DatabaseFallbackOptions<T> {
  /** The actual database query function */
  query: () => Promise<T>;
  /** What to return if database is unavailable (should be empty, not mock) */
  emptyFallback: T;
  /** Error message for logs */
  errorContext: string;
  /** Whether to throw in production on database error */
  throwOnProductionError?: boolean;
}

/**
 * Execute a database query with proper fallback handling
 * In production: Either returns data or throws
 * In development: Returns empty fallback with warning
 */
export async function withDatabaseFallback<T>({
  query,
  emptyFallback,
  errorContext,
  throwOnProductionError = true,
}: DatabaseFallbackOptions<T>): Promise<{ data: T; fromDatabase: boolean }> {
  try {
    const data = await query();
    return { data, fromDatabase: true };
  } catch (error: unknown) {
    if (isProduction() && throwOnProductionError) {
      throw error;
    }
    
    return { data: emptyFallback, fromDatabase: false };
  }
}

// ============================================================================
// External Service Fallback Handler
// ============================================================================

interface ExternalServiceOptions<T> {
  /** The service call function */
  call: () => Promise<T>;
  /** Service name for error messages */
  serviceName: string;
  /** Whether service is required or optional */
  required: boolean;
  /** Fallback for optional services */
  fallback?: T;
}

/**
 * Execute an external service call with proper handling
 */
export async function withExternalService<T>({
  call,
  serviceName,
  required,
  fallback,
}: ExternalServiceOptions<T>): Promise<{ data: T | null; available: boolean }> {
  try {
    const data = await call();
    return { data, available: true };
  } catch {
    if (required) {
      throw new Error(`Required service ${serviceName} is unavailable`);
    }
    
    return { data: fallback ?? null, available: false };
  }
}

// ============================================================================
// Feature Flag for Mock Data
// ============================================================================

/**
 * Check if a specific feature should use mock data
 * This should ONLY return true in development
 */
export function shouldUseMockData(feature: string): boolean {
  if (isProduction()) {
    return false;
  }
  
  const mockFeatures = process.env.MOCK_FEATURES?.split(',') || [];
  return mockFeatures.includes(feature) || mockFeatures.includes('all');
}

// ============================================================================
// Logging Helpers
// ============================================================================

/**
 * Log a warning about mock data usage
 */
export function logMockDataUsage(context: string, details?: Record<string, unknown>): void {
  if (isProduction()) {
    return;
  }
}

/**
 * Log when production data source is unavailable
 */
export function logDataSourceUnavailable(source: string, error: unknown): void {
  // In production, send to monitoring service
  if (isProduction()) {
    // Try Sentry
    if (process.env.SENTRY_DSN) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sentry = require('@sentry/nextjs');
        Sentry.captureException(error, {
          tags: { source, type: 'data_source_unavailable' },
          extra: { source },
        });
      } catch {
        // Sentry not available
      }
    }

    // Try DataDog
    if (process.env.DD_API_KEY) {
      fetch('https://http-intake.logs.datadoghq.com/api/v2/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': process.env.DD_API_KEY,
        },
        body: JSON.stringify([{
          ddsource: 'contigo',
          ddtags: `source:${source},env:production`,
          hostname: process.env.HOSTNAME || 'unknown',
          message: `Data source unavailable: ${source}`,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        }]),
      }).catch(() => {});
    }

    // Always log to console in production as fallback
    console.error(`[PROD] Data source unavailable: ${source}`, error);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if response indicates mock data was used
 */
export function isMockResponse(response: { source?: string; _mock?: boolean }): boolean {
  return response.source === 'mock' || response._mock === true;
}

/**
 * Strip mock indicators from response before sending to client
 */
export function sanitizeResponse<T extends Record<string, unknown>>(response: T): T {
  const { _mock, source, ...rest } = response;
  return rest as T;
}

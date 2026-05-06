/**
 * Resilient API Fetch Utility
 * 
 * Drop-in replacement for raw `fetch()` in page components.
 * Adds timeout, automatic tenant headers, error normalization,
 * and structured error responses.
 * 
 * For components already using BaseService/ApiClient, this is not needed.
 * This bridges the gap for the many page components that use raw fetch().
 * 
 * @example
 * // Before (raw fetch, no timeout, no error handling):
 * const res = await fetch('/api/contracts', { headers: { 'x-tenant-id': getTenantId() } });
 * const data = await res.json();
 * 
 * // After (timeout, tenant header, error normalization):
 * const data = await apiFetch<Contract[]>('/api/contracts');
 */

import { getTenantId } from '@/lib/tenant';

// ============================================================================
// Types
// ============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True for 5xx errors (server fault) */
  get isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  /** True for 401/403 (auth issues) */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** True for 429 (rate limited) */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** True for network/timeout errors (no HTTP status) */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'signal'> {
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Skip automatic tenant-id header (default: false) */
  skipTenantHeader?: boolean;
  /** External abort signal to chain with timeout */
  signal?: AbortSignal;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function unwrapApiResponseData<T = unknown>(payload: unknown): T {
  let current = payload;
  let depth = 0;

  while (
    depth < 5 &&
    isObjectRecord(current) &&
    current.success === true &&
    'data' in current
  ) {
    current = current.data;
    depth += 1;
  }

  return current as T;
}

// ============================================================================
// Default configuration
// ============================================================================

const DEFAULTS = {
  timeout: 30_000,       // 30 seconds
  uploadTimeout: 120_000, // 2 minutes for file uploads
} as const;

// ============================================================================
// Core fetch wrapper
// ============================================================================

/**
 * Resilient fetch wrapper with timeout, tenant headers, and error normalization.
 * 
 * Returns parsed JSON directly. Throws `ApiError` on failure.
 * Compatible with React Query's `queryFn` pattern.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    timeout = DEFAULTS.timeout,
    skipTenantHeader = false,
    signal: externalSignal,
    headers: userHeaders,
    ...fetchOptions
  } = options;

  // Build headers: merge tenant-id + content-type + user headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(userHeaders as Record<string, string>),
  };

  // Auto-inject tenant header for client-side requests
  if (!skipTenantHeader && typeof window !== 'undefined') {
    const tenantId = getTenantId();
    if (tenantId && tenantId !== 'unknown') {
      headers['x-tenant-id'] = tenantId;
    }
  }

  // Create timeout abort controller, chain with external signal
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // If external signal provided, abort when it fires
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-OK responses
    if (!response.ok) {
      let errorMessage = response.statusText || `HTTP ${response.status}`;
      let errorCode = `HTTP_${response.status}`;
      let errorDetails: unknown;

      try {
        const errorBody = await response.json();
        if (errorBody.error) {
          errorMessage = errorBody.error.message || errorBody.error || errorMessage;
          errorCode = errorBody.error.code || errorCode;
          errorDetails = errorBody.error.details;
        } else if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // Response body wasn't JSON — use statusText
      }

      throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return undefined as T;
    }

    // Parse JSON response
    const data = await response.json();

    // Handle standardized { success, data, error } API envelope
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success) {
        return unwrapApiResponseData<T>(data);
      }
      throw new ApiError(
        data.error?.message || 'Request failed',
        response.status,
        data.error?.code || 'API_ERROR',
        data.error?.details
      );
    }

    return unwrapApiResponseData<T>(data);
  } catch (error) {
    clearTimeout(timeoutId);

    // Re-throw ApiError as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Normalize abort/timeout errors
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        `Request to ${url} timed out after ${timeout}ms`,
        0,
        'TIMEOUT'
      );
    }

    // Normalize network errors (DNS, offline, CORS, etc.)
    if (error instanceof TypeError) {
      throw new ApiError(
        `Network error: ${error.message}`,
        0,
        'NETWORK_ERROR'
      );
    }

    // Unknown errors
    throw new ApiError(
      error instanceof Error ? error.message : String(error),
      0,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Convenience: POST with JSON body
 */
export function apiPost<T = unknown>(
  url: string,
  body: unknown,
  options: ApiFetchOptions = {}
): Promise<T> {
  return apiFetch<T>(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Convenience: PATCH with JSON body
 */
export function apiPatch<T = unknown>(
  url: string,
  body: unknown,
  options: ApiFetchOptions = {}
): Promise<T> {
  return apiFetch<T>(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Convenience: DELETE
 */
export function apiDelete<T = unknown>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  return apiFetch<T>(url, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * Upload a file with extended timeout.
 * Does NOT set Content-Type (lets browser set multipart boundary).
 */
export function apiUpload<T = unknown>(
  url: string,
  formData: FormData,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { headers: userHeaders, ...rest } = options;
  
  // Remove Content-Type so browser sets multipart boundary
  const headers: Record<string, string> = {
    ...(userHeaders as Record<string, string>),
  };
  delete headers['Content-Type'];

  return apiFetch<T>(url, {
    ...rest,
    method: 'POST',
    body: formData,
    headers,
    timeout: options.timeout ?? DEFAULTS.uploadTimeout,
  });
}

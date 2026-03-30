'use client';

/**
 * CSRF Token Provider
 * 
 * Provides CSRF token to all client components for API requests.
 * Automatically fetches and refreshes the token.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CSRF_CONSTANTS } from '@/lib/csrf-constants';

interface CSRFContextValue {
  token: string | null;
  isLoading: boolean;
  error: string | null;
  refreshToken: () => Promise<void>;
  getHeaders: () => Record<string, string>;
}

const CSRFContext = createContext<CSRFContextValue | null>(null);

/**
 * Get CSRF token from cookie — uses indexOf to correctly handle base64 `=` padding
 * in the token value (split('=') would truncate after the first `=`).
 */
function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const name = trimmed.slice(0, eqIdx);
    if (name === CSRF_CONSTANTS.TOKEN_NAME) {
      return decodeURIComponent(trimmed.slice(eqIdx + 1));
    }
  }
  return null;
}

/**
 * HTTP methods that require CSRF protection (state-changing requests)
 */
const CSRF_MUTATION_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * Install a global fetch + XHR interceptor that automatically injects the CSRF
 * token header into all same-origin mutation requests. This ensures every
 * component gets CSRF protection without needing to individually call useCSRF().
 */
function installFetchInterceptor(): () => void {
  if (typeof window === 'undefined') return () => {};

  const originalFetch = window.fetch;

  // ── Fetch interceptor ─────────────────────────────────────────────────────
  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const method = (init?.method ?? 'GET').toUpperCase();

    // Only inject for mutation methods on same-origin API calls
    if (CSRF_MUTATION_METHODS.has(method)) {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      const isSameOrigin =
        url.startsWith('/') || url.startsWith(window.location.origin);

      if (isSameOrigin) {
        let csrfToken = getTokenFromCookie();

        // If no token exists yet, eagerly fetch one before sending the request.
        // This avoids a guaranteed 403 followed by a retry that can't replay
        // consumed body streams (e.g. FormData with file uploads).
        if (!csrfToken) {
          try {
            await originalFetch.call(window, '/api/csrf', { method: 'GET', credentials: 'include' });
            csrfToken = getTokenFromCookie();
          } catch (err) {
            console.warn('[CSRF] Failed to obtain CSRF token from /api/csrf:', err);
          }
        }

        if (csrfToken) {
          const existingHeaders = new Headers(init?.headers);
          // Don't overwrite if the caller already set it
          if (!existingHeaders.has(CSRF_CONSTANTS.HEADER_NAME)) {
            existingHeaders.set(CSRF_CONSTANTS.HEADER_NAME, csrfToken);
          }
          init = { ...init, headers: existingHeaders, credentials: init?.credentials ?? 'include' };
        } else {
          console.warn('[CSRF] No token available — request may be rejected by server:', method, url);
        }

        // Execute the request
        const response = await originalFetch.call(window, input, init!);

        // Auto-retry ONCE on CSRF failure: refresh token and replay.
        // NOTE: Only retry if the body is NOT a ReadableStream/FormData (which
        // cannot be consumed twice). File uploads rely on the eager-fetch above.
        if (response.status === 403) {
          const canRetry = !(init?.body instanceof FormData) && !(init?.body instanceof ReadableStream);
          if (canRetry) {
            try {
              const body = await response.clone().json();
              if (body?.code === 'CSRF_MISSING' || body?.code === 'CSRF_EXPIRED' || body?.code === 'CSRF_INVALID') {
                console.info('[CSRF] Token expired — refreshing and retrying request');
                await originalFetch.call(window, '/api/csrf', { method: 'GET', credentials: 'include' });
                const freshToken = getTokenFromCookie();
                if (freshToken) {
                  const retryHeaders = new Headers(init?.headers);
                  retryHeaders.set(CSRF_CONSTANTS.HEADER_NAME, freshToken);
                  return originalFetch.call(window, input, { ...init, headers: retryHeaders });
                }
              }
            } catch {
              // If retry parsing fails, return original response
            }
          }
        }

        return response;
      }
    }

    return originalFetch.call(window, input, init!);
  };

  // ── XHR interceptor ───────────────────────────────────────────────────────
  // Patch XMLHttpRequest so non-fetch code (e.g. legacy upload managers) also
  // gets CSRF tokens injected automatically.
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async_?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    // Store method + url on the instance for use in send()
    (this as XMLHttpRequest & { _csrfMethod?: string; _csrfUrl?: string })._csrfMethod = method.toUpperCase();
    (this as XMLHttpRequest & { _csrfMethod?: string; _csrfUrl?: string })._csrfUrl =
      typeof url === 'string' ? url : url.href;
    return originalOpen.call(this, method, url, async_ ?? true, username, password);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null) {
    const self = this as XMLHttpRequest & { _csrfMethod?: string; _csrfUrl?: string };
    const method = self._csrfMethod ?? 'GET';
    const url = self._csrfUrl ?? '';

    if (CSRF_MUTATION_METHODS.has(method)) {
      const isSameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);
      if (isSameOrigin) {
        const token = getTokenFromCookie();
        if (token) {
          this.setRequestHeader(CSRF_CONSTANTS.HEADER_NAME, token);
        }
      }
    }

    return originalSend.call(this, body);
  };

  // Return cleanup function that restores original implementations
  return () => {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
  };
}

export function CSRFProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First check if we have a valid token in cookie
      const existingToken = getTokenFromCookie();
      if (existingToken) {
        setToken(existingToken);
        setIsLoading(false);
        return;
      }
      
      // Fetch new token from API (use /api/csrf to avoid NextAuth conflict)
      const response = await fetch('/api/csrf', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }
      
      // Token is set in cookie by the API
      const newToken = getTokenFromCookie();
      setToken(newToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Install global fetch interceptor on mount → all same-origin mutation
  // requests automatically include the x-csrf-token header.
  useEffect(() => {
    const cleanup = installFetchInterceptor();
    return cleanup;
  }, []);

  useEffect(() => {
    fetchToken();
    
    // Refresh token periodically (every 4 hours for 8 hour expiry)
    const interval = setInterval(fetchToken, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchToken]);

  const getHeaders = useCallback((): Record<string, string> => {
    if (!token) return {};
    return {
      [CSRF_CONSTANTS.HEADER_NAME]: token,
    };
  }, [token]);

  return (
    <CSRFContext.Provider value={{ token, isLoading, error, refreshToken: fetchToken, getHeaders }}>
      {children}
    </CSRFContext.Provider>
  );
}

/**
 * Hook to access CSRF token and helpers
 */
export function useCSRF(): CSRFContextValue {
  const context = useContext(CSRFContext);
  if (!context) {
    throw new Error('useCSRF must be used within a CSRFProvider');
  }
  return context;
}

/**
 * Enhanced fetch that automatically includes CSRF token
 */
export function useCSRFFetch() {
  const { getHeaders } = useCSRF();
  
  return useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const csrfHeaders = getHeaders();
      
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...csrfHeaders,
        },
        credentials: 'include',
      });
    },
    [getHeaders]
  );
}

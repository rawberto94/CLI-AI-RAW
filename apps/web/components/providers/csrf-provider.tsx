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
 * Get CSRF token from cookie
 */
function getTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_CONSTANTS.TOKEN_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
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

  useEffect(() => {
    fetchToken();
    
    // Refresh token periodically (every 50 minutes for 1 hour expiry)
    const interval = setInterval(fetchToken, 50 * 60 * 1000);
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

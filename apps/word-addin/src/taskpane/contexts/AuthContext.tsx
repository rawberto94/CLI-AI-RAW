/**
 * Authentication Context for Word Add-in
 * Supports both ConTigo email/password and Microsoft Office SSO.
 */

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api-client';
import { attemptMicrosoftSSO, isOfficeSSOAvailable, type SSOResult } from '../../services/sso-service';

interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  ssoAvailable: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithMicrosoft: () => Promise<{ success: boolean; error?: string; needsConsent?: boolean }>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = 'contigo_addin_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ssoAvailable, setSsoAvailable] = useState(false);

  // Check if Office SSO is available on mount
  useEffect(() => {
    setSsoAvailable(isOfficeSSOAvailable());
  }, []);

  // Load saved auth from storage on mount, then attempt auto-SSO
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Try restoring from saved session
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          const { token, tenantId, user: savedUser } = JSON.parse(saved);
          apiClient.setAuth(token, tenantId);

          const result = await apiClient.validateToken();
          if (result.success && result.data?.valid) {
            setUser(savedUser);
            setIsLoading(false);
            return;
          }
          // Token expired, clear
          localStorage.removeItem(AUTH_STORAGE_KEY);
          apiClient.clearAuth();
        }

        // 2. No saved session — attempt silent SSO if available
        if (isOfficeSSOAvailable()) {
          const ssoResult = await attemptMicrosoftSSO();
          if (ssoResult.success && ssoResult.token && ssoResult.user) {
            apiClient.setAuth(ssoResult.token, ssoResult.tenantId!);
            const ssoUser: User = {
              id: ssoResult.user.id,
              email: ssoResult.user.email,
              name: ssoResult.user.name,
              tenantId: ssoResult.tenantId!,
              role: 'member',
            };
            setUser(ssoUser);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
              token: ssoResult.token,
              tenantId: ssoResult.tenantId,
              user: ssoUser,
            }));
          }
          // If SSO fails silently, fall through to show login screen
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Helper to persist session
  const persistSession = useCallback((token: string, tenantId: string, authUser: User) => {
    apiClient.setAuth(token, tenantId);
    setUser(authUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, tenantId, user: authUser }));
  }, []);

  // Email/password login
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await apiClient.login(email, password);

      if (result.success && result.data) {
        const { token, tenantId, ...userData } = result.data as any;
        const authUser: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          tenantId,
          role: userData.role || 'member',
        };
        persistSession(token, tenantId, authUser);
        return { success: true };
      } else {
        return { success: false, error: result.error?.message || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  }, [persistSession]);

  // Microsoft SSO login (manual trigger from login screen button)
  const loginWithMicrosoft = useCallback(async () => {
    setIsLoading(true);
    try {
      const ssoResult: SSOResult = await attemptMicrosoftSSO();

      if (ssoResult.success && ssoResult.token && ssoResult.user) {
        const authUser: User = {
          id: ssoResult.user.id,
          email: ssoResult.user.email,
          name: ssoResult.user.name,
          tenantId: ssoResult.tenantId!,
          role: 'member',
        };
        persistSession(ssoResult.token, ssoResult.tenantId!, authUser);
        return { success: true };
      }

      return {
        success: false,
        error: ssoResult.error || 'Microsoft sign-in failed',
        needsConsent: ssoResult.needsConsent,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Microsoft sign-in failed' };
    } finally {
      setIsLoading(false);
    }
  }, [persistSession]);

  const logout = useCallback(() => {
    setUser(null);
    apiClient.clearAuth();
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const refreshAuth = useCallback(async () => {
    const result = await apiClient.validateToken();
    if (!result.success || !result.data?.valid) {
      logout();
    }
  }, [logout]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    ssoAvailable,
    login,
    loginWithMicrosoft,
    logout,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

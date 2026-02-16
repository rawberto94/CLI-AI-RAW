/**
 * Authentication Context for Word Add-in
 */

import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api-client';

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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = 'contigo_addin_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved auth from storage on mount
  useEffect(() => {
    const loadSavedAuth = async () => {
      try {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          const { token, tenantId, user: savedUser } = JSON.parse(saved);
          apiClient.setAuth(token, tenantId);
          
          // Validate token is still valid
          const result = await apiClient.validateToken();
          if (result.success && result.data?.valid) {
            setUser(savedUser);
          } else {
            // Token expired, clear storage
            localStorage.removeItem(AUTH_STORAGE_KEY);
            apiClient.clearAuth();
          }
        }
      } catch (error) {
        console.error('Failed to load saved auth:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await apiClient.login(email, password);
      
      if (result.success && result.data) {
        const { token, tenantId, ...userData } = result.data as any;
        apiClient.setAuth(token, tenantId);
        
        const user: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          tenantId,
          role: userData.role,
        };
        
        setUser(user);
        
        // Save to storage
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          token,
          tenantId,
          user,
        }));
        
        return { success: true };
      } else {
        return { 
          success: false, 
          error: result.error?.message || 'Login failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    login,
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

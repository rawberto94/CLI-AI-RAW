'use client';

/**
 * User Preferences Hook
 * Persists user preferences to localStorage with sync across tabs
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================
// Types
// ============================================

export interface UserPreferences {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  compactMode: boolean;
  
  // Accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
  
  // Notifications
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  soundEnabled: boolean;
  
  // Dashboard
  dashboardLayout: 'grid' | 'list';
  defaultContractView: 'all' | 'recent' | 'favorites';
  itemsPerPage: number;
  
  // Editor
  autoSave: boolean;
  autoSaveInterval: number; // seconds
  showLineNumbers: boolean;
  wordWrap: boolean;
  
  // AI Chat
  chatPosition: 'right' | 'bottom' | 'floating';
  chatAutoScroll: boolean;
  showSuggestions: boolean;
  
  // Keyboard
  keyboardShortcutsEnabled: boolean;
  vimMode: boolean;
}

export type PreferenceKey = keyof UserPreferences;

// ============================================
// Default Preferences
// ============================================

export const DEFAULT_PREFERENCES: UserPreferences = {
  // Appearance
  theme: 'system',
  sidebarCollapsed: false,
  compactMode: false,
  
  // Accessibility
  reducedMotion: false,
  highContrast: false,
  fontSize: 'medium',
  
  // Notifications
  notificationsEnabled: true,
  emailNotifications: true,
  soundEnabled: true,
  
  // Dashboard
  dashboardLayout: 'grid',
  defaultContractView: 'all',
  itemsPerPage: 20,
  
  // Editor
  autoSave: true,
  autoSaveInterval: 30,
  showLineNumbers: true,
  wordWrap: true,
  
  // AI Chat
  chatPosition: 'right',
  chatAutoScroll: true,
  showSuggestions: true,
  
  // Keyboard
  keyboardShortcutsEnabled: true,
  vimMode: false,
};

// ============================================
// Storage Key
// ============================================

const STORAGE_KEY = 'contigo-user-preferences';
const STORAGE_VERSION = 1;

interface StoredPreferences {
  version: number;
  preferences: Partial<UserPreferences>;
  updatedAt: string;
}

// ============================================
// Helper Functions
// ============================================

function getStoredPreferences(): Partial<UserPreferences> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    
    const parsed: StoredPreferences = JSON.parse(stored);
    
    // Version migration if needed
    if (parsed.version !== STORAGE_VERSION) {
      // Add migration logic here if needed
    }
    
    return parsed.preferences;
  } catch {
    return {};
  }
}

function setStoredPreferences(preferences: Partial<UserPreferences>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const data: StoredPreferences = {
      version: STORAGE_VERSION,
      preferences,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage error - silently ignore
  }
}

// ============================================
// User Preferences Hook
// ============================================

export function useUserPreferences() {
  const [preferences, setPreferencesState] = useState<UserPreferences>(() => ({
    ...DEFAULT_PREFERENCES,
    ...getStoredPreferences(),
  }));
  
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from storage on mount
  useEffect(() => {
    const stored = getStoredPreferences();
    setPreferencesState(prev => ({ ...prev, ...stored }));
    setIsLoaded(true);
  }, []);

  // Sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed: StoredPreferences = JSON.parse(e.newValue);
          setPreferencesState(prev => ({ ...prev, ...parsed.preferences }));
        } catch {
          // Ignore invalid JSON
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Apply theme preference
  useEffect(() => {
    if (!isLoaded) return;
    
    const { theme } = preferences;
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (mediaQuery.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      
      const handleChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [preferences.theme, isLoaded]);

  // Apply font size
  useEffect(() => {
    if (!isLoaded) return;
    
    const root = document.documentElement;
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    root.style.fontSize = fontSizeMap[preferences.fontSize];
  }, [preferences.fontSize, isLoaded]);

  // Apply reduced motion
  useEffect(() => {
    if (!isLoaded) return;
    
    const root = document.documentElement;
    if (preferences.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  }, [preferences.reducedMotion, isLoaded]);

  // Update a single preference
  const setPreference = useCallback(<K extends PreferenceKey>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferencesState(prev => {
      const next = { ...prev, [key]: value };
      setStoredPreferences(next);
      return next;
    });
  }, []);

  // Update multiple preferences
  const setPreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferencesState(prev => {
      const next = { ...prev, ...updates };
      setStoredPreferences(next);
      return next;
    });
  }, []);

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    setPreferencesState(DEFAULT_PREFERENCES);
    setStoredPreferences(DEFAULT_PREFERENCES);
  }, []);

  // Reset a single preference
  const resetPreference = useCallback(<K extends PreferenceKey>(key: K) => {
    setPreferencesState(prev => {
      const next = { ...prev, [key]: DEFAULT_PREFERENCES[key] };
      setStoredPreferences(next);
      return next;
    });
  }, []);

  // Toggle boolean preferences
  const togglePreference = useCallback(<K extends PreferenceKey>(
    key: K
  ) => {
    setPreferencesState(prev => {
      if (typeof prev[key] !== 'boolean') {
        return prev;
      }
      const next = { ...prev, [key]: !prev[key] };
      setStoredPreferences(next);
      return next;
    });
  }, []);

  // Check if preference differs from default
  const isModified = useCallback(<K extends PreferenceKey>(key: K): boolean => {
    return preferences[key] !== DEFAULT_PREFERENCES[key];
  }, [preferences]);

  // Get number of modified preferences
  const modifiedCount = useMemo(() => {
    return (Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]).filter(
      key => preferences[key] !== DEFAULT_PREFERENCES[key]
    ).length;
  }, [preferences]);

  return {
    preferences,
    isLoaded,
    setPreference,
    setPreferences,
    resetPreferences,
    resetPreference,
    togglePreference,
    isModified,
    modifiedCount,
  };
}

// ============================================
// Preference-specific Hooks
// ============================================

export function useTheme() {
  const { preferences, setPreference } = useUserPreferences();
  
  return {
    theme: preferences.theme,
    setTheme: (theme: UserPreferences['theme']) => setPreference('theme', theme),
    isDark: preferences.theme === 'dark' || 
      (preferences.theme === 'system' && 
        typeof window !== 'undefined' && 
        window.matchMedia('(prefers-color-scheme: dark)').matches),
  };
}

export function useSidebar() {
  const { preferences, togglePreference } = useUserPreferences();
  
  return {
    isCollapsed: preferences.sidebarCollapsed,
    toggle: () => togglePreference('sidebarCollapsed'),
  };
}

export function useAutoSave() {
  const { preferences, setPreference, togglePreference } = useUserPreferences();
  
  return {
    enabled: preferences.autoSave,
    interval: preferences.autoSaveInterval,
    toggle: () => togglePreference('autoSave'),
    setInterval: (seconds: number) => setPreference('autoSaveInterval', seconds),
  };
}

export function useAccessibilityPreferences() {
  const { preferences, setPreference, togglePreference } = useUserPreferences();
  
  return {
    reducedMotion: preferences.reducedMotion,
    highContrast: preferences.highContrast,
    fontSize: preferences.fontSize,
    toggleReducedMotion: () => togglePreference('reducedMotion'),
    toggleHighContrast: () => togglePreference('highContrast'),
    setFontSize: (size: UserPreferences['fontSize']) => setPreference('fontSize', size),
  };
}

export default useUserPreferences;

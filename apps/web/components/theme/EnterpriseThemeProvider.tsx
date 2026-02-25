'use client';

/**
 * EnterpriseThemeProvider
 *
 * React context that wraps the enterprise-theme engine, exposing runtime
 * brand customisation to the component tree.
 *
 * Usage in layout.tsx (nest inside ThemeProvider):
 *   <EnterpriseThemeProvider>
 *     {children}
 *   </EnterpriseThemeProvider>
 *
 * Usage in components:
 *   const { config, updateTheme, resetTheme, companyName, logoUrl } = useEnterpriseTheme();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type EnterpriseThemeConfig,
  computeThemeVars,
  applyThemeToDOM,
  removeThemeFromDOM,
  applyFavicon,
  saveThemeConfig,
  loadThemeConfig,
  clearThemeConfig,
} from '@/lib/enterprise-theme';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface EnterpriseThemeContextValue {
  /** Current enterprise theme configuration. */
  config: EnterpriseThemeConfig;
  /** Whether a custom enterprise theme is active. */
  isCustomised: boolean;
  /** Merge partial config into the current theme and apply immediately. */
  updateTheme: (partial: Partial<EnterpriseThemeConfig>) => void;
  /** Replace the entire theme config. */
  setTheme: (config: EnterpriseThemeConfig) => void;
  /** Reset to the default ConTigo theme. */
  resetTheme: () => void;
  // Convenience accessors
  companyName: string;
  logoUrl: string | undefined;
  logoDarkUrl: string | undefined;
}

const EnterpriseThemeContext = createContext<EnterpriseThemeContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface EnterpriseThemeProviderProps {
  /** Optional initial config (e.g. from a tenant API response). */
  initialConfig?: EnterpriseThemeConfig;
  /** Persist customisations in localStorage (default: true). */
  persist?: boolean;
  children: React.ReactNode;
}

export function EnterpriseThemeProvider({
  initialConfig,
  persist = true,
  children,
}: EnterpriseThemeProviderProps) {
  const [config, setConfigState] = useState<EnterpriseThemeConfig>(
    () => initialConfig ?? {},
  );

  // Hydrate from localStorage on mount (client-only).
  useEffect(() => {
    if (!persist) return;
    const saved = loadThemeConfig();
    if (saved) {
      setConfigState((prev) => ({ ...prev, ...saved }));
    }
  }, [persist]);

  // Apply CSS variable overrides whenever config changes.
  useEffect(() => {
    const vars = computeThemeVars(config);
    if (Object.keys(vars).length > 0) {
      applyThemeToDOM(vars);
    } else {
      removeThemeFromDOM();
    }

    if (config.faviconUrl) {
      applyFavicon(config.faviconUrl);
    }
  }, [config]);

  // Cleanup on unmount
  useEffect(() => () => removeThemeFromDOM(), []);

  const updateTheme = useCallback(
    (partial: Partial<EnterpriseThemeConfig>) => {
      setConfigState((prev) => {
        const next = { ...prev, ...partial };
        if (persist) saveThemeConfig(next);
        return next;
      });
    },
    [persist],
  );

  const setTheme = useCallback(
    (next: EnterpriseThemeConfig) => {
      setConfigState(next);
      if (persist) saveThemeConfig(next);
    },
    [persist],
  );

  const resetTheme = useCallback(() => {
    setConfigState({});
    removeThemeFromDOM();
    if (persist) clearThemeConfig();
  }, [persist]);

  const isCustomised = useMemo(
    () => Object.values(config).some((v) => v !== undefined && v !== ''),
    [config],
  );

  const value = useMemo<EnterpriseThemeContextValue>(
    () => ({
      config,
      isCustomised,
      updateTheme,
      setTheme,
      resetTheme,
      companyName: config.companyName ?? 'ConTigo',
      logoUrl: config.logoUrl,
      logoDarkUrl: config.logoDarkUrl ?? config.logoUrl,
    }),
    [config, isCustomised, updateTheme, setTheme, resetTheme],
  );

  return (
    <EnterpriseThemeContext.Provider value={value}>
      {children}
    </EnterpriseThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEnterpriseTheme(): EnterpriseThemeContextValue {
  const ctx = useContext(EnterpriseThemeContext);
  if (!ctx) {
    throw new Error('useEnterpriseTheme must be used within an <EnterpriseThemeProvider>');
  }
  return ctx;
}

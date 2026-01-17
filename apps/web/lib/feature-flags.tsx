/**
 * Feature Flags System
 * Runtime feature toggles with environment and user-based targeting
 * 
 * @example
 * import { useFeatureFlag, FeatureFlagProvider, isEnabled } from '@/lib/feature-flags';
 * 
 * // In components
 * const isNewUIEnabled = useFeatureFlag('new-ui');
 * 
 * // Conditional rendering
 * <FeatureGate flag="beta-feature">
 *   <NewFeature />
 * </FeatureGate>
 */

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

// ============================================================================
// Types
// ============================================================================

export interface FeatureFlag {
  /**
   * Unique identifier for the flag
   */
  id: string;
  /**
   * Human-readable name
   */
  name: string;
  /**
   * Description of what the flag controls
   */
  description?: string;
  /**
   * Whether the flag is enabled by default
   */
  enabled: boolean;
  /**
   * Environments where the flag should be enabled
   */
  environments?: ('development' | 'staging' | 'production')[];
  /**
   * Percentage of users to enable (0-100)
   */
  rolloutPercentage?: number;
  /**
   * Specific user IDs to enable for
   */
  enabledForUsers?: string[];
  /**
   * Specific user IDs to disable for
   */
  disabledForUsers?: string[];
  /**
   * User roles to enable for
   */
  enabledForRoles?: string[];
  /**
   * Start date for the flag
   */
  startDate?: Date;
  /**
   * End date for the flag
   */
  endDate?: Date;
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

export interface FeatureFlagOverride {
  flagId: string;
  enabled: boolean;
}

export interface FeatureFlagUser {
  id: string;
  roles?: string[];
  attributes?: Record<string, unknown>;
}

export interface FeatureFlagConfig {
  flags: FeatureFlag[];
  environment?: 'development' | 'staging' | 'production';
  user?: FeatureFlagUser;
}

// ============================================================================
// Default Flags
// ============================================================================

export const defaultFlags: FeatureFlag[] = [
  {
    id: 'new-dashboard',
    name: 'New Dashboard',
    description: 'Enable the redesigned dashboard experience',
    enabled: false,
    environments: ['development', 'staging'],
  },
  {
    id: 'ai-suggestions',
    name: 'AI Suggestions',
    description: 'Show AI-powered suggestions in the editor',
    enabled: true,
    environments: ['development', 'staging', 'production'],
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    description: 'Enable dark mode theme option',
    enabled: true,
  },
  {
    id: 'beta-features',
    name: 'Beta Features',
    description: 'Enable access to beta features',
    enabled: false,
    environments: ['development'],
    enabledForRoles: ['admin', 'beta-tester'],
  },
  {
    id: 'performance-monitoring',
    name: 'Performance Monitoring',
    description: 'Enable client-side performance monitoring',
    enabled: true,
    rolloutPercentage: 50,
  },
  {
    id: 'contract-templates',
    name: 'Contract Templates',
    description: 'Enable contract template library',
    enabled: true,
  },
  {
    id: 'bulk-operations',
    name: 'Bulk Operations',
    description: 'Enable bulk contract operations',
    enabled: true,
    environments: ['development', 'staging', 'production'],
  },
  {
    id: 'advanced-analytics',
    name: 'Advanced Analytics',
    description: 'Enable advanced analytics dashboard',
    enabled: false,
    environments: ['development', 'staging'],
    enabledForRoles: ['admin'],
  },
];

// ============================================================================
// Evaluation Logic
// ============================================================================

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function isInRolloutPercentage(
  flagId: string, 
  userId: string, 
  percentage: number
): boolean {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;
  
  // Consistent hashing for user assignment
  const hash = hashString(`${flagId}:${userId}`);
  const bucket = hash % 100;
  return bucket < percentage;
}

function isDateInRange(
  startDate?: Date,
  endDate?: Date
): boolean {
  const now = new Date();
  
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  
  return true;
}

export function evaluateFlag(
  flag: FeatureFlag,
  config: FeatureFlagConfig
): boolean {
  // Check environment
  if (flag.environments && config.environment) {
    if (!flag.environments.includes(config.environment)) {
      return false;
    }
  }

  // Check date range
  if (!isDateInRange(flag.startDate, flag.endDate)) {
    return false;
  }

  // Check user-specific rules
  if (config.user) {
    // Check if explicitly disabled for user
    if (flag.disabledForUsers?.includes(config.user.id)) {
      return false;
    }

    // Check if explicitly enabled for user
    if (flag.enabledForUsers?.includes(config.user.id)) {
      return true;
    }

    // Check role-based enabling
    if (flag.enabledForRoles && config.user.roles) {
      const hasRole = flag.enabledForRoles.some(role => 
        config.user!.roles!.includes(role)
      );
      if (hasRole) return true;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined) {
      return isInRolloutPercentage(flag.id, config.user.id, flag.rolloutPercentage);
    }
  }

  // Return default value
  return flag.enabled;
}

// ============================================================================
// Context
// ============================================================================

interface FeatureFlagContextValue {
  flags: Map<string, FeatureFlag>;
  overrides: Map<string, boolean>;
  isEnabled: (flagId: string) => boolean;
  setOverride: (flagId: string, enabled: boolean) => void;
  clearOverride: (flagId: string) => void;
  clearAllOverrides: () => void;
  getAllFlags: () => FeatureFlag[];
  getFlag: (flagId: string) => FeatureFlag | undefined;
  config: FeatureFlagConfig;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface FeatureFlagProviderProps {
  children: ReactNode;
  flags?: FeatureFlag[];
  environment?: 'development' | 'staging' | 'production';
  user?: FeatureFlagUser;
  /**
   * Persist overrides to localStorage
   */
  persistOverrides?: boolean;
  /**
   * Key for localStorage
   */
  storageKey?: string;
}

export function FeatureFlagProvider({
  children,
  flags = defaultFlags,
  environment = (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  user,
  persistOverrides = true,
  storageKey = 'feature-flag-overrides',
}: FeatureFlagProviderProps) {
  const [flagMap] = useState(() => new Map(flags.map(f => [f.id, f])));
  const [overrides, setOverrides] = useState<Map<string, boolean>>(() => {
    if (typeof window === 'undefined' || !persistOverrides) {
      return new Map();
    }
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return new Map(Object.entries(JSON.parse(stored)));
      }
    } catch {
      // Ignore localStorage errors
    }
    return new Map();
  });

  const config: FeatureFlagConfig = useMemo(
    () => ({
      flags,
      environment,
      user,
    }),
    [flags, environment, user]
  );

  // Persist overrides
  useEffect(() => {
    if (typeof window === 'undefined' || !persistOverrides) return;
    
    try {
      const obj = Object.fromEntries(overrides);
      localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch {
      // Ignore localStorage errors
    }
  }, [overrides, persistOverrides, storageKey]);

  const isEnabled = useCallback((flagId: string): boolean => {
    // Check overrides first
    if (overrides.has(flagId)) {
      return overrides.get(flagId)!;
    }

    // Get flag and evaluate
    const flag = flagMap.get(flagId);
    if (!flag) {
      // Flag not found - return default value silently
      return false;
    }

    return evaluateFlag(flag, config);
  }, [flagMap, overrides, config]);

  const setOverride = useCallback((flagId: string, enabled: boolean) => {
    setOverrides(prev => new Map(prev).set(flagId, enabled));
  }, []);

  const clearOverride = useCallback((flagId: string) => {
    setOverrides(prev => {
      const next = new Map(prev);
      next.delete(flagId);
      return next;
    });
  }, []);

  const clearAllOverrides = useCallback(() => {
    setOverrides(new Map());
  }, []);

  const getAllFlags = useCallback((): FeatureFlag[] => {
    return Array.from(flagMap.values());
  }, [flagMap]);

  const getFlag = useCallback((flagId: string): FeatureFlag | undefined => {
    return flagMap.get(flagId);
  }, [flagMap]);

  const value: FeatureFlagContextValue = {
    flags: flagMap,
    overrides,
    isEnabled,
    setOverride,
    clearOverride,
    clearAllOverrides,
    getAllFlags,
    getFlag,
    config,
  };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useFeatureFlags(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  }
  return context;
}

export function useFeatureFlag(flagId: string): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flagId);
}

/**
 * Hook to check multiple flags at once
 */
export function useFeatureFlagsValues(flagIds: string[]): Record<string, boolean> {
  const { isEnabled } = useFeatureFlags();
  
  return flagIds.reduce((acc, id) => {
    acc[id] = isEnabled(id);
    return acc;
  }, {} as Record<string, boolean>);
}

// ============================================================================
// Components
// ============================================================================

export interface FeatureGateProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally render based on feature flag
 */
export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(flag);
  return <>{isEnabled ? children : fallback}</>;
}

export interface FeatureGateMultipleProps {
  flags: string[];
  mode?: 'all' | 'any';
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally render based on multiple feature flags
 */
export function FeatureGateMultiple({
  flags,
  mode = 'all',
  children,
  fallback = null,
}: FeatureGateMultipleProps) {
  const values = useFeatureFlagsValues(flags);
  
  const shouldRender = mode === 'all'
    ? Object.values(values).every(Boolean)
    : Object.values(values).some(Boolean);
  
  return <>{shouldRender ? children : fallback}</>;
}

// ============================================================================
// Debug Panel
// ============================================================================

export function FeatureFlagDebugPanel({ className = '' }: { className?: string }) {
  const { getAllFlags, isEnabled, overrides, setOverride, clearOverride, clearAllOverrides, config } = useFeatureFlags();
  const [isOpen, setIsOpen] = useState(false);

  if (config.environment === 'production') {
    return null;
  }

  const flags = getAllFlags();

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg shadow-lg hover:bg-purple-700"
        >
          🚩 Flags
        </button>
      ) : (
        <div className="w-80 max-h-96 overflow-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-sm">Feature Flags</h3>
            <div className="flex gap-2">
              <button
                onClick={clearAllOverrides}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Reset
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="p-3 space-y-3">
            {flags.map(flag => {
              const enabled = isEnabled(flag.id);
              const hasOverride = overrides.has(flag.id);

              return (
                <div key={flag.id} className="flex items-start gap-3">
                  <button
                    onClick={() => setOverride(flag.id, !enabled)}
                    className={`mt-0.5 w-10 h-6 rounded-full transition-colors ${
                      enabled ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                        enabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{flag.name}</span>
                      {hasOverride && (
                        <button
                          onClick={() => clearOverride(flag.id)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          (override)
                        </button>
                      )}
                    </div>
                    {flag.description && (
                      <p className="text-xs text-gray-500 truncate">{flag.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Server-side helpers
// ============================================================================

/**
 * Check if a flag is enabled (server-side)
 */
export function isFeatureEnabled(
  flagId: string,
  flags: FeatureFlag[] = defaultFlags,
  config: Omit<FeatureFlagConfig, 'flags'> = {}
): boolean {
  const flag = flags.find(f => f.id === flagId);
  if (!flag) return false;
  
  return evaluateFlag(flag, { ...config, flags });
}

/**
 * Get all enabled flags (server-side)
 */
export function getEnabledFlags(
  flags: FeatureFlag[] = defaultFlags,
  config: Omit<FeatureFlagConfig, 'flags'> = {}
): string[] {
  return flags
    .filter(flag => evaluateFlag(flag, { ...config, flags }))
    .map(flag => flag.id);
}

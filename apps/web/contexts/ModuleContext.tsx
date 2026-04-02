'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// ============================================================================
// Types
// ============================================================================

export type ModuleType = 
  | 'dashboard'
  | 'contracts'
  | 'upload'
  | 'analytics'
  | 'rate-cards'
  | 'generate'
  | 'intelligence'
  | 'approvals'
  | 'renewals'
  | 'forecast'
  | 'drafting'
  | 'portal'
  | 'integrations'
  | 'governance'
  | 'search';

export interface ModuleBreadcrumb {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface CrossModuleAction {
  id: string;
  label: string;
  description: string;
  targetModule: ModuleType;
  targetPath: string;
  icon?: React.ComponentType<{ className?: string }>;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  contextData?: Record<string, unknown>;
}

export interface ModuleNotification {
  id: string;
  module: ModuleType;
  type: 'alert' | 'info' | 'success' | 'warning';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionPath?: string;
}

export interface ContextualItem {
  id: string;
  type: 'contract' | 'supplier' | 'approval' | 'renewal' | 'draft';
  title: string;
  subtitle?: string;
  status?: string;
  path: string;
  metadata?: Record<string, unknown>;
}

interface ModuleContextType {
  // Current Module State
  currentModule: ModuleType;
  breadcrumbs: ModuleBreadcrumb[];
  setBreadcrumbs: (breadcrumbs: ModuleBreadcrumb[]) => void;
  
  // Cross-Module Actions
  pendingActions: CrossModuleAction[];
  addAction: (action: Omit<CrossModuleAction, 'id'>) => void;
  removeAction: (id: string) => void;
  executeAction: (action: CrossModuleAction) => void;
  
  // Contextual Navigation
  navigateToModule: (module: ModuleType, path?: string, context?: Record<string, unknown>) => void;
  navigateWithContext: (path: string, context: Record<string, unknown>) => void;
  
  // Cross-Module Data Sharing
  sharedContext: Record<string, unknown>;
  setSharedContext: (key: string, value: unknown) => void;
  clearSharedContext: () => void;
  
  // Related Items (shown in contextual sidebar)
  relatedItems: ContextualItem[];
  setRelatedItems: (items: ContextualItem[]) => void;
  
  // Module Notifications
  moduleNotifications: ModuleNotification[];
  addNotification: (notification: Omit<ModuleNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  
  // Module Links for Quick Navigation
  getRelatedModules: (module: ModuleType) => ModuleType[];
  getModuleStats: () => Record<ModuleType, { count: number; urgent: number }>;
}

// ============================================================================
// Module Relationships Map
// ============================================================================

const MODULE_RELATIONSHIPS: Record<ModuleType, ModuleType[]> = {
  dashboard: ['contracts', 'approvals', 'renewals', 'intelligence', 'forecast'],
  contracts: ['intelligence', 'approvals', 'renewals', 'drafting', 'portal'],
  upload: ['contracts', 'intelligence'],
  analytics: ['contracts', 'forecast', 'rate-cards'],
  'rate-cards': ['contracts', 'analytics', 'forecast'],
  generate: ['drafting', 'contracts', 'governance'],
  intelligence: ['contracts', 'renewals', 'approvals', 'governance'],
  approvals: ['contracts', 'renewals', 'governance', 'intelligence'],
  renewals: ['contracts', 'approvals', 'intelligence', 'forecast'],
  forecast: ['analytics', 'renewals', 'contracts'],
  drafting: ['contracts', 'generate', 'governance', 'portal'],
  portal: ['contracts', 'drafting', 'approvals'],
  integrations: ['contracts', 'portal', 'analytics'],
  governance: ['contracts', 'approvals', 'drafting', 'intelligence'],
  search: ['contracts', 'intelligence'],
};

const MODULE_PATHS: Record<ModuleType, string> = {
  dashboard: '/',
  contracts: '/contracts',
  upload: '/upload',
  analytics: '/dashboard',
  'rate-cards': '/rate-cards',
  generate: '/drafting',
  intelligence: '/intelligence',
  approvals: '/approvals',
  renewals: '/renewals',
  forecast: '/forecast',
  drafting: '/drafting',
  portal: '/portal',
  integrations: '/integrations',
  governance: '/governance',
  search: '/search',
};

// ============================================================================
// Context Creation
// ============================================================================

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface ModuleProviderProps {
  children: ReactNode;
}

export function ModuleProvider({ children }: ModuleProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  // State
  const [breadcrumbs, setBreadcrumbs] = useState<ModuleBreadcrumb[]>([]);
  const [pendingActions, setPendingActions] = useState<CrossModuleAction[]>([]);
  const [sharedContext, setSharedContextState] = useState<Record<string, unknown>>({});
  const [relatedItems, setRelatedItems] = useState<ContextualItem[]>([]);
  const [moduleNotifications, setModuleNotifications] = useState<ModuleNotification[]>([]);
  
  // Derive current module from pathname
  const currentModule = useMemo((): ModuleType => {
    if (pathname === '/') return 'dashboard';
    const path = pathname.split('/')[1];
    const moduleMap: Record<string, ModuleType> = {
      contracts: 'contracts',
      upload: 'upload',
      dashboard: 'analytics',
      'rate-cards': 'rate-cards',
      generate: 'generate',
      intelligence: 'intelligence',
      approvals: 'approvals',
      renewals: 'renewals',
      forecast: 'forecast',
      drafting: 'drafting',
      portal: 'portal',
      integrations: 'integrations',
      governance: 'governance',
      search: 'search',
    };
    return (path && moduleMap[path]) || 'dashboard';
  }, [pathname]);
  
  // Actions
  const addAction = useCallback((action: Omit<CrossModuleAction, 'id'>) => {
    const newAction: CrossModuleAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    setPendingActions(prev => [...prev, newAction]);
  }, []);
  
  const removeAction = useCallback((id: string) => {
    setPendingActions(prev => prev.filter(a => a.id !== id));
  }, []);
  
  const executeAction = useCallback((action: CrossModuleAction) => {
    // Store context data before navigation
    if (action.contextData) {
      Object.entries(action.contextData).forEach(([key, value]) => {
        setSharedContextState(prev => ({ ...prev, [key]: value }));
      });
    }
    router.push(action.targetPath);
    removeAction(action.id);
  }, [router, removeAction]);
  
  // Navigation
  const navigateToModule = useCallback((module: ModuleType, path?: string, context?: Record<string, unknown>) => {
    if (context) {
      setSharedContextState(prev => ({ ...prev, ...context }));
    }
    router.push(path || MODULE_PATHS[module]);
  }, [router]);
  
  const navigateWithContext = useCallback((path: string, context: Record<string, unknown>) => {
    setSharedContextState(prev => ({ ...prev, ...context }));
    router.push(path);
  }, [router]);
  
  // Shared Context
  const setSharedContext = useCallback((key: string, value: unknown) => {
    setSharedContextState(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const clearSharedContext = useCallback(() => {
    setSharedContextState({});
  }, []);
  
  // Notifications
  const addNotification = useCallback((notification: Omit<ModuleNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: ModuleNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setModuleNotifications(prev => [newNotification, ...prev]);
  }, []);
  
  const markNotificationRead = useCallback((id: string) => {
    setModuleNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);
  
  // Module Utilities
  const getRelatedModules = useCallback((module: ModuleType) => {
    return MODULE_RELATIONSHIPS[module] || [];
  }, []);
  
  const getModuleStats = useCallback(() => {
    // Mock stats - in production, fetch from API
    const stats: Record<ModuleType, { count: number; urgent: number }> = {
      dashboard: { count: 0, urgent: 0 },
      contracts: { count: 24, urgent: 0 },
      upload: { count: 0, urgent: 0 },
      analytics: { count: 0, urgent: 0 },
      'rate-cards': { count: 156, urgent: 0 },
      generate: { count: 0, urgent: 0 },
      intelligence: { count: 3, urgent: 1 },
      approvals: { count: 4, urgent: 2 },
      renewals: { count: 5, urgent: 1 },
      forecast: { count: 0, urgent: 0 },
      drafting: { count: 2, urgent: 0 },
      portal: { count: 3, urgent: 0 },
      integrations: { count: 6, urgent: 0 },
      governance: { count: 12, urgent: 3 },
      search: { count: 0, urgent: 0 },
    };
    return stats;
  }, []);
  
  const value = useMemo<ModuleContextType>(() => ({
    currentModule,
    breadcrumbs,
    setBreadcrumbs,
    pendingActions,
    addAction,
    removeAction,
    executeAction,
    navigateToModule,
    navigateWithContext,
    sharedContext,
    setSharedContext,
    clearSharedContext,
    relatedItems,
    setRelatedItems,
    moduleNotifications,
    addNotification,
    markNotificationRead,
    getRelatedModules,
    getModuleStats,
  }), [
    currentModule,
    breadcrumbs,
    pendingActions,
    addAction,
    removeAction,
    executeAction,
    navigateToModule,
    navigateWithContext,
    sharedContext,
    setSharedContext,
    clearSharedContext,
    relatedItems,
    addNotification,
    markNotificationRead,
    getRelatedModules,
    getModuleStats,
  ]);
  
  return (
    <ModuleContext.Provider value={value}>
      {children}
    </ModuleContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useModuleContext() {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModuleContext must be used within a ModuleProvider');
  }
  return context;
}

// ============================================================================
// Utility Hooks
// ============================================================================

export function useModuleBreadcrumbs(breadcrumbs: ModuleBreadcrumb[]) {
  const { setBreadcrumbs } = useModuleContext();
  
  React.useEffect(() => {
    setBreadcrumbs(breadcrumbs);
    return () => setBreadcrumbs([]);
  }, [breadcrumbs, setBreadcrumbs]);
}

export function useCrossModuleAction() {
  const { addAction, navigateWithContext } = useModuleContext();
  
  const createHealthToRenewalAction = useCallback((contractId: string, contractName: string) => {
    addAction({
      label: 'Manage Renewal',
      description: `Review renewal options for ${contractName}`,
      targetModule: 'renewals',
      targetPath: `/renewals?contract=${contractId}`,
      priority: 'high',
      contextData: { contractId, contractName, source: 'health-score' },
    });
  }, [addAction]);
  
  const createHealthToApprovalAction = useCallback((contractId: string, action: string) => {
    addAction({
      label: 'Request Approval',
      description: `Request approval for ${action}`,
      targetModule: 'approvals',
      targetPath: `/approvals/new?contract=${contractId}&action=${action}`,
      priority: 'high',
      contextData: { contractId, action, source: 'health-score' },
    });
  }, [addAction]);
  
  const navigateToContractDetail = useCallback((contractId: string) => {
    navigateWithContext(`/contracts/${contractId}`, { source: 'cross-module' });
  }, [navigateWithContext]);
  
  return {
    createHealthToRenewalAction,
    createHealthToApprovalAction,
    navigateToContractDetail,
  };
}

export default ModuleContext;

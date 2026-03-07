/**
 * Propagation Utility
 * 
 * Centralized utility for triggering real-time updates across the app.
 * Use this when making changes that need to be reflected immediately
 * in other components, tabs, or the dashboard.
 * 
 * Usage:
 *   import { propagate } from '@/lib/propagation';
 *   
 *   // After saving a contract
 *   await saveContract(data);
 *   propagate.contract(contractId);
 *   
 *   // After updating taxonomy
 *   await updateCategory(data);
 *   propagate.taxonomy('category_updated', { categoryId: '123' });
 *   
 *   // After any approval action
 *   await approveContract(id);
 *   propagate.approval(contractId);
 */

import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/use-queries';
import { notifyTaxonomyChange, type TaxonomyEventType, type TaxonomyEvent } from '@/lib/taxonomy-events';

// Global query client reference (set by QueryProvider)
let globalQueryClient: QueryClient | null = null;

/**
 * Set the global query client (called by QueryProvider on mount)
 */
export function setGlobalQueryClient(client: QueryClient) {
  globalQueryClient = client;
}

/**
 * Get the query client for invalidation
 */
function getQueryClient(): QueryClient | null {
  return globalQueryClient;
}

/**
 * Propagation utility - trigger real-time updates across the app
 */
export const propagate = {
  /**
   * Propagate contract changes (create, update, delete, status change)
   */
  contract: (contractId?: string) => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: queryKeys.contracts.all });
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    qc.invalidateQueries({ queryKey: queryKeys.analytics.dashboard() });
    
    if (contractId) {
      qc.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
      qc.invalidateQueries({ queryKey: ['contract-rate-cards', contractId] });
      qc.invalidateQueries({ queryKey: ['contract-artifacts', contractId] });
      qc.invalidateQueries({ queryKey: ['contract-health', contractId] });
    }
  },

  /**
   * Propagate approval changes (approve, reject, escalate)
   */
  approval: (contractId?: string) => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: ['approvals'] });
    qc.invalidateQueries({ queryKey: ['pending-approvals'] });
    qc.invalidateQueries({ queryKey: ['approval-stats'] });
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    
    if (contractId) {
      qc.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
      qc.invalidateQueries({ queryKey: ['contract-health', contractId] });
    }
    qc.invalidateQueries({ queryKey: queryKeys.contracts.lists() });
  },

  /**
   * Propagate rate card changes
   */
  rateCard: (contractId?: string) => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: queryKeys.rateCards.all });
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    
    if (contractId) {
      qc.invalidateQueries({ queryKey: ['contract-rate-cards', contractId] });
    }
  },

  /**
   * Propagate renewal changes
   */
  renewal: (contractId?: string) => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: ['renewal-intelligence'] });
    qc.invalidateQueries({ queryKey: ['renewals'] });
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    qc.invalidateQueries({ queryKey: ['contract-expirations'] });
    
    if (contractId) {
      qc.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
    }
  },

  /**
   * Propagate workflow changes (also updates approvals since workflows affect them)
   */
  workflow: () => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: queryKeys.workflows.all });
    qc.invalidateQueries({ queryKey: ['approvals'] });
    qc.invalidateQueries({ queryKey: ['pending-approvals'] });
  },

  /**
   * Propagate template changes
   */
  template: () => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: queryKeys.templates.all });
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
  },

  /**
   * Propagate taxonomy/category changes (+ cross-tab sync)
   */
  taxonomy: (eventType: TaxonomyEventType = 'category_updated', data?: TaxonomyEvent['data']) => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: queryKeys.taxonomy.all });
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: queryKeys.contracts.all }); // Contracts show categories
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    
    // Cross-tab notification
    notifyTaxonomyChange(eventType, data);
  },

  /**
   * Propagate user/team changes
   */
  user: () => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: queryKeys.users.all });
    qc.invalidateQueries({ queryKey: ['teams'] });
    qc.invalidateQueries({ queryKey: ['permissions'] });
    qc.invalidateQueries({ queryKey: ['audit-log'] });
  },

  /**
   * Propagate integration/settings changes
   */
  integration: () => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: queryKeys.integrations.all });
    qc.invalidateQueries({ queryKey: ['settings'] });
    qc.invalidateQueries({ queryKey: ['sso-config'] });
    qc.invalidateQueries({ queryKey: ['storage-settings'] });
  },

  /**
   * Propagate clause library changes
   */
  clause: () => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: queryKeys.clauses.all });
    qc.invalidateQueries({ queryKey: ['clause-library'] });
  },

  /**
   * Propagate notification changes (mark as read, clear, etc.)
   */
  notification: () => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['unread-count'] });
  },

  /**
   * Propagate dashboard data refresh
   */
  dashboard: () => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    qc.invalidateQueries({ queryKey: ['dashboard-widgets'] });
    qc.invalidateQueries({ queryKey: ['pending-approvals'] });
    qc.invalidateQueries({ queryKey: ['contract-expirations'] });
    qc.invalidateQueries({ queryKey: ['contract-health-scores'] });
    qc.invalidateQueries({ queryKey: queryKeys.analytics.dashboard() });
  },

  /**
   * Force refresh all data - use sparingly
   */
  all: () => {
    const qc = getQueryClient();
    if (!qc) return;
    
    qc.invalidateQueries();
  },
};

/**
 * Helper to wrap async operations with automatic propagation
 * 
 * Usage:
 *   const result = await withPropagation(
 *     () => fetch('/api/contracts', { method: 'POST', body: data }),
 *     'contract'
 *   );
 */
export async function withPropagation<T>(
  operation: () => Promise<T>,
  propagationType: keyof typeof propagate,
  entityId?: string
): Promise<T> {
  const result = await operation();
  
  // Trigger propagation after successful operation
  const propagateFn = propagate[propagationType];
  if (typeof propagateFn === 'function') {
    // Type assertion since some functions take an optional id
    (propagateFn as (id?: string) => void)(entityId);
  }
  
  return result;
}

/**
 * Hook-style propagation for use in components
 * 
 * Usage:
 *   const { propagateContract, propagateApproval } = usePropagation();
 *   
 *   const handleSave = async () => {
 *     await saveContract(data);
 *     propagateContract(contractId);
 *   };
 */
export function createPropagationHelpers(queryClient: QueryClient) {
  return {
    propagateContract: (contractId?: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      if (contractId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
      }
    },
    propagateApproval: (contractId?: string) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      if (contractId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
      }
    },
    propagateRateCard: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rateCards.all });
    },
    propagateTaxonomy: (eventType: TaxonomyEventType = 'category_updated') => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taxonomy.all });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      notifyTaxonomyChange(eventType);
    },
    propagateWorkflow: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
    propagateTemplate: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
    },
    propagateDashboard: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    propagateAll: () => {
      queryClient.invalidateQueries();
    },
  };
}

/**
 * usePropagation Hook
 * 
 * React hook for triggering real-time updates across the app.
 * Provides the same functionality as the propagation utility but
 * with proper React Query client integration.
 * 
 * Usage:
 *   const { propagateContract, propagateTaxonomy } = usePropagation();
 *   
 *   const handleSave = async () => {
 *     await saveContract(data);
 *     propagateContract(contractId);
 *   };
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/hooks/use-queries';
import { notifyTaxonomyChange, type TaxonomyEventType, type TaxonomyEvent } from '@/lib/taxonomy-events';

export function usePropagation() {
  const queryClient = useQueryClient();

  const propagateContract = useCallback((contractId?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.dashboard() });
    
    if (contractId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
      queryClient.invalidateQueries({ queryKey: ['contract-rate-cards', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contract-artifacts', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contract-health', contractId] });
    }
  }, [queryClient]);

  const propagateApproval = useCallback((contractId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    
    if (contractId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
      queryClient.invalidateQueries({ queryKey: ['contract-health', contractId] });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() });
  }, [queryClient]);

  const propagateRateCard = useCallback((contractId?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.rateCards.all });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    
    if (contractId) {
      queryClient.invalidateQueries({ queryKey: ['contract-rate-cards', contractId] });
    }
  }, [queryClient]);

  const propagateRenewal = useCallback((contractId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['renewal-intelligence'] });
    queryClient.invalidateQueries({ queryKey: ['renewals'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['contract-expirations'] });
    
    if (contractId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
    }
  }, [queryClient]);

  const propagateWorkflow = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
  }, [queryClient]);

  const propagateTemplate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  }, [queryClient]);

  const propagateTaxonomy = useCallback((
    eventType: TaxonomyEventType = 'category_updated',
    data?: TaxonomyEvent['data']
  ) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.taxonomy.all });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    
    // Cross-tab notification
    notifyTaxonomyChange(eventType, data);
  }, [queryClient]);

  const propagateUser = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    queryClient.invalidateQueries({ queryKey: ['teams'] });
    queryClient.invalidateQueries({ queryKey: ['permissions'] });
    queryClient.invalidateQueries({ queryKey: ['audit-log'] });
  }, [queryClient]);

  const propagateIntegration = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    queryClient.invalidateQueries({ queryKey: ['sso-config'] });
    queryClient.invalidateQueries({ queryKey: ['storage-settings'] });
  }, [queryClient]);

  const propagateClause = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clauses.all });
    queryClient.invalidateQueries({ queryKey: ['clause-library'] });
  }, [queryClient]);

  const propagateNotification = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-count'] });
  }, [queryClient]);

  const propagateDashboard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    queryClient.invalidateQueries({ queryKey: ['contract-expirations'] });
    queryClient.invalidateQueries({ queryKey: ['contract-health-scores'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.dashboard() });
  }, [queryClient]);

  const propagateAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  return {
    propagateContract,
    propagateApproval,
    propagateRateCard,
    propagateRenewal,
    propagateWorkflow,
    propagateTemplate,
    propagateTaxonomy,
    propagateUser,
    propagateIntegration,
    propagateClause,
    propagateNotification,
    propagateDashboard,
    propagateAll,
  };
}

// Type for the hook return value
export type PropagationHelpers = ReturnType<typeof usePropagation>;

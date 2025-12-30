/**
 * Action Handlers
 * Central registry for all chatbot action handlers
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';
import { prisma } from '@/lib/prisma';

export type ActionHandler = (
  intent: DetectedIntent,
  context: ChatContext
) => Promise<ActionResponse>;

// Import handlers (will be created)
import { handleListActions } from './list-actions';
import { handleContractActions } from './contract-actions';
import { handleAnalyticsActions } from './analytics-actions';
import { handleTaxonomyActions } from './taxonomy-actions';
import { handleComparisonActions } from './comparison-actions';
import { handleWorkflowActions } from './workflow-actions';

const actionHandlers: Record<string, ActionHandler> = {
  // List actions
  list_by_supplier: handleListActions,
  list_expiring: handleListActions,
  list_by_status: handleListActions,
  list_by_value: handleListActions,
  find_master: handleListActions,

  // Contract actions
  renew: handleContractActions,
  generate: handleContractActions,
  approve: handleContractActions,
  create: handleContractActions,
  create_linked: handleContractActions,
  link_contracts: handleContractActions,
  show_hierarchy: handleContractActions,

  // Analytics actions
  count: handleAnalyticsActions,
  summarize: handleAnalyticsActions,
  spend_analysis: handleAnalyticsActions,
  cost_savings: handleAnalyticsActions,
  risk_assessment: handleAnalyticsActions,
  top_suppliers: handleAnalyticsActions,
  auto_renewals: handleAnalyticsActions,
  category_spend: handleAnalyticsActions,

  // Taxonomy actions
  list_categories: handleTaxonomyActions,
  browse_taxonomy: handleTaxonomyActions,
  categorize_contract: handleTaxonomyActions,

  // Comparison actions
  compare_contracts: handleComparisonActions,
  compare_suppliers: handleComparisonActions,
  compare_clauses: handleComparisonActions,

  // Workflow actions
  start_workflow: handleWorkflowActions,
};

export async function executeAction(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const handler = intent.action && actionHandlers[intent.action];

  if (!handler) {
    return {
      success: false,
      message: `No handler found for action: ${intent.action}`,
      error: 'HANDLER_NOT_FOUND',
    };
  }

  try {
    return await handler(intent, context);
  } catch (error) {
    console.error('[Action Handler] Error:', error);
    return {
      success: false,
      message: 'An error occurred while processing your request',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

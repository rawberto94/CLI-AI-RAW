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
import { handleUpdateActions, detectUpdateIntent, type UpdateIntent } from './update-actions';
import { handleVersionAction, versionActionPatterns } from './version-actions';
import { handleCreationAction, creationActionPatterns } from './creation-actions';
import { handleRepositoryAction, repositoryActionPatterns } from './repository-actions';
import { handleHelpAction, helpActionPatterns, detectHelpIntent } from './help-actions';

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

  // Update actions (bi-directional write-back)
  update_expiration: handleUpdateActions as ActionHandler,
  update_effective_date: handleUpdateActions as ActionHandler,
  update_value: handleUpdateActions as ActionHandler,
  update_status: handleUpdateActions as ActionHandler,
  update_title: handleUpdateActions as ActionHandler,
  update_supplier: handleUpdateActions as ActionHandler,
  update_client: handleUpdateActions as ActionHandler,
  update_category: handleUpdateActions as ActionHandler,
  confirm_action: handleUpdateActions as ActionHandler,
  reject_action: handleUpdateActions as ActionHandler,

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
  list_workflows: handleWorkflowActions,
  workflow_status: handleWorkflowActions,
  pending_approvals: handleWorkflowActions,
  approve_step: handleWorkflowActions,
  reject_step: handleWorkflowActions,
  create_workflow: handleWorkflowActions,
  assign_approver: handleWorkflowActions,
  escalate: handleWorkflowActions,
  cancel_workflow: handleWorkflowActions,

  // Version actions
  show_version_history: handleVersionAction as ActionHandler,
  compare_versions: handleVersionAction as ActionHandler,
  create_version: handleVersionAction as ActionHandler,
  revert_to_version: handleVersionAction as ActionHandler,
  upload_new_version: handleVersionAction as ActionHandler,
  export_version_history: handleVersionAction as ActionHandler,

  // Creation actions
  create_manual: handleCreationAction as ActionHandler,
  quick_upload: handleCreationAction as ActionHandler,
  ai_draft: handleCreationAction as ActionHandler,
  generate_from_template: handleCreationAction as ActionHandler,

  // Repository actions
  filter_contracts: handleRepositoryAction as ActionHandler,
  search_contracts: handleRepositoryAction as ActionHandler,
  show_expired: handleRepositoryAction as ActionHandler,
  show_expiring: handleRepositoryAction as ActionHandler,
  show_high_risk: handleRepositoryAction as ActionHandler,
  show_uncategorized: handleRepositoryAction as ActionHandler,
  show_by_status: handleRepositoryAction as ActionHandler,
  contract_stats: handleRepositoryAction as ActionHandler,
  bulk_operations: handleRepositoryAction as ActionHandler,
  change_view: handleRepositoryAction as ActionHandler,

  // Help actions
  show_help: handleHelpAction as ActionHandler,
  show_category_help: handleHelpAction as ActionHandler,
  list_commands: handleHelpAction as ActionHandler,
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

// Export update intent detection for use in chat route
export { detectUpdateIntent, type UpdateIntent };

// Export pattern matchers for intent detection
export { versionActionPatterns, creationActionPatterns, repositoryActionPatterns, helpActionPatterns, detectHelpIntent };

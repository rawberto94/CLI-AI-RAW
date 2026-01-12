/**
 * Chatbot Types
 * Shared type definitions for the chatbot system
 */

export interface DetectedIntent {
  type: 'search' | 'action' | 'question' | 'workflow' | 'list' | 'analytics' | 'procurement' | 'taxonomy' | 'comparison' | 'update' | 'version' | 'creation';
  action?: 
    // Contract actions
    | 'renew' | 'generate' | 'approve' | 'create' | 'start_workflow' | 'list_by_supplier' | 'list_expiring' | 'list_by_status' | 'list_by_value' | 'count' | 'summarize' | 'create_linked' | 'link_contracts' | 'show_hierarchy' | 'find_master' 
    // Procurement actions
    | 'spend_analysis' | 'cost_savings' | 'rate_comparison' | 'risk_assessment' | 'compliance_check' | 'compliance_status' | 'budget_status' | 'supplier_performance' | 'negotiate_terms' | 'category_spend' | 'top_suppliers' | 'savings_opportunities' | 'contract_risks' | 'auto_renewals' | 'payment_terms'
    // Taxonomy actions
    | 'list_categories' | 'browse_taxonomy' | 'categorize_contract' | 'category_details' | 'suggest_category'
    // Advanced AI agent actions
    | 'deep_analysis' | 'semantic_search' | 'clause_search' | 'executive_briefing' | 'status_update' | 'attention_needed' | 'find_signatories' | 'find_expiration'
    // Contract comparison actions
    | 'compare_contracts' | 'compare_clauses' | 'compare_groups' | 'compare_suppliers' | 'side_by_side'
    // BI-DIRECTIONAL UPDATE ACTIONS (write-back to database)
    | 'update_expiration' | 'update_effective_date' | 'update_value' | 'update_status' 
    | 'update_title' | 'update_supplier' | 'update_client' | 'update_category'
    | 'confirm_action' | 'reject_action'
    // VERSION ACTIONS
    | 'show_version_history' | 'compare_versions' | 'create_version' | 'revert_to_version' | 'upload_new_version' | 'export_version_history'
    // CREATION ACTIONS (enhanced)
    | 'create_manual' | 'quick_upload' | 'ai_draft' | 'generate_from_template'
    // REPOSITORY ACTIONS
    | 'filter_contracts' | 'search_contracts' | 'show_expired' | 'show_expiring' 
    | 'show_high_risk' | 'show_uncategorized' | 'show_by_status' | 'contract_stats'
    | 'bulk_operations' | 'change_view'
    // WORKFLOW ACTIONS
    | 'list_workflows' | 'workflow_status' | 'pending_approvals' | 'approve_step'
    | 'reject_step' | 'create_workflow' | 'assign_approver' | 'escalate' | 'cancel_workflow'
    // HELP ACTIONS
    | 'show_help' | 'show_category_help' | 'list_commands';
  entities: {
    contractName?: string;
    supplierName?: string;
    contractType?: string;
    workflowType?: string;
    status?: string;
    daysUntilExpiry?: number;
    valueThreshold?: number;
    // For contract linking
    parentContractType?: string;
    parentYear?: string;
    childContractType?: string;
    relationshipType?: string;
    // Procurement entities
    category?: string;
    timePeriod?: string;
    riskLevel?: string;
    savingsCategory?: string;
    topN?: number;
    // Advanced analysis aspects
    analysisAspects?: {
      value?: boolean;
      duration?: boolean;
      categories?: boolean;
      supplierDetails?: boolean;
      risk?: boolean;
      terms?: boolean;
    };
    // Search/query entities
    searchQuery?: string;
    clauseTerm?: string;
    topic?: string;
    timeframe?: string;
    sortOrder?: string;
    limit?: number;
    // Contract comparison entities
    contractA?: string;
    contractB?: string;
    supplierA?: string;
    supplierB?: string;
    comparisonEntities?: string[];
    clauseType?: string;
    comparisonAspects?: {
      value?: boolean;
      duration?: boolean;
      terms?: boolean;
      risk?: boolean;
      rates?: boolean;
      clauses?: boolean;
      count?: boolean;
      avgValue?: boolean;
    };
    // Multi-group comparison entities
    comparisonGroups?: Array<{
      supplier?: string;
      year?: string;
      category?: string;
    }>;
    // Bi-directional update entities
    contractId?: string;
    fieldToUpdate?: string;
    newValue?: string | number | Date;
    pendingActionId?: string;
    // Version entities
    versionNumber?: number;
    targetVersionId?: string;
    versionSummary?: string;
    compareVersionA?: number;
    compareVersionB?: number;
    // Creation entities
    contractTitle?: string;
    contractDescription?: string;
    templateType?: string;
    draftPrompt?: string;
    // Repository entities
    viewMode?: string;
    categoryName?: string;
    partyName?: string;
    filterType?: string;
    // Workflow entities
    workflowId?: string;
    executionId?: string;
    assignee?: string;
    reason?: string;
    comment?: string;
  };
  confidence: number;
}

export interface ChatContext {
  tenantId: string;
  userId?: string;
  conversationId?: string;
  currentContractId?: string; // For context-aware updates
  previousMessages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface ActionResponse {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

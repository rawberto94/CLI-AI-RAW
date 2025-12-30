/**
 * Chatbot Types
 * Shared type definitions for the chatbot system
 */

export interface DetectedIntent {
  type: 'search' | 'action' | 'question' | 'workflow' | 'list' | 'analytics' | 'procurement' | 'taxonomy' | 'comparison';
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
    | 'compare_contracts' | 'compare_clauses' | 'compare_groups' | 'compare_suppliers' | 'side_by_side';
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
  };
  confidence: number;
}

export interface ChatContext {
  tenantId: string;
  userId?: string;
  conversationId?: string;
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

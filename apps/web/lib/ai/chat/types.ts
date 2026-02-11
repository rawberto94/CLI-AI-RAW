/**
 * Chat Types & Interfaces
 * 
 * Shared types for the AI chat system including intent detection,
 * contract operations, and response generation.
 * 
 * @version 1.0.0
 */

// ============================================================================
// INTENT DETECTION TYPES
// ============================================================================

export type IntentType = 
  | 'search' 
  | 'action' 
  | 'question' 
  | 'workflow' 
  | 'list' 
  | 'analytics' 
  | 'procurement' 
  | 'taxonomy' 
  | 'comparison' 
  | 'system';

export type IntentAction = 
  // Basic actions
  | 'renew' | 'generate' | 'approve' | 'create' | 'start_workflow'
  | 'list_by_supplier' | 'list_expiring' | 'list_by_status' | 'list_by_value'
  | 'count' | 'summarize' | 'create_linked' | 'link_contracts' | 'show_hierarchy' | 'find_master'
  // Signature status actions
  | 'list_by_signature' | 'list_needing_signature'
  // Procurement actions
  | 'spend_analysis' | 'cost_savings' | 'rate_comparison' | 'risk_assessment'
  | 'compliance_check' | 'compliance_status' | 'budget_status' | 'supplier_performance'
  | 'negotiate_terms' | 'category_spend' | 'top_suppliers' | 'savings_opportunities'
  | 'contract_risks' | 'auto_renewals' | 'payment_terms'
  // Taxonomy actions
  | 'list_categories' | 'browse_taxonomy' | 'categorize_contract' | 'category_details' | 'suggest_category'
  // Advanced AI agent actions
  | 'deep_analysis' | 'semantic_search' | 'clause_search' | 'executive_briefing'
  | 'status_update' | 'attention_needed' | 'find_signatories' | 'find_expiration'
  // Contract comparison actions
  | 'compare_contracts' | 'compare_clauses' | 'compare_groups' | 'compare_suppliers' | 'side_by_side'
  // Contract update actions
  | 'update_expiration' | 'update_effective_date' | 'update_value' | 'update_status'
  | 'update_title' | 'update_supplier' | 'update_client' | 'update_category'
  // Document classification actions
  | 'list_by_document_type' | 'list_non_contracts'
  // System status actions
  | 'system_health' | 'categorization_accuracy' | 'ai_performance' | 'queue_status'
  // Conversational actions
  | 'greeting' | 'farewell' | 'help' | 'general';

export type SignatureStatusType = 'signed' | 'partially_signed' | 'unsigned' | 'unknown';

export type DocumentClassificationType = 
  | 'contract' | 'purchase_order' | 'invoice' | 'quote' | 'proposal'
  | 'work_order' | 'letter_of_intent' | 'memorandum' | 'amendment' | 'addendum' | 'unknown';

export interface DetectedIntent {
  type: IntentType;
  action?: IntentAction;
  entities: IntentEntities;
  confidence: number;
}

export interface IntentEntities {
  contractName?: string;
  supplierName?: string;
  contractType?: string;
  workflowType?: string;
  status?: string;
  daysUntilExpiry?: number;
  valueThreshold?: number;
  // Contract linking
  parentContractType?: string;
  parentYear?: string;
  childContractType?: string;
  relationshipType?: string;
  // Contract updates
  fieldToUpdate?: string;
  newValue?: string;
  contractId?: string;
  // Signature status
  signatureStatus?: SignatureStatusType;
  // Document classification
  documentType?: DocumentClassificationType;
  // Procurement
  category?: string;
  timePeriod?: string;
  riskLevel?: string;
  savingsCategory?: string;
  topN?: number;
  // Analysis aspects
  analysisAspects?: {
    value?: boolean;
    duration?: boolean;
    categories?: boolean;
    supplierDetails?: boolean;
    risk?: boolean;
    terms?: boolean;
  };
  // Search/query
  searchQuery?: string;
  clauseTerm?: string;
  topic?: string;
  timeframe?: string;
  sortOrder?: string;
  limit?: number;
  // Contract comparison
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
  comparisonGroups?: Array<{
    supplier?: string;
    year?: string;
    category?: string;
  }>;
  // Implicit context flags (from conversation memory)
  hasImplicitContractContext?: boolean;
  isAskingRecommendation?: boolean;
  questionType?: string;
  hasUrgency?: boolean;
}

// ============================================================================
// CONTRACT OPERATION TYPES
// ============================================================================

export interface ContractPreview {
  id?: string;
  name?: string;
  supplier?: string;
  status?: string;
  value?: number;
  expirationDate?: string | null;
  daysUntilExpiry?: number | null;
  riskLevel?: string;
  type?: string;
}

export interface ContractSearchResult {
  id: string;
  contractTitle: string;
  supplierName?: string;
  status: string;
  totalValue?: number | string;
  expirationDate?: Date | null;
  contractType?: string;
}

export interface ProactiveInsights {
  criticalAlerts: string[];
  insights: string[];
  urgentContracts: ContractSearchResult[];
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface SpendAnalysis {
  totalSpend: number;
  bySupplier: Array<{ supplier: string; amount: number; percentage: number }>;
  byCategory: Array<{ category: string; amount: number; percentage: number }>;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  expiringContracts: number;
  highValueAtRisk: number;
  recommendations: string[];
}

export interface ComplianceStatus {
  compliant: number;
  nonCompliant: number;
  pending: number;
  issues: Array<{ contractId: string; issue: string; severity: string }>;
}

// ============================================================================
// AI RESPONSE TYPES
// ============================================================================

export interface ChatContext {
  contractId?: string;
  context?: Record<string, unknown>;
  intent?: DetectedIntent;
  additionalContext?: string;
  ragContext?: string;
  memoryContext?: string;
}

export interface ChatResponse {
  response: string;
  conversationId?: string;
  contractPreviews?: ContractPreview[];
  proactiveAlerts?: string[];
  proactiveInsights?: string[];
  suggestions?: string[];
  suggestedActions?: Array<{ label: string; action: string }>;
  clarificationNeeded?: boolean;
  clarificationPrompts?: string[];
  clarificationType?: string;
  referenceResolutions?: Array<{ original: string; resolved: string }>;
}

// ============================================================================
// CONTRACT TYPE ALIASES
// ============================================================================

export const CONTRACT_TYPE_ALIASES: Record<string, string> = {
  'sow': 'SOW',
  'statement of work': 'SOW',
  'msa': 'MSA',
  'master agreement': 'MSA',
  'master service agreement': 'MSA',
  'master services agreement': 'MSA',
  'amendment': 'AMENDMENT',
  'addendum': 'ADDENDUM',
  'change order': 'CHANGE_ORDER',
  'co': 'CHANGE_ORDER',
  'nda': 'NDA',
  'non-disclosure': 'NDA',
  'non disclosure': 'NDA',
  'purchase order': 'PO',
  'po': 'PO',
  'license': 'LICENSE',
  'license agreement': 'LICENSE',
};

/**
 * Normalize a contract type string to standard format
 */
export function normalizeContractType(input: string | undefined): string {
  if (!input) return 'CONTRACT';
  const lower = input.toLowerCase().trim();
  return CONTRACT_TYPE_ALIASES[lower] || input.toUpperCase();
}

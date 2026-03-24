/**
 * Intent detection module for AI chat.
 * Extracted from the legacy non-streaming chat route.
 *
 * Contains pure logic for detecting user intent from natural language queries.
 * Includes an async LLM fallback for low-confidence regex matches.
 */

import OpenAI from 'openai';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';

export interface DetectedIntent {
  type: 'search' | 'action' | 'question' | 'workflow' | 'list' | 'analytics' | 'procurement' | 'taxonomy' | 'comparison' | 'system';
  action?: 'renew' | 'generate' | 'approve' | 'create' | 'start_workflow' | 'list_by_supplier' | 'list_expiring' | 'list_by_status' | 'list_by_value' | 'count' | 'summarize' | 'create_linked' | 'link_contracts' | 'show_hierarchy' | 'find_master' | 
    // Signature status actions
    'list_by_signature' | 'list_needing_signature' |
    // New procurement actions
    'spend_analysis' | 'cost_savings' | 'rate_comparison' | 'risk_assessment' | 'compliance_check' | 'compliance_status' | 'budget_status' | 'supplier_performance' | 'negotiate_terms' | 'category_spend' | 'top_suppliers' | 'savings_opportunities' | 'contract_risks' | 'auto_renewals' | 'payment_terms' |
    // Taxonomy actions
    'list_categories' | 'browse_taxonomy' | 'categorize_contract' | 'category_details' | 'suggest_category' |
    // Advanced AI agent actions
    'deep_analysis' | 'semantic_search' | 'clause_search' | 'executive_briefing' | 'status_update' | 'attention_needed' | 'find_signatories' | 'find_expiration' |
    // Contract comparison actions
    'compare_contracts' | 'compare_clauses' | 'compare_groups' | 'compare_suppliers' | 'side_by_side' |
    // Contract update actions
    'update_expiration' | 'update_effective_date' | 'update_value' | 'update_status' | 'update_title' | 'update_supplier' | 'update_client' | 'update_category' |
    // Document classification actions
    'list_by_document_type' | 'list_non_contracts' |
    // System status actions
    'system_health' | 'categorization_accuracy' | 'ai_performance' | 'queue_status' |
    // Conversational actions
    'greeting' | 'farewell' | 'help' | 'general';
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
    // For contract updates
    fieldToUpdate?: string;
    newValue?: string;
    contractId?: string;
    // Signature status entity
    signatureStatus?: 'signed' | 'partially_signed' | 'unsigned' | 'unknown';
    // Document classification entity
    documentType?: 'contract' | 'purchase_order' | 'invoice' | 'quote' | 'proposal' | 'work_order' | 'letter_of_intent' | 'memorandum' | 'amendment' | 'addendum' | 'unknown';
    // Procurement entities
    category?: string;
    timePeriod?: string;  // 'this_year', 'last_year', 'q1', 'q2', '2024', etc.
    riskLevel?: string;   // 'high', 'medium', 'low', 'critical'
    savingsCategory?: string;
    topN?: number;        // For "top 5 suppliers", "top 10 contracts"
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
    comparisonEntities?: string[];  // Array of supplier/contract names to compare
    clauseType?: string;            // Type of clause to compare (termination, liability, etc.)
    comparisonAspects?: {           // What aspects to focus on in comparison
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

// Contract type mappings for natural language
const CONTRACT_TYPE_ALIASES: Record<string, string> = {
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
  'license agreement': 'LICENSE' };

export function normalizeContractType(input: string | undefined): string {
  if (!input) return 'CONTRACT';
  const lower = input.toLowerCase().trim();
  return CONTRACT_TYPE_ALIASES[lower] || input.toUpperCase();
}

export function detectIntent(query: string): DetectedIntent {
  const lowerQuery = query.toLowerCase();
  
  // Extract potential contract and supplier names
  let contractName: string | undefined;
  let supplierName: string | undefined;

  // ============================================
  // CONTRACT CREATION WITH LINKING PATTERNS
  // ============================================

  // Pattern: "start/create a SOW with supplier X linked to/under the MSA from 2024"
  // Note: contractType words like "SoW", "statement of work", "amendment", etc.
  const createLinkedPattern = /(?:start|create|draft|initiate|begin|I\s+need\s+to\s+start)\s+(?:a\s+)?(?:new\s+)?(sow|statement\s+of\s+work|amendment|addendum|change\s+order|po|purchase\s+order)\s*(?:contract\s+)?(?:with|for)\s+(?:supplier\s+)?([^,]+?)(?:\s*,?\s*(?:linked?\s+to|linking\s+to|under|from|referencing|based\s+on)\s+(?:the\s+)?(?:master\s+)?(?:agreement|msa|contract)(?:\s+from\s+(\d{4}))?)?$/i;
  let match = query.match(createLinkedPattern);
  if (match) {
    const contractType = normalizeContractType(match[1]);
    supplierName = match[2]?.trim().replace(/\s*,.*$/, '').replace(/\s+linking.*$/i, '').replace(/\s+linked.*$/i, '');
    const parentYear = match[3];
    
    return {
      type: 'workflow',
      action: 'create_linked',
      entities: {
        contractType,
        supplierName,
        parentYear,
        parentContractType: 'MSA',
        relationshipType: `${contractType}_UNDER_MSA` },
      confidence: 0.95 };
  }

  // Pattern: "create an amendment for [contract name]" or "add a SOW to [contract]"
  const createForContractPattern = /(?:create|add|draft)\s+(?:an?\s+)?(?:new\s+)?(amendment|addendum|sow|statement\s+of\s+work|change\s+order)\s+(?:for|to|under)\s+(?:the\s+)?(.+?)(?:\s+contract)?$/i;
  match = query.match(createForContractPattern);
  if (match) {
    const contractType = normalizeContractType(match[1]);
    contractName = match[2]?.trim().replace(/\s+contract$/i, '');
    
    return {
      type: 'workflow',
      action: 'create_linked',
      entities: {
        contractType,
        contractName,
        parentContractType: 'EXISTING' },
      confidence: 0.9 };
  }

  // Pattern: "link this contract to MSA" or "connect to master agreement"
  const linkPattern = /(?:link|connect|attach|associate)\s+(?:this\s+)?(?:contract\s+)?(?:to|with)\s+(?:the\s+)?(?:master\s+)?(?:agreement|msa|contract)(?:\s+(?:from\s+)?(\d{4}))?/i;
  match = query.match(linkPattern);
  if (match) {
    const parentYear = match[1];
    return {
      type: 'action',
      action: 'link_contracts',
      entities: { parentYear, parentContractType: 'MSA' },
      confidence: 0.9 };
  }

  // Pattern: "show contract hierarchy" or "what's linked to this contract" or "show hierarchy for X"
  const hierarchyPattern = /(?:show|display|what(?:'s|s)?|list)\s+(?:me\s+)?(?:the\s+)?(?:contract\s+)?(?:hierarchy|structure|tree|linked\s+contracts|child\s+contracts|related\s+contracts)(?:\s+(?:for|of)\s+(.+?))?(?:\?|$)/i;
  match = query.match(hierarchyPattern);
  if (match) {
    contractName = match[1]?.trim();
    return {
      type: 'action',
      action: 'show_hierarchy',
      entities: { contractName },
      confidence: 0.9 };
  }

  // Pattern: "find master agreement for supplier X" or "what MSA do we have with supplier X"
  const findMasterPattern = /(?:find|show|get|what)\s+(?:is\s+)?(?:the\s+)?(?:master\s+)?(?:agreement|msa)\s+(?:do\s+we\s+have\s+)?(?:with|for)\s+(?:supplier\s+)?([^?]+)/i;
  match = query.match(findMasterPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'list',
      action: 'find_master',
      entities: { supplierName, contractType: 'MSA' },
      confidence: 0.9 };
  }

  // ============================================
  // PROCUREMENT AGENT PATTERNS (existing)
  // ============================================

  // Pattern: "contracts with [supplier]" or "show me contracts from [supplier]"
  const supplierListPattern = /(?:what|show|list|get|find|display)?\s*(?:me\s+)?(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:with|from|by|for)\s+(?:supplier\s+)?([^?]+?)(?:\s+to\s+be\s+renewed|\s+expiring|\s+that|\?|$)/i;
  match = query.match(supplierListPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'list',
      action: 'list_by_supplier',
      entities: { supplierName },
      confidence: 0.9 };
  }

  // Pattern: "contracts expiring in X days" or "what contracts are expiring"
  const expiringPattern = /(?:what|show|list|get|find|which)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:that\s+)?(?:are\s+)?(?:expiring|expire|due|ending)(?:\s+(?:in|within)\s+(\d+)\s+days?)?/i;
  match = query.match(expiringPattern);
  if (match) {
    const days = match[1] ? parseInt(match[1]) : 30;
    return {
      type: 'list',
      action: 'list_expiring',
      entities: { daysUntilExpiry: days },
      confidence: 0.9 };
  }

  // Pattern: "contracts to be renewed" with optional supplier
  const renewalListPattern = /(?:what|show|list|get|find|which)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:that\s+)?(?:need\s+to\s+be|to\s+be|needing)\s+renewed?(?:\s+(?:with|from|by)\s+(?:supplier\s+)?([^?]+))?/i;
  match = query.match(renewalListPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'list',
      action: 'list_expiring',
      entities: { supplierName, daysUntilExpiry: 90 },
      confidence: 0.9 };
  }

  // Pattern: "how many contracts" or "count contracts"
  const countPattern = /(?:how\s+many|count|total|number\s+of)\s+(?:active\s+)?contracts?(?:\s+(?:do\s+we\s+have|with|from|by)\s+(?:supplier\s+)?([^?]+))?/i;
  match = query.match(countPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'analytics',
      action: 'count',
      entities: { supplierName },
      confidence: 0.85 };
  }

  // Pattern: "contracts by status" (active, expired, pending)
  const statusPattern = /(?:show|list|get|find|what)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?(active|pending|expired|draft|processing|archived)\s+contracts?/i;
  match = query.match(statusPattern);
  if (match) {
    const status = match[1]?.toUpperCase();
    return {
      type: 'list',
      action: 'list_by_status',
      entities: { status },
      confidence: 0.85 };
  }

  // ============================================
  // SIGNATURE STATUS PATTERNS
  // ============================================

  // Pattern: "unsigned contracts" or "contracts not signed"
  const unsignedPattern = /(?:unsigned|not\s+signed|missing\s+signature|without\s+signature)\s*contracts?|contracts?\s+(?:that\s+)?(?:are\s+)?(?:not\s+signed|unsigned|need\s+signature)/i;
  if (unsignedPattern.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'list_by_signature',
      entities: { signatureStatus: 'unsigned' },
      confidence: 0.95 };
  }

  // Pattern: "signed contracts" or "fully signed"
  const signedPattern = /(?:show|list|find|get)\s+(?:all\s+)?(?:fully\s+)?signed\s+contracts?|contracts?\s+(?:that\s+)?(?:are\s+)?(?:fully\s+)?signed|executed\s+contracts?/i;
  if (signedPattern.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'list_by_signature',
      entities: { signatureStatus: 'signed' },
      confidence: 0.95 };
  }

  // Pattern: "partially signed contracts"
  const partiallySignedPattern = /(?:partially|partly)\s+signed\s+contracts?|contracts?\s+(?:that\s+)?(?:are\s+)?partially\s+signed|contracts?\s+(?:with\s+)?(?:some|missing)\s+signatures?/i;
  if (partiallySignedPattern.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'list_by_signature',
      entities: { signatureStatus: 'partially_signed' },
      confidence: 0.95 };
  }

  // Pattern: "contracts needing signature attention"
  const signatureAttentionPattern = /contracts?\s+(?:needing|requiring|need|require)\s+(?:signature\s+)?attention|contracts?\s+flagged\s+for\s+signature|signature\s+(?:issues?|problems?|attention)/i;
  if (signatureAttentionPattern.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'list_needing_signature',
      entities: {},
      confidence: 0.95 };
  }

  // Pattern: "high value contracts" or "contracts over $X"
  const valuePattern = /(?:show|list|get|find|what)\s+(?:are\s+)?(?:the\s+)?(?:high[\s-]?value|large|big)\s+contracts?|contracts?\s+(?:over|above|exceeding)\s+\$?([\d,]+)/i;
  match = query.match(valuePattern);
  if (match) {
    const threshold = match[1] ? parseInt(match[1].replace(/,/g, '')) : 100000;
    return {
      type: 'list',
      action: 'list_by_value',
      entities: { valueThreshold: threshold },
      confidence: 0.85 };
  }

  // Pattern: "summarize contracts with [supplier]" or "summary of [supplier] contracts"
  const summarizePattern = /(?:summarize|summary\s+of|overview\s+of)\s+(?:the\s+)?(?:all\s+)?contracts?\s+(?:with|from|by)\s+(?:supplier\s+)?([^?]+)/i;
  match = query.match(summarizePattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'analytics',
      action: 'summarize',
      entities: { supplierName },
      confidence: 0.85 };
  }

  // ============================================
  // PROCUREMENT AGENT PATTERNS
  // ============================================

  // Pattern: "total spend" or "how much are we spending" or "spend with [supplier]"
  const spendPattern = /(?:what(?:'s|s)?|show|total|how\s+much)\s+(?:is\s+)?(?:the\s+)?(?:our\s+)?(?:total\s+)?spend(?:ing)?(?:\s+(?:with|on|for)\s+(?:supplier\s+)?([^?]+))?/i;
  match = query.match(spendPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'procurement',
      action: 'spend_analysis',
      entities: { supplierName },
      confidence: 0.9 };
  }

  // Pattern: "cost savings" or "savings opportunities" or "where can we save"
  const savingsPattern = /(?:what|show|find|identify|where)\s+(?:are\s+)?(?:the\s+)?(?:potential\s+)?(?:cost\s+)?savings?(?:\s+opportunities)?|where\s+can\s+(?:we|i)\s+save|reduce\s+costs?/i;
  match = query.match(savingsPattern);
  if (match) {
    return {
      type: 'procurement',
      action: 'cost_savings',
      entities: {},
      confidence: 0.9 };
  }

  // Pattern: "top suppliers" or "biggest suppliers" or "top 5/10 suppliers"
  const topSuppliersPattern = /(?:show|what|who)\s+(?:are\s+)?(?:the\s+)?(?:our\s+)?(?:top|biggest|largest|main)\s+(\d+\s+)?suppliers?/i;
  match = query.match(topSuppliersPattern);
  if (match) {
    const topN = match[1] ? parseInt(match[1]) : 10;
    return {
      type: 'procurement',
      action: 'top_suppliers',
      entities: { topN },
      confidence: 0.9 };
  }

  // Pattern: "high risk contracts" or "risky suppliers" or "risk assessment"
  const riskPattern = /(?:show|what|which|find)\s+(?:are\s+)?(?:the\s+)?(?:high[\s-]?risk|risky|at[\s-]?risk)\s+(?:contracts?|suppliers?)|risk\s+assessment|contract\s+risks?/i;
  match = query.match(riskPattern);
  if (match) {
    return {
      type: 'procurement',
      action: 'risk_assessment',
      entities: { riskLevel: 'high' },
      confidence: 0.9 };
  }

  // Pattern: "auto-renewal" or "contracts with auto renewal"
  const autoRenewalPattern = /(?:show|what|which|find|list)\s+(?:are\s+)?(?:the\s+)?(?:contracts?\s+)?(?:with\s+)?auto[\s-]?renewals?|auto[\s-]?renewing\s+contracts?/i;
  match = query.match(autoRenewalPattern);
  if (match) {
    return {
      type: 'procurement',
      action: 'auto_renewals',
      entities: {},
      confidence: 0.9 };
  }

  // Pattern: "spend by category" or "category breakdown"
  const categorySpendPattern = /(?:spend|spending|breakdown)\s+(?:by|per)\s+category|category\s+(?:spend|breakdown|analysis)/i;
  match = query.match(categorySpendPattern);
  if (match) {
    return {
      type: 'procurement',
      action: 'category_spend',
      entities: {},
      confidence: 0.9 };
  }

  // ============================================
  // TAXONOMY/CATEGORY PATTERNS
  // ============================================

  // Pattern: "show categories" or "list categories" or "what categories do we have"
  const listCategoriesPattern = /(?:show|list|what|get|display)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?(?:taxonomy\s+)?(?:procurement\s+)?categories|category\s+(?:list|tree|structure)|what\s+categories\s+(?:do\s+we\s+have|exist)|browse\s+(?:the\s+)?taxonomy/i;
  match = query.match(listCategoriesPattern);
  if (match) {
    return {
      type: 'taxonomy',
      action: 'list_categories',
      entities: {},
      confidence: 0.9 };
  }

  // ============================================
  // COMPARISON PATTERNS (NEW)
  // ============================================

  // Pattern: "compare [contract A] with [contract B]" or "compare contracts X and Y"
  const compareContractsPattern = /compare\s+(?:contract\s+)?(.+?)\s+(?:with|to|and|vs\.?)\s+(?:contract\s+)?(.+?)(?:\s+contracts?)?(?:\?|$)/i;
  match = query.match(compareContractsPattern);
  if (match) {
    const contractA = match[1]?.trim();
    const contractB = match[2]?.trim().replace(/\?$/, '');
    return {
      type: 'comparison',
      action: 'compare_contracts',
      entities: { contractA, contractB },
      confidence: 0.92 };
  }

  // Pattern: "what's different between [A] and [B]" or "differences between contracts"
  const differencesPattern = /(?:what(?:'s|s)?|show)\s+(?:the\s+)?(?:difference|differences|diff)\s+(?:between|in)\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)(?:\?|$)/i;
  match = query.match(differencesPattern);
  if (match) {
    const contractA = match[1]?.trim();
    const contractB = match[2]?.trim().replace(/\?$/, '');
    return {
      type: 'comparison',
      action: 'compare_contracts',
      entities: { contractA, contractB },
      confidence: 0.9 };
  }

  // Pattern: "compare [supplier A] vs [supplier B] terms" or "which supplier has better terms"
  const compareSupplierTermsPattern = /compare\s+(.+?)\s+(?:vs\.?|versus|and|to)\s+(.+?)\s+(?:terms?|pricing|rates?|contracts?)|which\s+(?:supplier|vendor)\s+has\s+better\s+(?:terms?|pricing|rates?)/i;
  match = query.match(compareSupplierTermsPattern);
  if (match) {
    const supplierA = match[1]?.trim();
    const supplierB = match[2]?.trim();
    return {
      type: 'comparison',
      action: 'compare_suppliers',
      entities: { supplierA, supplierB },
      confidence: 0.88 };
  }

  // Pattern: "compare renewal terms" or "side-by-side comparison"
  const sideBySidePattern = /(?:side[- ]?by[- ]?side|parallel)\s+comparison|compare\s+(?:all\s+)?(?:renewal|payment|liability|termination)\s+terms?/i;
  match = query.match(sideBySidePattern);
  if (match) {
    return {
      type: 'comparison',
      action: 'side_by_side',
      entities: {},
      confidence: 0.85 };
  }

  // Pattern: "what category is [contract]" or "categorize [contract]"
  const categorizeContractPattern = /(?:what|which)\s+category\s+(?:is|for|should)\s+(.+?)(?:\?|$)|categorize\s+(?:the\s+)?(.+?)(?:\s+contract)?(?:\?|$)|suggest\s+category\s+for\s+(.+)/i;
  match = query.match(categorizeContractPattern);
  if (match) {
    const contractName = (match[1] || match[2] || match[3])?.trim();
    return {
      type: 'taxonomy',
      action: 'suggest_category',
      entities: { contractName },
      confidence: 0.85 };
  }

  // Pattern: "show [category] details" or "tell me about [category] category"
  const categoryDetailsPattern = /(?:show|tell\s+me\s+about|details\s+(?:of|for)|info\s+on)\s+(?:the\s+)?(.+?)\s+category|category\s+details?\s+(?:for\s+)?(.+)/i;
  match = query.match(categoryDetailsPattern);
  if (match) {
    const category = (match[1] || match[2])?.trim();
    return {
      type: 'taxonomy',
      action: 'category_details',
      entities: { category },
      confidence: 0.85 };
  }

  // Pattern: "contracts in [category]" or "[category] contracts"
  const contractsInCategoryPattern = /(?:contracts?|items?)\s+(?:in|under|for)\s+(?:the\s+)?(.+?)\s+category|(?:show|list|get)\s+(.+?)\s+(?:category\s+)?contracts/i;
  match = query.match(contractsInCategoryPattern);
  if (match) {
    const category = (match[1] || match[2])?.trim();
    return {
      type: 'taxonomy',
      action: 'browse_taxonomy',
      entities: { category },
      confidence: 0.85 };
  }

  // Pattern: "payment terms" or "contracts with net 30/60/90"
  const paymentTermsPattern = /(?:show|what|which|list)\s+(?:are\s+)?(?:the\s+)?(?:contracts?\s+)?(?:with\s+)?(?:payment\s+terms?|net\s*\d+)/i;
  match = query.match(paymentTermsPattern);
  if (match) {
    return {
      type: 'procurement',
      action: 'payment_terms',
      entities: {},
      confidence: 0.85 };
  }

  // Pattern: "compare rates" or "rate comparison for [role]" or "benchmark rates"
  const rateComparePattern = /(?:compare|benchmark|check)\s+(?:the\s+)?rates?|rate\s+comparison|(?:are\s+)?(?:our|the)\s+rates?\s+(?:competitive|good|high|low)/i;
  match = query.match(rateComparePattern);
  if (match) {
    return {
      type: 'procurement',
      action: 'rate_comparison',
      entities: {},
      confidence: 0.85 };
  }

  // Pattern: "supplier performance" or "how is [supplier] performing"
  const performancePattern = /(?:supplier|vendor)\s+performance|how\s+is\s+([^\s]+)\s+performing|performance\s+of\s+([^\s?]+)/i;
  match = query.match(performancePattern);
  if (match) {
    supplierName = match[1] || match[2];
    return {
      type: 'procurement',
      action: 'supplier_performance',
      entities: { supplierName: supplierName?.trim() },
      confidence: 0.85 };
  }

  // Pattern: "negotiate" or "negotiation tips" or "how to negotiate with [supplier]"
  const negotiatePattern = /(?:negotiate|negotiation)\s+(?:tips?|strategies?|help)?|how\s+(?:to|can\s+(?:i|we))\s+negotiate\s+(?:with\s+)?([^?]+)?/i;
  match = query.match(negotiatePattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'procurement',
      action: 'negotiate_terms',
      entities: { supplierName },
      confidence: 0.85 };
  }

  // ============================================
  // RENEWAL WORKFLOW PATTERNS
  // ============================================

  // Pattern: "renew [contract] X with [supplier] Y"
  const renewWithPattern = /(?:renew|renewal)\s+(?:the\s+)?(?:contract\s+)?(.+?)\s+(?:contract\s+)?with\s+(.+?)(?:\s*,|\s+please|\s+and|\s*$)/i;
  match = query.match(renewWithPattern);
  if (match) {
    contractName = match[1]?.trim().replace(/^the\s+/i, '');
    supplierName = match[2]?.trim().replace(/\s*(?:,|please|and).*$/i, '');
  }

  // Pattern: "renew the X contract" or "renew X"
  if (!contractName) {
    const simpleRenewPattern = /(?:please\s+)?(?:renew|renewal)\s+(?:the\s+)?(.+?)(?:\s+contract)?$/i;
    match = query.match(simpleRenewPattern);
    if (match) {
      const extracted = match[1]?.trim().replace(/\s+contract$/i, '');
      if (extracted && extracted.length > 2) {
        contractName = extracted;
      }
    }
  }

  // Pattern: "with [supplier]" anywhere in text
  if (!supplierName) {
    const withSupplierPattern = /with\s+(?:supplier\s+)?([^,]+?)(?:\s*,|\s+please|\s+and|\s*$)/i;
    match = query.match(withSupplierPattern);
    if (match) {
      supplierName = match[1]?.trim();
    }
  }

  // Check for renewal/workflow keywords
  const isRenewalRequest = /(?:renew|renewal|start|initiate|begin)\s+(?:the\s+)?(?:approval|workflow|process|contract)/i.test(lowerQuery) ||
    /(?:need|want)\s+to\s+renew/i.test(lowerQuery) ||
    /(?:please\s+)?renew/i.test(lowerQuery);

  if (isRenewalRequest && (contractName || supplierName)) {
    return {
      type: 'workflow',
      action: 'renew',
      entities: {
        contractName: contractName || undefined,
        supplierName: supplierName || undefined,
        workflowType: 'renewal' },
      confidence: 0.9 };
  }

  // Contract generation patterns  
  const generatePatterns = [
    /(?:create|generate|draft)\s+(?:a\s+)?(?:new\s+)?(.+?)\s+(?:contract|agreement)\s+(?:with|for)\s+(.+)/i,
    /(?:need|want)\s+(?:a\s+)?(?:new\s+)?(.+?)\s+(?:contract|agreement)\s+(?:with|for)\s+(.+)/i,
  ];

  for (const pattern of generatePatterns) {
    match = query.match(pattern);
    if (match) {
      return {
        type: 'workflow',
        action: 'generate',
        entities: {
          contractType: match[1]?.trim(),
          supplierName: match[2]?.trim(),
          workflowType: 'contract_generation' },
        confidence: 0.85 };
    }
  }

  // Approval patterns
  const approvalPatterns = [
    /start\s+(?:the\s+)?approval\s+(?:flow|workflow|process)/i,
    /submit\s+(?:for\s+)?approval/i,
    /initiate\s+approval/i,
  ];

  if (approvalPatterns.some(p => p.test(lowerQuery))) {
    return {
      type: 'workflow',
      action: 'start_workflow',
      entities: { workflowType: 'approval' },
      confidence: 0.8 };
  }

  // ============================================
  // ADVANCED AI AGENT: DEEP ANALYSIS PATTERNS
  // ============================================
  
  // Extract year if mentioned (e.g., "in 2024", "from 2023", "2024 contracts")
  const yearMatch = query.match(/(?:in|from|for|during)\s+(\d{4})|(\d{4})\s+contracts/i);
  const year = yearMatch ? (yearMatch[1] || yearMatch[2]) : undefined;
  
  // Extract supplier name from various patterns
  const supplierPatterns = [
    /(?:from|with|by|for)\s+(?:supplier\s+)?([A-Z][a-zA-Z\s&]+?)(?:\s+in\s+\d{4}|\s+contracts|\s+and|\s*,|\s*$)/i,
    /(?:contracts?\s+(?:from|with|by))\s+([A-Z][a-zA-Z\s&]+?)(?:\s+in|\s+and|\s*,|\s*$)/i,
  ];
  
  for (const pattern of supplierPatterns) {
    const supplierMatch = query.match(pattern);
    if (supplierMatch && !supplierName) {
      supplierName = supplierMatch[1]?.trim().replace(/\s+contracts?$/i, '');
    }
  }
  
  // Extract category if mentioned
  const categoryMatch = query.match(/(?:in\s+(?:the\s+)?|for\s+|under\s+)([A-Z][a-zA-Z\s]+?)\s+category/i);
  const category = categoryMatch ? categoryMatch[1]?.trim() : undefined;

  // Pattern: Complex analysis queries - summarize, analyze, understand, give me an understanding
  const deepAnalysisPattern = /(?:summarize?|summari[sz]e|analyze?|analyse|understand|give\s+me\s+(?:an?\s+)?(?:understanding|overview|summary|analysis)|tell\s+me\s+about|what\s+(?:can\s+you\s+tell\s+me\s+about|do\s+you\s+know\s+about)|break\s*down|deep\s+dive|report\s+on)/i;
  
  // Check if query mentions specific analysis aspects
  const wantsValue = /value|worth|amount|cost|spend|price/i.test(query);
  const wantsDuration = /duration|length|term|period|how\s+long/i.test(query);
  const wantsCategories = /categor|type|kind|classification/i.test(query);
  const wantsSupplierDetails = /supplier|vendor|provider|partner/i.test(query);
  const wantsRisk = /risk|expir|renew|concern/i.test(query);
  const wantsTerms = /terms|condition|clause|obligation/i.test(query);
  
  // ============================================
  // MULTI-CONTRACT GROUP COMPARISON PATTERNS
  // ============================================
  
  // Pattern: "compare all X 2024 contracts vs Y 2024" / "compare X in 2024 versus Y in 2024"
  // This detects group-level comparisons (e.g., all Deloitte 2024 vs all Accenture 2024)
  const groupComparePattern = /(?:compare|contrast|analyze)\s+(?:all\s+)?(.+?)\s+(?:in\s+)?(\d{4})?\s*(?:contracts?)?\s*(?:vs\.?|versus|against|with|to|and)\s+(?:all\s+)?(.+?)\s+(?:in\s+)?(\d{4})?\s*(?:contracts?)?(?:\s*$|\s+(?:in\s+terms\s+of|regarding|for))/i;
  match = query.match(groupComparePattern);
  if (match) {
    const group1 = match[1]?.trim().replace(/\s+contracts?$/i, '').replace(/^\s*the\s+/i, '');
    const year1 = match[2] || year;
    const group2 = match[3]?.trim().replace(/\s+contracts?$/i, '').replace(/^\s*the\s+/i, '');
    const year2 = match[4] || year;
    
    return {
      type: 'analytics',
      action: 'compare_groups',
      entities: { 
        comparisonGroups: [
          { supplier: group1, year: year1 },
          { supplier: group2, year: year2 },
        ],
        comparisonAspects: {
          value: true,
          duration: true,
          count: true,
          avgValue: true,
          terms: wantsTerms,
          risk: wantsRisk,
          rates: /rate|pricing|cost/i.test(query) } },
      confidence: 0.95 };
  }

  // Pattern: "compare X and Y" / "compare X vs Y" / "compare X with Y"
  const comparePattern = /(?:compare|contrast|diff(?:erence)?|versus|vs\.?)\s+(.+?)\s+(?:and|vs\.?|versus|with|to|against)\s+(.+?)(?:\s+contracts?)?(?:\s*$|\s+(?:in\s+terms\s+of|regarding|for|on))/i;
  match = query.match(comparePattern);
  if (match) {
    const entity1 = (match[1]?.trim().replace(/(?:the\s+)?contracts?\s+(?:from|with|by)\s+/i, '').replace(/\s+contracts?$/i, '')) || '';
    const entity2 = (match[2]?.trim().replace(/(?:the\s+)?contracts?\s+(?:from|with|by)\s+/i, '').replace(/\s+contracts?$/i, '')) || '';
    
    return {
      type: 'analytics',
      action: 'compare_contracts',
      entities: { 
        comparisonEntities: [entity1, entity2].filter(Boolean),
        comparisonAspects: {
          value: wantsValue || true, // Default to comparing values
          duration: wantsDuration || true,
          terms: wantsTerms,
          risk: wantsRisk,
          rates: /rate|pricing|cost/i.test(query),
          clauses: /clause|term|condition|obligation|liability|termination|indemnif/i.test(query) } },
      confidence: 0.95 };
  }
  
  // Pattern: "what's the difference between X and Y"
  const differencePattern = /(?:what(?:'s|s)?|show|tell\s+me)\s+(?:the\s+)?(?:difference|differences|comparison)\s+(?:between|of)\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)(?:\s*\?|\s*$)/i;
  match = query.match(differencePattern);
  if (match) {
    const entity1 = (match[1]?.trim().replace(/(?:the\s+)?contracts?\s+(?:from|with|by)\s+/i, '')) || '';
    const entity2 = (match[2]?.trim().replace(/(?:the\s+)?contracts?\s+(?:from|with|by)\s+/i, '')) || '';
    
    return {
      type: 'analytics',
      action: 'compare_contracts',
      entities: { 
        comparisonEntities: [entity1, entity2].filter(Boolean),
        comparisonAspects: {
          value: true,
          duration: true,
          terms: true,
          risk: true,
          rates: true,
          clauses: true } },
      confidence: 0.95 };
  }
  
  // Pattern: "how does X compare to Y" / "X vs Y"
  const howComparePattern = /how\s+(?:does|do)\s+(.+?)\s+compare\s+(?:to|with|against)\s+(.+?)(?:\s*\?|\s*$)/i;
  match = query.match(howComparePattern);
  if (match) {
    const entity1 = match[1]?.trim() || '';
    const entity2 = match[2]?.trim() || '';
    
    return {
      type: 'analytics',
      action: 'compare_contracts',
      entities: { 
        comparisonEntities: [entity1, entity2].filter(Boolean),
        comparisonAspects: {
          value: true,
          duration: true,
          terms: true,
          risk: true,
          rates: true,
          clauses: true } },
      confidence: 0.95 };
  }
  
  // Pattern: Compare specific clauses - "compare termination clauses in X and Y"
  const compareClausesPattern = /compare\s+(?:the\s+)?(.+?)\s+(?:clause|clauses|terms?|section|provisions?)\s+(?:in|between|of|for)\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)(?:\s*\?|\s*$)/i;
  match = query.match(compareClausesPattern);
  if (match) {
    const clauseType = match[1]?.trim() || 'termination';
    const entity1 = match[2]?.trim() || '';
    const entity2 = match[3]?.trim() || '';
    
    return {
      type: 'analytics',
      action: 'compare_clauses',
      entities: { 
        comparisonEntities: [entity1, entity2].filter(Boolean),
        clauseType,
        comparisonAspects: {
          clauses: true } },
      confidence: 0.95 };
  }

  if (deepAnalysisPattern.test(lowerQuery) && (supplierName || category || year)) {
    return {
      type: 'analytics',
      action: 'deep_analysis',
      entities: { 
        supplierName, 
        category,
        timePeriod: year,
        analysisAspects: {
          value: wantsValue,
          duration: wantsDuration,
          categories: wantsCategories,
          supplierDetails: wantsSupplierDetails,
          risk: wantsRisk,
          terms: wantsTerms } },
      confidence: 0.95 };
  }

  // ============================================
  // ADVANCED NATURAL LANGUAGE PATTERNS
  // ============================================

  // Pattern: "find me contracts about/related to/containing [topic]"
  const semanticSearchPattern = /(?:find|search|show|get|look\s+for|locate)\s+(?:me\s+)?(?:all\s+)?contracts?\s+(?:about|related\s+to|containing|mentioning|with|that\s+(?:mention|contain|include|have))\s+(.+?)(?:\?|$)/i;
  match = query.match(semanticSearchPattern);
  if (match) {
    const searchTopic = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'search',
      action: 'semantic_search',
      entities: { searchQuery: searchTopic },
      confidence: 0.9 };
  }

  // Pattern: "which contracts have [clause/term]" or "contracts with [specific term]"
  const clauseSearchPattern = /(?:which|what)\s+contracts?\s+(?:have|contain|include|mention)\s+(.+?)(?:\s+clause|\s+terms?|\s+language)?(?:\?|$)/i;
  match = query.match(clauseSearchPattern);
  if (match) {
    const clauseTerm = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'search',
      action: 'clause_search',
      entities: { clauseTerm },
      confidence: 0.9 };
  }

  // Pattern: "what should I know about [contract/supplier]"
  const briefingPattern = /(?:what\s+should\s+I\s+know\s+about|brief\s+me\s+on|catch\s+me\s+up\s+on|what's\s+important\s+about|key\s+points\s+(?:about|for))\s+(.+?)(?:\?|$)/i;
  match = query.match(briefingPattern);
  if (match) {
    const briefingTopic = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'analytics',
      action: 'executive_briefing',
      entities: { topic: briefingTopic, supplierName: briefingTopic },
      confidence: 0.9 };
  }

  // Pattern: "what's happening with [supplier/category]" or "update on [topic]"
  const statusUpdatePattern = /(?:what's|whats)\s+(?:happening|going\s+on)\s+(?:with|at)\s+(.+?)(?:\?|$)|(?:status|update)\s+(?:on|for)\s+(.+?)(?:\?|$)/i;
  match = query.match(statusUpdatePattern);
  if (match) {
    const topic = (match[1] || match[2])?.trim().replace(/\?$/, '');
    return {
      type: 'analytics',
      action: 'status_update',
      entities: { supplierName: topic, topic },
      confidence: 0.85 };
  }

  // Pattern: "contracts ending/starting this month/quarter/year"
  const timeframePattern = /contracts?\s+(?:ending|expiring|starting|beginning|renewed)\s+(?:this|next|last)\s+(week|month|quarter|year)/i;
  match = query.match(timeframePattern);
  if (match) {
    const timeframe = match[1]?.toLowerCase();
    const action = query.toLowerCase().includes('ending') || query.toLowerCase().includes('expiring') ? 'ending' : 'starting';
    return {
      type: 'list',
      action: action === 'ending' ? 'list_expiring' : 'list_by_status',
      entities: { timeframe, daysUntilExpiry: timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : timeframe === 'quarter' ? 90 : 365 },
      confidence: 0.9 };
  }

  // Pattern: "most expensive/valuable contracts"
  const rankingPattern = /(?:most|top|highest|biggest|largest)\s+(?:expensive|valuable|costly|important)\s+contracts?/i;
  match = query.match(rankingPattern);
  if (match) {
    return {
      type: 'list',
      action: 'list_by_value',
      entities: { sortOrder: 'desc', limit: 10 },
      confidence: 0.9 };
  }

  // Pattern: "contracts needing attention" or "what needs my attention"
  const attentionPattern = /(?:contracts?|what)\s+(?:needing|that\s+need|requiring)\s+(?:my\s+)?attention|what\s+needs\s+(?:my\s+)?attention|urgent\s+contracts?/i;
  match = query.match(attentionPattern);
  if (match) {
    return {
      type: 'analytics',
      action: 'attention_needed',
      entities: {},
      confidence: 0.9 };
  }

  // Pattern: "who signed [contract]" or "signatories for [contract]"
  const signatoryPattern = /(?:who\s+signed|signatories?\s+(?:for|of|on)|signatures?\s+on)\s+(.+?)(?:\?|$)/i;
  match = query.match(signatoryPattern);
  if (match) {
    contractName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'search',
      action: 'find_signatories',
      entities: { contractName },
      confidence: 0.9 };
  }

  // Pattern: "when does [contract] expire" or "expiration date for [contract]"
  const expirationPattern = /(?:when\s+does|when\s+will)\s+(.+?)\s+(?:expire|end|renew)|expiration\s+(?:date\s+)?(?:for|of)\s+(.+?)(?:\?|$)/i;
  match = query.match(expirationPattern);
  if (match) {
    contractName = (match[1] || match[2])?.trim().replace(/\?$/, '');
    return {
      type: 'search',
      action: 'find_expiration',
      entities: { contractName },
      confidence: 0.9 };
  }

  // ============================================
  // CONTRACT-SPECIFIC DEEP ANALYSIS PATTERNS
  // When user wants to ask specific questions about a named contract
  // ============================================

  // Pattern: "in the [contract name] contract, what are the..." or "about [contract], tell me..."
  // This enables contextual Q&A for a specific contract from the chatbot
  const contractDeepAnalysisPattern = /(?:in\s+(?:the\s+)?|about\s+(?:the\s+)?|for\s+(?:the\s+)?|regarding\s+(?:the\s+)?)?["\']?(.+?)["\']?\s+(?:contract|agreement|msa|sow|nda),?\s*(?:what|how|when|where|who|is|are|does|can|tell\s+me|explain|analyze|find|show)\s+(.+?)(?:\?|$)/i;
  match = query.match(contractDeepAnalysisPattern);
  if (match && match[1] && match[2]) {
    const targetContract = match[1].trim();
    const question = match[2].trim();
    return {
      type: 'search',
      action: 'deep_analysis',
      entities: { 
        contractName: targetContract,
        searchQuery: question,
        analysisAspects: {
          terms: true,
          risk: true,
          value: true }
      },
      confidence: 0.92 };
  }

  // Pattern: "what are the termination clauses in [contract]" - specific clause questions
  const contractClausePattern = /(?:what\s+(?:are|is)\s+(?:the\s+)?|show\s+(?:me\s+)?(?:the\s+)?|find\s+(?:the\s+)?|extract\s+(?:the\s+)?)?(termination|payment|liability|indemnity|confidentiality|renewal|warranty|sla|force\s+majeure|ip|intellectual\s+property)\s*(?:clause|terms?|provisions?|section)?\s+(?:in|from|of)\s+(?:the\s+)?["\']?(.+?)["\']?(?:\s+contract|\s+agreement)?(?:\?|$)/i;
  match = query.match(contractClausePattern);
  if (match && match[2]) {
    const clauseType = match[1]?.trim().toLowerCase() || 'general';
    const targetContract = match[2].trim();
    return {
      type: 'search',
      action: 'clause_search',
      entities: { 
        contractName: targetContract,
        clauseTerm: clauseType,
        searchQuery: `${clauseType} clause terms provisions` },
      confidence: 0.95 };
  }

  // Pattern: "analyze [contract] for risks" or "[contract] risk assessment"
  const contractRiskPattern = /(?:analyze|assess|check|review)\s+(?:the\s+)?["\']?(.+?)["\']?\s+(?:contract\s+)?(?:for\s+)?(?:risks?|risk\s+assessment|issues?|concerns?)|["\']?(.+?)["\']?\s+(?:contract\s+)?risk\s+(?:assessment|analysis|review)/i;
  match = query.match(contractRiskPattern);
  if (match && (match[1] || match[2])) {
    const targetContract = (match[1] || match[2]).trim();
    return {
      type: 'analytics',
      action: 'risk_assessment',
      entities: { 
        contractName: targetContract,
        searchQuery: 'risks liabilities obligations penalties termination breach',
        analysisAspects: { risk: true }
      },
      confidence: 0.93 };
  }

  // ============================================
  // BI-DIRECTIONAL UPDATE PATTERNS (write-back to database)
  // ============================================

  // Pattern: "set/change/update expiration date to [date]"
  const updateExpirationPattern = /(?:set|change|update|modify)\s+(?:the\s+)?(expiration|expiry|end)\s*(?:date)?\s+(?:to|as|=)\s+(.+?)(?:\?|$)/i;
  match = query.match(updateExpirationPattern);
  if (match) {
    return {
      type: 'action',
      action: 'update_expiration',
      entities: { 
        fieldToUpdate: 'expiration',
        newValue: match[2].trim() },
      confidence: 0.95 };
  }

  // Pattern: "extend the contract to [date]"
  const extendContractPattern = /extend\s+(?:the\s+)?(?:contract\s+)?(?:expiration\s+)?(?:to|until|by)\s+(.+?)(?:\?|$)/i;
  match = query.match(extendContractPattern);
  if (match) {
    return {
      type: 'action',
      action: 'update_expiration',
      entities: { 
        fieldToUpdate: 'expiration',
        newValue: match[1].trim() },
      confidence: 0.9 };
  }

  // Pattern: "set effective/start date to [date]"
  const updateEffectivePattern = /(?:set|change|update)\s+(?:the\s+)?(effective|start)\s*(?:date)?\s+(?:to|as|=)\s+(.+?)(?:\?|$)/i;
  match = query.match(updateEffectivePattern);
  if (match) {
    return {
      type: 'action',
      action: 'update_effective_date',
      entities: { 
        fieldToUpdate: 'effective',
        newValue: match[2].trim() },
      confidence: 0.95 };
  }

  // Pattern: "set/update contract value to [amount]"
  const updateValuePattern = /(?:set|change|update)\s+(?:the\s+)?(?:contract\s+)?(?:value|amount|total)\s+(?:to|as|=)\s+(.+?)(?:\?|$)/i;
  match = query.match(updateValuePattern);
  if (match) {
    return {
      type: 'action',
      action: 'update_value',
      entities: { 
        fieldToUpdate: 'value',
        newValue: match[1].trim() },
      confidence: 0.95 };
  }

  // Pattern: "change/set status to [status]"
  const updateStatusPattern = /(?:set|change|update|mark)\s+(?:the\s+)?status\s+(?:to|as)\s+(\w+)/i;
  match = query.match(updateStatusPattern);
  if (match) {
    return {
      type: 'action',
      action: 'update_status',
      entities: { 
        fieldToUpdate: 'status',
        newValue: match[1].trim().toUpperCase() },
      confidence: 0.95 };
  }

  // Pattern: "rename/change title to [name]"
  const updateTitlePattern = /(?:rename|change\s+the\s+title|update\s+the\s+name)\s+(?:to|as)\s+(.+?)(?:\?|$)/i;
  match = query.match(updateTitlePattern);
  if (match) {
    return {
      type: 'action',
      action: 'update_title',
      entities: { 
        fieldToUpdate: 'title',
        newValue: match[1].trim() },
      confidence: 0.9 };
  }

  // ============================================
  // SYSTEM STATUS & AI PERFORMANCE PATTERNS
  // ============================================

  // Pattern: "system health" or "how is the system doing"
  const systemHealthPattern = /(?:system|worker|queue|background)\s+(?:health|status)|(?:how\s+is\s+the\s+)?(?:system|workers?|queues?)\s+(?:doing|running|performing)|(?:are\s+)?(?:workers?|queues?)\s+(?:healthy|running|ok)/i;
  match = query.match(systemHealthPattern);
  if (match) {
    return {
      type: 'system',
      action: 'system_health',
      entities: {},
      confidence: 0.9 };
  }

  // Pattern: "categorization accuracy" or "how accurate is the AI categorization"
  const accuracyPattern = /(?:categorization|classification)\s+(?:accuracy|performance|metrics)|(?:how\s+)?(?:accurate|good)\s+(?:is\s+)?(?:the\s+)?(?:ai\s+)?(?:categorization|classification)|ai\s+(?:accuracy|performance)/i;
  match = query.match(accuracyPattern);
  if (match) {
    return {
      type: 'system',
      action: 'categorization_accuracy',
      entities: {},
      confidence: 0.9 };
  }

  // Pattern: "queue status" or "how many jobs are pending"
  const queueStatusPattern = /(?:queue|job)\s+(?:status|depth|count)|(?:how\s+many)\s+(?:jobs?|tasks?)\s+(?:are\s+)?(?:pending|waiting|queued)|(?:background\s+)?(?:processing|job)\s+status/i;
  match = query.match(queueStatusPattern);
  if (match) {
    return {
      type: 'system',
      action: 'queue_status',
      entities: {},
      confidence: 0.9 };
  }

  // Pattern: "AI performance" or "how is AI performing"
  const aiPerformancePattern = /(?:ai|openai|gpt)\s+(?:performance|status|health)|(?:how\s+is\s+)?(?:the\s+)?ai\s+(?:doing|performing)/i;
  match = query.match(aiPerformancePattern);
  if (match) {
    return {
      type: 'system',
      action: 'ai_performance',
      entities: {},
      confidence: 0.9 };
  }

  // ============================================
  // SMART INTENT CLASSIFICATION FOR AMBIGUOUS QUERIES
  // Analyzes query structure to better understand user intent
  // ============================================
  
  // Detect question type from structure
  const questionWords = {
    what: 'information',
    who: 'entity',
    when: 'time',
    where: 'location',
    why: 'reason',
    how: 'process',
    which: 'selection',
    can: 'capability',
    should: 'recommendation',
    is: 'confirmation',
    are: 'confirmation',
    do: 'action',
    does: 'confirmation',
    will: 'prediction',
    would: 'hypothetical' };
  
  const firstWord = lowerQuery.split(/\s+/)[0];
  const questionType = questionWords[firstWord as keyof typeof questionWords] || 'general';
  
  // Detect if query is about contracts even without explicit keywords
  const implicitContractTerms = [
    'agreement', 'deal', 'vendor', 'client', 'party', 'parties',
    'obligation', 'term', 'condition', 'clause', 'provision',
    'expire', 'renew', 'sign', 'execute', 'negotiate',
    'price', 'cost', 'fee', 'rate', 'payment', 'invoice',
    'deadline', 'milestone', 'deliverable', 'scope',
    'liability', 'indemnity', 'warranty', 'guarantee',
    'terminate', 'cancel', 'breach', 'default',
    'confidential', 'proprietary', 'intellectual property', 'ip',
  ];
  
  const hasImplicitContractContext = implicitContractTerms.some(term => lowerQuery.includes(term));
  
  // Detect sentiment/urgency
  const urgencyIndicators = ['urgent', 'asap', 'immediately', 'critical', 'important', 'priority', 'deadline', 'overdue'];
  const hasUrgency = urgencyIndicators.some(term => lowerQuery.includes(term));
  
  // Detect if user is asking for a recommendation
  const recommendationPatterns = /(?:should\s+(?:i|we)|recommend|suggest|advice|best\s+(?:way|approach|practice)|what\s+(?:should|would\s+you))/i;
  const isAskingRecommendation = recommendationPatterns.test(lowerQuery);
  
  // Detect clarification requests
  const clarificationPatterns = /(?:what\s+do\s+you\s+mean|can\s+you\s+explain|i\s+don'?t\s+understand|clarify|elaborate|more\s+(?:details?|info)|tell\s+me\s+more)/i;
  const isClarificationRequest = clarificationPatterns.test(lowerQuery);

  // ============================================
  // GENERAL CONVERSATIONAL / CATCH-ALL HANDLER
  // For any message that doesn't match specific patterns
  // ============================================
  
  // Extract potential search terms from the query for RAG
  const extractedTerms = query
    .replace(/\?/g, '')
    .replace(/(?:can you|could you|please|tell me|help me|i want to|i need to|how do i|what is|what are|who is|where is|when is)/gi, '')
    .trim();

  // Check if it seems like a greeting or general conversation
  const isGreeting = /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|howdy|what'?s\s+up|greetings)/i.test(lowerQuery);
  const isGoodbye = /^(?:bye|goodbye|see you|thanks|thank you|cheers|later|take care)/i.test(lowerQuery);
  const isHelpRequest = /^(?:help|what can you do|how can you help|what are your capabilities)/i.test(lowerQuery);
  
  if (isGreeting) {
    return {
      type: 'question',
      action: 'greeting',
      entities: {},
      confidence: 1.0 };
  }
  
  if (isGoodbye) {
    return {
      type: 'question',
      action: 'farewell',
      entities: {},
      confidence: 1.0 };
  }
  
  if (isHelpRequest) {
    return {
      type: 'question',
      action: 'help',
      entities: {},
      confidence: 1.0 };
  }

  // Enhanced general query with smart context
  // The AI model will understand and respond appropriately
  return {
    type: 'question',
    action: 'general',
    entities: {
      searchQuery: extractedTerms.length > 2 ? extractedTerms : query },
    confidence: hasImplicitContractContext ? 0.8 : 0.7 };
}

// ─── LLM Fallback for Low-Confidence Intent Detection ─────────────────────

const LLM_FALLBACK_THRESHOLD = 0.75;

const INTENT_CLASSIFICATION_PROMPT = `You are an intent classifier for a contract management system chatbot.
Given a user query, classify it into one of the following intent types and actions.

Intent types: search, action, question, workflow, list, analytics, procurement, taxonomy, comparison, system.

Common actions per type:
- search: semantic_search, clause_search
- action: renew, generate, approve, create, update_status, update_value, update_expiration, deep_analysis
- question: general, help, greeting, farewell, executive_briefing, status_update, attention_needed
- workflow: start_workflow
- list: list_by_supplier, list_expiring, list_by_status, list_by_value, count, list_by_signature, list_needing_signature, list_by_document_type
- analytics: spend_analysis, cost_savings, risk_assessment, supplier_performance, rate_comparison, compliance_status
- procurement: budget_status, top_suppliers, savings_opportunities, contract_risks, auto_renewals, payment_terms
- taxonomy: list_categories, categorize_contract, category_details, suggest_category
- comparison: compare_contracts, compare_clauses, compare_groups, compare_suppliers, side_by_side
- system: system_health, ai_performance, queue_status

Respond with JSON: {"type": "<intent_type>", "action": "<action>", "confidence": <0.0-1.0>}
Only return the JSON object, nothing else.`;

let _openaiForIntent: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  if (!hasAIClientConfig()) return null;
  if (!_openaiForIntent) {
    _openaiForIntent = createOpenAIClient();
  }
  return _openaiForIntent;
}

/**
 * Enhanced intent detection with LLM fallback.
 * Runs the fast regex-based detectIntent first, then falls back to
 * gpt-4o-mini classification when confidence is below threshold.
 */
export async function detectIntentWithLLMFallback(query: string): Promise<DetectedIntent> {
  const regexResult = detectIntent(query);

  // High-confidence regex match — no need for LLM
  if (regexResult.confidence >= LLM_FALLBACK_THRESHOLD) {
    return regexResult;
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return regexResult; // No API key, use regex result as-is
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: INTENT_CLASSIFICATION_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return regexResult;

    const llmResult = JSON.parse(content) as {
      type?: string;
      action?: string;
      confidence?: number;
    };

    // Validate LLM output
    const validTypes = ['search', 'action', 'question', 'workflow', 'list', 'analytics', 'procurement', 'taxonomy', 'comparison', 'system'];
    if (!llmResult.type || !validTypes.includes(llmResult.type)) {
      return regexResult;
    }

    const llmConfidence = typeof llmResult.confidence === 'number'
      ? Math.min(llmResult.confidence, 0.95) // cap at 0.95 — never fully trust LLM alone
      : 0.85;

    // Only use LLM result if it's more confident than regex
    if (llmConfidence <= regexResult.confidence) {
      return regexResult;
    }

    // Merge: take LLM type/action but keep regex-extracted entities
    return {
      type: llmResult.type as DetectedIntent['type'],
      action: (llmResult.action || regexResult.action) as DetectedIntent['action'],
      entities: regexResult.entities, // regex entity extraction is still valuable
      confidence: llmConfidence,
    };
  } catch {
    // LLM call failed — silently fall back to regex result
    return regexResult;
  }
}


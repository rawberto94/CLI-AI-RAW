import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { hybridSearch } from '@/lib/rag/advanced-rag.service'
import { prisma } from '@/lib/prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Intent detection for actionable requests
interface DetectedIntent {
  type: 'search' | 'action' | 'question' | 'workflow' | 'list' | 'analytics' | 'procurement' | 'taxonomy';
  action?: 'renew' | 'generate' | 'approve' | 'create' | 'start_workflow' | 'list_by_supplier' | 'list_expiring' | 'list_by_status' | 'list_by_value' | 'count' | 'summarize' | 'create_linked' | 'link_contracts' | 'show_hierarchy' | 'find_master' | 
    // New procurement actions
    'spend_analysis' | 'cost_savings' | 'rate_comparison' | 'risk_assessment' | 'compliance_check' | 'compliance_status' | 'budget_status' | 'supplier_performance' | 'negotiate_terms' | 'category_spend' | 'top_suppliers' | 'savings_opportunities' | 'contract_risks' | 'auto_renewals' | 'payment_terms' |
    // Taxonomy actions
    'list_categories' | 'browse_taxonomy' | 'categorize_contract' | 'category_details' | 'suggest_category' |
    // Advanced AI agent actions
    'deep_analysis' |
    // Contract comparison actions
    'compare_contracts' | 'compare_clauses' | 'compare_groups';
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
    // Contract comparison entities
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
  'license agreement': 'LICENSE',
};

function normalizeContractType(input: string | undefined): string {
  if (!input) return 'CONTRACT';
  const lower = input.toLowerCase().trim();
  return CONTRACT_TYPE_ALIASES[lower] || input.toUpperCase();
}

function detectIntent(query: string): DetectedIntent {
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
    
    console.log('[AI Chat] Detected create linked contract intent:', { contractType, supplierName, parentYear });
    return {
      type: 'workflow',
      action: 'create_linked',
      entities: {
        contractType,
        supplierName,
        parentYear,
        parentContractType: 'MSA',
        relationshipType: `${contractType}_UNDER_MSA`,
      },
      confidence: 0.95,
    };
  }

  // Pattern: "create an amendment for [contract name]" or "add a SOW to [contract]"
  const createForContractPattern = /(?:create|add|draft)\s+(?:an?\s+)?(?:new\s+)?(amendment|addendum|sow|statement\s+of\s+work|change\s+order)\s+(?:for|to|under)\s+(?:the\s+)?(.+?)(?:\s+contract)?$/i;
  match = query.match(createForContractPattern);
  if (match) {
    const contractType = normalizeContractType(match[1]);
    contractName = match[2]?.trim().replace(/\s+contract$/i, '');
    
    console.log('[AI Chat] Detected create child contract intent:', { contractType, contractName });
    return {
      type: 'workflow',
      action: 'create_linked',
      entities: {
        contractType,
        contractName,
        parentContractType: 'EXISTING',
      },
      confidence: 0.9,
    };
  }

  // Pattern: "link this contract to MSA" or "connect to master agreement"
  const linkPattern = /(?:link|connect|attach|associate)\s+(?:this\s+)?(?:contract\s+)?(?:to|with)\s+(?:the\s+)?(?:master\s+)?(?:agreement|msa|contract)(?:\s+(?:from\s+)?(\d{4}))?/i;
  match = query.match(linkPattern);
  if (match) {
    const parentYear = match[1];
    console.log('[AI Chat] Detected link contract intent:', { parentYear });
    return {
      type: 'action',
      action: 'link_contracts',
      entities: { parentYear, parentContractType: 'MSA' },
      confidence: 0.9,
    };
  }

  // Pattern: "show contract hierarchy" or "what's linked to this contract" or "show hierarchy for X"
  const hierarchyPattern = /(?:show|display|what(?:'s|s)?|list)\s+(?:me\s+)?(?:the\s+)?(?:contract\s+)?(?:hierarchy|structure|tree|linked\s+contracts|child\s+contracts|related\s+contracts)(?:\s+(?:for|of)\s+(.+?))?(?:\?|$)/i;
  match = query.match(hierarchyPattern);
  if (match) {
    contractName = match[1]?.trim();
    console.log('[AI Chat] Detected show hierarchy intent:', { contractName });
    return {
      type: 'action',
      action: 'show_hierarchy',
      entities: { contractName },
      confidence: 0.9,
    };
  }

  // Pattern: "find master agreement for supplier X" or "what MSA do we have with supplier X"
  const findMasterPattern = /(?:find|show|get|what)\s+(?:is\s+)?(?:the\s+)?(?:master\s+)?(?:agreement|msa)\s+(?:do\s+we\s+have\s+)?(?:with|for)\s+(?:supplier\s+)?([^?]+)/i;
  match = query.match(findMasterPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected find master agreement intent:', { supplierName });
    return {
      type: 'list',
      action: 'find_master',
      entities: { supplierName, contractType: 'MSA' },
      confidence: 0.9,
    };
  }

  // ============================================
  // PROCUREMENT AGENT PATTERNS (existing)
  // ============================================

  // Pattern: "contracts with [supplier]" or "show me contracts from [supplier]"
  const supplierListPattern = /(?:what|show|list|get|find|display)?\s*(?:me\s+)?(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:with|from|by|for)\s+(?:supplier\s+)?([^?]+?)(?:\s+to\s+be\s+renewed|\s+expiring|\s+that|\?|$)/i;
  match = query.match(supplierListPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected supplier list intent:', { supplierName });
    return {
      type: 'list',
      action: 'list_by_supplier',
      entities: { supplierName },
      confidence: 0.9,
    };
  }

  // Pattern: "contracts expiring in X days" or "what contracts are expiring"
  const expiringPattern = /(?:what|show|list|get|find|which)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:that\s+)?(?:are\s+)?(?:expiring|expire|due|ending)(?:\s+(?:in|within)\s+(\d+)\s+days?)?/i;
  match = query.match(expiringPattern);
  if (match) {
    const days = match[1] ? parseInt(match[1]) : 30;
    console.log('[AI Chat] Detected expiring contracts intent:', { days });
    return {
      type: 'list',
      action: 'list_expiring',
      entities: { daysUntilExpiry: days },
      confidence: 0.9,
    };
  }

  // Pattern: "contracts to be renewed" with optional supplier
  const renewalListPattern = /(?:what|show|list|get|find|which)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:that\s+)?(?:need\s+to\s+be|to\s+be|needing)\s+renewed?(?:\s+(?:with|from|by)\s+(?:supplier\s+)?([^?]+))?/i;
  match = query.match(renewalListPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected renewal list intent:', { supplierName });
    return {
      type: 'list',
      action: 'list_expiring',
      entities: { supplierName, daysUntilExpiry: 90 },
      confidence: 0.9,
    };
  }

  // Pattern: "how many contracts" or "count contracts"
  const countPattern = /(?:how\s+many|count|total|number\s+of)\s+(?:active\s+)?contracts?(?:\s+(?:do\s+we\s+have|with|from|by)\s+(?:supplier\s+)?([^?]+))?/i;
  match = query.match(countPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected count intent:', { supplierName });
    return {
      type: 'analytics',
      action: 'count',
      entities: { supplierName },
      confidence: 0.85,
    };
  }

  // Pattern: "contracts by status" (active, expired, pending)
  const statusPattern = /(?:show|list|get|find|what)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?(active|pending|expired|draft|processing|archived)\s+contracts?/i;
  match = query.match(statusPattern);
  if (match) {
    const status = match[1]?.toUpperCase();
    console.log('[AI Chat] Detected status list intent:', { status });
    return {
      type: 'list',
      action: 'list_by_status',
      entities: { status },
      confidence: 0.85,
    };
  }

  // Pattern: "high value contracts" or "contracts over $X"
  const valuePattern = /(?:show|list|get|find|what)\s+(?:are\s+)?(?:the\s+)?(?:high[\s-]?value|large|big)\s+contracts?|contracts?\s+(?:over|above|exceeding)\s+\$?([\d,]+)/i;
  match = query.match(valuePattern);
  if (match) {
    const threshold = match[1] ? parseInt(match[1].replace(/,/g, '')) : 100000;
    console.log('[AI Chat] Detected value list intent:', { threshold });
    return {
      type: 'list',
      action: 'list_by_value',
      entities: { valueThreshold: threshold },
      confidence: 0.85,
    };
  }

  // Pattern: "summarize contracts with [supplier]" or "summary of [supplier] contracts"
  const summarizePattern = /(?:summarize|summary\s+of|overview\s+of)\s+(?:the\s+)?(?:all\s+)?contracts?\s+(?:with|from|by)\s+(?:supplier\s+)?([^?]+)/i;
  match = query.match(summarizePattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected summarize intent:', { supplierName });
    return {
      type: 'analytics',
      action: 'summarize',
      entities: { supplierName },
      confidence: 0.85,
    };
  }

  // ============================================
  // PROCUREMENT AGENT PATTERNS
  // ============================================

  // Pattern: "total spend" or "how much are we spending" or "spend with [supplier]"
  const spendPattern = /(?:what(?:'s|s)?|show|total|how\s+much)\s+(?:is\s+)?(?:the\s+)?(?:our\s+)?(?:total\s+)?spend(?:ing)?(?:\s+(?:with|on|for)\s+(?:supplier\s+)?([^?]+))?/i;
  match = query.match(spendPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected spend analysis intent:', { supplierName });
    return {
      type: 'procurement',
      action: 'spend_analysis',
      entities: { supplierName },
      confidence: 0.9,
    };
  }

  // Pattern: "cost savings" or "savings opportunities" or "where can we save"
  const savingsPattern = /(?:what|show|find|identify|where)\s+(?:are\s+)?(?:the\s+)?(?:potential\s+)?(?:cost\s+)?savings?(?:\s+opportunities)?|where\s+can\s+(?:we|i)\s+save|reduce\s+costs?/i;
  match = query.match(savingsPattern);
  if (match) {
    console.log('[AI Chat] Detected cost savings intent');
    return {
      type: 'procurement',
      action: 'cost_savings',
      entities: {},
      confidence: 0.9,
    };
  }

  // Pattern: "top suppliers" or "biggest suppliers" or "top 5/10 suppliers"
  const topSuppliersPattern = /(?:show|what|who)\s+(?:are\s+)?(?:the\s+)?(?:our\s+)?(?:top|biggest|largest|main)\s+(\d+\s+)?suppliers?/i;
  match = query.match(topSuppliersPattern);
  if (match) {
    const topN = match[1] ? parseInt(match[1]) : 10;
    console.log('[AI Chat] Detected top suppliers intent:', { topN });
    return {
      type: 'procurement',
      action: 'top_suppliers',
      entities: { topN },
      confidence: 0.9,
    };
  }

  // Pattern: "high risk contracts" or "risky suppliers" or "risk assessment"
  const riskPattern = /(?:show|what|which|find)\s+(?:are\s+)?(?:the\s+)?(?:high[\s-]?risk|risky|at[\s-]?risk)\s+(?:contracts?|suppliers?)|risk\s+assessment|contract\s+risks?/i;
  match = query.match(riskPattern);
  if (match) {
    console.log('[AI Chat] Detected risk assessment intent');
    return {
      type: 'procurement',
      action: 'risk_assessment',
      entities: { riskLevel: 'high' },
      confidence: 0.9,
    };
  }

  // Pattern: "auto-renewal" or "contracts with auto renewal"
  const autoRenewalPattern = /(?:show|what|which|find|list)\s+(?:are\s+)?(?:the\s+)?(?:contracts?\s+)?(?:with\s+)?auto[\s-]?renewals?|auto[\s-]?renewing\s+contracts?/i;
  match = query.match(autoRenewalPattern);
  if (match) {
    console.log('[AI Chat] Detected auto-renewal intent');
    return {
      type: 'procurement',
      action: 'auto_renewals',
      entities: {},
      confidence: 0.9,
    };
  }

  // Pattern: "spend by category" or "category breakdown"
  const categorySpendPattern = /(?:spend|spending|breakdown)\s+(?:by|per)\s+category|category\s+(?:spend|breakdown|analysis)/i;
  match = query.match(categorySpendPattern);
  if (match) {
    console.log('[AI Chat] Detected category spend intent');
    return {
      type: 'procurement',
      action: 'category_spend',
      entities: {},
      confidence: 0.9,
    };
  }

  // ============================================
  // TAXONOMY/CATEGORY PATTERNS
  // ============================================

  // Pattern: "show categories" or "list categories" or "what categories do we have"
  const listCategoriesPattern = /(?:show|list|what|get|display)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?(?:taxonomy\s+)?(?:procurement\s+)?categories|category\s+(?:list|tree|structure)|what\s+categories\s+(?:do\s+we\s+have|exist)|browse\s+(?:the\s+)?taxonomy/i;
  match = query.match(listCategoriesPattern);
  if (match) {
    console.log('[AI Chat] Detected list categories intent');
    return {
      type: 'taxonomy',
      action: 'list_categories',
      entities: {},
      confidence: 0.9,
    };
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
    console.log('[AI Chat] Detected compare contracts intent:', { contractA, contractB });
    return {
      type: 'comparison',
      action: 'compare_contracts',
      entities: { contractA, contractB },
      confidence: 0.92,
    };
  }

  // Pattern: "what's different between [A] and [B]" or "differences between contracts"
  const differencesPattern = /(?:what(?:'s|s)?|show)\s+(?:the\s+)?(?:difference|differences|diff)\s+(?:between|in)\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)(?:\?|$)/i;
  match = query.match(differencesPattern);
  if (match) {
    const contractA = match[1]?.trim();
    const contractB = match[2]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected differences intent:', { contractA, contractB });
    return {
      type: 'comparison',
      action: 'compare_contracts',
      entities: { contractA, contractB },
      confidence: 0.9,
    };
  }

  // Pattern: "compare [supplier A] vs [supplier B] terms" or "which supplier has better terms"
  const compareSupplierTermsPattern = /compare\s+(.+?)\s+(?:vs\.?|versus|and|to)\s+(.+?)\s+(?:terms?|pricing|rates?|contracts?)|which\s+(?:supplier|vendor)\s+has\s+better\s+(?:terms?|pricing|rates?)/i;
  match = query.match(compareSupplierTermsPattern);
  if (match) {
    const supplierA = match[1]?.trim();
    const supplierB = match[2]?.trim();
    console.log('[AI Chat] Detected compare suppliers intent:', { supplierA, supplierB });
    return {
      type: 'comparison',
      action: 'compare_suppliers',
      entities: { supplierA, supplierB },
      confidence: 0.88,
    };
  }

  // Pattern: "compare renewal terms" or "side-by-side comparison"
  const sideBySidePattern = /(?:side[- ]?by[- ]?side|parallel)\s+comparison|compare\s+(?:all\s+)?(?:renewal|payment|liability|termination)\s+terms?/i;
  match = query.match(sideBySidePattern);
  if (match) {
    console.log('[AI Chat] Detected side-by-side comparison intent');
    return {
      type: 'comparison',
      action: 'side_by_side',
      entities: {},
      confidence: 0.85,
    };
  }

  // Pattern: "what category is [contract]" or "categorize [contract]"
  const categorizeContractPattern = /(?:what|which)\s+category\s+(?:is|for|should)\s+(.+?)(?:\?|$)|categorize\s+(?:the\s+)?(.+?)(?:\s+contract)?(?:\?|$)|suggest\s+category\s+for\s+(.+)/i;
  match = query.match(categorizeContractPattern);
  if (match) {
    const contractName = (match[1] || match[2] || match[3])?.trim();
    console.log('[AI Chat] Detected categorize contract intent:', { contractName });
    return {
      type: 'taxonomy',
      action: 'suggest_category',
      entities: { contractName },
      confidence: 0.85,
    };
  }

  // Pattern: "show [category] details" or "tell me about [category] category"
  const categoryDetailsPattern = /(?:show|tell\s+me\s+about|details\s+(?:of|for)|info\s+on)\s+(?:the\s+)?(.+?)\s+category|category\s+details?\s+(?:for\s+)?(.+)/i;
  match = query.match(categoryDetailsPattern);
  if (match) {
    const category = (match[1] || match[2])?.trim();
    console.log('[AI Chat] Detected category details intent:', { category });
    return {
      type: 'taxonomy',
      action: 'category_details',
      entities: { category },
      confidence: 0.85,
    };
  }

  // Pattern: "contracts in [category]" or "[category] contracts"
  const contractsInCategoryPattern = /(?:contracts?|items?)\s+(?:in|under|for)\s+(?:the\s+)?(.+?)\s+category|(?:show|list|get)\s+(.+?)\s+(?:category\s+)?contracts/i;
  match = query.match(contractsInCategoryPattern);
  if (match) {
    const category = (match[1] || match[2])?.trim();
    console.log('[AI Chat] Detected contracts in category intent:', { category });
    return {
      type: 'taxonomy',
      action: 'browse_taxonomy',
      entities: { category },
      confidence: 0.85,
    };
  }

  // Pattern: "payment terms" or "contracts with net 30/60/90"
  const paymentTermsPattern = /(?:show|what|which|list)\s+(?:are\s+)?(?:the\s+)?(?:contracts?\s+)?(?:with\s+)?(?:payment\s+terms?|net\s*\d+)/i;
  match = query.match(paymentTermsPattern);
  if (match) {
    console.log('[AI Chat] Detected payment terms intent');
    return {
      type: 'procurement',
      action: 'payment_terms',
      entities: {},
      confidence: 0.85,
    };
  }

  // Pattern: "compare rates" or "rate comparison for [role]" or "benchmark rates"
  const rateComparePattern = /(?:compare|benchmark|check)\s+(?:the\s+)?rates?|rate\s+comparison|(?:are\s+)?(?:our|the)\s+rates?\s+(?:competitive|good|high|low)/i;
  match = query.match(rateComparePattern);
  if (match) {
    console.log('[AI Chat] Detected rate comparison intent');
    return {
      type: 'procurement',
      action: 'rate_comparison',
      entities: {},
      confidence: 0.85,
    };
  }

  // Pattern: "supplier performance" or "how is [supplier] performing"
  const performancePattern = /(?:supplier|vendor)\s+performance|how\s+is\s+([^\s]+)\s+performing|performance\s+of\s+([^\s?]+)/i;
  match = query.match(performancePattern);
  if (match) {
    supplierName = match[1] || match[2];
    console.log('[AI Chat] Detected supplier performance intent:', { supplierName });
    return {
      type: 'procurement',
      action: 'supplier_performance',
      entities: { supplierName: supplierName?.trim() },
      confidence: 0.85,
    };
  }

  // Pattern: "negotiate" or "negotiation tips" or "how to negotiate with [supplier]"
  const negotiatePattern = /(?:negotiate|negotiation)\s+(?:tips?|strategies?|help)?|how\s+(?:to|can\s+(?:i|we))\s+negotiate\s+(?:with\s+)?([^?]+)?/i;
  match = query.match(negotiatePattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected negotiation intent:', { supplierName });
    return {
      type: 'procurement',
      action: 'negotiate_terms',
      entities: { supplierName },
      confidence: 0.85,
    };
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
    console.log('[AI Chat] Detected renewal intent:', { contractName, supplierName });
    return {
      type: 'workflow',
      action: 'renew',
      entities: {
        contractName: contractName || undefined,
        supplierName: supplierName || undefined,
        workflowType: 'renewal',
      },
      confidence: 0.9,
    };
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
          workflowType: 'contract_generation',
        },
        confidence: 0.85,
      };
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
      confidence: 0.8,
    };
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
    
    console.log('[AI Chat] Detected group comparison intent:', { group1, year1, group2, year2 });
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
          rates: /rate|pricing|cost/i.test(query),
        },
      },
      confidence: 0.95,
    };
  }

  // Pattern: "compare X and Y" / "compare X vs Y" / "compare X with Y"
  const comparePattern = /(?:compare|contrast|diff(?:erence)?|versus|vs\.?)\s+(.+?)\s+(?:and|vs\.?|versus|with|to|against)\s+(.+?)(?:\s+contracts?)?(?:\s*$|\s+(?:in\s+terms\s+of|regarding|for|on))/i;
  match = query.match(comparePattern);
  if (match) {
    const entity1 = (match[1]?.trim().replace(/(?:the\s+)?contracts?\s+(?:from|with|by)\s+/i, '').replace(/\s+contracts?$/i, '')) || '';
    const entity2 = (match[2]?.trim().replace(/(?:the\s+)?contracts?\s+(?:from|with|by)\s+/i, '').replace(/\s+contracts?$/i, '')) || '';
    
    console.log('[AI Chat] Detected comparison intent:', { entity1, entity2 });
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
          clauses: /clause|term|condition|obligation|liability|termination|indemnif/i.test(query),
        },
      },
      confidence: 0.95,
    };
  }
  
  // Pattern: "what's the difference between X and Y"
  const differencePattern = /(?:what(?:'s|s)?|show|tell\s+me)\s+(?:the\s+)?(?:difference|differences|comparison)\s+(?:between|of)\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)(?:\s*\?|\s*$)/i;
  match = query.match(differencePattern);
  if (match) {
    const entity1 = (match[1]?.trim().replace(/(?:the\s+)?contracts?\s+(?:from|with|by)\s+/i, '')) || '';
    const entity2 = (match[2]?.trim().replace(/(?:the\s+)?contracts?\s+(?:from|with|by)\s+/i, '')) || '';
    
    console.log('[AI Chat] Detected difference intent:', { entity1, entity2 });
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
          clauses: true,
        },
      },
      confidence: 0.95,
    };
  }
  
  // Pattern: "how does X compare to Y" / "X vs Y"
  const howComparePattern = /how\s+(?:does|do)\s+(.+?)\s+compare\s+(?:to|with|against)\s+(.+?)(?:\s*\?|\s*$)/i;
  match = query.match(howComparePattern);
  if (match) {
    const entity1 = match[1]?.trim() || '';
    const entity2 = match[2]?.trim() || '';
    
    console.log('[AI Chat] Detected how compare intent:', { entity1, entity2 });
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
          clauses: true,
        },
      },
      confidence: 0.95,
    };
  }
  
  // Pattern: Compare specific clauses - "compare termination clauses in X and Y"
  const compareClausesPattern = /compare\s+(?:the\s+)?(.+?)\s+(?:clause|clauses|terms?|section|provisions?)\s+(?:in|between|of|for)\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)(?:\s*\?|\s*$)/i;
  match = query.match(compareClausesPattern);
  if (match) {
    const clauseType = match[1]?.trim() || 'termination';
    const entity1 = match[2]?.trim() || '';
    const entity2 = match[3]?.trim() || '';
    
    console.log('[AI Chat] Detected clause comparison intent:', { clauseType, entity1, entity2 });
    return {
      type: 'analytics',
      action: 'compare_clauses',
      entities: { 
        comparisonEntities: [entity1, entity2].filter(Boolean),
        clauseType,
        comparisonAspects: {
          clauses: true,
        },
      },
      confidence: 0.95,
    };
  }

  if (deepAnalysisPattern.test(lowerQuery) && (supplierName || category || year)) {
    console.log('[AI Chat] Detected deep analysis intent:', { supplierName, category, year, wantsValue, wantsDuration, wantsCategories });
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
          terms: wantsTerms,
        },
      },
      confidence: 0.95,
    };
  }

  // ============================================
  // ADVANCED NATURAL LANGUAGE PATTERNS
  // ============================================

  // Pattern: "find me contracts about/related to/containing [topic]"
  const semanticSearchPattern = /(?:find|search|show|get|look\s+for|locate)\s+(?:me\s+)?(?:all\s+)?contracts?\s+(?:about|related\s+to|containing|mentioning|with|that\s+(?:mention|contain|include|have))\s+(.+?)(?:\?|$)/i;
  match = query.match(semanticSearchPattern);
  if (match) {
    const searchTopic = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected semantic search intent:', { searchTopic });
    return {
      type: 'search',
      action: 'semantic_search',
      entities: { searchQuery: searchTopic },
      confidence: 0.9,
    };
  }

  // Pattern: "which contracts have [clause/term]" or "contracts with [specific term]"
  const clauseSearchPattern = /(?:which|what)\s+contracts?\s+(?:have|contain|include|mention)\s+(.+?)(?:\s+clause|\s+terms?|\s+language)?(?:\?|$)/i;
  match = query.match(clauseSearchPattern);
  if (match) {
    const clauseTerm = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected clause search intent:', { clauseTerm });
    return {
      type: 'search',
      action: 'clause_search',
      entities: { clauseTerm },
      confidence: 0.9,
    };
  }

  // Pattern: "what should I know about [contract/supplier]"
  const briefingPattern = /(?:what\s+should\s+I\s+know\s+about|brief\s+me\s+on|catch\s+me\s+up\s+on|what's\s+important\s+about|key\s+points\s+(?:about|for))\s+(.+?)(?:\?|$)/i;
  match = query.match(briefingPattern);
  if (match) {
    const briefingTopic = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected briefing intent:', { briefingTopic });
    return {
      type: 'analytics',
      action: 'executive_briefing',
      entities: { topic: briefingTopic, supplierName: briefingTopic },
      confidence: 0.9,
    };
  }

  // Pattern: "what's happening with [supplier/category]" or "update on [topic]"
  const statusUpdatePattern = /(?:what's|whats)\s+(?:happening|going\s+on)\s+(?:with|at)\s+(.+?)(?:\?|$)|(?:status|update)\s+(?:on|for)\s+(.+?)(?:\?|$)/i;
  match = query.match(statusUpdatePattern);
  if (match) {
    const topic = (match[1] || match[2])?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected status update intent:', { topic });
    return {
      type: 'analytics',
      action: 'status_update',
      entities: { supplierName: topic, topic },
      confidence: 0.85,
    };
  }

  // Pattern: "contracts ending/starting this month/quarter/year"
  const timeframePattern = /contracts?\s+(?:ending|expiring|starting|beginning|renewed)\s+(?:this|next|last)\s+(week|month|quarter|year)/i;
  match = query.match(timeframePattern);
  if (match) {
    const timeframe = match[1]?.toLowerCase();
    const action = query.toLowerCase().includes('ending') || query.toLowerCase().includes('expiring') ? 'ending' : 'starting';
    console.log('[AI Chat] Detected timeframe intent:', { timeframe, action });
    return {
      type: 'list',
      action: action === 'ending' ? 'list_expiring' : 'list_by_status',
      entities: { timeframe, daysUntilExpiry: timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : timeframe === 'quarter' ? 90 : 365 },
      confidence: 0.9,
    };
  }

  // Pattern: "most expensive/valuable contracts"
  const rankingPattern = /(?:most|top|highest|biggest|largest)\s+(?:expensive|valuable|costly|important)\s+contracts?/i;
  match = query.match(rankingPattern);
  if (match) {
    console.log('[AI Chat] Detected ranking intent: most valuable');
    return {
      type: 'list',
      action: 'list_by_value',
      entities: { sortOrder: 'desc', limit: 10 },
      confidence: 0.9,
    };
  }

  // Pattern: "contracts needing attention" or "what needs my attention"
  const attentionPattern = /(?:contracts?|what)\s+(?:needing|that\s+need|requiring)\s+(?:my\s+)?attention|what\s+needs\s+(?:my\s+)?attention|urgent\s+contracts?/i;
  match = query.match(attentionPattern);
  if (match) {
    console.log('[AI Chat] Detected attention needed intent');
    return {
      type: 'analytics',
      action: 'attention_needed',
      entities: {},
      confidence: 0.9,
    };
  }

  // Pattern: "who signed [contract]" or "signatories for [contract]"
  const signatoryPattern = /(?:who\s+signed|signatories?\s+(?:for|of|on)|signatures?\s+on)\s+(.+?)(?:\?|$)/i;
  match = query.match(signatoryPattern);
  if (match) {
    contractName = match[1]?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected signatory intent:', { contractName });
    return {
      type: 'search',
      action: 'find_signatories',
      entities: { contractName },
      confidence: 0.9,
    };
  }

  // Pattern: "when does [contract] expire" or "expiration date for [contract]"
  const expirationPattern = /(?:when\s+does|when\s+will)\s+(.+?)\s+(?:expire|end|renew)|expiration\s+(?:date\s+)?(?:for|of)\s+(.+?)(?:\?|$)/i;
  match = query.match(expirationPattern);
  if (match) {
    contractName = (match[1] || match[2])?.trim().replace(/\?$/, '');
    console.log('[AI Chat] Detected expiration query intent:', { contractName });
    return {
      type: 'search',
      action: 'find_expiration',
      entities: { contractName },
      confidence: 0.9,
    };
  }

  // Default intent
  return {
    type: lowerQuery.includes('?') ? 'question' : 'search',
    entities: {},
    confidence: 0.5,
  };
}

// Search for matching contracts
async function findMatchingContracts(entities: DetectedIntent['entities'], tenantId: string) {
  try {
    const searchTerms: any[] = [];
    
    if (entities.contractName) {
      // Search in contractTitle field only
      searchTerms.push(
        { contractTitle: { contains: entities.contractName, mode: 'insensitive' } }
      );
    }
    
    if (entities.supplierName) {
      // Search in supplierName field only
      searchTerms.push(
        { supplierName: { contains: entities.supplierName, mode: 'insensitive' } }
      );
    }

    // If no search terms, return empty
    if (searchTerms.length === 0) {
      console.log('[AI Chat] No search terms provided');
      return [];
    }

    console.log('[AI Chat] Searching with terms:', searchTerms, 'in tenant:', tenantId);

    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        OR: searchTerms,
      },
      include: {
        contractMetadata: true,
      },
      take: 5,
    });
    
    console.log(`[AI Chat] Found ${contracts.length} contracts matching:`, entities);
    return contracts;
  } catch (e) {
    console.error('[AI Chat] Error finding contracts:', e);
    return [];
  }
}

// ============================================
// PROCUREMENT AGENT DATABASE QUERIES
// ============================================

// List contracts by supplier
async function listContractsBySupplier(supplierName: string, tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: supplierName, mode: 'insensitive' },
      },
      orderBy: { expirationDate: 'asc' },
      take: 20,
    });
    console.log(`[AI Chat] Found ${contracts.length} contracts for supplier: ${supplierName}`);
    return contracts;
  } catch (e) {
    console.error('[AI Chat] Error listing contracts by supplier:', e);
    return [];
  }
}

// List expiring contracts
async function listExpiringContracts(daysUntilExpiry: number, tenantId: string, supplierName?: string) {
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);
    
    const where: any = {
      tenantId,
      expirationDate: {
        lte: expiryDate,
        gte: new Date(),
      },
      status: { notIn: ['EXPIRED', 'ARCHIVED', 'CANCELLED'] },
    };
    
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }

    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { expirationDate: 'asc' },
      take: 20,
    });
    console.log(`[AI Chat] Found ${contracts.length} contracts expiring in ${daysUntilExpiry} days`);
    return contracts;
  } catch (e) {
    console.error('[AI Chat] Error listing expiring contracts:', e);
    return [];
  }
}

// List contracts by status
async function listContractsByStatus(status: string, tenantId: string) {
  try {
    const validStatus = status.toUpperCase() as any; // ContractStatus enum
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        status: validStatus,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    console.log(`[AI Chat] Found ${contracts.length} ${status} contracts`);
    return contracts;
  } catch (e) {
    console.error('[AI Chat] Error listing contracts by status:', e);
    return [];
  }
}

// List high-value contracts
async function listHighValueContracts(threshold: number, tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        totalValue: { gte: threshold },
      },
      orderBy: { totalValue: 'desc' },
      take: 20,
    });
    console.log(`[AI Chat] Found ${contracts.length} contracts over $${threshold}`);
    return contracts;
  } catch (e) {
    console.error('[AI Chat] Error listing high-value contracts:', e);
    return [];
  }
}

// Fetch proactive alerts and insights
async function getProactiveInsights(tenantId: string): Promise<{
  criticalAlerts: string[];
  insights: string[];
  urgentContracts: any[];
}> {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Fetch critical expiring contracts (within 7 days)
    const criticalExpiring = await prisma.contract.findMany({
      where: {
        tenantId,
        expirationDate: {
          gte: now,
          lte: in7Days,
        },
        status: { notIn: ['EXPIRED', 'ARCHIVED', 'CANCELLED'] },
      },
      orderBy: { expirationDate: 'asc' },
      take: 5,
    });
    
    // Fetch auto-renewal contracts coming up
    const autoRenewals = await prisma.contract.findMany({
      where: {
        tenantId,
        autoRenewal: true,
        expirationDate: {
          gte: now,
          lte: in30Days,
        },
        status: 'ACTIVE',
      },
      take: 5,
    });
    
    // Fetch high-value contracts expiring soon
    const highValueExpiring = await prisma.contract.findMany({
      where: {
        tenantId,
        totalValue: { gte: 100000 },
        expirationDate: {
          gte: now,
          lte: in30Days,
        },
        status: { notIn: ['EXPIRED', 'ARCHIVED', 'CANCELLED'] },
      },
      orderBy: { totalValue: 'desc' },
      take: 3,
    });
    
    // Build alerts
    const criticalAlerts: string[] = [];
    const insights: string[] = [];
    
    if (criticalExpiring.length > 0) {
      criticalAlerts.push(`🔴 **${criticalExpiring.length} contract(s) expiring within 7 days!** Immediate attention required.`);
    }
    
    if (autoRenewals.length > 0) {
      criticalAlerts.push(`⚠️ **${autoRenewals.length} auto-renewal contract(s)** will renew within 30 days. Review cancellation options.`);
    }
    
    if (highValueExpiring.length > 0) {
      const totalValue = highValueExpiring.reduce((sum, c) => sum + Number(c.totalValue || 0), 0);
      insights.push(`💰 **$${totalValue.toLocaleString()}** in high-value contracts expiring soon. Consider renewal negotiations.`);
    }
    
    // Count total active vs expiring
    const activeCount = await prisma.contract.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    
    const expiringCount = await prisma.contract.count({
      where: {
        tenantId,
        expirationDate: { lte: in30Days, gte: now },
        status: { notIn: ['EXPIRED', 'ARCHIVED', 'CANCELLED'] },
      },
    });
    
    if (expiringCount > 0 && activeCount > 0) {
      const expiringPct = Math.round((expiringCount / activeCount) * 100);
      if (expiringPct > 20) {
        insights.push(`📊 **${expiringPct}%** of your active contracts expire within 30 days. Consider batch renewal strategy.`);
      }
    }
    
    return {
      criticalAlerts,
      insights,
      urgentContracts: [...criticalExpiring, ...highValueExpiring.filter(c => !criticalExpiring.find(ce => ce.id === c.id))],
    };
  } catch (e) {
    console.error('[AI Chat] Error fetching proactive insights:', e);
    return { criticalAlerts: [], insights: [], urgentContracts: [] };
  }
}

// Compare two contracts side-by-side
async function compareContracts(
  contractNameA: string,
  contractNameB: string,
  tenantId: string
): Promise<{
  contractA: any | null;
  contractB: any | null;
  comparison: {
    field: string;
    valueA: string;
    valueB: string;
    difference: 'same' | 'different' | 'better_a' | 'better_b' | 'na';
  }[];
  summary: string;
}> {
  try {
    // Find both contracts
    const [contractA, contractB] = await Promise.all([
      prisma.contract.findFirst({
        where: {
          tenantId,
          OR: [
            { fileName: { contains: contractNameA, mode: 'insensitive' } },
            { supplierName: { contains: contractNameA, mode: 'insensitive' } },
          ],
        },
        include: {
          artifacts: {
            where: { 
              artifactType: { in: ['OVERVIEW', 'TERM_DATES', 'FINANCIAL', 'TERMINATION', 'LIABILITY'] },
              status: 'COMPLETE',
            },
          },
        },
      }),
      prisma.contract.findFirst({
        where: {
          tenantId,
          OR: [
            { fileName: { contains: contractNameB, mode: 'insensitive' } },
            { supplierName: { contains: contractNameB, mode: 'insensitive' } },
          ],
        },
        include: {
          artifacts: {
            where: { 
              artifactType: { in: ['OVERVIEW', 'TERM_DATES', 'FINANCIAL', 'TERMINATION', 'LIABILITY'] },
              status: 'COMPLETE',
            },
          },
        },
      }),
    ]);

    if (!contractA || !contractB) {
      return {
        contractA,
        contractB,
        comparison: [],
        summary: !contractA && !contractB 
          ? `Could not find either contract. Please check the names.`
          : !contractA 
            ? `Could not find contract matching "${contractNameA}".`
            : `Could not find contract matching "${contractNameB}".`,
      };
    }

    // Build comparison
    const comparison: {
      field: string;
      valueA: string;
      valueB: string;
      difference: 'same' | 'different' | 'better_a' | 'better_b' | 'na';
    }[] = [];

    // Compare basic fields
    const formatValue = (v: any) => v ? String(v) : 'N/A';
    const formatMoney = (v: any) => v ? `$${Number(v).toLocaleString()}` : 'N/A';
    const formatDate = (d: Date | null) => d ? new Date(d).toLocaleDateString() : 'N/A';

    comparison.push({
      field: 'Supplier',
      valueA: formatValue(contractA.supplierName),
      valueB: formatValue(contractB.supplierName),
      difference: contractA.supplierName === contractB.supplierName ? 'same' : 'different',
    });

    comparison.push({
      field: 'Contract Type',
      valueA: formatValue(contractA.contractType),
      valueB: formatValue(contractB.contractType),
      difference: contractA.contractType === contractB.contractType ? 'same' : 'different',
    });

    comparison.push({
      field: 'Status',
      valueA: formatValue(contractA.status),
      valueB: formatValue(contractB.status),
      difference: contractA.status === contractB.status ? 'same' : 'different',
    });

    comparison.push({
      field: 'Total Value',
      valueA: formatMoney(contractA.totalValue),
      valueB: formatMoney(contractB.totalValue),
      difference: !contractA.totalValue || !contractB.totalValue ? 'na' :
        contractA.totalValue === contractB.totalValue ? 'same' :
        Number(contractA.totalValue) > Number(contractB.totalValue) ? 'better_a' : 'better_b',
    });

    comparison.push({
      field: 'Start Date',
      valueA: formatDate(contractA.effectiveDate),
      valueB: formatDate(contractB.effectiveDate),
      difference: contractA.effectiveDate?.getTime() === contractB.effectiveDate?.getTime() ? 'same' : 'different',
    });

    comparison.push({
      field: 'End Date',
      valueA: formatDate(contractA.expirationDate),
      valueB: formatDate(contractB.expirationDate),
      difference: !contractA.expirationDate || !contractB.expirationDate ? 'na' :
        contractA.expirationDate.getTime() === contractB.expirationDate.getTime() ? 'same' : 'different',
    });

    comparison.push({
      field: 'Auto-Renewal',
      valueA: contractA.autoRenewal ? 'Yes' : 'No',
      valueB: contractB.autoRenewal ? 'Yes' : 'No',
      difference: contractA.autoRenewal === contractB.autoRenewal ? 'same' : 'different',
    });

    // Get artifact data for deeper comparison
    const getArtifactData = (artifacts: any[], type: string) => {
      const artifact = artifacts.find((a: any) => a.artifactType === type);
      return artifact?.extractedData || {};
    };

    const termA = getArtifactData(contractA.artifacts, 'TERM_DATES');
    const termB = getArtifactData(contractB.artifacts, 'TERM_DATES');

    if (termA.noticeRequiredDays || termB.noticeRequiredDays) {
      comparison.push({
        field: 'Notice Period (Days)',
        valueA: termA.noticeRequiredDays ? `${termA.noticeRequiredDays} days` : 'N/A',
        valueB: termB.noticeRequiredDays ? `${termB.noticeRequiredDays} days` : 'N/A',
        difference: termA.noticeRequiredDays === termB.noticeRequiredDays ? 'same' : 'different',
      });
    }

    const finA = getArtifactData(contractA.artifacts, 'FINANCIAL');
    const finB = getArtifactData(contractB.artifacts, 'FINANCIAL');

    if (finA.paymentTerms || finB.paymentTerms) {
      comparison.push({
        field: 'Payment Terms',
        valueA: formatValue(finA.paymentTerms),
        valueB: formatValue(finB.paymentTerms),
        difference: finA.paymentTerms === finB.paymentTerms ? 'same' : 'different',
      });
    }

    const liabA = getArtifactData(contractA.artifacts, 'LIABILITY');
    const liabB = getArtifactData(contractB.artifacts, 'LIABILITY');

    if (liabA.liabilityCap || liabB.liabilityCap) {
      comparison.push({
        field: 'Liability Cap',
        valueA: formatValue(liabA.liabilityCap),
        valueB: formatValue(liabB.liabilityCap),
        difference: liabA.liabilityCap === liabB.liabilityCap ? 'same' : 'different',
      });
    }

    // Generate summary
    const differences = comparison.filter(c => c.difference !== 'same' && c.difference !== 'na');
    const valueDiff = Number(contractA.totalValue || 0) - Number(contractB.totalValue || 0);
    
    let summary = `## Contract Comparison: ${contractA.fileName} vs ${contractB.fileName}\n\n`;
    summary += `**${differences.length} differences** found across ${comparison.length} compared fields.\n\n`;
    
    if (valueDiff !== 0) {
      summary += valueDiff > 0 
        ? `💰 **${contractA.fileName}** has higher value by ${formatMoney(Math.abs(valueDiff))}.\n`
        : `💰 **${contractB.fileName}** has higher value by ${formatMoney(Math.abs(valueDiff))}.\n`;
    }

    // Add key differences
    if (differences.length > 0) {
      summary += `\n**Key Differences:**\n`;
      differences.slice(0, 5).forEach(d => {
        summary += `- **${d.field}**: ${d.valueA} vs ${d.valueB}\n`;
      });
    }

    return { contractA, contractB, comparison, summary };
  } catch (e) {
    console.error('[AI Chat] Error comparing contracts:', e);
    return {
      contractA: null,
      contractB: null,
      comparison: [],
      summary: 'Error comparing contracts. Please try again.',
    };
  }
}

// Count contracts (with optional supplier filter)
async function countContracts(tenantId: string, supplierName?: string) {
  try {
    const where: any = { tenantId };
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }
    
    const total = await prisma.contract.count({ where });
    const active = await prisma.contract.count({ 
      where: { ...where, status: 'ACTIVE' } 
    });
    const draft = await prisma.contract.count({ 
      where: { ...where, status: 'DRAFT' } 
    });
    const expired = await prisma.contract.count({ 
      where: { ...where, status: 'EXPIRED' } 
    });
    const expiringSoon = await prisma.contract.count({
      where: {
        ...where,
        expirationDate: {
          lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    });
    
    console.log(`[AI Chat] Contract counts: total=${total}, active=${active}, expiringSoon=${expiringSoon}, draft=${draft}, expired=${expired}`);
    return { total, active, expiringSoon, draft, expired, supplierName };
  } catch (e) {
    console.error('[AI Chat] Error counting contracts:', e);
    return { total: 0, active: 0, expiringSoon: 0, draft: 0, expired: 0, supplierName };
  }
}

// Get supplier summary
async function getSupplierSummary(supplierName: string, tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: supplierName, mode: 'insensitive' },
      },
    });
    
    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    const statusCounts = contracts.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;
    const contractTypes = [...new Set(contracts.map(c => c.contractType).filter(Boolean))];
    
    const expiringContracts = contracts.filter(c => 
      c.expirationDate && 
      new Date(c.expirationDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) &&
      new Date(c.expirationDate) >= new Date()
    );
    
    return {
      supplierName,
      totalContracts: contracts.length,
      totalValue,
      statusBreakdown: statusCounts,
      activeContracts,
      contractTypes,
      expiringIn90Days: expiringContracts.length,
      contracts,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting supplier summary:', e);
    return null;
  }
}

// ============================================
// ADVANCED PROCUREMENT AGENT QUERIES
// ============================================

// Get total spend analysis
async function getSpendAnalysis(tenantId: string, supplierName?: string) {
  try {
    const where: any = { tenantId, status: { not: 'CANCELLED' } };
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }

    const contracts = await prisma.contract.findMany({
      where,
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        totalValue: true,
        annualValue: true,
        categoryL1: true,
        categoryL2: true,
        status: true,
        effectiveDate: true,
        expirationDate: true,
      },
    });

    const totalSpend = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    const annualSpend = contracts.reduce((sum, c) => sum + (Number(c.annualValue) || Number(c.totalValue) || 0), 0);
    
    // Group by supplier
    const bySupplier = contracts.reduce((acc, c) => {
      const supplier = c.supplierName || 'Unknown';
      if (!acc[supplier]) acc[supplier] = { count: 0, value: 0 };
      acc[supplier].count++;
      acc[supplier].value += Number(c.totalValue) || 0;
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    // Group by category
    const byCategory = contracts.reduce((acc, c) => {
      const category = c.categoryL1 || 'Uncategorized';
      if (!acc[category]) acc[category] = { count: 0, value: 0 };
      acc[category].count++;
      acc[category].value += Number(c.totalValue) || 0;
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    return {
      totalContracts: contracts.length,
      totalSpend,
      annualSpend,
      bySupplier: Object.entries(bySupplier)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 10),
      byCategory: Object.entries(byCategory)
        .sort((a, b) => b[1].value - a[1].value),
      supplierFilter: supplierName,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting spend analysis:', e);
    return null;
  }
}

// Get cost savings opportunities
async function getCostSavingsOpportunities(tenantId: string) {
  try {
    const savings = await prisma.costSavingsOpportunity.findMany({
      where: { tenantId, status: { not: 'implemented' } },
      orderBy: { potentialSavingsAmount: 'desc' },
      take: 10,
      include: {
        contract: {
          select: { contractTitle: true, supplierName: true },
        },
      },
    });

    const totalPotential = savings.reduce((sum, s) => sum + Number(s.potentialSavingsAmount), 0);
    
    // Group by category
    const byCategory = savings.reduce((acc, s) => {
      const category = s.category || 'Other';
      if (!acc[category]) acc[category] = { count: 0, value: 0 };
      acc[category]!.count++;
      acc[category]!.value += Number(s.potentialSavingsAmount);
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    return {
      opportunities: savings,
      totalPotentialSavings: totalPotential,
      byCategory,
      count: savings.length,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting cost savings:', e);
    return { opportunities: [], totalPotentialSavings: 0, byCategory: {}, count: 0 };
  }
}

// Get top suppliers by spend
async function getTopSuppliers(tenantId: string, topN: number = 10) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      select: {
        supplierName: true,
        totalValue: true,
        status: true,
        expirationDate: true,
      },
    });

    const supplierStats = contracts.reduce((acc, c) => {
      const supplier = c.supplierName || 'Unknown';
      if (!acc[supplier]) {
        acc[supplier] = { 
          count: 0, 
          totalValue: 0, 
          activeCount: 0, 
          expiringCount: 0 
        };
      }
      acc[supplier].count++;
      acc[supplier].totalValue += Number(c.totalValue) || 0;
      if (c.status === 'ACTIVE') acc[supplier].activeCount++;
      if (c.expirationDate && new Date(c.expirationDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) {
        acc[supplier].expiringCount++;
      }
      return acc;
    }, {} as Record<string, { count: number; totalValue: number; activeCount: number; expiringCount: number }>);

    const sorted = Object.entries(supplierStats)
      .sort((a, b) => b[1].totalValue - a[1].totalValue)
      .slice(0, topN);

    return {
      suppliers: sorted.map(([name, stats]) => ({ name, ...stats })),
      totalSuppliers: Object.keys(supplierStats).length,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting top suppliers:', e);
    return { suppliers: [], totalSuppliers: 0 };
  }
}

// Get high-risk contracts
async function getRiskAssessment(tenantId: string) {
  try {
    // Get contracts with risk indicators
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        OR: [
          { expirationRisk: { in: ['HIGH', 'CRITICAL'] } },
          { daysUntilExpiry: { lte: 30 } },
          { autoRenewalEnabled: true },
        ],
      },
      orderBy: { expirationDate: 'asc' },
      take: 20,
    });

    // Categorize risks
    const byRiskLevel = {
      critical: contracts.filter(c => c.expirationRisk === 'CRITICAL' || (c.daysUntilExpiry && c.daysUntilExpiry <= 7)),
      high: contracts.filter(c => c.expirationRisk === 'HIGH' || (c.daysUntilExpiry && c.daysUntilExpiry <= 30 && c.daysUntilExpiry > 7)),
      autoRenewal: contracts.filter(c => c.autoRenewalEnabled),
    };

    return {
      contracts,
      byRiskLevel,
      criticalCount: byRiskLevel.critical.length,
      highRiskCount: byRiskLevel.high.length,
      autoRenewalCount: byRiskLevel.autoRenewal.length,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting risk assessment:', e);
    return { contracts: [], byRiskLevel: {}, criticalCount: 0, highRiskCount: 0, autoRenewalCount: 0 };
  }
}

// Get auto-renewal contracts
async function getAutoRenewalContracts(tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        autoRenewalEnabled: true,
        status: { not: 'CANCELLED' },
      },
      orderBy: { expirationDate: 'asc' },
      take: 20,
    });

    const upcomingRenewals = contracts.filter(c => 
      c.expirationDate && 
      new Date(c.expirationDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    );

    return {
      contracts,
      totalAutoRenewal: contracts.length,
      upcomingRenewals,
      upcomingCount: upcomingRenewals.length,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting auto-renewal contracts:', e);
    return { contracts: [], totalAutoRenewal: 0, upcomingRenewals: [], upcomingCount: 0 };
  }
}

// Get spend by category
async function getCategorySpend(tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      select: {
        categoryL1: true,
        categoryL2: true,
        totalValue: true,
        supplierName: true,
      },
    });

    // Group by L1 category
    const byL1 = contracts.reduce((acc, c) => {
      const cat = c.categoryL1 || 'Uncategorized';
      if (!acc[cat]) acc[cat] = { value: 0, count: 0, suppliers: new Set() };
      acc[cat].value += Number(c.totalValue) || 0;
      acc[cat].count++;
      if (c.supplierName) acc[cat].suppliers.add(c.supplierName);
      return acc;
    }, {} as Record<string, { value: number; count: number; suppliers: Set<string> }>);

    // Group by L2 under each L1
    const byL2 = contracts.reduce((acc, c) => {
      const l1 = c.categoryL1 || 'Uncategorized';
      const l2 = c.categoryL2 || 'General';
      const key = `${l1} > ${l2}`;
      if (!acc[key]) acc[key] = { value: 0, count: 0 };
      acc[key].value += Number(c.totalValue) || 0;
      acc[key].count++;
      return acc;
    }, {} as Record<string, { value: number; count: number }>);

    return {
      byL1Category: Object.entries(byL1)
        .map(([name, data]) => ({ 
          name, 
          value: data.value, 
          count: data.count, 
          supplierCount: data.suppliers.size 
        }))
        .sort((a, b) => b.value - a.value),
      byL2Category: Object.entries(byL2)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15),
      totalCategories: Object.keys(byL1).length,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting category spend:', e);
    return { byL1Category: [], byL2Category: [], totalCategories: 0 };
  }
}

// Get payment terms analysis
async function getPaymentTermsAnalysis(tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        contractTitle: true,
        supplierName: true,
        paymentTerms: true,
        paymentFrequency: true,
        totalValue: true,
      },
    });

    // Group by payment terms
    const byTerms = contracts.reduce((acc, c) => {
      const terms = c.paymentTerms || 'Not Specified';
      if (!acc[terms]) acc[terms] = { count: 0, value: 0, contracts: [] };
      acc[terms].count++;
      acc[terms].value += Number(c.totalValue) || 0;
      acc[terms].contracts.push(c);
      return acc;
    }, {} as Record<string, { count: number; value: number; contracts: any[] }>);

    return {
      byTerms: Object.entries(byTerms)
        .map(([terms, data]) => ({ 
          terms, 
          count: data.count, 
          value: data.value,
          contracts: data.contracts.slice(0, 5),
        }))
        .sort((a, b) => b.count - a.count),
      totalContracts: contracts.length,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting payment terms:', e);
    return { byTerms: [], totalContracts: 0 };
  }
}

// Get compliance status for contracts
async function getComplianceStatus(tenantId: string, supplierName?: string) {
  try {
    const where: any = { tenantId, status: { not: 'CANCELLED' } };
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }

    const contracts = await prisma.contract.findMany({
      where,
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        status: true,
        expirationDate: true,
        noticePeriodDays: true,
        totalValue: true,
      },
    });

    // Calculate compliance metrics based on available data
    // Contracts are considered to have issues if they're missing key dates/info
    const contractsWithIssues = contracts.filter(c => {
      const issues = [];
      if (!c.expirationDate) issues.push('missing_expiration');
      if (!c.noticePeriodDays) issues.push('missing_notice_period');
      return issues.length > 0;
    });

    const compliantCount = contracts.length - contractsWithIssues.length;

    return {
      totalContracts: contracts.length,
      compliantCount,
      issueCount: contractsWithIssues.length,
      contracts: contractsWithIssues.slice(0, 10).map(c => ({
        ...c,
        complianceScore: c.expirationDate && c.noticePeriodDays ? 100 : c.expirationDate ? 50 : 25,
        issueCount: (!c.expirationDate ? 1 : 0) + (!c.noticePeriodDays ? 1 : 0),
      })),
    };
  } catch (e) {
    console.error('[AI Chat] Error getting compliance status:', e);
    return { totalContracts: 0, compliantCount: 0, issueCount: 0, contracts: [] };
  }
}

// Get supplier performance metrics
async function getSupplierPerformance(tenantId: string, supplierName: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: supplierName, mode: 'insensitive' },
      },
      orderBy: { effectiveDate: 'asc' },
    });

    const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;
    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    
    // Calculate relationship duration
    const firstContract = contracts[0];
    const relationshipMonths = firstContract?.effectiveDate 
      ? Math.floor((Date.now() - new Date(firstContract.effectiveDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;

    // Default performance scores (in a real app, these would come from supplier reviews)
    return {
      supplierName,
      overallScore: 75,
      deliveryScore: 80,
      qualityScore: 75,
      communicationScore: 70,
      valueScore: 75,
      activeContracts,
      totalValue,
      relationshipMonths,
      totalContracts: contracts.length,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting supplier performance:', e);
    return {
      supplierName,
      overallScore: 0,
      deliveryScore: 0,
      qualityScore: 0,
      communicationScore: 0,
      valueScore: 0,
      activeContracts: 0,
      totalValue: 0,
      relationshipMonths: 0,
      totalContracts: 0,
    };
  }
}

// ============================================
// ADVANCED AI AGENT: DEEP ANALYSIS FUNCTION
// ============================================

interface DeepAnalysisResult {
  summary: {
    totalContracts: number;
    activeContracts: number;
    totalValue: number;
    averageValue: number;
    averageDurationMonths: number;
    shortestDurationMonths: number;
    longestDurationMonths: number;
  };
  contracts: Array<{
    id: string;
    title: string;
    supplierName: string;
    value: number;
    status: string;
    effectiveDate: Date | null;
    expirationDate: Date | null;
    durationMonths: number;
    category: string;
    daysUntilExpiry: number | null;
  }>;
  byCategory: Record<string, { count: number; value: number; contracts: string[] }>;
  byStatus: Record<string, number>;
  byYear: Record<string, { count: number; value: number }>;
  riskAnalysis: {
    expiringIn30Days: number;
    expiringIn90Days: number;
    autoRenewalCount: number;
    highValueAtRisk: number;
  };
  filters: {
    supplierName?: string;
    category?: string;
    year?: string;
  };
}

/**
 * Perform deep analysis on contracts matching the given criteria
 * This is the core AI agent capability for complex queries
 */
async function performDeepAnalysis(
  tenantId: string,
  options: {
    supplierName?: string;
    category?: string;
    year?: string;
    analysisAspects?: {
      value?: boolean;
      duration?: boolean;
      categories?: boolean;
      supplierDetails?: boolean;
      risk?: boolean;
      terms?: boolean;
    };
  }
): Promise<DeepAnalysisResult> {
  const { supplierName, category, year, analysisAspects } = options;
  
  try {
    // Build dynamic query
    const where: any = { tenantId };
    
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }
    
    if (category) {
      where.OR = [
        { categoryL1: { contains: category, mode: 'insensitive' } },
        { categoryL2: { contains: category, mode: 'insensitive' } },
        { procurementCategory: { name: { contains: category, mode: 'insensitive' } } },
      ];
    }
    
    // Filter by year if specified
    if (year) {
      const yearNum = parseInt(year);
      where.AND = [
        {
          OR: [
            { effectiveDate: { gte: new Date(`${yearNum}-01-01`), lte: new Date(`${yearNum}-12-31`) } },
            { 
              AND: [
                { effectiveDate: { lte: new Date(`${yearNum}-12-31`) } },
                { expirationDate: { gte: new Date(`${yearNum}-01-01`) } },
              ]
            },
          ]
        }
      ];
    }
    
    console.log('[AI Deep Analysis] Query filters:', { supplierName, category, year });
    
    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { totalValue: 'desc' },
      take: 100, // Limit for performance
    });
    
    console.log(`[AI Deep Analysis] Found ${contracts.length} contracts`);
    
    if (contracts.length === 0) {
      return {
        summary: {
          totalContracts: 0,
          activeContracts: 0,
          totalValue: 0,
          averageValue: 0,
          averageDurationMonths: 0,
          shortestDurationMonths: 0,
          longestDurationMonths: 0,
        },
        contracts: [],
        byCategory: {},
        byStatus: {},
        byYear: {},
        riskAnalysis: {
          expiringIn30Days: 0,
          expiringIn90Days: 0,
          autoRenewalCount: 0,
          highValueAtRisk: 0,
        },
        filters: { supplierName, category, year },
      };
    }
    
    // Calculate durations
    const contractsWithDuration = contracts.map(c => {
      const effectiveDate = c.effectiveDate ? new Date(c.effectiveDate) : null;
      const expirationDate = c.expirationDate ? new Date(c.expirationDate) : null;
      const durationMonths = effectiveDate && expirationDate
        ? Math.round((expirationDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0;
      const daysUntilExpiry = expirationDate 
        ? Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        id: c.id,
        title: c.contractTitle || 'Untitled',
        supplierName: c.supplierName || 'Unknown',
        value: Number(c.totalValue) || 0,
        status: c.status,
        effectiveDate,
        expirationDate,
        durationMonths,
        category: c.categoryL1 || 'Uncategorized',
        daysUntilExpiry,
      };
    });
    
    // Calculate summary stats
    const totalValue = contractsWithDuration.reduce((sum, c) => sum + c.value, 0);
    const durations = contractsWithDuration.filter(c => c.durationMonths > 0).map(c => c.durationMonths);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const activeContracts = contractsWithDuration.filter(c => c.status === 'ACTIVE').length;
    
    // Group by category
    const byCategory: Record<string, { count: number; value: number; contracts: string[] }> = {};
    contractsWithDuration.forEach(c => {
      const cat = c.category;
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, value: 0, contracts: [] };
      }
      byCategory[cat].count++;
      byCategory[cat].value += c.value;
      byCategory[cat].contracts.push(c.title);
    });
    
    // Group by status
    const byStatus: Record<string, number> = {};
    contractsWithDuration.forEach(c => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });
    
    // Group by year
    const byYear: Record<string, { count: number; value: number }> = {};
    contractsWithDuration.forEach(c => {
      const contractYear = c.effectiveDate?.getFullYear()?.toString() || 'Unknown';
      if (!byYear[contractYear]) {
        byYear[contractYear] = { count: 0, value: 0 };
      }
      byYear[contractYear].count++;
      byYear[contractYear].value += c.value;
    });
    
    // Risk analysis
    const now = Date.now();
    const in30Days = now + (30 * 24 * 60 * 60 * 1000);
    const in90Days = now + (90 * 24 * 60 * 60 * 1000);
    
    const expiringIn30Days = contractsWithDuration.filter(c => 
      c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 30
    ).length;
    
    const expiringIn90Days = contractsWithDuration.filter(c => 
      c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 90
    ).length;
    
    const autoRenewalCount = contracts.filter(c => c.autoRenewalEnabled).length;
    
    const highValueAtRisk = contractsWithDuration.filter(c => 
      c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 90 && c.value > 100000
    ).length;
    
    return {
      summary: {
        totalContracts: contracts.length,
        activeContracts,
        totalValue,
        averageValue: contracts.length > 0 ? totalValue / contracts.length : 0,
        averageDurationMonths: Math.round(avgDuration),
        shortestDurationMonths: durations.length > 0 ? Math.min(...durations) : 0,
        longestDurationMonths: durations.length > 0 ? Math.max(...durations) : 0,
      },
      contracts: contractsWithDuration.slice(0, 20), // Top 20 by value
      byCategory,
      byStatus,
      byYear,
      riskAnalysis: {
        expiringIn30Days,
        expiringIn90Days,
        autoRenewalCount,
        highValueAtRisk,
      },
      filters: { supplierName, category, year },
    };
  } catch (e) {
    console.error('[AI Deep Analysis] Error:', e);
    return {
      summary: {
        totalContracts: 0,
        activeContracts: 0,
        totalValue: 0,
        averageValue: 0,
        averageDurationMonths: 0,
        shortestDurationMonths: 0,
        longestDurationMonths: 0,
      },
      contracts: [],
      byCategory: {},
      byStatus: {},
      byYear: {},
      riskAnalysis: {
        expiringIn30Days: 0,
        expiringIn90Days: 0,
        autoRenewalCount: 0,
        highValueAtRisk: 0,
      },
      filters: { supplierName, category, year },
    };
  }
}

// Get rate comparison data
async function getRateComparison(tenantId: string, supplierName?: string) {
  try {
    const where: any = { tenantId };
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }

    // Get rate card entries if available
    const rateCards = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      include: {
        contract: {
          select: { contractTitle: true, supplierName: true },
        },
      },
      take: 20,
    });

    // Transform to comparison format with market rates
    const comparison = rateCards.map(entry => {
      const rate = Number(entry.dailyRate) || 0;
      const marketRate = entry.marketRateAverage ? Number(entry.marketRateAverage) : Math.round(rate * 1.1);
      const variance = marketRate > 0 ? Math.round(((rate - marketRate) / marketRate) * 100) : 0;
      return {
        roleName: entry.roleStandardized || entry.roleOriginal,
        rate,
        marketRate,
        vsMarket: variance,
        supplier: entry.supplierName || entry.contract?.supplierName || 'Unknown',
        contractTitle: entry.contract?.contractTitle || 'Unknown',
      };
    });

    return {
      rateCards: comparison,
      totalRates: rateCards.length,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting rate comparison:', e);
    return { rateCards: [], totalRates: 0 };
  }
}

// ============================================
// MULTI-CONTRACT COMPARISON FUNCTIONS
// ============================================

interface ContractComparisonData {
  id: string;
  contractTitle: string;
  supplierName: string;
  status: string;
  totalValue: number;
  annualValue: number;
  effectiveDate: Date | null;
  expirationDate: Date | null;
  durationMonths: number;
  categoryL1: string | null;
  categoryL2: string | null;
  paymentTerms: string | null;
  paymentFrequency: string | null;
  autoRenewalEnabled: boolean;
  noticePeriodDays: number | null;
  terminationClause: string | null;
  currency: string | null;
  artifacts: Array<{
    id: string;
    type: string;
    title: string;
    content: any;
  }>;
  metadata: any;
  keyTerms: string[];
  clauses: Record<string, string | null>;
  rates?: Array<{
    roleName: string;
    rate: number;
    currency: string;
    unit: string;
  }>;
}

interface ComparisonResult {
  entity1: ContractComparisonData | null;
  entity2: ContractComparisonData | null;
  entity1Name: string;
  entity2Name: string;
  differences: {
    field: string;
    label: string;
    value1: any;
    value2: any;
    analysis: string;
  }[];
  similarities: {
    field: string;
    label: string;
    sharedValue: any;
  }[];
  summary: string;
  keyInsights: string[];
  recommendation: string;
}

/**
 * Find contracts matching a supplier or contract name for comparison
 */
async function findContractsForComparison(
  searchTerm: string,
  tenantId: string
): Promise<ContractComparisonData[]> {
  try {
    console.log(`[AI Comparison] Searching for contracts matching: "${searchTerm}"`);
    
    // Search by supplier name OR contract title
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        OR: [
          { supplierName: { contains: searchTerm, mode: 'insensitive' } },
          { contractTitle: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      include: {
        contractMetadata: true,
      },
      orderBy: { totalValue: 'desc' },
      take: 5, // Get top 5 by value
    });
    
    console.log(`[AI Comparison] Found ${contracts.length} contracts for "${searchTerm}"`);
    
    // For each contract, get artifacts and rate cards
    const contractsWithData: ContractComparisonData[] = [];
    
    for (const contract of contracts) {
      // Get artifacts
      const artifacts = await prisma.artifact.findMany({
        where: { contractId: contract.id },
        select: {
          id: true,
          type: true,
          title: true,
          data: true,
          status: true,
        },
        take: 20,
      });
      
      // Get rate card entries
      const rateCards = await prisma.rateCardEntry.findMany({
        where: { contractId: contract.id },
        select: {
          roleStandardized: true,
          roleOriginal: true,
          dailyRate: true,
          currency: true,
          unit: true,
        },
        take: 20,
      });
      
      // Extract key terms from metadata
      const customFields = (contract.contractMetadata as any)?.customFields || {};
      const appliedMetadata = typeof customFields === 'object' && customFields
        ? Object.fromEntries(Object.entries(customFields).filter(([k]) => !String(k).startsWith('_')))
        : {};

      if ((appliedMetadata as any).contract_name !== undefined && (appliedMetadata as any).contract_title === undefined) {
        (appliedMetadata as any).contract_title = (appliedMetadata as any).contract_name;
      }
      if ((appliedMetadata as any).notice_period_days !== undefined && (appliedMetadata as any).notice_period === undefined) {
        (appliedMetadata as any).notice_period = (appliedMetadata as any).notice_period_days;
      }
      if ((appliedMetadata as any).party_a_name !== undefined && (appliedMetadata as any).client_name === undefined) {
        (appliedMetadata as any).client_name = (appliedMetadata as any).party_a_name;
      }
      if ((appliedMetadata as any).party_b_name !== undefined && (appliedMetadata as any).supplier_name === undefined) {
        (appliedMetadata as any).supplier_name = (appliedMetadata as any).party_b_name;
      }
      const metadata = {
        ...(typeof contract.aiMetadata === 'object' && contract.aiMetadata ? (contract.aiMetadata as any) : {}),
        ...(appliedMetadata as any),
      };
      const keyTerms: string[] = [];
      
      // Parse metadata for key terms
      if (typeof metadata === 'object') {
        const meta = metadata as any;
        if (meta.termination_clause) keyTerms.push(`Termination: ${meta.termination_clause}`);
        if (meta.liability_cap) keyTerms.push(`Liability Cap: ${meta.liability_cap}`);
        if (meta.indemnification) keyTerms.push(`Indemnification: ${meta.indemnification}`);
        if (meta.sla_terms) keyTerms.push(`SLA: ${meta.sla_terms}`);
        if (meta.payment_terms) keyTerms.push(`Payment: ${meta.payment_terms}`);
      }
      
      // Build clauses object from artifacts
      const clauses: Record<string, string | null> = {
        termination: null,
        liability: null,
        indemnification: null,
        confidentiality: null,
        intellectualProperty: null,
        sla: null,
        warranty: null,
        insurance: null,
      };
      
      // Extract clauses from artifacts
      for (const artifact of artifacts) {
        if (artifact.type === 'TERMINATION_CLAUSE' || artifact.title?.toLowerCase().includes('termination')) {
          clauses.termination = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
        if (artifact.type === 'LIABILITY_CLAUSE' || artifact.title?.toLowerCase().includes('liability')) {
          clauses.liability = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
        if (artifact.title?.toLowerCase().includes('indemnif')) {
          clauses.indemnification = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
        if (artifact.title?.toLowerCase().includes('confidential')) {
          clauses.confidentiality = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
        if (artifact.title?.toLowerCase().includes('intellectual') || artifact.title?.toLowerCase().includes('ip')) {
          clauses.intellectualProperty = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
        if (artifact.type === 'SLA_TERMS' || artifact.title?.toLowerCase().includes('sla')) {
          clauses.sla = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
      }
      
      // Calculate duration
      const effectiveDate = contract.effectiveDate ? new Date(contract.effectiveDate) : null;
      const expirationDate = contract.expirationDate ? new Date(contract.expirationDate) : null;
      const durationMonths = effectiveDate && expirationDate
        ? Math.round((expirationDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0;
      
      contractsWithData.push({
        id: contract.id,
        contractTitle: contract.contractTitle || 'Untitled Contract',
        supplierName: contract.supplierName || 'Unknown Supplier',
        status: contract.status,
        totalValue: Number(contract.totalValue) || 0,
        annualValue: Number(contract.annualValue) || 0,
        effectiveDate,
        expirationDate,
        durationMonths,
        categoryL1: contract.categoryL1,
        categoryL2: contract.categoryL2,
        paymentTerms: contract.paymentTerms,
        paymentFrequency: contract.paymentFrequency,
        autoRenewalEnabled: contract.autoRenewalEnabled || false,
        noticePeriodDays: contract.noticePeriodDays,
        terminationClause: contract.terminationClause,
        currency: contract.currency,
        artifacts: artifacts.map(a => ({
          id: a.id,
          type: a.type,
          title: a.title || 'Untitled',
          content: a.data,
        })),
        metadata,
        keyTerms,
        clauses,
        rates: rateCards.map(r => ({
          roleName: r.roleStandardized || r.roleOriginal || 'Unknown Role',
          rate: Number(r.dailyRate) || 0,
          currency: r.currency || 'USD',
          unit: r.unit || 'day',
        })),
      });
    }
    
    return contractsWithData;
  } catch (e) {
    console.error('[AI Comparison] Error finding contracts:', e);
    return [];
  }
}

/**
 * Perform comprehensive comparison between two entities (suppliers or contracts)
 */
async function performContractComparison(
  entity1Name: string,
  entity2Name: string,
  tenantId: string,
  aspectsToCompare?: {
    value?: boolean;
    duration?: boolean;
    terms?: boolean;
    risk?: boolean;
    rates?: boolean;
    clauses?: boolean;
  }
): Promise<ComparisonResult> {
  console.log(`[AI Comparison] Comparing "${entity1Name}" vs "${entity2Name}"`);
  
  // Find contracts for both entities
  const [contracts1, contracts2] = await Promise.all([
    findContractsForComparison(entity1Name, tenantId),
    findContractsForComparison(entity2Name, tenantId),
  ]);
  
  // Get the top contract for each entity (highest value)
  const contract1 = contracts1[0] || null;
  const contract2 = contracts2[0] || null;
  
  const differences: ComparisonResult['differences'] = [];
  const similarities: ComparisonResult['similarities'] = [];
  const keyInsights: string[] = [];
  
  // Helper function to format currency
  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  // Helper function to analyze difference
  const analyzeDifference = (field: string, val1: any, val2: any): string => {
    if (val1 === null && val2 === null) return 'Both contracts are missing this information';
    if (val1 === null) return `Only ${entity2Name} has this defined`;
    if (val2 === null) return `Only ${entity1Name} has this defined`;
    
    if (typeof val1 === 'number' && typeof val2 === 'number') {
      const diff = val1 - val2;
      const pct = val2 !== 0 ? Math.round((diff / val2) * 100) : 0;
      if (diff > 0) {
        return `${entity1Name} is ${Math.abs(pct)}% higher`;
      } else if (diff < 0) {
        return `${entity2Name} is ${Math.abs(pct)}% higher`;
      }
      return 'Both are equal';
    }
    
    return 'Values differ';
  };
  
  if (contract1 && contract2) {
    // Compare values
    if (aspectsToCompare?.value !== false) {
      if (contract1.totalValue !== contract2.totalValue) {
        differences.push({
          field: 'totalValue',
          label: 'Total Contract Value',
          value1: formatCurrency(contract1.totalValue, contract1.currency || 'USD'),
          value2: formatCurrency(contract2.totalValue, contract2.currency || 'USD'),
          analysis: analyzeDifference('totalValue', contract1.totalValue, contract2.totalValue),
        });
        
        // Generate insight
        const valueDiff = Math.abs(contract1.totalValue - contract2.totalValue);
        if (valueDiff > 100000) {
          keyInsights.push(`Significant value difference of ${formatCurrency(valueDiff)} between contracts`);
        }
      } else {
        similarities.push({
          field: 'totalValue',
          label: 'Total Contract Value',
          sharedValue: formatCurrency(contract1.totalValue, contract1.currency || 'USD'),
        });
      }
      
      // Annual value
      if (contract1.annualValue !== contract2.annualValue) {
        differences.push({
          field: 'annualValue',
          label: 'Annual Value',
          value1: formatCurrency(contract1.annualValue, contract1.currency || 'USD'),
          value2: formatCurrency(contract2.annualValue, contract2.currency || 'USD'),
          analysis: analyzeDifference('annualValue', contract1.annualValue, contract2.annualValue),
        });
      }
    }
    
    // Compare duration
    if (aspectsToCompare?.duration !== false) {
      if (contract1.durationMonths !== contract2.durationMonths) {
        differences.push({
          field: 'duration',
          label: 'Contract Duration',
          value1: `${contract1.durationMonths} months`,
          value2: `${contract2.durationMonths} months`,
          analysis: contract1.durationMonths > contract2.durationMonths
            ? `${entity1Name} has a longer commitment (${contract1.durationMonths - contract2.durationMonths} months more)`
            : `${entity2Name} has a longer commitment (${contract2.durationMonths - contract1.durationMonths} months more)`,
        });
      } else if (contract1.durationMonths > 0) {
        similarities.push({
          field: 'duration',
          label: 'Contract Duration',
          sharedValue: `${contract1.durationMonths} months`,
        });
      }
    }
    
    // Compare payment terms
    if (aspectsToCompare?.terms !== false) {
      if (contract1.paymentTerms !== contract2.paymentTerms) {
        differences.push({
          field: 'paymentTerms',
          label: 'Payment Terms',
          value1: contract1.paymentTerms || 'Not specified',
          value2: contract2.paymentTerms || 'Not specified',
          analysis: 'Different payment terms may affect cash flow planning',
        });
      } else if (contract1.paymentTerms) {
        similarities.push({
          field: 'paymentTerms',
          label: 'Payment Terms',
          sharedValue: contract1.paymentTerms,
        });
      }
      
      // Notice period
      if (contract1.noticePeriodDays !== contract2.noticePeriodDays) {
        differences.push({
          field: 'noticePeriod',
          label: 'Notice Period',
          value1: contract1.noticePeriodDays ? `${contract1.noticePeriodDays} days` : 'Not specified',
          value2: contract2.noticePeriodDays ? `${contract2.noticePeriodDays} days` : 'Not specified',
          analysis: 'Different notice periods affect exit flexibility',
        });
      }
    }
    
    // Compare risk factors
    if (aspectsToCompare?.risk !== false) {
      // Auto-renewal comparison
      if (contract1.autoRenewalEnabled !== contract2.autoRenewalEnabled) {
        differences.push({
          field: 'autoRenewal',
          label: 'Auto-Renewal',
          value1: contract1.autoRenewalEnabled ? 'Enabled' : 'Disabled',
          value2: contract2.autoRenewalEnabled ? 'Enabled' : 'Disabled',
          analysis: contract1.autoRenewalEnabled
            ? `${entity1Name} auto-renews - monitor notice period`
            : `${entity2Name} auto-renews - monitor notice period`,
        });
        
        if (contract1.autoRenewalEnabled || contract2.autoRenewalEnabled) {
          keyInsights.push('Auto-renewal is enabled on one contract - ensure timely review before renewal date');
        }
      }
      
      // Expiration dates
      if (contract1.expirationDate && contract2.expirationDate) {
        const now = Date.now();
        const days1 = Math.ceil((contract1.expirationDate.getTime() - now) / (1000 * 60 * 60 * 24));
        const days2 = Math.ceil((contract2.expirationDate.getTime() - now) / (1000 * 60 * 60 * 24));
        
        if (days1 <= 90 || days2 <= 90) {
          if (days1 <= 90) {
            keyInsights.push(`⚠️ ${entity1Name} contract expires in ${days1} days`);
          }
          if (days2 <= 90) {
            keyInsights.push(`⚠️ ${entity2Name} contract expires in ${days2} days`);
          }
        }
      }
    }
    
    // Compare rates if available
    if (aspectsToCompare?.rates !== false && contract1.rates && contract2.rates) {
      const roles1 = new Map(contract1.rates.map(r => [r.roleName.toLowerCase(), r]));
      const roles2 = new Map(contract2.rates.map(r => [r.roleName.toLowerCase(), r]));
      
      // Find common roles and compare
      const roles1Entries = Array.from(roles1.entries());
      for (const [roleName, rate1] of roles1Entries) {
        const rate2 = roles2.get(roleName);
        if (rate2) {
          if (rate1.rate !== rate2.rate) {
            const diff = rate1.rate - rate2.rate;
            const pctDiff = rate2.rate > 0 ? Math.round((diff / rate2.rate) * 100) : 0;
            differences.push({
              field: `rate_${roleName}`,
              label: `Rate: ${rate1.roleName}`,
              value1: `${formatCurrency(rate1.rate)}/${rate1.unit}`,
              value2: `${formatCurrency(rate2.rate)}/${rate2.unit}`,
              analysis: diff > 0
                ? `${entity1Name} is ${Math.abs(pctDiff)}% more expensive for this role`
                : `${entity2Name} is ${Math.abs(pctDiff)}% more expensive for this role`,
            });
          }
        }
      }
      
      // Overall rate comparison insight
      const avgRate1 = contract1.rates.length > 0
        ? contract1.rates.reduce((sum, r) => sum + r.rate, 0) / contract1.rates.length
        : 0;
      const avgRate2 = contract2.rates.length > 0
        ? contract2.rates.reduce((sum, r) => sum + r.rate, 0) / contract2.rates.length
        : 0;
      
      if (avgRate1 > 0 && avgRate2 > 0) {
        const avgDiff = Math.round(((avgRate1 - avgRate2) / avgRate2) * 100);
        if (Math.abs(avgDiff) > 5) {
          keyInsights.push(
            avgDiff > 0
              ? `Average rates with ${entity1Name} are ${avgDiff}% higher than ${entity2Name}`
              : `Average rates with ${entity2Name} are ${Math.abs(avgDiff)}% higher than ${entity1Name}`
          );
        }
      }
    }
    
    // Compare clauses
    if (aspectsToCompare?.clauses !== false) {
      const clauseLabels: Record<string, string> = {
        termination: 'Termination Clause',
        liability: 'Liability Clause',
        indemnification: 'Indemnification',
        confidentiality: 'Confidentiality',
        intellectualProperty: 'Intellectual Property',
        sla: 'Service Level Agreement',
      };
      
      for (const [clauseKey, label] of Object.entries(clauseLabels)) {
        const clause1 = contract1.clauses[clauseKey];
        const clause2 = contract2.clauses[clauseKey];
        
        if (clause1 && clause2 && clause1 !== clause2) {
          differences.push({
            field: `clause_${clauseKey}`,
            label,
            value1: clause1.substring(0, 200) + (clause1.length > 200 ? '...' : ''),
            value2: clause2.substring(0, 200) + (clause2.length > 200 ? '...' : ''),
            analysis: 'Clause text differs - recommend legal review',
          });
        } else if (clause1 && !clause2) {
          differences.push({
            field: `clause_${clauseKey}`,
            label,
            value1: clause1.substring(0, 200) + (clause1.length > 200 ? '...' : ''),
            value2: 'Not found in contract',
            analysis: `${entity2Name} contract is missing this clause`,
          });
        } else if (!clause1 && clause2) {
          differences.push({
            field: `clause_${clauseKey}`,
            label,
            value1: 'Not found in contract',
            value2: clause2.substring(0, 200) + (clause2.length > 200 ? '...' : ''),
            analysis: `${entity1Name} contract is missing this clause`,
          });
        }
      }
    }
    
    // Category comparison
    if (contract1.categoryL1 !== contract2.categoryL1) {
      differences.push({
        field: 'category',
        label: 'Category',
        value1: contract1.categoryL1 || 'Uncategorized',
        value2: contract2.categoryL1 || 'Uncategorized',
        analysis: 'Contracts are in different categories',
      });
    } else if (contract1.categoryL1) {
      similarities.push({
        field: 'category',
        label: 'Category',
        sharedValue: contract1.categoryL1,
      });
    }
  }
  
  // Generate summary and recommendation
  let summary = '';
  let recommendation = '';
  
  if (!contract1 && !contract2) {
    summary = `Could not find contracts matching "${entity1Name}" or "${entity2Name}". Please check the supplier or contract names.`;
    recommendation = 'Try searching with more specific names or check the contract database.';
  } else if (!contract1) {
    summary = `Could not find contracts for "${entity1Name}". Found ${contracts2.length} contract(s) for "${entity2Name}".`;
    recommendation = `Consider verifying the name "${entity1Name}" or searching in the contracts list.`;
  } else if (!contract2) {
    summary = `Could not find contracts for "${entity2Name}". Found ${contracts1.length} contract(s) for "${entity1Name}".`;
    recommendation = `Consider verifying the name "${entity2Name}" or searching in the contracts list.`;
  } else {
    // Generate comprehensive summary
    const valueDiff = contract1.totalValue - contract2.totalValue;
    const valueWinner = valueDiff > 0 ? entity1Name : entity2Name;
    const durationDiff = contract1.durationMonths - contract2.durationMonths;
    
    summary = `**Comparison: ${contract1.supplierName} vs ${contract2.supplierName}**\n\n`;
    summary += `Found **${differences.length}** key differences and **${similarities.length}** similarities between the contracts.\n\n`;
    
    if (valueDiff !== 0) {
      summary += `💰 **Value**: ${valueWinner} has a ${formatCurrency(Math.abs(valueDiff))} ${valueDiff > 0 ? 'higher' : 'lower'} total contract value.\n`;
    }
    
    if (durationDiff !== 0) {
      const durationWinner = durationDiff > 0 ? entity1Name : entity2Name;
      summary += `📅 **Duration**: ${durationWinner} has a ${Math.abs(durationDiff)} month longer commitment.\n`;
    }
    
    // Build recommendation based on findings
    const recommendations: string[] = [];
    
    if (contract1.autoRenewalEnabled || contract2.autoRenewalEnabled) {
      recommendations.push('Review auto-renewal terms before expiration to avoid unwanted extensions');
    }
    
    if (differences.some(d => d.field.startsWith('rate_'))) {
      recommendations.push('Consider rate renegotiation based on the rate comparison');
    }
    
    if (differences.some(d => d.field.startsWith('clause_'))) {
      recommendations.push('Recommend legal review of clause differences between contracts');
    }
    
    recommendation = recommendations.length > 0
      ? recommendations.join('. ') + '.'
      : 'Both contracts are similar in key terms. Monitor expiration dates for timely renewal decisions.';
  }
  
  return {
    entity1: contract1,
    entity2: contract2,
    entity1Name,
    entity2Name,
    differences,
    similarities,
    summary,
    keyInsights,
    recommendation,
  };
}

/**
 * Compare specific clauses between two contracts using RAG
 */
async function compareContractClauses(
  entity1Name: string,
  entity2Name: string,
  clauseType: string,
  tenantId: string
): Promise<{
  entity1Clause: string | null;
  entity2Clause: string | null;
  analysis: string;
  differences: string[];
  recommendation: string;
}> {
  console.log(`[AI Comparison] Comparing ${clauseType} clauses between "${entity1Name}" and "${entity2Name}"`);
  
  // Find contracts
  const [contracts1, contracts2] = await Promise.all([
    findContractsForComparison(entity1Name, tenantId),
    findContractsForComparison(entity2Name, tenantId),
  ]);
  
  const contract1 = contracts1[0];
  const contract2 = contracts2[0];
  
  if (!contract1 || !contract2) {
    return {
      entity1Clause: contract1 ? 'Contract found but clause not extracted' : null,
      entity2Clause: contract2 ? 'Contract found but clause not extracted' : null,
      analysis: `Could not find one or both contracts. ${entity1Name}: ${contract1 ? 'found' : 'not found'}, ${entity2Name}: ${contract2 ? 'found' : 'not found'}`,
      differences: [],
      recommendation: 'Please verify the contract/supplier names.',
    };
  }
  
  // Map clause type to key
  const clauseKeyMap: Record<string, string> = {
    'termination': 'termination',
    'terminate': 'termination',
    'liability': 'liability',
    'limit': 'liability',
    'indemnif': 'indemnification',
    'indemnity': 'indemnification',
    'confidential': 'confidentiality',
    'nda': 'confidentiality',
    'intellectual': 'intellectualProperty',
    'ip': 'intellectualProperty',
    'sla': 'sla',
    'service level': 'sla',
    'warranty': 'warranty',
    'insurance': 'insurance',
  };
  
  const clauseKey = Object.entries(clauseKeyMap).find(([pattern]) => 
    clauseType.toLowerCase().includes(pattern)
  )?.[1] || 'termination';
  
  const clause1 = contract1.clauses[clauseKey];
  const clause2 = contract2.clauses[clauseKey];
  
  const differences: string[] = [];
  let analysis = '';
  
  if (clause1 && clause2) {
    analysis = `Both contracts have ${clauseType} clauses defined. `;
    
    // Simple text comparison
    if (clause1.length !== clause2.length) {
      const lengthDiff = Math.abs(clause1.length - clause2.length);
      analysis += `${entity1Name}'s clause is ${clause1.length > clause2.length ? 'more' : 'less'} detailed (${lengthDiff} characters ${clause1.length > clause2.length ? 'longer' : 'shorter'}). `;
      differences.push(`Clause length differs by ${lengthDiff} characters`);
    }
    
    // Check for key terms
    const keyTermsToCheck = ['days', 'notice', 'liability', 'cap', 'limit', 'indemnify', 'material breach', 'convenience'];
    for (const term of keyTermsToCheck) {
      const in1 = clause1.toLowerCase().includes(term);
      const in2 = clause2.toLowerCase().includes(term);
      if (in1 && !in2) {
        differences.push(`"${term}" mentioned in ${entity1Name} but not in ${entity2Name}`);
      } else if (!in1 && in2) {
        differences.push(`"${term}" mentioned in ${entity2Name} but not in ${entity1Name}`);
      }
    }
  } else if (clause1 && !clause2) {
    analysis = `Only ${entity1Name} has the ${clauseType} clause defined. ${entity2Name} contract is missing this clause.`;
    differences.push(`${entity2Name} is missing the ${clauseType} clause entirely`);
  } else if (!clause1 && clause2) {
    analysis = `Only ${entity2Name} has the ${clauseType} clause defined. ${entity1Name} contract is missing this clause.`;
    differences.push(`${entity1Name} is missing the ${clauseType} clause entirely`);
  } else {
    analysis = `Neither contract has the ${clauseType} clause extracted. This may indicate the clauses exist but weren't automatically detected.`;
  }
  
  const recommendation = differences.length > 0
    ? `Review the ${clauseType} clause differences with legal counsel. Key differences: ${differences.slice(0, 3).join('; ')}.`
    : `Both contracts appear similar for ${clauseType} terms. Verify with legal review if needed.`;
  
  return {
    entity1Clause: clause1 ?? null,
    entity2Clause: clause2 ?? null,
    analysis,
    differences,
    recommendation,
  };
}

// ============================================
// MULTI-CONTRACT GROUP COMPARISON
// ============================================

interface GroupComparisonResult {
  groups: Array<{
    label: string;
    supplier?: string;
    year?: string;
    category?: string;
    contractCount: number;
    totalValue: number;
    avgValue: number;
    avgDurationMonths: number;
    activeCount: number;
    expiringSoonCount: number;
    contracts: Array<{ id: string; title: string; value: number }>;
  }>;
  categoryBreakdown?: Record<string, Array<{ count: number; value: number }>>;
  rateComparison?: Array<{ role: string; rates: number[] }>;
  insights: string[];
  recommendation: string;
}

/**
 * Compare multiple groups of contracts (e.g., all Deloitte 2024 contracts vs Accenture 2024)
 */
async function performGroupComparison(
  groups: Array<{ supplier?: string; year?: string; category?: string; name?: string }>,
  tenantId: string
): Promise<GroupComparisonResult> {
  console.log('[AI Group Comparison] Comparing groups:', groups);
  
  const formatCurrency = (val: number, curr: string = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(val);
  
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  // Helper to convert Decimal to number
  const toNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(String(val)) || 0;
  };
  
  // Helper to compute duration in months from dates
  const computeDurationMonths = (startDate: Date | null, endDate: Date | null): number => {
    if (!startDate || !endDate) return 0;
    const diffMs = endDate.getTime() - startDate.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30)));
  };
  
  const result: GroupComparisonResult = {
    groups: [],
    categoryBreakdown: {},
    rateComparison: [],
    insights: [],
    recommendation: '',
  };
  
  // Fetch contracts for each group
  for (const group of groups) {
    const whereClause: any = { tenantId };
    
    // Build filter based on group criteria
    if (group.supplier) {
      whereClause.supplierName = { contains: group.supplier, mode: 'insensitive' };
    }
    
    if (group.year) {
      const year = parseInt(group.year);
      whereClause.startDate = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }
    
    if (group.category) {
      whereClause.OR = [
        { categoryL1: { contains: group.category, mode: 'insensitive' } },
        { categoryL2: { contains: group.category, mode: 'insensitive' } },
      ];
    }
    
    const contracts = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        totalValue: true,
        annualValue: true,
        startDate: true,
        endDate: true,
        expirationDate: true,
        status: true,
        categoryL1: true,
        categoryL2: true,
        currency: true,
      },
      orderBy: { totalValue: 'desc' },
    });
    
    // Calculate aggregates
    const totalValue = contracts.reduce((sum, c) => sum + toNumber(c.totalValue), 0);
    const avgValue = contracts.length > 0 ? totalValue / contracts.length : 0;
    
    // Calculate average duration
    const durations = contracts.map(c => computeDurationMonths(c.startDate, c.endDate || c.expirationDate));
    const avgDuration = contracts.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / contracts.length
      : 0;
    
    const activeCount = contracts.filter(c => c.status === 'ACTIVE').length;
    const expiringSoonCount = contracts.filter(c => {
      if (!c.expirationDate) return false;
      return c.expirationDate >= now && c.expirationDate <= thirtyDaysLater;
    }).length;
    
    // Build group label
    const label = group.name || [
      group.supplier,
      group.year,
      group.category,
    ].filter(Boolean).join(' ');
    
    result.groups.push({
      label,
      supplier: group.supplier,
      year: group.year,
      category: group.category,
      contractCount: contracts.length,
      totalValue,
      avgValue,
      avgDurationMonths: avgDuration,
      activeCount,
      expiringSoonCount,
      contracts: contracts.slice(0, 10).map(c => ({
        id: c.id,
        title: c.contractTitle || c.supplierName || 'Untitled',
        value: toNumber(c.totalValue),
      })),
    });
    
    // Build category breakdown
    for (const contract of contracts) {
      const cat = contract.categoryL1 || 'Uncategorized';
      if (!result.categoryBreakdown![cat]) {
        result.categoryBreakdown![cat] = groups.map(() => ({ count: 0, value: 0 }));
      }
      const groupIndex = result.groups.length - 1;
      if (result.categoryBreakdown![cat][groupIndex]) {
        result.categoryBreakdown![cat][groupIndex].count++;
        result.categoryBreakdown![cat][groupIndex].value += toNumber(contract.totalValue);
      }
    }
  }
  
  // Fetch rates for comparison
  if (result.groups.length >= 2) {
    const roleRates: Record<string, number[]> = {};
    
    for (let i = 0; i < result.groups.length; i++) {
      const group = result.groups[i];
      if (!group) continue;
      const contractIds = group.contracts.map(c => c.id);
      
      if (contractIds.length > 0) {
        const rates = await prisma.rateCardEntry.findMany({
          where: {
            contractId: { in: contractIds },
          },
          select: {
            roleStandardized: true,
            dailyRateUSD: true,
          },
        });
        
        // Aggregate rates by role
        const roleAvgRates: Record<string, { sum: number; count: number }> = {};
        for (const rate of rates) {
          const role = rate.roleStandardized.toLowerCase();
          if (!roleAvgRates[role]) {
            roleAvgRates[role] = { sum: 0, count: 0 };
          }
          roleAvgRates[role].sum += toNumber(rate.dailyRateUSD);
          roleAvgRates[role].count++;
        }
        
        // Store average rates for this group
        for (const [role, data] of Object.entries(roleAvgRates)) {
          if (!roleRates[role]) {
            roleRates[role] = groups.map(() => 0);
          }
          roleRates[role][i] = data.sum / data.count;
        }
      }
    }
    
    // Convert to array format
    result.rateComparison = Object.entries(roleRates)
      .filter(([, rates]) => rates.some(r => r > 0))
      .map(([role, rates]) => ({
        role: role.charAt(0).toUpperCase() + role.slice(1),
        rates,
      }))
      .sort((a, b) => (b.rates[0] ?? 0) - (a.rates[0] ?? 0));
  }
  
  // Generate insights
  if (result.groups.length >= 2) {
    const g1 = result.groups[0]!;
    const g2 = result.groups[1]!;
    
    // Contract count insight
    if (g1.contractCount !== g2.contractCount) {
      const diff = Math.abs(g1.contractCount - g2.contractCount);
      const higher = g1.contractCount > g2.contractCount ? g1 : g2;
      result.insights.push(`${higher.label} has ${diff} more contracts`);
    }
    
    // Total value insight
    if (g1.totalValue !== g2.totalValue) {
      const diff = Math.abs(g1.totalValue - g2.totalValue);
      const higher = g1.totalValue > g2.totalValue ? g1 : g2;
      const pctDiff = g2.totalValue > 0 ? Math.round((diff / g2.totalValue) * 100) : 0;
      result.insights.push(`${higher.label} represents ${formatCurrency(diff)} (${pctDiff}%) more in total value`);
    }
    
    // Average value insight
    if (g1.avgValue !== g2.avgValue && g1.contractCount > 0 && g2.contractCount > 0) {
      const diff = Math.abs(g1.avgValue - g2.avgValue);
      const higher = g1.avgValue > g2.avgValue ? g1 : g2;
      result.insights.push(`${higher.label} has ${formatCurrency(diff)} higher average contract value`);
    }
    
    // Duration insight
    if (Math.abs(g1.avgDurationMonths - g2.avgDurationMonths) > 3) {
      const longer = g1.avgDurationMonths > g2.avgDurationMonths ? g1 : g2;
      result.insights.push(`${longer.label} contracts average ${Math.abs(g1.avgDurationMonths - g2.avgDurationMonths).toFixed(1)} months longer duration`);
    }
    
    // Expiring soon warning
    if (g1.expiringSoonCount > 0 || g2.expiringSoonCount > 0) {
      result.insights.push(`⚠️ ${g1.expiringSoonCount + g2.expiringSoonCount} contracts expiring in the next 30 days`);
    }
    
    // Rate comparison insights
    if (result.rateComparison && result.rateComparison.length > 0) {
      const avgRateDiffs = result.rateComparison
        .filter(r => (r.rates[0] ?? 0) > 0 && (r.rates[1] ?? 0) > 0)
        .map(r => (((r.rates[0] ?? 0) - (r.rates[1] ?? 1)) / (r.rates[1] ?? 1)) * 100);
      
      if (avgRateDiffs.length > 0) {
        const avgDiff = avgRateDiffs.reduce((a, b) => a + b, 0) / avgRateDiffs.length;
        if (Math.abs(avgDiff) > 5) {
          const cheaper = avgDiff > 0 ? g2 : g1;
          result.insights.push(`💰 ${cheaper.label} averages ${Math.abs(avgDiff).toFixed(1)}% lower rates across comparable roles`);
        }
      }
    }
  }
  
  // Generate recommendation
  if (result.groups.length === 0 || result.groups.every(g => g.contractCount === 0)) {
    result.recommendation = 'No contracts found matching the specified criteria. Try broader search terms or verify supplier names.';
  } else if (result.groups.length >= 2) {
    const g1 = result.groups[0]!;
    const g2 = result.groups[1]!;
    
    const recommendations: string[] = [];
    
    // Value-based recommendation
    if (g1.totalValue > g2.totalValue * 1.5) {
      recommendations.push(`Consider negotiating volume discounts with ${g1.label} given the larger portfolio`);
    } else if (g2.totalValue > g1.totalValue * 1.5) {
      recommendations.push(`Consider negotiating volume discounts with ${g2.label} given the larger portfolio`);
    }
    
    // Rate-based recommendation
    if (result.rateComparison && result.rateComparison.length > 0) {
      const roleDiffs = result.rateComparison
        .filter(r => (r.rates[0] ?? 0) > 0 && (r.rates[1] ?? 0) > 0)
        .map(r => ({ role: r.role, diff: (((r.rates[0] ?? 0) - (r.rates[1] ?? 1)) / (r.rates[1] ?? 1)) * 100 }));
      
      const significantDiffs = roleDiffs.filter(r => Math.abs(r.diff) > 10);
      if (significantDiffs.length > 0) {
        recommendations.push(`Review rate differences for ${significantDiffs.slice(0, 3).map(r => r.role).join(', ')} - potential for rate optimization`);
      }
    }
    
    // Expiration warning
    if (g1.expiringSoonCount > 0 || g2.expiringSoonCount > 0) {
      recommendations.push('Prioritize renewal discussions for contracts expiring soon');
    }
    
    result.recommendation = recommendations.length > 0
      ? recommendations.join('. ') + '.'
      : 'Both groups show comparable metrics. Continue monitoring and evaluate consolidation opportunities.';
  } else {
    result.recommendation = `Found ${result.groups[0]?.contractCount || 0} contracts for ${result.groups[0]?.label || 'unknown'}. Add another group to enable comparison.`;
  }
  
  return result;
}

// ============================================
// TAXONOMY/CATEGORY QUERY FUNCTIONS
// ============================================

// Get all taxonomy categories with hierarchy
async function getTaxonomyCategories(tenantId: string) {
  try {
    const categories = await prisma.taxonomyCategory.findMany({
      where: { tenantId },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
      },
    });

    // Get top-level categories (L1)
    const topLevel = categories.filter(c => !c.parentId);
    
    // Build hierarchical structure
    const hierarchy = topLevel.map(parent => ({
      id: parent.id,
      name: parent.name,
      path: parent.path,
      description: parent.description,
      level: parent.level,
      children: categories
        .filter(c => c.parentId === parent.id)
        .map(child => ({
          id: child.id,
          name: child.name,
          path: child.path,
          description: child.description,
          children: categories
            .filter(c => c.parentId === child.id)
            .map(grandchild => ({
              id: grandchild.id,
              name: grandchild.name,
              path: grandchild.path,
            })),
        })),
    }));

    // Calculate totals
    const totalCategories = categories.length;
    const totalL1 = topLevel.length;
    const totalL2 = categories.filter(c => c.level === 2).length;
    const totalL3 = categories.filter(c => c.level === 3).length;

    return {
      hierarchy,
      categories,
      stats: {
        totalCategories,
        totalL1,
        totalL2,
        totalL3,
      },
    };
  } catch (e) {
    console.error('[AI Chat] Error getting taxonomy categories:', e);
    return { hierarchy: [], categories: [], stats: { totalCategories: 0, totalL1: 0, totalL2: 0, totalL3: 0, totalContracts: 0 } };
  }
}

// Get category details with contracts
async function getCategoryDetails(categoryName: string, tenantId: string) {
  try {
    // Find category by name (fuzzy match)
    const category = await prisma.taxonomyCategory.findFirst({
      where: {
        tenantId,
        name: { contains: categoryName, mode: 'insensitive' },
      },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          select: { id: true, name: true, path: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!category) {
      return null;
    }

    return {
      id: category.id,
      name: category.name,
      path: category.path,
      description: category.description,
      level: category.level,
      parentId: category.parentId,
      children: category.children,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting category details:', e);
    return null;
  }
}

// Suggest category for a contract based on title/description
async function suggestCategoryForContract(contractName: string, tenantId: string) {
  try {
    // Find the contract
    const contract = await prisma.contract.findFirst({
      where: {
        tenantId,
        OR: [
          { contractTitle: { contains: contractName, mode: 'insensitive' } },
          { supplierName: { contains: contractName, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        categoryL1: true,
        categoryL2: true,
        procurementCategoryId: true,
      },
    });

    // Get all categories for suggestion
    const categories = await prisma.taxonomyCategory.findMany({
      where: { tenantId, level: { lte: 2 } },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        path: true,
        level: true,
        keywords: true,
      },
    });

    // Simple keyword matching for suggestions
    const contractText = (contract?.contractTitle || contractName).toLowerCase();
    const suggestions = categories
      .filter(cat => {
        const keywords = cat.keywords || [];
        return keywords.some(kw => contractText.includes(kw.toLowerCase())) ||
          contractText.includes(cat.name.toLowerCase());
      })
      .slice(0, 5);

    return {
      contract,
      currentCategory: contract?.procurementCategoryId ? { id: contract.procurementCategoryId, name: contract.categoryL1 || 'Uncategorized' } : null,
      suggestions: suggestions.length > 0 ? suggestions : categories.slice(0, 5),
      allCategories: categories,
    };
  } catch (e) {
    console.error('[AI Chat] Error suggesting category:', e);
    return { contract: null, currentCategory: null, suggestions: [], allCategories: [] };
  }
}

// Get contracts in a specific category
async function getContractsInCategory(categoryName: string, tenantId: string) {
  try {
    // Find category
    const category = await prisma.taxonomyCategory.findFirst({
      where: {
        tenantId,
        name: { contains: categoryName, mode: 'insensitive' },
      },
    });

    if (!category) {
      return null;
    }

    // Get contracts in this category using procurementCategoryId
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        procurementCategoryId: category.id,
      },
      orderBy: { totalValue: 'desc' },
      take: 20,
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        totalValue: true,
        status: true,
        expirationDate: true,
      },
    });

    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);

    return {
      category: {
        id: category.id,
        name: category.name,
        path: category.path,
      },
      contracts,
      totalContracts: contracts.length,
      totalValue,
    };
  } catch (e) {
    console.error('[AI Chat] Error getting contracts in category:', e);
    return null;
  }
}

// ============================================
// CONTRACT HIERARCHY & LINKING FUNCTIONS
// ============================================

// Find master agreements for a supplier
async function findMasterAgreements(supplierName: string, tenantId: string, year?: string) {
  try {
    const where: any = {
      tenantId,
      supplierName: { contains: supplierName, mode: 'insensitive' },
      contractType: { in: ['MSA', 'MASTER', 'MASTER_AGREEMENT', 'MASTER SERVICE AGREEMENT'] },
      status: { notIn: ['EXPIRED', 'CANCELLED', 'ARCHIVED'] },
    };
    
    // If year specified, filter by effective date
    if (year) {
      const startOfYear = new Date(`${year}-01-01`);
      const endOfYear = new Date(`${year}-12-31`);
      where.effectiveDate = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        childContracts: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            status: true,
            relationshipType: true,
          },
        },
      },
      orderBy: { effectiveDate: 'desc' },
      take: 10,
    });
    
    console.log(`[AI Chat] Found ${contracts.length} master agreements for ${supplierName}`);
    return contracts;
  } catch (e) {
    console.error('[AI Chat] Error finding master agreements:', e);
    return [];
  }
}

// Get contract hierarchy (parent and children)
async function getContractHierarchy(contractId: string, tenantId: string) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        parentContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            supplierName: true,
            status: true,
            effectiveDate: true,
            expirationDate: true,
          },
        },
        childContracts: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            relationshipType: true,
            status: true,
            effectiveDate: true,
            totalValue: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    
    return contract;
  } catch (e) {
    console.error('[AI Chat] Error getting contract hierarchy:', e);
    return null;
  }
}

// Find all contracts linked to a master agreement
async function getChildContracts(parentContractId: string, tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        parentContractId,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`[AI Chat] Found ${contracts.length} child contracts for parent ${parentContractId}`);
    return contracts;
  } catch (e) {
    console.error('[AI Chat] Error getting child contracts:', e);
    return [];
  }
}

// Create a draft contract linked to a parent
async function createLinkedContractDraft(
  tenantId: string,
  supplierName: string,
  contractType: string,
  parentContractId?: string,
  relationshipType?: string
) {
  try {
    // This creates a draft contract entry that can be filled in
    const contract = await prisma.contract.create({
      data: {
        tenantId,
        supplierName,
        contractType,
        contractTitle: `New ${contractType} - ${supplierName}`,
        status: 'DRAFT',
        fileName: `draft-${contractType.toLowerCase()}-${Date.now()}.pdf`,
        fileSize: 0,
        mimeType: 'application/pdf',
        parentContractId,
        relationshipType: relationshipType || `${contractType}_UNDER_MSA`,
        linkedAt: new Date(),
      },
      include: {
        parentContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            supplierName: true,
          },
        },
      },
    });
    
    console.log(`[AI Chat] Created draft ${contractType} linked to parent ${parentContractId}`);
    return contract;
  } catch (e) {
    console.error('[AI Chat] Error creating linked contract draft:', e);
    return null;
  }
}

// Find suitable parent contract for linking
async function findSuitableParent(
  supplierName: string,
  tenantId: string,
  year?: string
) {
  const masterAgreements = await findMasterAgreements(supplierName, tenantId, year);
  
  if (masterAgreements.length === 0) {
    // Try to find any active contract with this supplier that could be a parent
    const activeContracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: supplierName, mode: 'insensitive' },
        status: 'ACTIVE',
        parentContractId: null, // Only top-level contracts
      },
      orderBy: { effectiveDate: 'desc' },
      take: 5,
    });
    return activeContracts;
  }
  
  return masterAgreements;
}

// Find available renewal workflows
async function findRenewalWorkflows(tenantId: string) {
  try {
    const workflows = await prisma.workflow.findMany({
      where: {
        tenantId,
        isActive: true,
        type: { in: ['RENEWAL', 'APPROVAL'] },
      },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
      take: 3,
    });
    return workflows;
  } catch (e) {
    console.error('Error finding workflows:', e);
    return [];
  }
}

// Start a workflow execution
async function startWorkflowExecution(
  workflowId: string,
  contractId: string,
  tenantId: string,
  userId: string
) {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!workflow) return null;

    const execution = await prisma.workflowExecution.create({
      data: {
        tenantId,
        workflowId,
        contractId,
        status: 'PENDING',
        currentStep: '1',
        startedBy: userId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        stepExecutions: {
          create: workflow.steps.map(step => ({
            stepId: step.id,
            stepName: step.name,
            stepOrder: step.order,
            status: step.order === 0 ? 'PENDING' : 'WAITING',
            assignedTo: step.assignedUser || step.assignedRole,
          })),
        },
      },
      include: {
        stepExecutions: true,
        workflow: true,
        contract: true,
      },
    });

    return execution;
  } catch (e) {
    console.error('Error starting workflow:', e);
    return null;
  }
}

// Fetch contract details directly from database when contractId is provided
// ENHANCED: Now includes ALL artifact types for comprehensive AI context
async function getContractContext(contractId: string): Promise<string> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        artifacts: {
          select: {
            type: true,
            data: true,
            updatedAt: true,
          },
          // Get ALL artifacts, not just 5
        },
      },
    });

    if (!contract) return '';

    let context = `\n\n**Current Contract Details:**\n`;
    context += `• Name: ${contract.contractTitle || contract.fileName}\n`;
    context += `• Status: ${contract.status}\n`;
    context += `• Vendor: ${contract.supplierName || 'Not specified'}\n`;
    context += `• Type: ${contract.category || contract.contractType || 'Not specified'}\n`;
    
    if (contract.startDate) context += `• Start Date: ${contract.startDate.toLocaleDateString()}\n`;
    if (contract.endDate) context += `• End Date: ${contract.endDate.toLocaleDateString()}\n`;
    if (contract.totalValue) context += `• Value: $${Number(contract.totalValue).toLocaleString()}\n`;

    // Comprehensive artifact context builder
    if (contract.artifacts && contract.artifacts.length > 0) {
      context += `\n**Extracted Contract Intelligence (${contract.artifacts.length} artifacts):**\n`;
      
      for (const artifact of contract.artifacts) {
        try {
          const data = typeof artifact.data === 'string' 
            ? JSON.parse(artifact.data) 
            : artifact.data;
          
          if (!data) continue;
          
          switch (artifact.type) {
            case 'OVERVIEW':
              context += `\n### Contract Overview\n`;
              if (data.summary) context += `**Summary:** ${String(data.summary).slice(0, 800)}\n`;
              if (data.keyTerms?.length) context += `**Key Terms:** ${data.keyTerms.slice(0, 10).join(', ')}\n`;
              if (data.parties?.length) context += `**Parties:** ${data.parties.map((p: any) => p.name || p).join(', ')}\n`;
              if (data.effectiveDate) context += `**Effective Date:** ${data.effectiveDate}\n`;
              if (data.expirationDate) context += `**Expiration Date:** ${data.expirationDate}\n`;
              if (data.contractValue) context += `**Contract Value:** ${data.contractValue}\n`;
              if (data.governingLaw) context += `**Governing Law:** ${data.governingLaw}\n`;
              if (data.additionalFindings?.length) {
                context += `**Additional Findings:** ${data.additionalFindings.map((f: any) => `${f.field}: ${f.value}`).join('; ')}\n`;
              }
              if (data.openEndedNotes) context += `**Notes:** ${data.openEndedNotes}\n`;
              break;
              
            case 'CLAUSES':
              context += `\n### Key Clauses (${data.clauses?.length || 0} found)\n`;
              if (data.clauses?.length) {
                data.clauses.slice(0, 15).forEach((clause: any, i: number) => {
                  context += `${i + 1}. **${clause.title || clause.name}** (${clause.importance || 'medium'} priority)\n`;
                  if (clause.content) context += `   ${String(clause.content).slice(0, 200)}\n`;
                  if (clause.risks?.length) context += `   ⚠️ Risks: ${clause.risks.join(', ')}\n`;
                });
              }
              if (data.missingClauses?.length) context += `**Missing Clauses:** ${data.missingClauses.join(', ')}\n`;
              if (data.unusualClauses?.length) context += `**Unusual Clauses:** ${data.unusualClauses.join(', ')}\n`;
              if (data.additionalFindings?.length) {
                context += `**Additional Clause Findings:** ${data.additionalFindings.map((f: any) => f.value).join('; ')}\n`;
              }
              break;
              
            case 'FINANCIAL':
              context += `\n### Financial Terms\n`;
              if (data.totalValue) context += `**Total Value:** ${data.currency || 'USD'} ${Number(data.totalValue).toLocaleString()}\n`;
              if (data.paymentTerms) context += `**Payment Terms:** ${data.paymentTerms}\n`;
              if (data.rateCards?.length) {
                context += `**Rate Cards (${data.rateCards.length}):**\n`;
                data.rateCards.slice(0, 10).forEach((rate: any) => {
                  context += `  • ${rate.role}: ${rate.currency || 'USD'} ${rate.rate}/${rate.unit || 'hour'}\n`;
                });
              }
              if (data.penalties?.length) {
                context += `**Penalties:** ${data.penalties.map((p: any) => p.description || p.type).join('; ')}\n`;
              }
              if (data.discounts?.length) {
                context += `**Discounts:** ${data.discounts.map((d: any) => `${d.value}${d.unit === 'percentage' ? '%' : ''} ${d.description || d.type}`).join('; ')}\n`;
              }
              if (data.additionalFindings?.length) {
                context += `**Additional Financial Info:** ${data.additionalFindings.map((f: any) => `${f.field}: ${f.value}`).join('; ')}\n`;
              }
              break;
              
            case 'RISK':
              context += `\n### Risk Assessment\n`;
              context += `**Overall Risk:** ${data.overallRisk || data.riskLevel || 'Unknown'} (Score: ${data.riskScore || data.overallScore || 'N/A'}/100)\n`;
              if (data.risks?.length || data.riskFactors?.length) {
                const risks = data.risks || data.riskFactors || [];
                context += `**Risk Factors (${risks.length}):**\n`;
                risks.slice(0, 8).forEach((risk: any) => {
                  context += `  • [${risk.level || risk.severity || 'medium'}] ${risk.title || risk.category}: ${String(risk.description).slice(0, 150)}\n`;
                  if (risk.mitigation) context += `    → Mitigation: ${String(risk.mitigation).slice(0, 100)}\n`;
                });
              }
              if (data.redFlags?.length) context += `**Red Flags:** ${data.redFlags.join('; ')}\n`;
              if (data.missingProtections?.length) context += `**Missing Protections:** ${data.missingProtections.join('; ')}\n`;
              break;
              
            case 'COMPLIANCE':
              context += `\n### Compliance Status\n`;
              context += `**Compliance Score:** ${data.complianceScore || data.score || 'N/A'}%\n`;
              if (data.checks?.length) {
                context += `**Compliance Checks:**\n`;
                data.checks.slice(0, 10).forEach((check: any) => {
                  const icon = check.status === 'compliant' ? '✅' : check.status === 'non-compliant' ? '❌' : '⚠️';
                  context += `  ${icon} ${check.regulation}: ${check.status}\n`;
                });
              }
              if (data.issues?.length) {
                context += `**Issues:** ${data.issues.map((i: any) => `[${i.severity}] ${i.description}`).join('; ')}\n`;
              }
              break;
              
            case 'OBLIGATIONS':
              context += `\n### Obligations & Milestones\n`;
              if (data.obligations?.length) {
                context += `**Obligations (${data.obligations.length}):**\n`;
                data.obligations.slice(0, 10).forEach((ob: any) => {
                  context += `  • ${ob.party}: ${ob.obligation || ob.title} (${ob.type || 'general'})`;
                  if (ob.dueDate) context += ` - Due: ${ob.dueDate}`;
                  context += `\n`;
                });
              }
              if (data.milestones?.length) {
                context += `**Milestones (${data.milestones.length}):**\n`;
                data.milestones.slice(0, 8).forEach((m: any) => {
                  context += `  • ${m.name}: ${m.dueDate || m.date || 'No date'}\n`;
                });
              }
              if (data.keyDeadlines?.length) context += `**Key Deadlines:** ${data.keyDeadlines.join(', ')}\n`;
              break;
              
            case 'RENEWAL':
              context += `\n### Renewal & Termination\n`;
              context += `**Auto-Renewal:** ${data.autoRenewal ? 'Yes' : 'No'}\n`;
              if (data.renewalTerms) context += `**Renewal Terms:** ${typeof data.renewalTerms === 'string' ? data.renewalTerms : data.renewalTerms.renewalPeriod || JSON.stringify(data.renewalTerms)}\n`;
              if (data.expirationDate) context += `**Expiration Date:** ${data.expirationDate}\n`;
              if (data.noticeRequirements?.noticePeriod) context += `**Notice Required:** ${data.noticeRequirements.noticePeriod}\n`;
              if (data.terminationRights) {
                context += `**Termination Rights:** For cause: ${data.terminationRights.forCause || 'Yes'}; For convenience: ${data.terminationRights.forConvenience || 'Check contract'}\n`;
              }
              if (data.earlyTerminationFees) context += `**Early Termination Fees:** ${data.earlyTerminationFees}\n`;
              break;
              
            case 'NEGOTIATION':
              context += `\n### Negotiation Analysis\n`;
              context += `**Favorability Score:** ${data.favorabilityScore || 'N/A'}/100\n`;
              if (data.favorabilityAssessment) context += `**Assessment:** ${data.favorabilityAssessment}\n`;
              if (data.negotiationPoints?.length) {
                context += `**Points to Negotiate (${data.negotiationPoints.length}):**\n`;
                data.negotiationPoints.slice(0, 5).forEach((np: any) => {
                  context += `  • [${np.priority}] ${np.clause}: ${np.concern}\n`;
                  if (np.suggestedChange) context += `    → Suggest: ${String(np.suggestedChange).slice(0, 100)}\n`;
                });
              }
              if (data.strongPoints?.length) context += `**Strong Points:** ${data.strongPoints.slice(0, 5).join('; ')}\n`;
              if (data.imbalances?.length) context += `**Imbalances:** ${data.imbalances.slice(0, 5).join('; ')}\n`;
              break;
              
            case 'AMENDMENTS':
              context += `\n### Amendments History\n`;
              if (data.amendments?.length) {
                context += `**Amendments (${data.amendments.length}):**\n`;
                data.amendments.forEach((a: any) => {
                  context += `  • ${a.number || a.title}: ${a.summary || 'See details'} (${a.date || 'No date'})\n`;
                });
              } else {
                context += `No amendments recorded.\n`;
              }
              break;
              
            case 'CONTACTS':
              context += `\n### Key Contacts\n`;
              if (data.contacts?.length) {
                data.contacts.slice(0, 8).forEach((c: any) => {
                  context += `  • ${c.name} (${c.role || c.partyType}): ${c.email || c.phone || 'No contact info'}\n`;
                });
              }
              if (data.signatories?.length) {
                context += `**Signatories:** ${data.signatories.map((s: any) => `${s.name} (${s.title})`).join(', ')}\n`;
              }
              break;
              
            default:
              // Handle any other artifact types dynamically
              context += `\n### ${artifact.type}\n`;
              context += `Data available: ${Object.keys(data).slice(0, 10).join(', ')}\n`;
          }
          
        } catch (e) {
          // Skip if can't parse artifact
          console.warn(`Could not parse artifact ${artifact.type}:`, e);
        }
      }
    }

    // Add last updated timestamp
    const latestArtifact = contract.artifacts?.reduce((latest: any, a: any) => 
      !latest || (a.updatedAt && a.updatedAt > latest.updatedAt) ? a : latest, null);
    if (latestArtifact?.updatedAt) {
      context += `\n---\n*Artifacts last updated: ${latestArtifact.updatedAt.toLocaleString()}*\n`;
    }

    return context;
  } catch (error) {
    console.error('Error fetching contract context:', error);
    return '';
  }
}

// Mock AI responses based on context
const mockAIResponses: Record<string, (query: string, context: any) => any> = {
  // ============================================
  // PROCUREMENT AGENT RESPONSES
  // ============================================
  
  'list-by-supplier': (query, context) => {
    const { contracts, supplierName } = context;
    
    if (!contracts || contracts.length === 0) {
      return {
        response: `I couldn't find any contracts with supplier "${supplierName}".

Would you like me to:
1. Search with a different supplier name
2. Show you a list of all suppliers we work with
3. Create a new contract with this supplier`,
        sources: ['Contract Database'],
        suggestedActions: [
          { label: '📋 List All Suppliers', action: 'list-suppliers' },
          { label: '📝 Create New Contract', action: 'create-contract' },
        ],
        suggestions: [
          'Show me all suppliers',
          'Create a new contract',
        ],
      };
    }

    const contractList = contracts.map((c: any, i: number) => {
      const expiry = c.expirationDate ? new Date(c.expirationDate) : null;
      const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
      const urgency = daysLeft !== null && daysLeft <= 30 ? '🔴' : daysLeft !== null && daysLeft <= 90 ? '🟡' : '🟢';
      const value = c.value ? `$${Number(c.value).toLocaleString()}` : 'N/A';
      const expiryText = expiry ? `${expiry.toLocaleDateString()} (${daysLeft} days)` : 'No expiry';
      
      return `${i + 1}. ${urgency} [📄 ${c.contractTitle || c.name}](/contracts/${c.id})
   • Status: ${c.status} | Value: ${value}
   • Expires: ${expiryText}`;
    }).join('\n\n');

    const expiringCount = contracts.filter((c: any) => {
      if (!c.expirationDate) return false;
      const expiry = new Date(c.expirationDate);
      const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 90 && daysLeft > 0;
    }).length;

    return {
      response: `📦 **Contracts with ${supplierName}**

Found **${contracts.length} contract(s)** with this supplier:

${contractList}

---
**Summary:** ${expiringCount} contract(s) expiring in the next 90 days.

Would you like me to start a renewal for any of these?`,
      sources: contracts.map((c: any) => `Contract: ${c.contractTitle || c.name}`),
      suggestedActions: contracts.slice(0, 3).map((c: any) => ({
        label: `🔄 Renew: ${(c.contractTitle || c.name).slice(0, 25)}...`,
        action: `start-renewal:${c.id}`,
      })),
      suggestions: [
        `What is the total value of ${supplierName} contracts?`,
        `Which ${supplierName} contracts are expiring soon?`,
        'Create a new contract with this supplier',
      ],
    };
  },

  'list-expiring': (query, context) => {
    const { contracts, daysUntilExpiry, supplierName } = context;
    
    if (!contracts || contracts.length === 0) {
      const supplierText = supplierName ? ` with ${supplierName}` : '';
      return {
        response: `✅ Good news! No contracts${supplierText} are expiring in the next ${daysUntilExpiry} days.

Your procurement portfolio is in good shape for now!`,
        sources: ['Contract Database', 'Expiration Tracker'],
        suggestedActions: [
          { label: '📊 View All Contracts', action: 'view-all-contracts' },
          { label: '📅 Set Renewal Reminders', action: 'set-reminders' },
        ],
        suggestions: [
          'Show me contracts expiring in 90 days',
          'What is my contract portfolio overview?',
        ],
      };
    }

    const totalValue = contracts.reduce((sum: number, c: any) => sum + (Number(c.value) || 0), 0);
    
    const contractList = contracts.map((c: any, i: number) => {
      const expiry = c.expirationDate ? new Date(c.expirationDate) : null;
      const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
      const urgency = daysLeft !== null && daysLeft <= 7 ? '🔴 CRITICAL' : daysLeft !== null && daysLeft <= 30 ? '🟠 URGENT' : '🟡 UPCOMING';
      const value = c.value ? `$${Number(c.value).toLocaleString()}` : 'N/A';
      
      return `${i + 1}. ${urgency}
   [📄 ${c.contractTitle || c.name}](/contracts/${c.id})
   • Supplier: ${c.supplierName || 'N/A'} | Value: ${value}
   • Expires: ${expiry?.toLocaleDateString()} (${daysLeft} days left)`;
    }).join('\n\n');

    const supplierText = supplierName ? ` with ${supplierName}` : '';

    return {
      response: `⏰ **Contracts Expiring in ${daysUntilExpiry} Days${supplierText}**

Found **${contracts.length} contract(s)** requiring renewal action:

${contractList}

---
**💰 Total Value at Risk: $${totalValue.toLocaleString()}**

I recommend starting the renewal process for critical contracts immediately.`,
      sources: ['Contract Database', 'Expiration Tracker'],
      suggestedActions: [
        { label: '🚀 Start Bulk Renewal', action: 'bulk-renewal' },
        { label: '📧 Send Renewal Reminders', action: 'send-reminders' },
        { label: '📊 Export to Report', action: 'export-report' },
      ],
      suggestions: [
        'Start renewal for the most urgent contract',
        'Send reminders to all contract owners',
        'What is the standard renewal process?',
      ],
    };
  },

  'list-by-status': (query, context) => {
    const { contracts, status } = context;
    
    if (!contracts || contracts.length === 0) {
      return {
        response: `No ${status.toLowerCase()} contracts found.`,
        sources: ['Contract Database'],
        suggestedActions: [
          { label: '📋 View All Contracts', action: 'view-all-contracts' },
        ],
        suggestions: ['Show me active contracts', 'Show me all contracts'],
      };
    }

    const contractList = contracts.slice(0, 10).map((c: any, i: number) => {
      const value = c.value ? `$${Number(c.value).toLocaleString()}` : 'N/A';
      return `${i + 1}. [📄 ${c.contractTitle || c.name}](/contracts/${c.id})
   • Supplier: ${c.supplierName || 'N/A'} | Value: ${value}`;
    }).join('\n\n');

    return {
      response: `📋 **${status} Contracts**

Found **${contracts.length}** contracts with status "${status}":

${contractList}
${contracts.length > 10 ? `\n... and ${contracts.length - 10} more` : ''}`,
      sources: ['Contract Database'],
      suggestedActions: [
        { label: '📊 Export List', action: 'export-list' },
        { label: '🔍 Filter Further', action: 'filter-contracts' },
      ],
      suggestions: [
        'Show me contracts expiring soon',
        'Which contracts need approval?',
      ],
    };
  },

  'contract-count': (query, context) => {
    const { counts } = context;
    const supplierText = counts.supplierName ? ` with ${counts.supplierName}` : '';

    return {
      response: `📊 **Contract Statistics${supplierText}**

| Metric | Count |
|--------|-------|
| **Total Contracts** | ${counts.total} |
| **Active Contracts** | ${counts.active} |
| **Expiring in 30 Days** | ${counts.expiring} |

${counts.expiring > 0 ? `⚠️ You have ${counts.expiring} contract(s) expiring soon that need attention!` : '✅ No contracts expiring in the next 30 days.'}`,
      sources: ['Contract Analytics'],
      suggestedActions: counts.expiring > 0 ? [
        { label: '📅 View Expiring Contracts', action: 'view-expiring' },
        { label: '🚀 Start Renewals', action: 'bulk-renewal' },
      ] : [
        { label: '📋 View All Contracts', action: 'view-all-contracts' },
      ],
      suggestions: [
        'Show me contracts expiring in 90 days',
        'What is the total contract value?',
        'List all suppliers',
      ],
    };
  },

  'supplier-summary': (query, context) => {
    const { summary } = context;
    
    if (!summary) {
      return {
        response: `I couldn't find information about this supplier.`,
        sources: ['Contract Database'],
        suggestedActions: [
          { label: '🔍 Search Suppliers', action: 'search-suppliers' },
        ],
        suggestions: ['List all suppliers', 'Search for a different supplier'],
      };
    }

    const statusBreakdown = Object.entries(summary.statusBreakdown)
      .map(([status, count]) => `• ${status}: ${count}`)
      .join('\n');

    return {
      response: `📦 **Supplier Summary: ${summary.supplierName}**

**Portfolio Overview:**
• Total Contracts: ${summary.totalContracts}
• Total Value: $${summary.totalValue.toLocaleString()}
• Expiring in 90 Days: ${summary.expiringIn90Days}

**Contract Status Breakdown:**
${statusBreakdown}

${summary.expiringIn90Days > 0 ? `⚠️ **Action Required:** ${summary.expiringIn90Days} contract(s) need renewal attention.` : '✅ All contracts are in good standing.'}`,
      sources: [`Supplier: ${summary.supplierName}`, 'Contract Analytics'],
      suggestedActions: summary.expiringIn90Days > 0 ? [
        { label: '📅 View Expiring', action: `list-expiring:${summary.supplierName}` },
        { label: '🚀 Start Renewals', action: 'bulk-renewal' },
      ] : [
        { label: '📋 View All Contracts', action: `list-supplier:${summary.supplierName}` },
        { label: '📝 Create New Contract', action: 'create-contract' },
      ],
      suggestions: [
        `Show contracts with ${summary.supplierName}`,
        `Which ${summary.supplierName} contracts are expiring?`,
        'Compare with other suppliers',
      ],
    };
  },

  // ============================================
  // ADVANCED PROCUREMENT RESPONSES
  // ============================================

  'spend-analysis': (query, context) => {
    const { spendData } = context;
    if (!spendData) {
      return {
        response: `📊 **Spend Analysis**\n\nI couldn't retrieve spend data at this time. Please try again or check your contracts.`,
        sources: [],
        suggestedActions: [{ label: '📋 View Contracts', action: 'list-contracts' }],
        suggestions: ['Show all contracts', 'List suppliers'],
      };
    }

    const topSuppliers = spendData.bySupplier.slice(0, 5).map(([name, data]: [string, any], i: number) => 
      `${i + 1}. **${name}**: $${data.value.toLocaleString()} (${data.count} contracts)`
    ).join('\n');

    const categoryBreakdown = spendData.byCategory.slice(0, 5).map(([name, data]: [string, any]) => 
      `• ${name}: $${data.value.toLocaleString()}`
    ).join('\n');

    return {
      response: `💰 **Spend Analysis${spendData.supplierFilter ? ` - ${spendData.supplierFilter}` : ''}**

**Overview:**
• Total Contracts: ${spendData.totalContracts}
• Total Spend: **$${spendData.totalSpend.toLocaleString()}**
• Annual Run Rate: $${spendData.annualSpend.toLocaleString()}

**Top Suppliers by Spend:**
${topSuppliers}

**Spend by Category:**
${categoryBreakdown}

💡 *Tip: Review top suppliers for consolidation opportunities.*`,
      sources: ['Contract Database', 'Spend Analytics'],
      suggestedActions: [
        { label: '📉 Cost Savings', action: 'cost-savings' },
        { label: '📊 Category Breakdown', action: 'category-spend' },
        { label: '🏆 Top Suppliers', action: 'top-suppliers' },
      ],
      suggestions: [
        'Show cost savings opportunities',
        'What are our top 10 suppliers?',
        'Spend by category breakdown',
      ],
    };
  },

  'cost-savings': (query, context) => {
    const { savingsData } = context;
    if (!savingsData || savingsData.count === 0) {
      return {
        response: `💡 **Cost Savings Opportunities**\n\nNo savings opportunities identified yet. Consider:\n• Analyzing rate cards for competitive pricing\n• Reviewing auto-renewal contracts\n• Consolidating supplier relationships`,
        sources: [],
        suggestedActions: [{ label: '📊 Analyze Spend', action: 'spend-analysis' }],
        suggestions: ['Show total spend', 'Compare supplier rates'],
      };
    }

    const opportunityList = savingsData.opportunities.slice(0, 5).map((opp: any, i: number) => 
      `${i + 1}. **${opp.title}**\n   • Potential: $${Number(opp.potentialSavingsAmount).toLocaleString()}\n   • Category: ${opp.category} | Confidence: ${opp.confidence}\n   • Contract: ${opp.contract?.contractTitle || 'N/A'}`
    ).join('\n\n');

    return {
      response: `💡 **Cost Savings Opportunities**

**Summary:**
• Total Opportunities: ${savingsData.count}
• Potential Savings: **$${savingsData.totalPotentialSavings.toLocaleString()}**

**Top Opportunities:**
${opportunityList}

📈 *Implementing these could save significant costs.*`,
      sources: ['Cost Analysis Engine', 'Contract Database'],
      suggestedActions: [
        { label: '✅ Implement Top Saving', action: 'implement-saving:1' },
        { label: '📋 View All Opportunities', action: 'all-savings' },
        { label: '📊 Spend Analysis', action: 'spend-analysis' },
      ],
      suggestions: [
        'How can I implement the top savings?',
        'Show spend by category',
        'Which suppliers are most expensive?',
      ],
    };
  },

  'top-suppliers': (query, context) => {
    const { topSuppliersData } = context;
    if (!topSuppliersData || topSuppliersData.suppliers.length === 0) {
      return {
        response: `🏆 **Top Suppliers**\n\nNo supplier data available. Add contracts to see your supplier breakdown.`,
        sources: [],
        suggestedActions: [],
        suggestions: ['Upload a contract', 'Create a contract'],
      };
    }

    const supplierList = topSuppliersData.suppliers.map((s: any, i: number) => 
      `${i + 1}. **${s.name}**\n   • Total Value: $${s.totalValue.toLocaleString()}\n   • Contracts: ${s.count} (${s.activeCount} active)\n   • Expiring Soon: ${s.expiringCount > 0 ? `⚠️ ${s.expiringCount}` : '✅ None'}`
    ).join('\n\n');

    return {
      response: `🏆 **Top Suppliers by Spend**

You have **${topSuppliersData.totalSuppliers}** suppliers total.

**Top ${topSuppliersData.suppliers.length}:**
${supplierList}

💡 *Consider consolidating smaller suppliers for better terms.*`,
      sources: ['Supplier Analytics', 'Contract Database'],
      suggestedActions: [
        { label: '💰 Spend Analysis', action: 'spend-analysis' },
        { label: '⚠️ Risk Assessment', action: 'risk-assessment' },
        { label: '📝 Negotiate Terms', action: 'negotiate' },
      ],
      suggestions: [
        'Show contracts with top supplier',
        'What are our high-risk contracts?',
        'How can I consolidate suppliers?',
      ],
    };
  },

  'risk-assessment': (query, context) => {
    const { riskData } = context;
    if (!riskData || riskData.contracts.length === 0) {
      return {
        response: `✅ **Risk Assessment**\n\nNo high-risk contracts identified! Your contract portfolio looks healthy.`,
        sources: ['Risk Analysis'],
        suggestedActions: [{ label: '📋 View All Contracts', action: 'list-contracts' }],
        suggestions: ['Show expiring contracts', 'List auto-renewal contracts'],
      };
    }

    const riskList = riskData.contracts.slice(0, 5).map((c: any, i: number) => {
      const riskIcon = c.expirationRisk === 'CRITICAL' ? '🔴' : c.expirationRisk === 'HIGH' ? '🟠' : '🟡';
      return `${i + 1}. ${riskIcon} [📄 ${c.contractTitle}](/contracts/${c.id})\n   • Risk: ${c.expirationRisk || 'HIGH'} | Days Left: ${c.daysUntilExpiry || 'N/A'}\n   • Supplier: ${c.supplierName || 'Unknown'}\n   • Auto-Renew: ${c.autoRenewalEnabled ? '⚠️ Yes' : 'No'}`;
    }).join('\n\n');

    return {
      response: `⚠️ **Risk Assessment**

**Summary:**
• 🔴 Critical: ${riskData.criticalCount} contracts
• 🟠 High Risk: ${riskData.highRiskCount} contracts
• ⚠️ Auto-Renewal: ${riskData.autoRenewalCount} contracts

**Contracts Requiring Attention:**
${riskList}

🚨 *Take action on critical items to avoid auto-renewals or lapses.*`,
      sources: ['Risk Analysis Engine', 'Contract Database'],
      suggestedActions: [
        { label: '🔄 Start Renewal', action: 'start-renewal' },
        { label: '📧 Send Alert', action: 'send-alert' },
        { label: '📅 View Calendar', action: 'expiration-calendar' },
      ],
      suggestions: [
        'Start renewal for critical contracts',
        'Disable auto-renewal on specific contracts',
        'Show me all auto-renewal contracts',
      ],
    };
  },

  'auto-renewals': (query, context) => {
    const { autoRenewalData } = context;
    if (!autoRenewalData || autoRenewalData.contracts.length === 0) {
      return {
        response: `🔄 **Auto-Renewal Contracts**\n\nNo contracts have auto-renewal enabled.`,
        sources: [],
        suggestedActions: [],
        suggestions: ['Show expiring contracts', 'List all contracts'],
      };
    }

    const contractList = autoRenewalData.contracts.slice(0, 8).map((c: any, i: number) => {
      const expiry = c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'N/A';
      const urgent = c.daysUntilExpiry && c.daysUntilExpiry <= 30 ? '⚠️' : '';
      return `${i + 1}. ${urgent} [📄 ${c.contractTitle}](/contracts/${c.id})\n   • Supplier: ${c.supplierName} | Renews: ${expiry}`;
    }).join('\n\n');

    return {
      response: `🔄 **Auto-Renewal Contracts**

**${autoRenewalData.totalAutoRenewal}** contracts have auto-renewal enabled.
**${autoRenewalData.upcomingCount}** renewing in the next 90 days.

${contractList}

⚠️ *Review before renewal dates to avoid unwanted extensions.*`,
      sources: ['Contract Database'],
      suggestedActions: [
        { label: '🛑 Disable Auto-Renewal', action: 'disable-auto-renewal' },
        { label: '📋 Export List', action: 'export-auto-renewals' },
        { label: '📅 Calendar View', action: 'renewal-calendar' },
      ],
      suggestions: [
        'Disable auto-renewal for a specific contract',
        'What contracts are renewing next month?',
        'Show high-value auto-renewal contracts',
      ],
    };
  },

  'category-spend': (query, context) => {
    const { categoryData } = context;
    if (!categoryData || categoryData.byL1Category.length === 0) {
      return {
        response: `📊 **Category Spend**\n\nNo category data available. Categorize your contracts for better insights.`,
        sources: [],
        suggestedActions: [],
        suggestions: ['Show all contracts', 'Upload a contract'],
      };
    }

    const l1List = categoryData.byL1Category.slice(0, 6).map((cat: any, i: number) => 
      `${i + 1}. **${cat.name}**: $${cat.value.toLocaleString()}\n   • ${cat.count} contracts | ${cat.supplierCount} suppliers`
    ).join('\n\n');

    return {
      response: `📊 **Spend by Category**

**${categoryData.totalCategories}** procurement categories.

**Top Categories:**
${l1List}

💡 *Focus on top categories for maximum savings impact.*`,
      sources: ['Category Analytics', 'Contract Database'],
      suggestedActions: [
        { label: '💰 Savings by Category', action: 'savings-by-category' },
        { label: '📊 Drill Down', action: 'category-details' },
        { label: '🏆 Top Suppliers', action: 'top-suppliers' },
      ],
      suggestions: [
        'Show IT spend in detail',
        'Which category has most suppliers?',
        'Compare categories year over year',
      ],
    };
  },

  'payment-terms': (query, context) => {
    const { paymentData } = context;
    if (!paymentData || paymentData.byTerms.length === 0) {
      return {
        response: `💳 **Payment Terms**\n\nNo payment terms data available.`,
        sources: [],
        suggestedActions: [],
        suggestions: ['Show all contracts'],
      };
    }

    const termsList = paymentData.byTerms.slice(0, 5).map((t: any, i: number) => 
      `${i + 1}. **${t.terms}**: ${t.count} contracts ($${t.value.toLocaleString()})`
    ).join('\n');

    return {
      response: `💳 **Payment Terms Analysis**

**${paymentData.totalContracts}** active contracts.

**Breakdown:**
${termsList}

💡 *Extending payment terms (Net60→Net90) can improve cash flow.*`,
      sources: ['Contract Database'],
      suggestedActions: [
        { label: '📊 Cash Flow Impact', action: 'cash-flow' },
        { label: '📝 Renegotiate Terms', action: 'negotiate-terms' },
      ],
      suggestions: [
        'Which suppliers offer Net 90?',
        'Show contracts with early payment discounts',
        'Calculate cash flow impact of term changes',
      ],
    };
  },

  'compliance-status': (query, context) => {
    const { complianceData } = context;
    if (!complianceData || complianceData.contracts.length === 0) {
      return {
        response: `✅ **Compliance Status**\n\nAll contracts are compliant! No issues detected.`,
        sources: ['Compliance Engine'],
        suggestedActions: [{ label: '📋 View All Contracts', action: 'list-contracts' }],
        suggestions: ['Show contract audit trail', 'List contracts by category'],
      };
    }

    const issueList = complianceData.contracts.slice(0, 5).map((c: any, i: number) => {
      const issueIcon = c.complianceScore < 60 ? '🔴' : c.complianceScore < 80 ? '🟠' : '🟡';
      return `${i + 1}. ${issueIcon} [📄 ${c.contractTitle}](/contracts/${c.id})\n   • Score: ${c.complianceScore}% | Issues: ${c.issueCount}\n   • Supplier: ${c.supplierName || 'Unknown'}\n   • Last Audit: ${c.lastAuditDate || 'Never'}`;
    }).join('\n\n');

    return {
      response: `📋 **Compliance Status${complianceData.supplierFilter ? `: ${complianceData.supplierFilter}` : ''}**

**Overview:**
• Total Contracts: ${complianceData.totalContracts}
• Compliant: ✅ ${complianceData.compliantCount} (${Math.round(complianceData.compliantCount / complianceData.totalContracts * 100)}%)
• Issues Found: ⚠️ ${complianceData.issueCount}

**Contracts Requiring Attention:**
${issueList}

📝 *Address compliance gaps to reduce risk.*`,
      sources: ['Compliance Analysis', 'Audit Reports'],
      suggestedActions: [
        { label: '📝 Schedule Audit', action: 'schedule-audit' },
        { label: '📊 Full Report', action: 'compliance-report' },
        { label: '⚠️ View Issues', action: 'compliance-issues' },
      ],
      suggestions: [
        'What are the common compliance issues?',
        'Schedule audits for non-compliant contracts',
        'Show contracts missing required clauses',
      ],
    };
  },

  'supplier-performance': (query, context) => {
    const { performanceData, supplierName } = context;
    if (!performanceData) {
      return {
        response: `📊 **Supplier Performance**\n\nNo performance data available${supplierName ? ` for ${supplierName}` : ''}. Add performance metrics to track supplier quality.`,
        sources: [],
        suggestedActions: [{ label: '📋 View Contracts', action: 'list-contracts' }],
        suggestions: ['Show all suppliers', 'Add performance metrics'],
      };
    }

    const scoreIcon = performanceData.overallScore >= 80 ? '🟢' : performanceData.overallScore >= 60 ? '🟡' : '🔴';
    
    const metrics = [
      { name: 'Delivery', score: performanceData.deliveryScore, icon: performanceData.deliveryScore >= 80 ? '✅' : '⚠️' },
      { name: 'Quality', score: performanceData.qualityScore, icon: performanceData.qualityScore >= 80 ? '✅' : '⚠️' },
      { name: 'Communication', score: performanceData.communicationScore, icon: performanceData.communicationScore >= 80 ? '✅' : '⚠️' },
      { name: 'Value', score: performanceData.valueScore, icon: performanceData.valueScore >= 80 ? '✅' : '⚠️' },
    ].map(m => `• ${m.icon} ${m.name}: ${m.score}%`).join('\n');

    return {
      response: `📊 **Supplier Performance: ${performanceData.supplierName}**

${scoreIcon} **Overall Score: ${performanceData.overallScore}%**

**Metrics Breakdown:**
${metrics}

**Contract Relationship:**
• Active Contracts: ${performanceData.activeContracts}
• Total Value: $${performanceData.totalValue.toLocaleString()}
• Relationship Duration: ${performanceData.relationshipMonths} months

**Recent Activity:**
${performanceData.recentIssues?.length > 0 ? performanceData.recentIssues.map((issue: any) => `• ⚠️ ${issue}`).join('\n') : '• ✅ No recent issues'}

💡 *${performanceData.overallScore >= 80 ? 'This is a high-performing supplier.' : 'Consider discussing improvement areas.'}*`,
      sources: ['Supplier Performance Analytics', 'Contract Database'],
      suggestedActions: [
        { label: '📈 Trend Analysis', action: 'performance-trend' },
        { label: '🤝 Schedule Review', action: 'schedule-review' },
        { label: '📋 View Contracts', action: `list-supplier:${performanceData.supplierName}` },
      ],
      suggestions: [
        `Show contracts with ${performanceData.supplierName}`,
        `Compare ${performanceData.supplierName} to alternatives`,
        'What are this supplier\'s strengths?',
      ],
    };
  },

  'rate-comparison': (query, context) => {
    const { rateData, supplierName } = context;
    if (!rateData || !rateData.rateCards || rateData.rateCards.length === 0) {
      return {
        response: `📊 **Rate Comparison**\n\nNo rate card data available${supplierName ? ` for ${supplierName}` : ''}. Upload rate cards to compare pricing.`,
        sources: [],
        suggestedActions: [{ label: '📤 Upload Rate Card', action: 'upload-rate-card' }],
        suggestions: ['Upload a rate card', 'Show all suppliers'],
      };
    }

    const rateList = rateData.rateCards.slice(0, 5).map((card: any, i: number) => {
      const compIcon = card.vsMarket < 0 ? '🟢' : card.vsMarket < 10 ? '🟡' : '🔴';
      return `${i + 1}. **${card.roleName || card.serviceType}**\n   • Your Rate: $${card.rate.toLocaleString()}/hr\n   • Market Avg: $${card.marketRate.toLocaleString()}/hr\n   • ${compIcon} ${card.vsMarket > 0 ? '+' : ''}${card.vsMarket}% vs market`;
    }).join('\n\n');

    const avgVariance = rateData.rateCards.reduce((sum: number, c: any) => sum + c.vsMarket, 0) / rateData.rateCards.length;

    return {
      response: `💰 **Rate Comparison${supplierName ? `: ${supplierName}` : ''}**

**Summary:**
• Rate Cards Analyzed: ${rateData.rateCards.length}
• Overall Position: ${avgVariance < 0 ? '🟢 Below Market' : avgVariance < 10 ? '🟡 At Market' : '🔴 Above Market'} (${avgVariance > 0 ? '+' : ''}${avgVariance.toFixed(1)}%)

**Rate Breakdown:**
${rateList}

${avgVariance > 5 ? '⚠️ *Your rates are above market average. Consider renegotiation.*' : '✅ *Your rates are competitive with market benchmarks.*'}`,
      sources: ['Rate Card Analysis', 'Market Benchmarks'],
      suggestedActions: [
        { label: '🤝 Start Negotiation', action: 'negotiate-rates' },
        { label: '📊 Full Benchmark', action: 'rate-benchmark' },
        { label: '📈 Rate Trends', action: 'rate-trends' },
      ],
      suggestions: [
        'Which roles are most expensive?',
        'Compare rates across suppliers',
        'Negotiate lower rates with this supplier',
      ],
    };
  },

  'negotiate-terms': (query, context) => {
    const { supplierName, contractData } = context;

    return {
      response: `🤝 **Negotiation Assistant${supplierName ? `: ${supplierName}` : ''}**

**Key Negotiation Levers:**

1. **Volume Discounts** 📦
   • Consolidate spend for better rates
   • Commit to multi-year terms

2. **Payment Terms** 💳
   • Request extended terms (Net 60/90)
   • Negotiate early payment discounts

3. **Rate Cards** 📊
   • Benchmark against market rates
   • Lock in rates with annual caps

4. **Contract Terms** 📋
   • Reduce auto-renewal periods
   • Add termination flexibility
   • Cap liability clauses

5. **Service Levels** ⚡
   • Include SLA credits
   • Add performance guarantees

💡 *Use your total spend with this supplier as leverage.*`,
      sources: ['Negotiation Best Practices', 'Market Intelligence'],
      suggestedActions: [
        { label: '📊 Benchmark Rates', action: 'benchmark-rates' },
        { label: '💰 View Spend', action: 'supplier-spend' },
        { label: '📋 Draft Amendment', action: 'create-amendment' },
      ],
      suggestions: [
        'What is our total spend with this supplier?',
        'Compare our rates to market benchmarks',
        'Show similar contracts for comparison',
      ],
    };
  },

  // ============================================
  // CONTRACT CREATION & LINKING RESPONSES
  // ============================================

  'create-linked-contract': (query, context) => {
    const { 
      contractType, 
      supplierName, 
      contractName,
      parentContracts, 
      parentYear,
      draftContract 
    } = context;

    // If we found parent contracts
    if (parentContracts && parentContracts.length > 0) {
      const parent = parentContracts[0];
      const displayName = supplierName || parent.supplierName || 'the selected contract';
      const parentList = parentContracts.map((p: any, i: number) => {
        const effective = p.effectiveDate ? new Date(p.effectiveDate).getFullYear() : 'N/A';
        const childCount = p.childContracts?.length || 0;
        return `${i + 1}. **${p.contractTitle || p.contractType}** (${effective})
   • Status: ${p.status} | ${childCount} linked contracts`;
      }).join('\n');

      return {
        response: `📝 **Creating ${contractType}${supplierName ? ` with ${supplierName}` : ` for ${contractName || parent.contractTitle}`}**

I found **${parentContracts.length}** contract(s) to link to:

${parentList}

${parentContracts.length === 1 ? `
I'll link your new ${contractType} to: **${parent.contractTitle}**

**Next Steps:**
1. ✅ Create draft ${contractType}
2. 📋 Fill in scope and terms
3. 💰 Add pricing and rates
4. 🚀 Submit for approval

Ready to proceed?` : `
Please select which contract to link to, or I can help you find the right one.`}`,
        sources: parentContracts.map((p: any) => `Contract: ${p.contractTitle}`),
        suggestedActions: parentContracts.length === 1 ? [
          { label: `📝 Create ${contractType} Draft`, action: `create-draft:${contractType}:${parent.id}` },
          { label: '📋 Use Template', action: `use-template:${contractType}` },
          { label: '📅 Schedule Kickoff', action: 'schedule-meeting' },
        ] : parentContracts.slice(0, 3).map((p: any) => ({
          label: `🔗 Link to ${(p.contractTitle || p.contractType).slice(0, 20)}...`,
          action: `select-parent:${p.id}`,
        })),
        suggestions: [
          'Show me the terms of the MSA',
          'What SOWs already exist under this MSA?',
          'Use the standard SOW template',
        ],
        workflow: {
          ready: true,
          action: 'create_linked',
          contractType,
          supplierName,
          parentContractId: parentContracts.length === 1 ? parent.id : null,
          parentContracts: parentContracts.map((p: any) => ({
            id: p.id,
            title: p.contractTitle,
            type: p.contractType,
          })),
        },
      };
    }

    // No parent contracts found
    return {
      response: `📝 **Creating ${contractType} with ${supplierName}**

I couldn't find an existing Master Agreement with ${supplierName}${parentYear ? ` from ${parentYear}` : ''}.

**Options:**
1. **Create without linking** - Start a standalone ${contractType}
2. **Create MSA first** - Establish a Master Agreement, then add the ${contractType}
3. **Search again** - Help me find the right parent contract

💡 *Tip: Linking to an MSA helps track contract relationships and ensures consistent terms.*`,
      sources: ['Contract Database'],
      suggestedActions: [
        { label: `📝 Create Standalone ${contractType}`, action: `create-standalone:${contractType}` },
        { label: '📋 Create MSA First', action: `create-msa:${supplierName}` },
        { label: '🔍 Search for MSA', action: 'search-msa' },
      ],
      suggestions: [
        `Show me all contracts with ${supplierName}`,
        `Create a new MSA with ${supplierName}`,
        'What suppliers have active MSAs?',
      ],
      workflow: {
        ready: false,
        action: 'create_linked',
        contractType,
        supplierName,
        needsParent: true,
      },
    };
  },

  'find-master-agreement': (query, context) => {
    const { masterAgreements, supplierName } = context;

    if (!masterAgreements || masterAgreements.length === 0) {
      return {
        response: `🔍 **Master Agreement Search: ${supplierName}**

I couldn't find any active Master Agreements with "${supplierName}".

**This means:**
- No MSA exists yet with this supplier
- The MSA may be archived or expired
- The supplier name might be slightly different

**Would you like to:**
1. Create a new Master Agreement
2. Search with a different name
3. View all active suppliers`,
        sources: ['Contract Database'],
        suggestedActions: [
          { label: '📝 Create New MSA', action: `create-msa:${supplierName}` },
          { label: '🔍 Search Suppliers', action: 'search-suppliers' },
          { label: '📋 List All MSAs', action: 'list-msas' },
        ],
        suggestions: [
          `Create MSA with ${supplierName}`,
          'Show all active master agreements',
          'List suppliers without MSAs',
        ],
      };
    }

    const msaList = masterAgreements.map((msa: any, i: number) => {
      const effective = msa.effectiveDate ? new Date(msa.effectiveDate).toLocaleDateString() : 'N/A';
      const expiry = msa.expirationDate ? new Date(msa.expirationDate).toLocaleDateString() : 'No expiry';
      const childCount = msa.childContracts?.length || 0;
      const value = msa.totalValue ? `$${Number(msa.totalValue).toLocaleString()}` : 'N/A';
      
      return `${i + 1}. **${msa.contractTitle || 'Master Agreement'}**
   • Effective: ${effective} → ${expiry}
   • Value: ${value} | Status: ${msa.status}
   • 📎 ${childCount} linked contract(s) (SOWs, Amendments, etc.)`;
    }).join('\n\n');

    return {
      response: `📋 **Master Agreements with ${supplierName}**

Found **${masterAgreements.length}** Master Agreement(s):

${msaList}

**Quick Actions:**
- Create a new SOW under any MSA
- View linked contracts
- Start renewal process`,
      sources: masterAgreements.map((m: any) => `MSA: ${m.contractTitle}`),
      suggestedActions: masterAgreements.slice(0, 2).map((m: any) => ({
        label: `📝 Create SOW under ${(m.contractTitle || 'MSA').slice(0, 15)}...`,
        action: `create-sow:${m.id}`,
      })).concat([
        { label: '🔗 View Contract Tree', action: `show-hierarchy:${masterAgreements[0].id}` },
      ]),
      suggestions: [
        `Create a SOW under the ${masterAgreements[0].contractTitle || 'MSA'}`,
        'Show all linked contracts',
        'What is the total value of this relationship?',
      ],
    };
  },

  'show-hierarchy': (query, context) => {
    const { contract, childContracts } = context;

    if (!contract) {
      return {
        response: `I couldn't find the contract hierarchy. Please specify a contract to view.`,
        sources: [],
        suggestedActions: [
          { label: '🔍 Search Contracts', action: 'search-contracts' },
        ],
        suggestions: ['Show me all master agreements'],
      };
    }

    const parent = contract.parentContract;
    const children = contract.childContracts || [];
    
    let hierarchyView = '';
    
    if (parent) {
      hierarchyView += `**📁 Parent Contract:**\n`;
      hierarchyView += `└── ${parent.contractTitle || parent.contractType} (${parent.status})\n\n`;
    }
    
    hierarchyView += `**📄 Current Contract:**\n`;
    hierarchyView += `${parent ? '    └── ' : ''}**${contract.contractTitle}** (${contract.status})\n\n`;
    
    if (children.length > 0) {
      hierarchyView += `**📎 Linked Contracts (${children.length}):**\n`;
      children.forEach((child: any, i: number) => {
        const prefix = i === children.length - 1 ? '└──' : '├──';
        hierarchyView += `${prefix} ${child.contractTitle || child.contractType}\n`;
        hierarchyView += `    • Type: ${child.relationshipType || child.contractType} | Status: ${child.status}\n`;
      });
    }

    const totalValue = children.reduce((sum: number, c: any) => sum + (Number(c.totalValue) || 0), Number(contract.totalValue) || 0);

    return {
      response: `🌳 **Contract Hierarchy**

${hierarchyView}

**Summary:**
• Total contracts in tree: ${1 + children.length + (parent ? 1 : 0)}
• Combined value: $${totalValue.toLocaleString()}
• Active children: ${children.filter((c: any) => c.status === 'ACTIVE').length}`,
      sources: [`Contract: ${contract.contractTitle}`],
      suggestedActions: [
        { label: '📝 Add New SOW', action: `create-sow:${contract.id}` },
        { label: '📋 Add Amendment', action: `create-amendment:${contract.id}` },
        { label: '📊 Value Analysis', action: `analyze-value:${contract.id}` },
      ],
      suggestions: [
        'Create a new SOW under this MSA',
        'Show spending breakdown by SOW',
        'When do these contracts expire?',
      ],
    };
  },

  // ============================================
  // EXISTING RESPONSES
  // ============================================

  'high-risk contracts': (query, context) => ({
    response: `I found **5 high-risk contracts** that require attention:

1. **Acme Corp MSA** - Risk Score: 78/100
   - Issues: Unlimited liability clause, no termination cap
   - Action: Review liability terms with legal

2. **TechVendor Agreement** - Risk Score: 72/100
   - Issues: Auto-renewal without notice, steep penalties
   - Action: Set calendar reminder 90 days before renewal

3. **Global Services Contract** - Risk Score: 85/100
   - Issues: Non-standard indemnification, data breach liability
   - Action: Immediate legal review required

Would you like me to create a detailed risk report or schedule reviews for these contracts?`,
    sources: [
      'Contract: Acme Corp MSA (ID: contract-001)',
      'Contract: TechVendor Agreement (ID: contract-034)',
      'Risk Analysis Dashboard',
    ],
    suggestedActions: [
      { label: '📊 Generate Risk Report', action: 'generate-risk-report' },
      { label: '📅 Schedule Legal Reviews', action: 'schedule-reviews' },
      { label: '🔍 View All High-Risk Contracts', action: 'view-high-risk' },
    ],
    suggestions: [
      'Show me details for Acme Corp MSA',
      'What are common risk patterns?',
      'Create a risk mitigation plan',
    ],
  }),

  'expire': (query, context) => ({
    response: `I found **12 contracts expiring in the next 30 days**:

**Critical (7 days or less):**
• Master Services Agreement - Acme Corp (expires in 3 days) - $250K/year
• NDA - TechPartner Inc (expires in 5 days)

**Urgent (7-14 days):**
• Software License - CloudVendor (expires in 9 days) - $120K/year
• Consulting Agreement - Strategy Co (expires in 11 days) - $80K/year

**Total Annual Value at Risk: $450,000**

I recommend sending renewal reminders immediately for the critical contracts.`,
    sources: ['Deadlines Dashboard', 'Contract Renewals Report'],
    suggestedActions: [
      { label: '📧 Send Renewal Reminders', action: 'send-reminders' },
      { label: '📊 Create Renewal Report', action: 'create-report' },
    ],
    suggestions: [
      'What is the renewal process for Acme Corp?',
      'Show me all auto-renewing contracts',
    ],
  }),

  'pending approvals': (query, context) => ({
    response: `You have **8 pending approvals** across different workflows:

**Urgent (Waiting >5 days):**
1. Contract Review - Global Services Agreement (waiting 7 days)
2. Template Approval - Updated NDA Template (waiting 6 days)

**Recent (<2 days):**
3. Signature Request - Vendor Agreement
4. Workflow Step - MSA Amendment

Would you like me to open the approval interface?`,
    sources: ['Workflow Dashboard', 'Your Pending Tasks'],
    suggestedActions: [
      { label: '✅ Approve All Standard Items', action: 'bulk-approve' },
      { label: '👀 Review Urgent Items', action: 'review-urgent' },
    ],
    suggestions: ['Show me the Global Services Agreement', 'Who else needs to approve these?'],
  }),

  'summarize': (query, context) => ({
    response: `**Contract Summary: Master Service Agreement**

**Key Details:**
• Parties: Acme Corporation ↔ Your Company
• Effective: January 15, 2024
• Term: 12 months (expires in 45 days)
• Value: $250,000/year

**Key Terms:**
• Payment: Net-30 days
• Liability Cap: $500,000
• Termination: 60-day notice

**Risk Score: 68/100 (Medium-High)**

**Recommended Actions:**
1. Schedule renewal discussion
2. Review scope clarity issues

Would you like a detailed risk report?`,
    sources: ['Contract: MSA-Acme-Corp-2024', 'Risk Analysis Report'],
    suggestedActions: [
      { label: '📅 Schedule Renewal Meeting', action: 'schedule-renewal' },
      { label: '⚠️ View Detailed Risks', action: 'view-risks' },
    ],
    suggestions: ['What are the active SOWs?', 'Compare to similar MSAs'],
  }),

  'renew-workflow': (query, context) => {
    const { contractName, supplierName, matchedContracts, workflows } = context;
    
    if (matchedContracts && matchedContracts.length > 0) {
      const contract = matchedContracts[0];
      const workflowList = workflows?.length > 0 
        ? workflows.map((w: any, i: number) => `${i + 1}. **${w.name}** - ${w.steps?.length || 0} steps`).join('\n')
        : '1. **Standard Renewal** - 3 steps (Legal → Finance → VP Approval)';
      
      return {
        response: `I found the contract you want to renew:

**📄 ${contract.name || contract.contractTitle}**
• Supplier: ${contract.vendor || contract.supplierName || supplierName || 'Not specified'}
• Current Value: ${contract.value ? `$${Number(contract.value).toLocaleString()}` : 'Not specified'}
• Status: ${contract.status}
${contract.endDate ? `• Expires: ${new Date(contract.endDate).toLocaleDateString()}` : ''}

**Available Renewal Workflows:**
${workflowList}

Would you like me to start the renewal process? I can:
1. **Start the approval workflow** now
2. **Draft a renewal contract** with updated terms
3. **Schedule a renewal meeting** with stakeholders

Just let me know which option you prefer!`,
        sources: [`Contract: ${contract.name || contract.contractTitle}`],
        suggestedActions: [
          { label: '🚀 Start Renewal Workflow', action: `start-renewal:${contract.id}` },
          { label: '📝 Draft Renewal Contract', action: `draft-renewal:${contract.id}` },
          { label: '📅 Schedule Meeting', action: `schedule-meeting:${contract.id}` },
        ],
        suggestions: [
          'What are the current terms?',
          'Show me the contract history',
          'Who needs to approve?',
        ],
        workflow: {
          ready: true,
          contractId: contract.id,
          contractName: contract.name || contract.contractTitle,
          action: 'renew',
        },
      };
    }
    
    return {
      response: `I'd be happy to help you renew a contract${supplierName ? ` with ${supplierName}` : ''}!

I couldn't find an exact match for "${contractName || 'the contract'}". Could you help me identify it?

**Here's what I can do:**
1. **Search** - Tell me more details (contract number, supplier name, contract type)
2. **Browse** - Show me contracts expiring soon that need renewal
3. **Create New** - Start a fresh renewal contract from scratch

What would you like to do?`,
      sources: ['Contract Database'],
      suggestedActions: [
        { label: '🔍 Search All Contracts', action: 'search-contracts' },
        { label: '📅 View Expiring Contracts', action: 'view-expiring' },
        { label: '📝 Create New Contract', action: 'create-contract' },
      ],
      suggestions: [
        'Show me contracts expiring in 30 days',
        'List all contracts with [supplier name]',
        'Create a new MSA agreement',
      ],
    };
  },

  // ============================================
  // TAXONOMY/CATEGORY RESPONSES
  // ============================================

  'list-categories': (query, context) => {
    const { taxonomyData } = context;
    if (!taxonomyData || !taxonomyData.hierarchy || taxonomyData.hierarchy.length === 0) {
      return {
        response: `📂 **Taxonomy Categories**\n\nNo taxonomy categories have been set up yet.\n\n**Get Started:**\n• Go to Settings → Taxonomy Management to configure your procurement categories\n• Or let me help you create a standard indirect procurement taxonomy`,
        sources: ['Taxonomy Database'],
        suggestedActions: [
          { label: '⚙️ Setup Taxonomy', action: '/settings/taxonomy' },
          { label: '📥 Import Standard', action: 'import-taxonomy' },
        ],
        suggestions: [
          'Create standard indirect procurement taxonomy',
          'What categories should I use?',
          'Show me sample taxonomy structures',
        ],
      };
    }

    const { stats, hierarchy } = taxonomyData;
    
    // Format the hierarchy nicely
    const categoryList = hierarchy.slice(0, 8).map((cat: any, i: number) => {
      const childCount = cat.children?.length || 0;
      const contractCount = cat.contractCount || 0;
      return `${i + 1}. **${cat.name}** (${cat.code || 'N/A'})\n   • ${childCount} subcategories | ${contractCount} contracts`;
    }).join('\n\n');

    return {
      response: `📂 **Procurement Taxonomy**

**Overview:**
• Total Categories: ${stats.totalCategories}
• L1 Categories: ${stats.totalL1}
• L2 Subcategories: ${stats.totalL2}
• L3 Detailed: ${stats.totalL3}
• Categorized Contracts: ${stats.totalContracts}

**Top-Level Categories:**
${categoryList}

💡 *Click on a category to see subcategories and contracts.*`,
      sources: ['Taxonomy Database'],
      suggestedActions: [
        { label: '⚙️ Manage Taxonomy', action: '/settings/taxonomy' },
        { label: '📊 Category Spend', action: 'category-spend' },
        { label: '📋 Uncategorized', action: 'uncategorized-contracts' },
      ],
      suggestions: [
        'Show IT & Technology categories',
        'What contracts are in Professional Services?',
        'Show spend by category',
      ],
    };
  },

  'category-details': (query, context) => {
    const { categoryDetails, categoryName } = context;
    if (!categoryDetails) {
      return {
        response: `🔍 **Category Search**\n\nI couldn't find a category matching "${categoryName}".\n\nTry searching with a different name or browse all categories.`,
        sources: ['Taxonomy Database'],
        suggestedActions: [
          { label: '📂 Browse All Categories', action: 'list-categories' },
        ],
        suggestions: [
          'Show all categories',
          'What categories exist?',
          'List IT categories',
        ],
      };
    }

    const { name, code, description, level, parent, children, contractCount, totalSpend, sampleContracts } = categoryDetails;
    
    const parentInfo = parent ? `Part of: **${parent.name}**` : 'Top-level category';
    const childList = children && children.length > 0 
      ? children.slice(0, 5).map((c: any) => `• ${c.name} (${c.code})`).join('\n')
      : 'No subcategories';
    
    const contractList = sampleContracts && sampleContracts.length > 0
      ? sampleContracts.slice(0, 3).map((c: any, i: number) => 
          `${i + 1}. [📄 ${c.contractTitle}](/contracts/${c.id}) - $${Number(c.totalValue || 0).toLocaleString()}`
        ).join('\n')
      : 'No contracts in this category';

    return {
      response: `📋 **${name}** (${code || 'No code'})

${description || 'No description available.'}

**Hierarchy:** ${parentInfo}
**Level:** L${level}

**Statistics:**
• Contracts: ${contractCount}
• Total Spend: $${totalSpend.toLocaleString()}

**Subcategories:**
${childList}

**Sample Contracts:**
${contractList}`,
      sources: ['Taxonomy Database', 'Contract Analytics'],
      suggestedActions: [
        { label: '📋 View All Contracts', action: `category-contracts:${name}` },
        { label: '📊 Category Analytics', action: `category-analytics:${name}` },
        { label: '✏️ Edit Category', action: `/settings/taxonomy?edit=${categoryDetails.id}` },
      ],
      suggestions: [
        `Show all contracts in ${name}`,
        `What's the spend breakdown for ${name}?`,
        'Show parent category',
      ],
    };
  },

  'suggest-category': (query, context) => {
    const { categorySuggestion, contractName } = context;
    if (!categorySuggestion) {
      return {
        response: `🏷️ **Category Suggestion**\n\nI couldn't analyze "${contractName}". Make sure the contract exists in the system.`,
        sources: [],
        suggestedActions: [],
        suggestions: ['Show all contracts', 'List categories'],
      };
    }

    const { contract, currentCategory, suggestions, allCategories } = categorySuggestion;
    
    if (currentCategory) {
      return {
        response: `🏷️ **Current Category for "${contract?.contractTitle || contractName}"**

**Current Assignment:** ${currentCategory.name}

This contract is already categorized. Would you like to change it?

**Other Options:**
${suggestions.slice(0, 3).map((s: any, i: number) => `${i + 1}. ${s.name} (${s.code})`).join('\n')}`,
        sources: ['Taxonomy Database'],
        suggestedActions: [
          { label: '✏️ Change Category', action: `change-category:${contract?.id}` },
          { label: '📂 View Category', action: `category-details:${currentCategory.name}` },
        ],
        suggestions: [
          'Show category details',
          'List all categories',
        ],
      };
    }

    const suggestionList = suggestions.length > 0
      ? suggestions.slice(0, 5).map((s: any, i: number) => 
          `${i + 1}. **${s.name}** (${s.code})\n   • ${s._count?.contracts || 0} existing contracts`
        ).join('\n\n')
      : 'No strong matches found. Browse all categories to assign.';

    return {
      response: `🏷️ **Category Suggestions for "${contract?.contractTitle || contractName}"**

This contract is currently uncategorized.

**Suggested Categories:**
${suggestionList}

💡 *Select a category or browse all to assign.*`,
      sources: ['Taxonomy Database', 'AI Analysis'],
      suggestedActions: [
        { label: '📂 Browse All', action: 'list-categories' },
        ...(suggestions[0] ? [{ label: `✅ Assign ${suggestions[0].name}`, action: `assign-category:${contract?.id}:${suggestions[0].id}` }] : []),
      ],
      suggestions: [
        'Show all categories',
        'What category fits IT services?',
        'Browse Professional Services',
      ],
    };
  },

  'browse-taxonomy': (query, context) => {
    const { categoryContracts, categoryName } = context;
    if (!categoryContracts) {
      return {
        response: `📋 **Contracts in Category**\n\nNo category found matching "${categoryName}" or no contracts assigned to it.`,
        sources: ['Taxonomy Database'],
        suggestedActions: [
          { label: '📂 Browse Categories', action: 'list-categories' },
        ],
        suggestions: ['Show all categories', 'List uncategorized contracts'],
      };
    }

    const { category, contracts, totalContracts, totalValue } = categoryContracts;
    
    const contractList = contracts.slice(0, 10).map((c: any, i: number) => {
      const statusIcon = c.status === 'ACTIVE' ? '🟢' : c.status === 'EXPIRED' ? '🔴' : '🟡';
      const value = c.totalValue ? `$${Number(c.totalValue).toLocaleString()}` : 'N/A';
      return `${i + 1}. ${statusIcon} [📄 ${c.contractTitle}](/contracts/${c.id})\n   • ${c.supplierName} | ${value}`;
    }).join('\n\n');

    return {
      response: `📋 **${category.name}** Contracts

**Summary:**
• Total Contracts: ${totalContracts}
• Total Value: $${totalValue.toLocaleString()}

**Contracts:**
${contractList}

${totalContracts > 10 ? `\n*Showing 10 of ${totalContracts} contracts.*` : ''}`,
      sources: ['Contract Database', 'Taxonomy'],
      suggestedActions: [
        { label: '📊 Category Analytics', action: `category-analytics:${category.name}` },
        { label: '📤 Export List', action: `export-category:${category.id}` },
        { label: '⬆️ Parent Category', action: 'list-categories' },
      ],
      suggestions: [
        `Show spend breakdown for ${category.name}`,
        `High-value ${category.name} contracts`,
        'Show all categories',
      ],
    };
  },

  'default': (query, context) => ({
    response: `I understand you're asking about "${query}". 

I can help you with:
• Contract Analysis & Search
• Deadlines & Renewals
• Workflows & Approvals
• Templates & Clauses
• Analytics & Reports

Could you provide more details about what you'd like to know?`,
    sources: [],
    suggestedActions: [
      { label: '🔍 Search Contracts', action: 'search-contracts' },
      { label: '📊 View Dashboard', action: 'view-dashboard' },
    ],
    suggestions: [
      'Show me all high-risk contracts',
      'What contracts expire soon?',
      'Summarize my pending approvals',
    ],
  }),
};

function selectResponse(query: string, context: any) {
  const lowerQuery = query.toLowerCase();

  // ============================================
  // PROCUREMENT AGENT INTENTS (FROM DATABASE)
  // ============================================
  
  // Handle list intents with real data
  if (context.intent?.type === 'list') {
    if (context.intent.action === 'list_by_supplier' && context.contracts) {
      return mockAIResponses['list-by-supplier']?.(query, {
        ...context,
        contracts: context.contracts,
        supplierName: context.intent.entities.supplierName,
      });
    }
    if (context.intent.action === 'list_expiring' && context.contracts) {
      return mockAIResponses['list-expiring']?.(query, {
        ...context,
        contracts: context.contracts,
        daysUntilExpiry: context.intent.entities.daysUntilExpiry || 30,
        supplierName: context.intent.entities.supplierName,
      });
    }
    if (context.intent.action === 'list_by_status' && context.contracts) {
      return mockAIResponses['list-by-status']?.(query, {
        ...context,
        contracts: context.contracts,
        status: context.intent.entities.status,
      });
    }
    if (context.intent.action === 'list_by_value' && context.contracts) {
      return mockAIResponses['list-by-status']?.(query, {
        ...context,
        contracts: context.contracts,
        status: 'HIGH VALUE',
      });
    }
  }

  // Handle analytics intents
  if (context.intent?.type === 'analytics') {
    if (context.intent.action === 'count' && context.counts) {
      return mockAIResponses['contract-count']?.(query, {
        ...context,
        counts: context.counts,
      });
    }
    if (context.intent.action === 'summarize' && context.summary) {
      return mockAIResponses['supplier-summary']?.(query, {
        ...context,
        summary: context.summary,
      });
    }
  }

  // ============================================
  // PROCUREMENT ANALYTICS INTENTS
  // ============================================
  
  if (context.intent?.type === 'procurement') {
    // Spend Analysis
    if (context.intent.action === 'spend_analysis' && context.spendData) {
      return mockAIResponses['spend-analysis']?.(query, {
        ...context,
        spendData: context.spendData,
      });
    }
    
    // Cost Savings Opportunities
    if (context.intent.action === 'savings_opportunities' && context.savingsData) {
      return mockAIResponses['cost-savings']?.(query, {
        ...context,
        savingsData: context.savingsData,
      });
    }
    
    // Risk Assessment
    if (context.intent.action === 'risk_assessment' && context.riskData) {
      return mockAIResponses['risk-assessment']?.(query, {
        ...context,
        riskData: context.riskData,
      });
    }
    
    // Compliance Status
    if (context.intent.action === 'compliance_status' && context.complianceData) {
      return mockAIResponses['compliance-status']?.(query, {
        ...context,
        complianceData: context.complianceData,
      });
    }
    
    // Supplier Performance
    if (context.intent.action === 'supplier_performance' && context.performanceData) {
      return mockAIResponses['supplier-performance']?.(query, {
        ...context,
        performanceData: context.performanceData,
      });
    }
    
    // Rate Comparison
    if (context.intent.action === 'rate_comparison' && context.rateData) {
      return mockAIResponses['rate-comparison']?.(query, {
        ...context,
        rateData: context.rateData,
      });
    }
    
    // Top Suppliers
    if (context.intent.action === 'top_suppliers' && context.topSuppliersData) {
      return mockAIResponses['top-suppliers']?.(query, {
        ...context,
        topSuppliersData: context.topSuppliersData,
      });
    }
    
    // Auto-renewals
    if (context.intent.action === 'auto_renewals' && context.autoRenewalData) {
      return mockAIResponses['auto-renewals']?.(query, {
        ...context,
        autoRenewalData: context.autoRenewalData,
      });
    }
    
    // Category Spend
    if (context.intent.action === 'category_spend' && context.categoryData) {
      return mockAIResponses['category-spend']?.(query, {
        ...context,
        categoryData: context.categoryData,
      });
    }
    
    // Payment Terms
    if (context.intent.action === 'payment_terms' && context.paymentData) {
      return mockAIResponses['payment-terms']?.(query, {
        ...context,
        paymentData: context.paymentData,
      });
    }
    
    // Negotiation Assistance
    if (context.intent.action === 'negotiate') {
      return mockAIResponses['negotiate-terms']?.(query, {
        ...context,
        supplierName: context.intent.entities.supplierName,
      });
    }
  }

  // ============================================
  // TAXONOMY INTENTS
  // ============================================
  
  if (context.intent?.type === 'taxonomy') {
    // List all categories
    if (context.intent.action === 'list_categories' && context.taxonomyData) {
      return mockAIResponses['list-categories']?.(query, {
        ...context,
        taxonomyData: context.taxonomyData,
      });
    }
    
    // Category details
    if (context.intent.action === 'category_details' && context.categoryDetails) {
      return mockAIResponses['category-details']?.(query, {
        ...context,
        categoryDetails: context.categoryDetails,
        categoryName: context.intent.entities.category,
      });
    }
    
    // Suggest category for contract
    if (context.intent.action === 'suggest_category' && context.categorySuggestion) {
      return mockAIResponses['suggest-category']?.(query, {
        ...context,
        categorySuggestion: context.categorySuggestion,
        contractName: context.intent.entities.contractName,
      });
    }
    
    // Browse taxonomy / contracts in category
    if (context.intent.action === 'browse_taxonomy' && context.categoryContracts) {
      return mockAIResponses['browse-taxonomy']?.(query, {
        ...context,
        categoryContracts: context.categoryContracts,
        categoryName: context.intent.entities.category,
      });
    }
  }

  // ============================================
  // WORKFLOW INTENTS
  // ============================================
  
  // Check for workflow intents
  if (context.intent?.type === 'workflow') {
    if (context.intent.action === 'renew') {
      return mockAIResponses['renew-workflow']?.(query, {
        ...context,
        contractName: context.intent.entities.contractName,
        supplierName: context.intent.entities.supplierName,
        matchedContracts: context.matchedContracts,
        workflows: context.workflows,
      });
    }
    
    // Handle create_linked workflow (e.g., "start a SoW with supplier X linking to master agreement")
    if (context.intent.action === 'create_linked') {
      return mockAIResponses['create-linked-contract']?.(query, {
        ...context,
        supplierName: context.intent.entities.supplierName,
        contractType: context.intent.entities.contractType,
        contractName: context.intent.entities.contractName,
        parentYear: context.intent.entities.parentYear,
        masterAgreements: context.masterAgreements,
        parentContracts: context.parentContracts || context.masterAgreements,
        creationWorkflows: context.creationWorkflows,
      });
    }
  }
  
  // ============================================
  // ACTION INTENTS (Contract Operations)
  // ============================================
  
  // Check for action intents
  if (context.intent?.type === 'action') {
    // Handle hierarchy display
    if (context.intent.action === 'show_hierarchy') {
      if (context.contractHierarchy) {
        return mockAIResponses['show-hierarchy']?.(query, {
          ...context,
          contract: context.contractHierarchy,
          contractName: context.intent.entities.contractName,
        });
      } else {
        // No contract found - return a helpful message
        return {
          response: `🔍 **Contract Hierarchy Search**\n\nI couldn't find a contract matching "${context.intent.entities.contractName || 'your search'}".\n\n**Try:**\n- Search with a different name\n- List all contracts to find the right one\n- Check if the contract exists in the system`,
          sources: [],
          suggestedActions: [
            { label: '📋 List All Contracts', action: 'list-all-contracts' },
            { label: '🔍 Search Contracts', action: 'search-contracts' },
          ],
          suggestions: [
            'Show me all contracts',
            'List contracts by supplier',
            'What contracts are active?',
          ],
        };
      }
    }
    
    // Handle linking existing contracts
    if (context.intent.action === 'link_contracts') {
      return mockAIResponses['link-existing-contract']?.(query, {
        ...context,
        childContractName: context.intent.entities.childContractName,
        parentContractName: context.intent.entities.parentContractName,
      });
    }
  }

  // ============================================
  // KEYWORD-BASED FALLBACKS
  // ============================================

  if (lowerQuery.includes('high-risk') || lowerQuery.includes('risky')) {
    return mockAIResponses['high-risk contracts']?.(query, context);
  }
  if (lowerQuery.includes('expire') || lowerQuery.includes('renewal') || lowerQuery.includes('renew')) {
    // Check if it's a renewal action request vs just a query
    if (lowerQuery.includes('start') || lowerQuery.includes('initiate') || 
        lowerQuery.includes('please') || lowerQuery.includes('need to')) {
      return mockAIResponses['renew-workflow']?.(query, context);
    }
    return mockAIResponses['expire']?.(query, context);
  }
  if (lowerQuery.includes('pending') || lowerQuery.includes('approval')) {
    return mockAIResponses['pending approvals']?.(query, context);
  }
  if (lowerQuery.includes('summarize') || lowerQuery.includes('summary')) {
    return mockAIResponses['summarize']?.(query, context);
  }

  return mockAIResponses['default']?.(query, context);
}

async function getOpenAIResponse(message: string, conversationHistory: any[], context: any) {
  try {
    // Check if the query needs RAG search
    const needsRAG = shouldUseRAG(message);
    let ragContext = '';
    let ragSources: string[] = [];
    let contractContext = '';
    let ragSearchResults: any[] = []; // Store actual RAG results

    // If we have a specific contract ID, fetch its details directly
    if (context?.contractId) {
      contractContext = await getContractContext(context.contractId);
      if (contractContext) {
        ragSources.push(`Contract: ${context.contractId}`);
      }
    }

    if (needsRAG) {
      try {
        // Use advanced RAG to find relevant contract content
        const searchResults = await hybridSearch(message, {
          mode: 'hybrid',
          k: 7,
          rerank: true,
          expandQuery: true,
          filters: context?.tenantId ? { tenantId: context.tenantId } : {},
        });

        if (searchResults.length > 0) {
          ragSearchResults = searchResults; // Store for returning to frontend
          
          // Build enhanced RAG context with better formatting
          ragContext = `\n\n**🔍 Relevant Contract Information Found (${searchResults.length} matches):**\n\n`;
          
          searchResults.forEach((r, i) => {
            const matchScore = Math.round(r.score * 100);
            const urgencyIcon = matchScore >= 90 ? '🎯' : matchScore >= 75 ? '✅' : '📄';
            
            ragContext += `---\n`;
            ragContext += `**${urgencyIcon} Match ${i + 1}: [${r.contractName}](/contracts/${r.contractId})** (${matchScore}% relevance)\n`;
            
            // Add metadata if available
            if (r.supplierName) ragContext += `• Supplier: ${r.supplierName}\n`;
            if (r.chunkType) ragContext += `• Section: ${r.chunkType.replace('_', ' ').toLowerCase()}\n`;
            
            // Add the actual content excerpt
            ragContext += `\n> ${r.text.slice(0, 600).replace(/\n/g, '\n> ')}${r.text.length > 600 ? '...' : ''}\n\n`;
          });
          
          ragSources = [...ragSources, ...searchResults.map(r => `Contract: ${r.contractName} (ID: ${r.contractId})`)];
        }
      } catch (ragError) {
        console.error('RAG search error:', ragError);
        // Continue without RAG results
      }
    }

    const systemPrompt = `You are ConTigo AI, an intelligent contract analysis agent for the ConTigo Contract Management platform. You are a powerful AI assistant that can deeply analyze, summarize, and provide insights about contracts.

**🤖 YOUR CAPABILITIES AS AN AI AGENT:**

1. **Deep Contract Analysis**
   - Analyze contracts by supplier, category, year, status, or any combination
   - Provide comprehensive summaries with value analysis, duration insights, and risk assessment
   - Compare contracts across time periods or categories
   - Identify patterns and trends in contract data

2. **Intelligent Search & Retrieval**
   - Find specific contracts by name, supplier, terms, or content
   - Search within contract text using semantic understanding
   - Link directly to relevant contracts for easy access

3. **Business Intelligence**
   - Spending analysis by supplier, category, or time period
   - Duration and renewal pattern analysis
   - Risk identification (expiring contracts, auto-renewals, high-value at risk)
   - Category breakdown and supplier concentration analysis

4. **Natural Language Understanding**
   - Understand complex queries like "summarize all Deloitte contracts from 2024 with their durations and values"
   - Handle multi-criteria filters naturally
   - Provide context-aware responses based on what you find

**📊 ANALYSIS DATA PROVIDED:**
${context?.additionalContext || 'No specific analysis data available - I will search for relevant information.'}

**🔍 RAG SEARCH RESULTS:**
${ragContext || 'No semantic search results available.'}

**📄 CURRENT CONTRACT CONTEXT:**
${contractContext || 'No specific contract selected.'}

**DETECTED INTENT:** ${context?.intent ? JSON.stringify(context.intent) : 'general inquiry'}

**📝 RESPONSE GUIDELINES:**
1. When analysis data is provided above, USE IT to give detailed, data-driven responses
2. **ALWAYS include clickable links to contracts using markdown format: [Contract Name](/contracts/CONTRACT_ID)**
   - When listing contracts, EVERY contract MUST be a clickable link
   - When mentioning a specific contract, ALWAYS link to it
   - Extract contract IDs from the context above and use them in links
3. Structure responses with clear sections using markdown (##, **, bullets)
4. For summaries, organize by: Overview → Value Analysis → Duration → Categories → Risks
5. Provide actionable insights and recommendations
6. Suggest relevant follow-up questions
7. If data shows risks or issues, highlight them prominently
8. Be conversational but professional - you're a trusted advisor
9. When asked to find/search/list contracts, format as a numbered list with each contract as a clickable link

**🚫 OUT OF SCOPE:**
- Workflow approvals/signatures (coming soon)
- Contract creation (use Upload feature)
- Legal advice (consult legal team)`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const responseContent = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    // Format RAG results for frontend - use actual search results
    const formattedRagResults = ragSearchResults.length > 0 
      ? ragSearchResults.slice(0, 5).map(r => ({
          contractId: r.contractId,
          contractName: r.contractName || 'Unknown Contract',
          score: r.score || 0.85,
          text: r.text?.slice(0, 200) + '...' || '',
          chunkType: r.chunkType || 'content',
        }))
      : [];

    // Generate smart, context-aware suggested actions based on intent and results
    const smartSuggestedActions = generateSmartSuggestedActions(context?.intent, ragSearchResults, context);
    const smartSuggestions = generateSmartFollowUpSuggestions(message, context?.intent, ragSearchResults);

    return {
      response: responseContent,
      sources: ragSources.length > 0 ? ragSources : ['AI-generated response', 'CLM Database'],
      ragResults: formattedRagResults.length > 0 ? formattedRagResults : undefined,
      usedRAG: ragSearchResults.length > 0,
      ragSearchCount: ragSearchResults.length,
      confidence: ragSearchResults.length > 0 ? 0.95 : 0.85,
      intent: { type: context?.intent?.type || 'general' },
      suggestedActions: smartSuggestedActions,
      suggestions: smartSuggestions,
    };
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

// Generate smart, context-aware suggested actions
function generateSmartSuggestedActions(intent: any, ragResults: any[], context: any): any[] {
  const actions: any[] = [];
  
  // Intent-based actions
  if (intent?.type === 'list') {
    if (intent.action === 'list_by_supplier') {
      actions.push({ label: '📊 Supplier Analytics', action: 'supplier-analytics' });
      actions.push({ label: '🔄 Start Renewal', action: 'start-renewal' });
    } else if (intent.action === 'list_expiring') {
      actions.push({ label: '🔔 Set Reminders', action: 'set-reminders' });
      actions.push({ label: '📧 Notify Stakeholders', action: 'notify-stakeholders' });
    } else if (intent.action === 'list_by_status') {
      actions.push({ label: '📋 Export List', action: 'export-list' });
    }
  } else if (intent?.type === 'analytics') {
    actions.push({ label: '📈 Deep Dive', action: 'deep-analysis' });
    actions.push({ label: '📊 Generate Report', action: 'generate-report' });
  } else if (intent?.type === 'search') {
    actions.push({ label: '🔍 Refine Search', action: 'refine-search' });
  }
  
  // If we have RAG results, add contract-specific actions
  if (ragResults && ragResults.length > 0) {
    const firstContract = ragResults[0];
    actions.push({ 
      label: `📄 View ${firstContract.contractName?.slice(0, 20)}...`, 
      action: `view-contract:${firstContract.contractId}` 
    });
  }
  
  // Always include some default helpful actions
  if (actions.length === 0) {
    actions.push({ label: '🔍 Search Contracts', action: 'search-contracts' });
    actions.push({ label: '📊 View Dashboard', action: 'view-dashboard' });
  }
  
  // Limit to 3 most relevant actions
  return actions.slice(0, 3);
}

// Generate smart follow-up suggestions based on context
function generateSmartFollowUpSuggestions(query: string, intent: any, ragResults: any[]): string[] {
  const suggestions: string[] = [];
  const lowerQuery = query.toLowerCase();
  
  // Intent-based suggestions
  if (intent?.type === 'list') {
    if (intent.action === 'list_by_supplier' && intent.entities?.supplierName) {
      suggestions.push(`What's the total spend with ${intent.entities.supplierName}?`);
      suggestions.push(`Which ${intent.entities.supplierName} contracts expire soon?`);
      suggestions.push(`Compare ${intent.entities.supplierName} rates with market`);
    } else if (intent.action === 'list_expiring') {
      suggestions.push('Which ones are auto-renewing?');
      suggestions.push('Show me the highest value expiring contracts');
      suggestions.push('What are the renewal options?');
    }
  } else if (intent?.type === 'analytics') {
    suggestions.push('How does this compare to last year?');
    suggestions.push('Show me the trend over time');
    suggestions.push('What are the main risk factors?');
  }
  
  // Query-based suggestions
  if (lowerQuery.includes('compare') || lowerQuery.includes('vs')) {
    suggestions.push('Which one offers better terms?');
    suggestions.push('Show me the key differences');
  }
  
  if (lowerQuery.includes('risk') || lowerQuery.includes('expire')) {
    suggestions.push('What actions should I take?');
    suggestions.push('Who should I notify?');
  }
  
  // RAG-based suggestions
  if (ragResults && ragResults.length > 0) {
    suggestions.push('Tell me more about the first result');
    suggestions.push('Are there similar contracts?');
  }
  
  // Default fallback suggestions
  if (suggestions.length === 0) {
    suggestions.push('Tell me more about this');
    suggestions.push('What should I do next?');
    suggestions.push('Show me related contracts');
  }
  
  // Return unique suggestions, limited to 3
  return [...new Set(suggestions)].slice(0, 3);
}

// Determine if the query should use RAG search
function shouldUseRAG(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Keywords that indicate contract search is needed
  const ragKeywords = [
    'find', 'search', 'show me', 'where', 'what', 'which',
    'contract', 'clause', 'term', 'liability', 'termination',
    'payment', 'renewal', 'expire', 'obligation', 'risk',
    'indemnif', 'sla', 'warranty', 'confidential', 'vendor',
    'supplier', 'agreement', 'msa', 'nda', 'sow',
  ];
  
  return ragKeywords.some(keyword => lowerQuery.includes(keyword));
}

export async function POST(request: NextRequest) {
  try {
    const { message, contractId, context: initialContext, conversationHistory } = await request.json()
    let context = initialContext || {};

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Always use real OpenAI with real database data
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.' },
        { status: 500 }
      );
    }

    // Detect intent from the message
    const intent = detectIntent(message);
    const tenantId = 'demo'; // TODO: Get from auth

    // Build database context based on detected intent
    let additionalContext = '';
    let contractPreviews: any[] = []; // Store contracts for visual preview cards
    let proactiveAlerts: string[] = []; // Store proactive alerts to show
    let proactiveInsightsData: string[] = []; // Store insights
    
    // Fetch proactive insights on first message or status/dashboard queries
    const isStatusQuery = /status|dashboard|overview|summary|what.*happening|urgent|critical|attention/i.test(message);
    if (isStatusQuery || (!conversationHistory || conversationHistory.length === 0)) {
      const insights = await getProactiveInsights(tenantId);
      proactiveAlerts = insights.criticalAlerts;
      proactiveInsightsData = insights.insights;
      
      // Add urgent contracts to previews if available
      if (insights.urgentContracts.length > 0 && contractPreviews.length === 0) {
        contractPreviews = insights.urgentContracts.map(formatContractForPreview);
      }
      
      // Add proactive alerts to context
      if (proactiveAlerts.length > 0 || proactiveInsightsData.length > 0) {
        additionalContext += `\n\n**⚡ PROACTIVE ALERTS:**\n${proactiveAlerts.join('\n')}\n\n**💡 INSIGHTS:**\n${proactiveInsightsData.join('\n')}`;
      }
    }
    
    // Helper to format contracts for preview cards
    const formatContractForPreview = (c: any) => {
      const expiry = c.expirationDate ? new Date(c.expirationDate) : null;
      const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
      
      return {
        id: c.id,
        name: c.contractTitle || c.name || 'Untitled Contract',
        supplier: c.supplierName,
        status: c.status,
        value: Number(c.totalValue || c.value || 0),
        expirationDate: expiry ? expiry.toISOString() : null,
        daysUntilExpiry: daysUntilExpiry,
        riskLevel: daysUntilExpiry !== null && daysUntilExpiry <= 30 ? 'high' : 
                   daysUntilExpiry !== null && daysUntilExpiry <= 90 ? 'medium' : 'low',
        type: c.contractType || c.type || 'CONTRACT',
      };
    };
    
    // ============================================
    // PROCUREMENT AGENT: Query real database based on intent
    // ============================================
    
    // For list intents - query database and add to context
    if (intent.type === 'list') {
      let contracts: any[] = [];
      if (intent.action === 'list_by_supplier' && intent.entities.supplierName) {
        contracts = await listContractsBySupplier(intent.entities.supplierName, tenantId);
        contractPreviews = contracts.map(formatContractForPreview);
        additionalContext = `\n\n**Contracts with ${intent.entities.supplierName}:**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Status: ${c.status}, Value: $${Number(c.totalValue || 0).toLocaleString()}, Expires: ${c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'N/A'}`
        ).join('\n') || 'No contracts found.'}`;
      } else if (intent.action === 'list_expiring') {
        contracts = await listExpiringContracts(intent.entities.daysUntilExpiry || 30, tenantId, intent.entities.supplierName);
        contractPreviews = contracts.map(formatContractForPreview);
        additionalContext = `\n\n**Contracts Expiring in ${intent.entities.daysUntilExpiry || 30} Days:**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Expires: ${c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'N/A'}, Supplier: ${c.supplierName}, Value: $${Number(c.totalValue || 0).toLocaleString()}`
        ).join('\n') || 'No expiring contracts found.'}`;
      } else if (intent.action === 'list_by_status' && intent.entities.status) {
        contracts = await listContractsByStatus(intent.entities.status, tenantId);
        contractPreviews = contracts.map(formatContractForPreview);
        additionalContext = `\n\n**${intent.entities.status} Contracts:**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Supplier: ${c.supplierName}, Value: $${Number(c.totalValue || 0).toLocaleString()}`
        ).join('\n') || 'No contracts found.'}`;
      } else if (intent.action === 'list_by_value') {
        contracts = await listHighValueContracts(intent.entities.valueThreshold || 100000, tenantId);
        contractPreviews = contracts.map(formatContractForPreview);
        additionalContext = `\n\n**High Value Contracts (>$${(intent.entities.valueThreshold || 100000).toLocaleString()}):**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Supplier: ${c.supplierName}, Value: $${Number(c.totalValue || 0).toLocaleString()}`
        ).join('\n') || 'No high-value contracts found.'}`;
      }
    }
    
    // For analytics intents
    if (intent.type === 'analytics') {
      if (intent.action === 'count') {
        const counts = await countContracts(tenantId, intent.entities.supplierName);
        additionalContext = `\n\n**Contract Counts${intent.entities.supplierName ? ` for ${intent.entities.supplierName}` : ''}:**\n- Total: ${counts.total}\n- Active: ${counts.active}\n- Expiring Soon (90 days): ${counts.expiringSoon}\n- Draft: ${counts.draft || 0}\n- Expired: ${counts.expired || 0}`;
      } else if (intent.action === 'summarize' && intent.entities.supplierName) {
        const summary = await getSupplierSummary(intent.entities.supplierName, tenantId);
        if (summary) {
          additionalContext = `\n\n**Supplier Summary for ${summary.supplierName}:**\n- Total Contracts: ${summary.totalContracts}\n- Active Contracts: ${summary.activeContracts}\n- Total Value: $${summary.totalValue.toLocaleString()}\n- Expiring in 90 Days: ${summary.expiringIn90Days}\n- Contract Types: ${summary.contractTypes?.join(', ') || 'Various'}`;
        }
      } else if (intent.action === 'deep_analysis') {
        // ADVANCED AI AGENT: Deep Analysis
        const analysis = await performDeepAnalysis(tenantId, {
          supplierName: intent.entities.supplierName,
          category: intent.entities.category,
          year: intent.entities.timePeriod,
          analysisAspects: intent.entities.analysisAspects,
        });
        
        // Build comprehensive analysis context
        const filterDesc = [
          intent.entities.supplierName && `Supplier: ${intent.entities.supplierName}`,
          intent.entities.category && `Category: ${intent.entities.category}`,
          intent.entities.timePeriod && `Year: ${intent.entities.timePeriod}`,
        ].filter(Boolean).join(' | ') || 'All Contracts';
        
        additionalContext = `\n\n**📊 Deep Analysis Report**\n*Filters: ${filterDesc}*\n`;
        
        if (analysis.summary.totalContracts === 0) {
          additionalContext += `\nNo contracts found matching the specified criteria.`;
        } else {
          // Summary Section
          additionalContext += `\n**Summary:**\n`;
          additionalContext += `- Total Contracts: ${analysis.summary.totalContracts}\n`;
          additionalContext += `- Active Contracts: ${analysis.summary.activeContracts}\n`;
          additionalContext += `- Total Value: $${analysis.summary.totalValue.toLocaleString()}\n`;
          additionalContext += `- Average Value: $${Math.round(analysis.summary.averageValue).toLocaleString()}\n`;
          
          // Duration Analysis
          if (analysis.summary.averageDurationMonths > 0) {
            additionalContext += `\n**Duration Analysis:**\n`;
            additionalContext += `- Average Duration: ${analysis.summary.averageDurationMonths} months\n`;
            additionalContext += `- Shortest: ${analysis.summary.shortestDurationMonths} months\n`;
            additionalContext += `- Longest: ${analysis.summary.longestDurationMonths} months\n`;
          }
          
          // Category Breakdown
          const categories = Object.entries(analysis.byCategory);
          if (categories.length > 0) {
            additionalContext += `\n**By Category:**\n`;
            categories.slice(0, 8).forEach(([cat, data]) => {
              additionalContext += `- ${cat}: ${data.count} contracts, $${data.value.toLocaleString()}\n`;
            });
          }
          
          // Status Breakdown
          const statuses = Object.entries(analysis.byStatus);
          if (statuses.length > 0) {
            additionalContext += `\n**By Status:**\n`;
            statuses.forEach(([status, count]) => {
              additionalContext += `- ${status}: ${count} contracts\n`;
            });
          }
          
          // Risk Analysis
          if (analysis.riskAnalysis.expiringIn90Days > 0 || analysis.riskAnalysis.autoRenewalCount > 0) {
            additionalContext += `\n**⚠️ Risk Alerts:**\n`;
            if (analysis.riskAnalysis.expiringIn30Days > 0) {
              additionalContext += `- 🔴 Expiring in 30 days: ${analysis.riskAnalysis.expiringIn30Days}\n`;
            }
            if (analysis.riskAnalysis.expiringIn90Days > 0) {
              additionalContext += `- 🟠 Expiring in 90 days: ${analysis.riskAnalysis.expiringIn90Days}\n`;
            }
            if (analysis.riskAnalysis.autoRenewalCount > 0) {
              additionalContext += `- 🔄 Auto-renewal enabled: ${analysis.riskAnalysis.autoRenewalCount}\n`;
            }
            if (analysis.riskAnalysis.highValueAtRisk > 0) {
              additionalContext += `- 💰 High-value at risk: ${analysis.riskAnalysis.highValueAtRisk}\n`;
            }
          }
          
          // Top Contracts with Links
          if (analysis.contracts.length > 0) {
            additionalContext += `\n**Top Contracts by Value:**\n`;
            analysis.contracts.slice(0, 10).forEach((c, i) => {
              additionalContext += `${i + 1}. [📄 ${c.title}](/contracts/${c.id}) - $${c.value.toLocaleString()}`;
              if (c.durationMonths > 0) additionalContext += ` (${c.durationMonths} mo)`;
              additionalContext += `\n`;
            });
          }
        }
        
        // Store the full analysis in context for the LLM
        context = { ...context, deepAnalysis: analysis };
      } else if (intent.action === 'compare_contracts') {
        // ============================================
        // MULTI-CONTRACT COMPARISON HANDLER
        // ============================================
        const comparisonEntities = intent.entities.comparisonEntities as string[];
        
        if (comparisonEntities && comparisonEntities.length >= 2) {
          const entity1 = comparisonEntities[0] || '';
          const entity2 = comparisonEntities[1] || '';
          
          console.log(`[AI Chat] Performing contract comparison: "${entity1}" vs "${entity2}"`);
          
          const comparison = await performContractComparison(
            entity1,
            entity2,
            tenantId,
            intent.entities.comparisonAspects as any
          );
          
          // Build comprehensive comparison context
          additionalContext = `\n\n**🔍 Contract Comparison: ${entity1} vs ${entity2}**\n`;
          
          if (!comparison.entity1 && !comparison.entity2) {
            additionalContext += `\n❌ Could not find contracts matching either "${entity1}" or "${entity2}". Please verify the supplier or contract names.\n`;
            additionalContext += `\n💡 **Tip:** Try using partial names or check the contracts list for exact names.`;
          } else if (!comparison.entity1) {
            additionalContext += `\n⚠️ Could not find contracts for "${entity1}". `;
            additionalContext += `Found contract(s) for "${entity2}": **${comparison.entity2?.contractTitle}** with ${comparison.entity2?.supplierName}.\n`;
          } else if (!comparison.entity2) {
            additionalContext += `\n⚠️ Could not find contracts for "${entity2}". `;
            additionalContext += `Found contract(s) for "${entity1}": **${comparison.entity1?.contractTitle}** with ${comparison.entity1?.supplierName}.\n`;
          } else {
            // Full comparison available
            additionalContext += `\n---\n`;
            additionalContext += `| Aspect | ${comparison.entity1.supplierName} | ${comparison.entity2.supplierName} |\n`;
            additionalContext += `|--------|----------|----------|\n`;
            additionalContext += `| **Contract** | ${comparison.entity1.contractTitle} | ${comparison.entity2.contractTitle} |\n`;
            additionalContext += `| **Status** | ${comparison.entity1.status} | ${comparison.entity2.status} |\n`;
            
            // Add value row
            const formatCurrency = (val: number, curr: string = 'USD') => 
              new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(val);
            
            additionalContext += `| **Total Value** | ${formatCurrency(comparison.entity1.totalValue, comparison.entity1.currency || 'USD')} | ${formatCurrency(comparison.entity2.totalValue, comparison.entity2.currency || 'USD')} |\n`;
            additionalContext += `| **Annual Value** | ${formatCurrency(comparison.entity1.annualValue || 0)} | ${formatCurrency(comparison.entity2.annualValue || 0)} |\n`;
            additionalContext += `| **Duration** | ${comparison.entity1.durationMonths} months | ${comparison.entity2.durationMonths} months |\n`;
            additionalContext += `| **Category** | ${comparison.entity1.categoryL1 || 'N/A'} | ${comparison.entity2.categoryL1 || 'N/A'} |\n`;
            additionalContext += `| **Payment Terms** | ${comparison.entity1.paymentTerms || 'N/A'} | ${comparison.entity2.paymentTerms || 'N/A'} |\n`;
            additionalContext += `| **Auto-Renewal** | ${comparison.entity1.autoRenewalEnabled ? '✅ Yes' : '❌ No'} | ${comparison.entity2.autoRenewalEnabled ? '✅ Yes' : '❌ No'} |\n`;
            additionalContext += `| **Notice Period** | ${comparison.entity1.noticePeriodDays ? `${comparison.entity1.noticePeriodDays} days` : 'N/A'} | ${comparison.entity2.noticePeriodDays ? `${comparison.entity2.noticePeriodDays} days` : 'N/A'} |\n`;
            
            // Expiration dates
            const formatDate = (d: Date | null) => d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
            additionalContext += `| **Expires** | ${formatDate(comparison.entity1.expirationDate)} | ${formatDate(comparison.entity2.expirationDate)} |\n`;
            additionalContext += `\n---\n`;
            
            // Key Differences Section
            if (comparison.differences.length > 0) {
              additionalContext += `\n**📋 Key Differences (${comparison.differences.length}):**\n`;
              comparison.differences.slice(0, 12).forEach((diff, i) => {
                additionalContext += `\n**${i + 1}. ${diff.label}**\n`;
                additionalContext += `   • ${entity1}: ${diff.value1}\n`;
                additionalContext += `   • ${entity2}: ${diff.value2}\n`;
                additionalContext += `   • _${diff.analysis}_\n`;
              });
            }
            
            // Similarities Section
            if (comparison.similarities.length > 0) {
              additionalContext += `\n**✅ Similarities (${comparison.similarities.length}):**\n`;
              comparison.similarities.slice(0, 8).forEach(sim => {
                additionalContext += `- ${sim.label}: ${sim.sharedValue}\n`;
              });
            }
            
            // Key Insights
            if (comparison.keyInsights.length > 0) {
              additionalContext += `\n**💡 Key Insights:**\n`;
              comparison.keyInsights.forEach(insight => {
                additionalContext += `- ${insight}\n`;
              });
            }
            
            // Rate comparison if both have rates
            if (comparison.entity1.rates && comparison.entity1.rates.length > 0 && 
                comparison.entity2.rates && comparison.entity2.rates.length > 0) {
              additionalContext += `\n**💰 Rate Card Comparison:**\n`;
              additionalContext += `| Role | ${comparison.entity1.supplierName} | ${comparison.entity2.supplierName} | Difference |\n`;
              additionalContext += `|------|----------|----------|------------|\n`;
              
              // Build rate comparison table
              const roles1 = new Map(comparison.entity1.rates.map(r => [r.roleName.toLowerCase(), r]));
              const roles2 = new Map(comparison.entity2.rates.map(r => [r.roleName.toLowerCase(), r]));
              const allRolesArray = Array.from(new Set([...Array.from(roles1.keys()), ...Array.from(roles2.keys())]));
              
              let rateRowCount = 0;
              for (const role of allRolesArray) {
                if (rateRowCount >= 8) break; // Limit to 8 rows
                const r1 = roles1.get(role);
                const r2 = roles2.get(role);
                if (r1 && r2) {
                  const diff = r1.rate - r2.rate;
                  const pct = r2.rate > 0 ? Math.round((diff / r2.rate) * 100) : 0;
                  additionalContext += `| ${r1.roleName} | ${formatCurrency(r1.rate)}/${r1.unit} | ${formatCurrency(r2.rate)}/${r2.unit} | ${diff > 0 ? '+' : ''}${pct}% |\n`;
                  rateRowCount++;
                }
              }
            }
            
            // Recommendation
            additionalContext += `\n**🎯 Recommendation:**\n${comparison.recommendation}\n`;
            
            // Quick actions
            additionalContext += `\n**Quick Actions:**\n`;
            additionalContext += `- [📄 View ${comparison.entity1.contractTitle}](/contracts/${comparison.entity1.id})\n`;
            additionalContext += `- [📄 View ${comparison.entity2.contractTitle}](/contracts/${comparison.entity2.id})\n`;
          }
          
          // Store comparison in context for LLM
          context = { ...context, contractComparison: comparison };
        } else {
          additionalContext += `\n\n⚠️ Please specify two contracts or suppliers to compare. For example: "Compare Deloitte vs Accenture contracts" or "What's the difference between Microsoft MSA and IBM services agreement?"`;
        }
      } else if (intent.action === 'compare_clauses') {
        // ============================================
        // CLAUSE-SPECIFIC COMPARISON HANDLER
        // ============================================
        const comparisonEntities = intent.entities.comparisonEntities as string[];
        const clauseType = intent.entities.clauseType as string || 'termination';
        
        if (comparisonEntities && comparisonEntities.length >= 2) {
          const entity1 = comparisonEntities[0] || '';
          const entity2 = comparisonEntities[1] || '';
          
          console.log(`[AI Chat] Comparing ${clauseType} clauses: "${entity1}" vs "${entity2}"`);
          
          const clauseComparison = await compareContractClauses(
            entity1,
            entity2,
            clauseType,
            tenantId
          );
          
          additionalContext = `\n\n**📑 ${clauseType.charAt(0).toUpperCase() + clauseType.slice(1)} Clause Comparison**\n`;
          additionalContext += `*Comparing ${entity1} vs ${entity2}*\n\n`;
          
          additionalContext += `**Analysis:** ${clauseComparison.analysis}\n\n`;
          
          if (clauseComparison.differences.length > 0) {
            additionalContext += `**Key Differences:**\n`;
            clauseComparison.differences.forEach(diff => {
              additionalContext += `- ${diff}\n`;
            });
            additionalContext += `\n`;
          }
          
          if (clauseComparison.entity1Clause) {
            additionalContext += `**${entity1} Clause:**\n> ${clauseComparison.entity1Clause.substring(0, 400)}${clauseComparison.entity1Clause.length > 400 ? '...' : ''}\n\n`;
          }
          
          if (clauseComparison.entity2Clause) {
            additionalContext += `**${entity2} Clause:**\n> ${clauseComparison.entity2Clause.substring(0, 400)}${clauseComparison.entity2Clause.length > 400 ? '...' : ''}\n\n`;
          }
          
          additionalContext += `**🎯 Recommendation:** ${clauseComparison.recommendation}\n`;
          
          context = { ...context, clauseComparison };
        } else {
          additionalContext += `\n\n⚠️ Please specify two contracts or suppliers to compare clauses. For example: "Compare termination clauses in Deloitte and Accenture contracts"`;
        }
      } else if (intent.action === 'compare_groups') {
        // ============================================
        // MULTI-CONTRACT GROUP COMPARISON HANDLER
        // Compare all contracts from one supplier/year vs another
        // ============================================
        const comparisonGroups = intent.entities.comparisonGroups as Array<{supplier?: string; year?: string; category?: string}>;
        
        if (comparisonGroups && comparisonGroups.length >= 2) {
          console.log('[AI Chat] Performing group comparison:', comparisonGroups);
          
          const groupComparison = await performGroupComparison(comparisonGroups, tenantId);
          
          additionalContext = `\n\n**📊 Contract Group Comparison**\n`;
          additionalContext += `*Comparing ${comparisonGroups.map(g => `${g.supplier || 'All'}${g.year ? ` (${g.year})` : ''}`).join(' vs ')}*\n\n`;
          
          if (groupComparison.groups.length === 0) {
            additionalContext += `❌ No contracts found for the specified criteria. Please check supplier names and try again.\n`;
          } else {
            // Summary table header
            additionalContext += `| Metric |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${g.label} |`;
            });
            additionalContext += `\n|--------|`;
            groupComparison.groups.forEach(() => {
              additionalContext += `----------|`;
            });
            additionalContext += `\n`;
            
            // Row: Contract Count
            additionalContext += `| **Contract Count** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${g.contractCount} |`;
            });
            additionalContext += `\n`;
            
            // Row: Total Value
            const formatCurrency = (val: number, curr: string = 'USD') => 
              new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(val);
            
            additionalContext += `| **Total Value** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${formatCurrency(g.totalValue)} |`;
            });
            additionalContext += `\n`;
            
            // Row: Average Value
            additionalContext += `| **Average Value** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${formatCurrency(g.avgValue)} |`;
            });
            additionalContext += `\n`;
            
            // Row: Average Duration
            additionalContext += `| **Avg Duration** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${g.avgDurationMonths.toFixed(1)} months |`;
            });
            additionalContext += `\n`;
            
            // Row: Active Contracts
            additionalContext += `| **Active** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${g.activeCount} |`;
            });
            additionalContext += `\n`;
            
            // Row: Expiring Soon (30 days)
            additionalContext += `| **Expiring Soon** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${g.expiringSoonCount} |`;
            });
            additionalContext += `\n\n`;
            
            // Key Insights
            if (groupComparison.insights.length > 0) {
              additionalContext += `**💡 Key Insights:**\n`;
              groupComparison.insights.forEach(insight => {
                additionalContext += `- ${insight}\n`;
              });
              additionalContext += `\n`;
            }
            
            // Category Breakdown
            if (groupComparison.categoryBreakdown && Object.keys(groupComparison.categoryBreakdown).length > 0) {
              additionalContext += `**📁 Category Breakdown:**\n`;
              additionalContext += `| Category |`;
              groupComparison.groups.forEach(g => {
                additionalContext += ` ${g.label} |`;
              });
              additionalContext += `\n|----------|`;
              groupComparison.groups.forEach(() => {
                additionalContext += `----------|`;
              });
              additionalContext += `\n`;
              
              Object.keys(groupComparison.categoryBreakdown).slice(0, 8).forEach(cat => {
                additionalContext += `| ${cat} |`;
                groupComparison.groups.forEach((g, idx) => {
                  const catData = groupComparison.categoryBreakdown?.[cat]?.[idx];
                  additionalContext += ` ${catData?.count || 0} (${formatCurrency(catData?.value || 0)}) |`;
                });
                additionalContext += `\n`;
              });
              additionalContext += `\n`;
            }
            
            // Rate comparison if available
            if (groupComparison.rateComparison && groupComparison.rateComparison.length > 0) {
              additionalContext += `**💰 Average Rates by Role:**\n`;
              additionalContext += `| Role |`;
              groupComparison.groups.forEach(g => {
                additionalContext += ` ${g.label} |`;
              });
              additionalContext += ` Difference |\n`;
              additionalContext += `|------|`;
              groupComparison.groups.forEach(() => {
                additionalContext += `----------|`;
              });
              additionalContext += `------------|\n`;
              
              groupComparison.rateComparison.slice(0, 10).forEach(r => {
                additionalContext += `| ${r.role} |`;
                r.rates.forEach(rate => {
                  additionalContext += ` ${formatCurrency(rate)} |`;
                });
                const rate0 = r.rates[0] ?? 0;
                const rate1 = r.rates[1] ?? 1;
                const diff = r.rates.length >= 2 ? ((rate0 - rate1) / rate1 * 100).toFixed(1) : '0';
                additionalContext += ` ${parseFloat(diff) > 0 ? '+' : ''}${diff}% |\n`;
              });
              additionalContext += `\n`;
            }
            
            // Recommendation
            additionalContext += `**🎯 Recommendation:**\n${groupComparison.recommendation}\n`;
          }
          
          context = { ...context, groupComparison };
        } else {
          additionalContext += `\n\n⚠️ Please specify at least two groups to compare. For example: "Compare all Deloitte 2024 contracts vs Accenture 2024" or "Compare IT Services category vs Consulting category"`;
        }
      }
    }
    
    // For workflow intents
    if (intent.type === 'workflow') {
      const matchedContracts = await findMatchingContracts(intent.entities, tenantId);
      
      if (matchedContracts.length > 0) {
        additionalContext += `\n\n**Matching Contracts Found:**\n${matchedContracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Supplier: ${c.supplierName || 'Unknown'}, Status: ${c.status}, Value: $${Number(c.totalValue || 0).toLocaleString()}`
        ).join('\n')}`;
      }
      
      // For create_linked, also find parent contracts
      if (intent.action === 'create_linked') {
        if (intent.entities.supplierName) {
          const masterAgreements = await findMasterAgreements(intent.entities.supplierName, tenantId, intent.entities.parentYear);
          if (masterAgreements.length > 0) {
            additionalContext += `\n\n**Master Agreements to link to:**\n${masterAgreements.map(m => 
              `- [${m.contractTitle}](/contracts/${m.id}) - Status: ${m.status}, Value: $${Number(m.totalValue || 0).toLocaleString()}`
            ).join('\n')}`;
          }
        }
      }
    }
    
    // For action intents (hierarchy view)
    if (intent.type === 'action' && intent.action === 'show_hierarchy' && intent.entities.contractName) {
      const contracts = await findMatchingContracts({ contractName: intent.entities.contractName }, tenantId);
      const firstContract = contracts[0];
      if (firstContract) {
        const hierarchy = await getContractHierarchy(firstContract.id, tenantId);
        if (hierarchy) {
          additionalContext += `\n\n**Contract Hierarchy for ${hierarchy.contractTitle}:**`;
          if (hierarchy.parentContract) {
            additionalContext += `\n- Parent: [${hierarchy.parentContract.contractTitle}](/contracts/${hierarchy.parentContract.id}) (${hierarchy.parentContract.status})`;
          }
          additionalContext += `\n- Current: [${hierarchy.contractTitle}](/contracts/${hierarchy.id}) (${hierarchy.status}, Value: $${Number(hierarchy.totalValue || 0).toLocaleString()})`;
          if (hierarchy.childContracts && hierarchy.childContracts.length > 0) {
            additionalContext += `\n- Children (${hierarchy.childContracts.length}):\n${hierarchy.childContracts.map((c: any) => 
              `  - [${c.contractTitle}](/contracts/${c.id}) (${c.contractType}, ${c.status})`
            ).join('\n')}`;
          }
        }
      }
    }
    
    // For procurement analytics intents
    if (intent.type === 'procurement') {
      if (intent.action === 'spend_analysis') {
        const spendData = await getSpendAnalysis(tenantId, intent.entities.supplierName);
        additionalContext += `\n\n**Spend Analysis${intent.entities.supplierName ? ` for ${intent.entities.supplierName}` : ''}:**`;
        additionalContext += `\n- Total Contracts: ${spendData?.totalContracts || 0}`;
        additionalContext += `\n- Total Spend: $${(spendData?.totalSpend || 0).toLocaleString()}`;
        additionalContext += `\n- Annual Run Rate: $${(spendData?.annualSpend || 0).toLocaleString()}`;
        if (spendData?.bySupplier) {
          additionalContext += `\n\nTop Suppliers by Spend:\n${spendData.bySupplier.slice(0, 10).map(([name, data]: [string, any], i: number) => 
            `${i + 1}. ${name}: $${data.value.toLocaleString()} (${data.count} contracts)`
          ).join('\n')}`;
        }
        if (spendData?.byCategory && spendData.byCategory.length > 0) {
          additionalContext += `\n\nSpend by Category:\n${spendData.byCategory.slice(0, 5).map(([name, data]: [string, any]) => 
            `- ${name}: $${data.value.toLocaleString()}`
          ).join('\n')}`;
        }
      } else if (intent.action === 'savings_opportunities') {
        const savingsData = await getCostSavingsOpportunities(tenantId);
        additionalContext += `\n\n**Cost Savings Opportunities:**`;
        additionalContext += `\n- Total Opportunities: ${savingsData.count}`;
        additionalContext += `\n- Potential Savings: $${savingsData.totalPotentialSavings.toLocaleString()}`;
        if (savingsData.opportunities.length > 0) {
          additionalContext += `\n\nTop Opportunities:\n${savingsData.opportunities.slice(0, 5).map((opp: any, i: number) => 
            `${i + 1}. ${opp.title}: $${Number(opp.potentialSavingsAmount).toLocaleString()} potential savings\n   - Category: ${opp.category} | Confidence: ${opp.confidence}\n   - Contract: ${opp.contract?.contractTitle || 'N/A'}`
          ).join('\n')}`;
        }
      } else if (intent.action === 'risk_assessment') {
        const riskData = await getRiskAssessment(tenantId);
        additionalContext += `\n\n**Risk Assessment:**`;
        additionalContext += `\n- Critical Risk: ${riskData.criticalCount} contracts`;
        additionalContext += `\n- High Risk: ${riskData.highRiskCount} contracts`;
        additionalContext += `\n- Auto-Renewal Enabled: ${riskData.autoRenewalCount} contracts`;
        if (riskData.contracts.length > 0) {
          additionalContext += `\n\nContracts Requiring Attention:\n${riskData.contracts.slice(0, 8).map((c: any, i: number) => 
            `${i + 1}. [📄 ${c.contractTitle}](/contracts/${c.id})\n   - Risk Level: ${c.expirationRisk || 'HIGH'} | Days Until Expiry: ${c.daysUntilExpiry || 'N/A'}\n   - Supplier: ${c.supplierName} | Auto-Renew: ${c.autoRenewalEnabled ? 'Yes' : 'No'}`
          ).join('\n')}`;
        }
      } else if (intent.action === 'compliance_status') {
        const complianceData = await getComplianceStatus(tenantId, intent.entities.supplierName);
        additionalContext += `\n\n**Compliance Status${intent.entities.supplierName ? ` for ${intent.entities.supplierName}` : ''}:**`;
        additionalContext += `\n- Total Contracts: ${complianceData.totalContracts}`;
        const compliancePercent = complianceData.totalContracts > 0 
          ? Math.round(complianceData.compliantCount / complianceData.totalContracts * 100) 
          : 0;
        additionalContext += `\n- Compliant: ${complianceData.compliantCount} (${compliancePercent}%)`;
        additionalContext += `\n- Issues Found: ${complianceData.issueCount}`;
        if (complianceData.contracts.length > 0) {
          additionalContext += `\n\nContracts with Issues:\n${complianceData.contracts.slice(0, 5).map((c: any) => 
            `- [📄 ${c.contractTitle}](/contracts/${c.id}) (Score: ${c.complianceScore}%, Issues: ${c.issueCount})`
          ).join('\n')}`;
        }
      } else if (intent.action === 'supplier_performance' && intent.entities.supplierName) {
        const performanceData = await getSupplierPerformance(tenantId, intent.entities.supplierName);
        additionalContext += `\n\n**Supplier Performance for ${intent.entities.supplierName}:**`;
        additionalContext += `\n- Overall Score: ${performanceData.overallScore}%`;
        additionalContext += `\n- Delivery Score: ${performanceData.deliveryScore}%`;
        additionalContext += `\n- Quality Score: ${performanceData.qualityScore}%`;
        additionalContext += `\n- Communication Score: ${performanceData.communicationScore}%`;
        additionalContext += `\n- Value Score: ${performanceData.valueScore}%`;
        additionalContext += `\n- Active Contracts: ${performanceData.activeContracts}`;
        additionalContext += `\n- Total Value: $${performanceData.totalValue.toLocaleString()}`;
        additionalContext += `\n- Relationship Duration: ${performanceData.relationshipMonths} months`;
      } else if (intent.action === 'rate_comparison') {
        const rateData = await getRateComparison(tenantId, intent.entities.supplierName);
        additionalContext += `\n\n**Rate Comparison${intent.entities.supplierName ? ` for ${intent.entities.supplierName}` : ''}:**`;
        additionalContext += `\n- Rate Cards Analyzed: ${rateData.rateCards.length}`;
        if (rateData.rateCards.length > 0) {
          const avgVariance = rateData.rateCards.reduce((sum: number, c: any) => sum + c.vsMarket, 0) / rateData.rateCards.length;
          additionalContext += `\n- Overall Position: ${avgVariance < 0 ? 'Below Market' : avgVariance < 10 ? 'At Market' : 'Above Market'} (${avgVariance > 0 ? '+' : ''}${avgVariance.toFixed(1)}% vs market)`;
          additionalContext += `\n\nRate Details:\n${rateData.rateCards.slice(0, 8).map((card: any) => 
            `- ${card.roleName}: $${card.rate}/hr (Market: $${card.marketRate}/hr, ${card.vsMarket > 0 ? '+' : ''}${card.vsMarket}%)`
          ).join('\n')}`;
        }
      } else if (intent.action === 'top_suppliers') {
        const spendData = await getSpendAnalysis(tenantId);
        if (spendData) {
          additionalContext += `\n\n**Top Suppliers by Spend:**`;
          additionalContext += `\n- Total Suppliers: ${spendData.bySupplier.length}`;
          additionalContext += `\n\nRanking:\n${spendData.bySupplier.slice(0, 10).map(([name, data]: [string, any], i: number) => 
            `${i + 1}. ${name}: $${data.value.toLocaleString()} (${data.count} contracts)`
          ).join('\n')}`;
        } else {
          additionalContext += `\n\n**Top Suppliers:** Unable to retrieve spend data.`;
        }
      } else if (intent.action === 'auto_renewals') {
        const riskData = await getRiskAssessment(tenantId);
        const autoRenewalContracts = riskData.contracts.filter((c: any) => c.autoRenewalEnabled);
        additionalContext += `\n\n**Auto-Renewal Contracts:**`;
        additionalContext += `\n- Total with Auto-Renewal: ${riskData.autoRenewalCount}`;
        additionalContext += `\n- Renewing in 90 Days: ${autoRenewalContracts.filter((c: any) => c.daysUntilExpiry && c.daysUntilExpiry <= 90).length}`;
        if (autoRenewalContracts.length > 0) {
          additionalContext += `\n\nContracts:\n${autoRenewalContracts.slice(0, 8).map((c: any) => 
            `- ${c.contractTitle} (Supplier: ${c.supplierName}, Renews: ${c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'N/A'})`
          ).join('\n')}`;
        }
      }
    }

    // For comparison intents
    if (intent.type === 'comparison') {
      if (intent.action === 'compare_contracts' && intent.entities.contractA && intent.entities.contractB) {
        const comparison = await compareContracts(
          intent.entities.contractA,
          intent.entities.contractB,
          tenantId
        );
        
        additionalContext += `\n\n${comparison.summary}`;
        
        if (comparison.contractA && comparison.contractB && comparison.comparison.length > 0) {
          additionalContext += `\n\n**Side-by-Side Comparison:**\n`;
          additionalContext += `| Field | ${comparison.contractA.fileName} | ${comparison.contractB.fileName} | Status |\n`;
          additionalContext += `|-------|----------|----------|--------|\n`;
          comparison.comparison.forEach(c => {
            const statusIcon = c.difference === 'same' ? '✓' : 
              c.difference === 'better_a' ? '⬆️' :
              c.difference === 'better_b' ? '⬇️' :
              c.difference === 'na' ? '—' : '≠';
            additionalContext += `| ${c.field} | ${c.valueA} | ${c.valueB} | ${statusIcon} |\n`;
          });
          
          // Add contract preview cards
          contractPreviews.push(
            formatContractForPreview(comparison.contractA),
            formatContractForPreview(comparison.contractB)
          );
        }
        
        context = { ...context, comparison };
      } else if (intent.action === 'compare_suppliers' && intent.entities.supplierA && intent.entities.supplierB) {
        // Compare contracts from two different suppliers
        const [supplierAContracts, supplierBContracts] = await Promise.all([
          prisma.contract.findMany({
            where: { tenantId, supplierName: { contains: intent.entities.supplierA, mode: 'insensitive' } },
            orderBy: { totalValue: 'desc' },
            take: 10,
          }),
          prisma.contract.findMany({
            where: { tenantId, supplierName: { contains: intent.entities.supplierB, mode: 'insensitive' } },
            orderBy: { totalValue: 'desc' },
            take: 10,
          }),
        ]);
        
        const calcStats = (contracts: any[]) => ({
          count: contracts.length,
          totalValue: contracts.reduce((s, c) => s + Number(c.totalValue || 0), 0),
          avgValue: contracts.length > 0 ? contracts.reduce((s, c) => s + Number(c.totalValue || 0), 0) / contracts.length : 0,
          activeCount: contracts.filter(c => c.status === 'ACTIVE').length,
        });
        
        const statsA = calcStats(supplierAContracts);
        const statsB = calcStats(supplierBContracts);
        
        additionalContext += `\n\n## Supplier Comparison: ${intent.entities.supplierA} vs ${intent.entities.supplierB}\n\n`;
        additionalContext += `| Metric | ${intent.entities.supplierA} | ${intent.entities.supplierB} |\n`;
        additionalContext += `|--------|----------|----------|\n`;
        additionalContext += `| Total Contracts | ${statsA.count} | ${statsB.count} |\n`;
        additionalContext += `| Total Value | $${statsA.totalValue.toLocaleString()} | $${statsB.totalValue.toLocaleString()} |\n`;
        additionalContext += `| Average Contract Value | $${Math.round(statsA.avgValue).toLocaleString()} | $${Math.round(statsB.avgValue).toLocaleString()} |\n`;
        additionalContext += `| Active Contracts | ${statsA.activeCount} | ${statsB.activeCount} |\n`;
        
        // Determine which is better overall
        if (statsA.totalValue !== statsB.totalValue) {
          const higher = statsA.totalValue > statsB.totalValue ? intent.entities.supplierA : intent.entities.supplierB;
          additionalContext += `\n💰 **${higher}** has higher total contract value.`;
        }
        
        context = { ...context, supplierComparison: { supplierA: intent.entities.supplierA, supplierB: intent.entities.supplierB, statsA, statsB } };
      } else if (intent.action === 'side_by_side') {
        additionalContext += `\n\n**Side-by-Side Comparison:**\nTo compare contracts, please specify which contracts you'd like to compare. For example:\n- "Compare Contract A with Contract B"\n- "Compare Acme Corp contract vs Globex contract"\n- "What's different between MSA 2024 and MSA 2023"`;
      }
    }

    // For taxonomy intents
    if (intent.type === 'taxonomy') {
      if (intent.action === 'list_categories') {
        const taxonomyData = await getTaxonomyCategories(tenantId);
        additionalContext += `\n\n**Taxonomy Categories:**`;
        additionalContext += `\n- Total Categories: ${taxonomyData.stats.totalCategories}`;
        additionalContext += `\n- L1 Categories: ${taxonomyData.stats.totalL1}`;
        additionalContext += `\n- L2 Subcategories: ${taxonomyData.stats.totalL2}`;
        if (taxonomyData.hierarchy.length > 0) {
          additionalContext += `\n\nTop-Level Categories:\n${taxonomyData.hierarchy.slice(0, 10).map((cat: any, i: number) => 
            `${i + 1}. ${cat.name} (${cat.path || 'N/A'}) - ${cat.children?.length || 0} subcategories`
          ).join('\n')}`;
        }
        context = { ...context, taxonomyData };
      } else if (intent.action === 'category_details' && intent.entities.category) {
        const categoryDetails = await getCategoryDetails(intent.entities.category, tenantId);
        if (categoryDetails) {
          additionalContext += `\n\n**Category Details for ${categoryDetails.name}:**`;
          additionalContext += `\n- Path: ${categoryDetails.path || 'N/A'}`;
          additionalContext += `\n- Level: L${categoryDetails.level}`;
          if (categoryDetails.children && categoryDetails.children.length > 0) {
            additionalContext += `\n\nSubcategories: ${categoryDetails.children.map((c: any) => c.name).join(', ')}`;
          }
          context = { ...context, categoryDetails };
        }
      } else if (intent.action === 'suggest_category' && intent.entities.contractName) {
        const categorySuggestion = await suggestCategoryForContract(intent.entities.contractName, tenantId);
        if (categorySuggestion) {
          additionalContext += `\n\n**Category Suggestion for "${intent.entities.contractName}":**`;
          if (categorySuggestion.currentCategory) {
            additionalContext += `\n- Current Category: ${categorySuggestion.currentCategory.name}`;
          } else {
            additionalContext += `\n- Currently uncategorized`;
          }
          if (categorySuggestion.suggestions.length > 0) {
            additionalContext += `\n\nSuggested Categories:\n${categorySuggestion.suggestions.slice(0, 5).map((s: any, i: number) => 
              `${i + 1}. ${s.name} (${s.code})`
            ).join('\n')}`;
          }
          context = { ...context, categorySuggestion };
        }
      } else if (intent.action === 'browse_taxonomy' && intent.entities.category) {
        const categoryContracts = await getContractsInCategory(intent.entities.category, tenantId);
        if (categoryContracts) {
          additionalContext += `\n\n**Contracts in ${categoryContracts.category.name}:**`;
          additionalContext += `\n- Total Contracts: ${categoryContracts.totalContracts}`;
          additionalContext += `\n- Total Value: $${categoryContracts.totalValue.toLocaleString()}`;
          if (categoryContracts.contracts.length > 0) {
            additionalContext += `\n\nContracts:\n${categoryContracts.contracts.slice(0, 10).map((c: any, i: number) => 
              `${i + 1}. [📄 ${c.contractTitle}](/contracts/${c.id}) - ${c.supplierName} - $${Number(c.totalValue || 0).toLocaleString()}`
            ).join('\n')}`;
          }
          context = { ...context, categoryContracts };
        }
      }
    }

    // Call OpenAI with the enriched context
    const response = await getOpenAIResponse(message, conversationHistory || [], { 
      contractId, 
      context,
      intent,
      additionalContext,
    });

    // Add contract previews to response if we have them
    if (contractPreviews.length > 0) {
      response.contractPreviews = contractPreviews;
    }

    // Add proactive alerts and insights to response
    if (proactiveAlerts.length > 0) {
      response.proactiveAlerts = proactiveAlerts;
    }
    if (proactiveInsightsData.length > 0) {
      response.proactiveInsights = proactiveInsightsData;
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Chat API error:', error);
    
    // Generate helpful error response with recovery suggestions
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || 'Failed to process chat message';
    
    let userFriendlyMessage = 'I encountered an issue processing your request.';
    let recoverySuggestions: string[] = [];
    let suggestedActions: { label: string; action: string }[] = [];
    
    // Categorize error and provide specific recovery options
    if (errorMessage.includes('rate limit') || errorCode === 'rate_limit_exceeded') {
      userFriendlyMessage = '⏳ I\'m receiving too many requests right now.';
      recoverySuggestions = [
        'Wait a few seconds and try again',
        'Try a simpler question',
        'Break complex questions into smaller parts',
      ];
      suggestedActions = [
        { label: '🔄 Retry', action: 'retry' },
        { label: '📋 View Contracts', action: 'list-contracts' },
      ];
    } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      userFriendlyMessage = '⏱️ The request took too long to process.';
      recoverySuggestions = [
        'Try a more specific search (e.g., add supplier name or date range)',
        'Ask about a single contract instead of all contracts',
        'Check your internet connection',
      ];
      suggestedActions = [
        { label: '🔄 Retry', action: 'retry' },
        { label: '📋 Show Active Contracts', action: 'list-active' },
      ];
    } else if (errorMessage.includes('OPENAI_API_KEY') || errorMessage.includes('api_key')) {
      userFriendlyMessage = '🔑 AI service is not configured properly.';
      recoverySuggestions = [
        'Contact your administrator to set up the AI service',
        'In the meantime, you can still browse and search contracts manually',
      ];
      suggestedActions = [
        { label: '📋 Browse Contracts', action: 'browse' },
      ];
    } else if (errorMessage.includes('not found') || errorCode === 'NOT_FOUND') {
      userFriendlyMessage = '🔍 I couldn\'t find what you\'re looking for.';
      recoverySuggestions = [
        'Check the spelling of supplier or contract names',
        'Try searching with partial names',
        'Ask me to list all contracts to find what you need',
      ];
      suggestedActions = [
        { label: '📋 List All Contracts', action: 'list-all' },
        { label: '🔍 Search Contracts', action: 'search' },
      ];
    } else if (errorMessage.includes('database') || errorMessage.includes('prisma') || errorMessage.includes('connection')) {
      userFriendlyMessage = '🗄️ I\'m having trouble accessing the contract database.';
      recoverySuggestions = [
        'The database may be temporarily unavailable',
        'Try again in a few moments',
        'If the problem persists, contact support',
      ];
      suggestedActions = [
        { label: '🔄 Retry', action: 'retry' },
      ];
    } else {
      recoverySuggestions = [
        'Try rephrasing your question',
        'Ask a more specific question',
        'Start with a simple query like "show me contracts expiring soon"',
      ];
      suggestedActions = [
        { label: '🔄 Retry', action: 'retry' },
        { label: '📋 Show All Contracts', action: 'list-all' },
        { label: '❓ Help', action: 'help' },
      ];
    }
    
    // Return a user-friendly error response that the UI can display nicely
    return NextResponse.json({
      response: `${userFriendlyMessage}\n\n**What you can try:**\n${recoverySuggestions.map(s => `• ${s}`).join('\n')}`,
      error: true,
      errorCode,
      errorDetails: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      suggestedActions,
      suggestions: recoverySuggestions,
      metadata: {
        intent: null,
        confidence: 0,
        usedRAG: false,
        errorRecovery: true,
      },
    }, { status: 200 }); // Return 200 so the UI can display the friendly error
  }
}

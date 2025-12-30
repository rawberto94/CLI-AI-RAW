/**
 * Intent Detector
 * Analyzes user messages to determine their intent and extract entities
 */

import { DetectedIntent } from './types';
import { CONTRACT_TYPE_ALIASES, STATUS_ALIASES, RISK_LEVEL_ALIASES } from './constants';

function normalizeContractType(input: string | undefined): string {
  if (!input) return 'CONTRACT';
  const lower = input.toLowerCase().trim();
  return CONTRACT_TYPE_ALIASES[lower] || input.toUpperCase();
}

export function detectIntent(query: string): DetectedIntent {
  const lowerQuery = query.toLowerCase();
  
  let contractName: string | undefined;
  let supplierName: string | undefined;
  let match: RegExpMatchArray | null;

  // ============================================
  // CONTRACT CREATION WITH LINKING PATTERNS
  // ============================================

  const createLinkedPattern = /(?:start|create|draft|initiate|begin|I\s+need\s+to\s+start)\s+(?:a\s+)?(?:new\s+)?(sow|statement\s+of\s+work|amendment|addendum|change\s+order|po|purchase\s+order)\s*(?:contract\s+)?(?:with|for)\s+(?:supplier\s+)?([^,]+?)(?:\s*,?\s*(?:linked?\s+to|linking\s+to|under|from|referencing|based\s+on)\s+(?:the\s+)?(?:master\s+)?(?:agreement|msa|contract)(?:\s+from\s+(\d{4}))?)?$/i;
  match = query.match(createLinkedPattern);
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
        relationshipType: `${contractType}_UNDER_MSA`,
      },
      confidence: 0.95,
    };
  }

  // Create amendment/child contract
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
        parentContractType: 'EXISTING',
      },
      confidence: 0.9,
    };
  }

  // Link contracts
  const linkPattern = /(?:link|connect|attach|associate)\s+(?:this\s+)?(?:contract\s+)?(?:to|with)\s+(?:the\s+)?(?:master\s+)?(?:agreement|msa|contract)(?:\s+(?:from\s+)?(\d{4}))?/i;
  match = query.match(linkPattern);
  if (match) {
    const parentYear = match[1];
    return {
      type: 'action',
      action: 'link_contracts',
      entities: { parentYear, parentContractType: 'MSA' },
      confidence: 0.9,
    };
  }

  // Show hierarchy
  const hierarchyPattern = /(?:show|display|what(?:'s|s)?|list)\s+(?:me\s+)?(?:the\s+)?(?:contract\s+)?(?:hierarchy|structure|tree|linked\s+contracts|child\s+contracts|related\s+contracts)(?:\s+(?:for|of)\s+(.+?))?(?:\?|$)/i;
  match = query.match(hierarchyPattern);
  if (match) {
    contractName = match[1]?.trim();
    return {
      type: 'action',
      action: 'show_hierarchy',
      entities: { contractName },
      confidence: 0.9,
    };
  }

  // Find master agreement
  const findMasterPattern = /(?:find|show|get|what)\s+(?:is\s+)?(?:the\s+)?(?:master\s+)?(?:agreement|msa)\s+(?:do\s+we\s+have\s+)?(?:with|for)\s+(?:supplier\s+)?([^?]+)/i;
  match = query.match(findMasterPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'list',
      action: 'find_master',
      entities: { supplierName, contractType: 'MSA' },
      confidence: 0.9,
    };
  }

  // ============================================
  // CONTRACT COMPARISON PATTERNS
  // ============================================

  // Compare two specific contracts
  const compareTwoPattern = /(?:compare|comparison\s+(?:of|between))\s+(.+?)\s+(?:and|with|vs|versus)\s+(.+?)(?:\?|$)/i;
  match = query.match(compareTwoPattern);
  if (match && !lowerQuery.includes('supplier')) {
    contractName = match[1]?.trim();
    const contractB = match[2]?.trim();
    return {
      type: 'comparison',
      action: 'compare_contracts',
      entities: { contractA: contractName, contractB },
      confidence: 0.9,
    };
  }

  // Compare suppliers
  const compareSuppliersPattern = /(?:compare|comparison\s+(?:of|between))\s+(?:suppliers?\s+)?(.+?)\s+(?:and|with|vs|versus)\s+(?:suppliers?\s+)?(.+?)(?:\?|$)/i;
  match = query.match(compareSuppliersPattern);
  if (match && lowerQuery.includes('supplier')) {
    const supplierA = match[1]?.trim();
    const supplierB = match[2]?.trim();
    return {
      type: 'comparison',
      action: 'compare_suppliers',
      entities: { supplierA, supplierB },
      confidence: 0.9,
    };
  }

  // ============================================
  // LIST/SEARCH PATTERNS
  // ============================================

  // List contracts by supplier
  const supplierListPattern = /(?:what|show|list|get|find|display)?\s*(?:me\s+)?(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:with|from|by|for)\s+(?:supplier\s+)?([^?]+?)(?:\s+to\s+be\s+renewed|\s+expiring|\s+that|\?|$)/i;
  match = query.match(supplierListPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'list',
      action: 'list_by_supplier',
      entities: { supplierName },
      confidence: 0.9,
    };
  }

  // Expiring contracts
  const expiringPattern = /(?:what|show|list|get|find|which)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:that\s+)?(?:are\s+)?(?:expiring|expire|due|ending)(?:\s+(?:in|within)\s+(\d+)\s+days?)?/i;
  match = query.match(expiringPattern);
  if (match) {
    const days = match[1] ? parseInt(match[1]) : 30;
    return {
      type: 'list',
      action: 'list_expiring',
      entities: { daysUntilExpiry: days },
      confidence: 0.9,
    };
  }

  // Contracts needing renewal
  const renewalListPattern = /(?:what|show|list|get|find|which)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:that\s+)?(?:need\s+to\s+be|to\s+be|needing)\s+renewed?(?:\s+(?:with|from|by)\s+(?:supplier\s+)?([^?]+))?/i;
  match = query.match(renewalListPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'list',
      action: 'list_expiring',
      entities: { supplierName, daysUntilExpiry: 90 },
      confidence: 0.9,
    };
  }

  // Count contracts
  const countPattern = /(?:how\s+many|count|total|number\s+of)\s+(?:active\s+)?contracts?(?:\s+(?:do\s+we\s+have|with|from|by)\s+(?:supplier\s+)?([^?]+))?/i;
  match = query.match(countPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'analytics',
      action: 'count',
      entities: { supplierName },
      confidence: 0.85,
    };
  }

  // Contracts by status
  const statusPattern = /(?:show|list|get|find|what)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?(active|pending|expired|draft|processing|archived)\s+contracts?/i;
  match = query.match(statusPattern);
  if (match) {
    const status = match[1]?.toUpperCase();
    return {
      type: 'list',
      action: 'list_by_status',
      entities: { status },
      confidence: 0.85,
    };
  }

  // High value contracts
  const valuePattern = /(?:show|list|get|find|what)\s+(?:are\s+)?(?:the\s+)?(?:high[\s-]?value|large|big)\s+contracts?|contracts?\s+(?:over|above|exceeding)\s+\$?([\d,]+)/i;
  match = query.match(valuePattern);
  if (match) {
    const threshold = match[1] ? parseInt(match[1].replace(/,/g, '')) : 100000;
    return {
      type: 'list',
      action: 'list_by_value',
      entities: { valueThreshold: threshold },
      confidence: 0.85,
    };
  }

  // ============================================
  // PROCUREMENT/ANALYTICS PATTERNS
  // ============================================

  // Spend analysis
  const spendPattern = /(?:what(?:'s|s)?|show|total|how\s+much)\s+(?:is\s+)?(?:the\s+)?(?:our\s+)?(?:total\s+)?spend(?:ing)?(?:\s+(?:with|on|for)\s+(?:supplier\s+)?([^?]+))?/i;
  match = query.match(spendPattern);
  if (match) {
    supplierName = match[1]?.trim().replace(/\?$/, '');
    return {
      type: 'procurement',
      action: 'spend_analysis',
      entities: { supplierName },
      confidence: 0.9,
    };
  }

  // Cost savings
  const savingsPattern = /(?:what|show|find|identify|where)\s+(?:are\s+)?(?:the\s+)?(?:potential\s+)?(?:cost\s+)?savings?(?:\s+opportunities)?|where\s+can\s+(?:we|i)\s+save|reduce\s+costs?/i;
  if (savingsPattern.test(lowerQuery)) {
    return {
      type: 'procurement',
      action: 'cost_savings',
      entities: {},
      confidence: 0.9,
    };
  }

  // Top suppliers
  const topSuppliersPattern = /(?:show|what|who)\s+(?:are\s+)?(?:the\s+)?(?:our\s+)?(?:top|biggest|largest|main)\s+(\d+\s+)?suppliers?/i;
  match = query.match(topSuppliersPattern);
  if (match) {
    const topN = match[1] ? parseInt(match[1]) : 10;
    return {
      type: 'procurement',
      action: 'top_suppliers',
      entities: { topN },
      confidence: 0.9,
    };
  }

  // Risk assessment
  const riskPattern = /(?:show|what|which|find)\s+(?:are\s+)?(?:the\s+)?(?:high[\s-]?risk|risky|at[\s-]?risk)\s+(?:contracts?|suppliers?)|risk\s+assessment|contract\s+risks?/i;
  if (riskPattern.test(lowerQuery)) {
    return {
      type: 'procurement',
      action: 'risk_assessment',
      entities: { riskLevel: 'high' },
      confidence: 0.9,
    };
  }

  // Auto-renewals
  const autoRenewalPattern = /(?:show|what|which|find|list)\s+(?:are\s+)?(?:the\s+)?(?:contracts?\s+)?(?:with\s+)?auto[\s-]?renewals?|auto[\s-]?renewing\s+contracts?/i;
  if (autoRenewalPattern.test(lowerQuery)) {
    return {
      type: 'procurement',
      action: 'auto_renewals',
      entities: {},
      confidence: 0.9,
    };
  }

  // ============================================
  // TAXONOMY PATTERNS
  // ============================================

  const listCategoriesPattern = /(?:show|list|what|get)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?categories/i;
  if (listCategoriesPattern.test(lowerQuery)) {
    return {
      type: 'taxonomy',
      action: 'list_categories',
      entities: {},
      confidence: 0.9,
    };
  }

  // ============================================
  // DEFAULT: SEMANTIC SEARCH
  // ============================================

  return {
    type: 'search',
    entities: { searchQuery: query },
    confidence: 0.5,
  };
}

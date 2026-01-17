/**
 * Intent Detector
 * Analyzes user messages to determine their intent and extract entities
 */

import { DetectedIntent } from './types';
import { CONTRACT_TYPE_ALIASES, STATUS_ALIASES, RISK_LEVEL_ALIASES } from './constants';
import { detectHelpIntent } from './action-handlers/help-actions';
import { detectAgentIntent } from './action-handlers/agent-actions';

function normalizeContractType(input: string | undefined): string {
  if (!input) return 'CONTRACT';
  const lower = input.toLowerCase().trim();
  return CONTRACT_TYPE_ALIASES[lower] || input.toUpperCase();
}

export function detectIntent(query: string): DetectedIntent {
  const lowerQuery = query.toLowerCase();
  
  // ============================================
  // HELP PATTERNS - Check first
  // ============================================
  const helpIntent = detectHelpIntent(query);
  if (helpIntent) return helpIntent;

  // ============================================
  // AGENT PATTERNS - Check early for agentic requests
  // ============================================
  const agentIntent = detectAgentIntent(query);
  if (agentIntent) return agentIntent;
  
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
  // VERSION CONTROL PATTERNS
  // ============================================

  // Show version history
  const versionHistoryPattern = /(?:show|view|list|get)\s+(?:me\s+)?(?:the\s+)?(?:version|revision)\s*(?:history|log)?(?:\s+(?:for|of)\s+(.+?))?(?:\?|$)/i;
  match = query.match(versionHistoryPattern);
  if (match || /version\s+history/i.test(lowerQuery)) {
    contractName = match?.[1]?.trim();
    return {
      type: 'version',
      action: 'show_version_history',
      entities: { contractName },
      confidence: 0.9,
    };
  }

  // Compare versions
  const compareVersionsPattern = /compare\s+version\s*(\d+)\s+(?:with|to|and|vs)\s+(?:version\s*)?(\d+)/i;
  match = query.match(compareVersionsPattern);
  if (match) {
    const compareVersionA = parseInt(match[1]);
    const compareVersionB = parseInt(match[2]);
    return {
      type: 'version',
      action: 'compare_versions',
      entities: { compareVersionA, compareVersionB },
      confidence: 0.95,
    };
  }

  // What changed between versions
  const versionDiffPattern = /(?:what|show)\s+(?:changed|differences?)\s+(?:between|from)\s+version\s*(\d+)\s*(?:to|and)\s*(?:version\s*)?(\d+)/i;
  match = query.match(versionDiffPattern);
  if (match) {
    return {
      type: 'version',
      action: 'compare_versions',
      entities: { compareVersionA: parseInt(match[1]), compareVersionB: parseInt(match[2]) },
      confidence: 0.9,
    };
  }

  // Create version/snapshot
  const createVersionPattern = /(?:create|make|save)\s+(?:a\s+)?(?:version|snapshot|backup)(?:\s+(?:of|for)\s+(.+?))?(?:\?|$)/i;
  match = query.match(createVersionPattern);
  if (match || /snapshot\s+(?:the\s+)?(?:current\s+)?(?:contract|state)/i.test(lowerQuery)) {
    contractName = match?.[1]?.trim();
    return {
      type: 'version',
      action: 'create_version',
      entities: { contractName, versionSummary: 'Manual snapshot via chat' },
      confidence: 0.9,
    };
  }

  // Revert to version
  const revertPattern = /(?:revert|roll\s*back|restore|go\s+back)\s+(?:to\s+)?version\s*(\d+)/i;
  match = query.match(revertPattern);
  if (match) {
    return {
      type: 'version',
      action: 'revert_to_version',
      entities: { versionNumber: parseInt(match[1]) },
      confidence: 0.95,
    };
  }

  // Upload new version
  if (/upload\s+(?:a\s+)?new\s+version/i.test(lowerQuery) || /(?:add|attach)\s+(?:a\s+)?(?:new|updated)\s+(?:document|file|version)/i.test(lowerQuery)) {
    return {
      type: 'version',
      action: 'upload_new_version',
      entities: {},
      confidence: 0.9,
    };
  }

  // ============================================
  // CONTRACT CREATION PATTERNS
  // ============================================

  // AI draft patterns
  const aiDraftPattern = /(?:ai|artificial\s+intelligence)\s+(?:help\s+)?(?:me\s+)?(?:draft|create|write)|(?:draft|write|create)\s+(?:an?\s+)?(?:contract|agreement)\s+(?:with\s+)?ai/i;
  if (aiDraftPattern.test(lowerQuery)) {
    return {
      type: 'creation',
      action: 'ai_draft',
      entities: {},
      confidence: 0.9,
    };
  }

  // Draft specific contract types with AI
  const draftTypePattern = /(?:help\s+me\s+)?(?:draft|write)\s+(?:an?\s+)?(nda|msa|sow|sla|employment\s+agreement|consulting\s+agreement|service\s+agreement)/i;
  match = query.match(draftTypePattern);
  if (match) {
    const contractType = match[1]?.toUpperCase();
    return {
      type: 'creation',
      action: 'ai_draft',
      entities: { contractType },
      confidence: 0.9,
    };
  }

  // Quick upload
  if (/(?:quick|fast)\s+upload/i.test(lowerQuery) || /upload\s+(?:a\s+)?(?:new\s+)?(?:contract|document|file)/i.test(lowerQuery)) {
    return {
      type: 'creation',
      action: 'quick_upload',
      entities: {},
      confidence: 0.85,
    };
  }

  // Template generation
  const templatePattern = /(?:use|generate\s+from|start\s+with)\s+(?:a\s+)?template|(?:nda|msa|sow|sla)\s+template/i;
  if (templatePattern.test(lowerQuery)) {
    const typeMatch = lowerQuery.match(/(nda|msa|sow|sla|employment|consulting)/i);
    return {
      type: 'creation',
      action: 'generate_from_template',
      entities: { templateType: typeMatch?.[1]?.toUpperCase() },
      confidence: 0.9,
    };
  }

  // Manual creation
  if (/(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?contract\s+(?:manually|by\s+hand)/i.test(lowerQuery)) {
    return {
      type: 'creation',
      action: 'create_manual',
      entities: {},
      confidence: 0.9,
    };
  }

  // How to create a contract (show options)
  if (/(?:how\s+(?:do\s+i|can\s+i|to))\s+(?:create|add|make)\s+(?:a\s+)?contract/i.test(lowerQuery)) {
    return {
      type: 'creation',
      action: 'create',
      entities: {},
      confidence: 0.85,
    };
  }

  // ============================================
  // REPOSITORY / CONTRACTS LIST PATTERNS
  // ============================================

  // Show expired contracts
  if (/(?:show|list|find|get)\s+(?:all\s+)?(?:my\s+)?expired\s+contracts?/i.test(lowerQuery) ||
      /contracts?\s+(?:that\s+)?(?:have\s+)?expired/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'show_expired',
      entities: {},
      confidence: 0.9,
    };
  }

  // Show expiring soon
  if (/(?:expiring|ending)\s+(?:soon|this\s+month|next\s+month)/i.test(lowerQuery) ||
      /contracts?\s+(?:about\s+to|going\s+to)\s+expire/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'show_expiring',
      entities: {},
      confidence: 0.9,
    };
  }

  // Show high risk
  if (/(?:high\s*risk|risky|critical|at\s*risk)\s+contracts?/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'show_high_risk',
      entities: {},
      confidence: 0.9,
    };
  }

  // ============================================
  // SIGNATURE STATUS PATTERNS
  // ============================================

  // Show unsigned contracts
  if (/(?:unsigned|not\s+signed|missing\s+signature|without\s+signature)\s*contracts?/i.test(lowerQuery) ||
      /contracts?\s+(?:that\s+)?(?:are\s+)?(?:not\s+signed|unsigned|need\s+signature)/i.test(lowerQuery) ||
      /contracts?\s+(?:without|with\s+no|missing)\s+(?:a\s+)?signature/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'show_unsigned',
      entities: { signatureStatus: 'unsigned' },
      confidence: 0.95,
    };
  }

  // Show signed contracts
  if (/(?:show|list|find|get)\s+(?:all\s+)?signed\s+contracts?/i.test(lowerQuery) ||
      /contracts?\s+(?:that\s+)?(?:are\s+)?(?:fully\s+)?signed/i.test(lowerQuery) ||
      /executed\s+contracts?/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'show_signed',
      entities: { signatureStatus: 'signed' },
      confidence: 0.95,
    };
  }

  // Show partially signed contracts
  if (/(?:partially|partly)\s+signed\s+contracts?/i.test(lowerQuery) ||
      /contracts?\s+(?:that\s+)?(?:are\s+)?partially\s+signed/i.test(lowerQuery) ||
      /contracts?\s+(?:with\s+)?(?:some|missing)\s+signatures?/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'show_partially_signed',
      entities: { signatureStatus: 'partially_signed' },
      confidence: 0.95,
    };
  }

  // Show contracts needing signature attention
  if (/contracts?\s+(?:needing|requiring|need|require)\s+(?:signature\s+)?attention/i.test(lowerQuery) ||
      /contracts?\s+flagged\s+for\s+signature/i.test(lowerQuery) ||
      /signature\s+(?:issues?|problems?|attention)/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'show_needing_signature',
      entities: {},
      confidence: 0.95,
    };
  }

  // ============================================
  // DOCUMENT CLASSIFICATION PATTERNS
  // ============================================

  // Show purchase orders
  if (/(?:show|list|find|get)\s+(?:all\s+)?(?:my\s+)?(?:purchase\s+orders?|POs?)/i.test(lowerQuery) ||
      /purchase\s+orders?\s+(?:in\s+the\s+)?(?:system|repository)/i.test(lowerQuery) ||
      /documents?\s+(?:classified|flagged)\s+as\s+(?:purchase\s+orders?|POs?)/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'list_by_document_type',
      entities: { documentType: 'purchase_order' },
      confidence: 0.95,
    };
  }

  // Show invoices
  if (/(?:show|list|find|get)\s+(?:all\s+)?(?:my\s+)?invoices?/i.test(lowerQuery) ||
      /invoices?\s+(?:in\s+the\s+)?(?:system|repository)/i.test(lowerQuery) ||
      /documents?\s+(?:classified|flagged)\s+as\s+invoices?/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'list_by_document_type',
      entities: { documentType: 'invoice' },
      confidence: 0.95,
    };
  }

  // Show quotes/proposals
  if (/(?:show|list|find|get)\s+(?:all\s+)?(?:my\s+)?(?:quotes?|proposals?)/i.test(lowerQuery) ||
      /(?:quotes?|proposals?)\s+(?:in\s+the\s+)?(?:system|repository)/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'list_by_document_type',
      entities: { documentType: 'quote' },
      confidence: 0.95,
    };
  }

  // Show work orders
  if (/(?:show|list|find|get)\s+(?:all\s+)?(?:my\s+)?(?:work\s+orders?)/i.test(lowerQuery) ||
      /work\s+orders?\s+(?:in\s+the\s+)?(?:system|repository)/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'list_by_document_type',
      entities: { documentType: 'work_order' },
      confidence: 0.95,
    };
  }

  // Show non-contract documents (catch-all for flagged documents)
  if (/(?:show|list|find|get)\s+(?:all\s+)?(?:non-?contract|non\s+contract)\s+documents?/i.test(lowerQuery) ||
      /documents?\s+(?:that\s+)?(?:are\s+)?(?:not\s+contracts?|flagged|non-?contracts?)/i.test(lowerQuery) ||
      /(?:flagged|misclassified|wrong\s+type)\s+documents?/i.test(lowerQuery) ||
      /documents?\s+(?:that\s+)?shouldn'?t\s+be\s+(?:here|in\s+contracts?)/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'list_non_contracts',
      entities: {},
      confidence: 0.95,
    };
  }

  // Generic document type query
  const documentTypeMatch = lowerQuery.match(/(?:show|list|find|get)\s+(?:all\s+)?(?:my\s+)?(letters?\s+of\s+intent|LOIs?|memorand(?:um|a)|amendments?|addend(?:um|a))/i);
  if (documentTypeMatch) {
    let docType = documentTypeMatch[1]?.toLowerCase();
    // Normalize document type names
    if (docType?.includes('letter') || docType?.toLowerCase() === 'loi' || docType?.toLowerCase() === 'lois') {
      docType = 'letter_of_intent';
    } else if (docType?.includes('memorand')) {
      docType = 'memorandum';
    } else if (docType?.includes('amendment')) {
      docType = 'amendment';
    } else if (docType?.includes('addend')) {
      docType = 'addendum';
    }
    return {
      type: 'list',
      action: 'list_by_document_type',
      entities: { documentType: docType },
      confidence: 0.95,
    };
  }

  // Show uncategorized
  if (/(?:uncategorized|untagged|no\s+category|missing\s+category)\s*contracts?/i.test(lowerQuery) ||
      /contracts?\s+(?:without|with\s+no)\s+(?:a\s+)?category/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'show_uncategorized',
      entities: {},
      confidence: 0.9,
    };
  }

  // Contract statistics
  if (/(?:how\s+many|total|count|number\s+of)\s+contracts?/i.test(lowerQuery) ||
      /contract\s+(?:stats|statistics|metrics|numbers)/i.test(lowerQuery) ||
      /(?:show|give)\s+(?:me\s+)?(?:contract\s+)?(?:stats|statistics|overview)/i.test(lowerQuery)) {
    return {
      type: 'analytics',
      action: 'contract_stats',
      entities: {},
      confidence: 0.85,
    };
  }

  // Filter by status
  const statusFilterMatch = lowerQuery.match(/(?:show|list|find|get)\s+(?:all\s+)?(?:my\s+)?(active|pending|draft|archived|terminated)\s+contracts?/i);
  if (statusFilterMatch) {
    return {
      type: 'list',
      action: 'show_by_status',
      entities: { status: statusFilterMatch[1].toLowerCase() },
      confidence: 0.9,
    };
  }

  // Search for contracts
  const searchMatch = lowerQuery.match(/(?:search|look|find)\s+(?:for\s+)?(?:contracts?\s+)?(?:named?|called|titled)\s+["\']?(.+?)["\']?$/i);
  if (searchMatch) {
    return {
      type: 'search',
      action: 'search_contracts',
      entities: { searchQuery: searchMatch[1].trim() },
      confidence: 0.85,
    };
  }

  // Bulk operations
  if (/(?:bulk|mass|batch)\s+(?:action|operation|edit|update|tag|delete|export)/i.test(lowerQuery) ||
      /(?:select|choose)\s+(?:all|multiple|several)\s+contracts?/i.test(lowerQuery)) {
    return {
      type: 'action',
      action: 'bulk_operations',
      entities: {},
      confidence: 0.85,
    };
  }

  // Change view mode
  const viewMatch = lowerQuery.match(/(?:switch|change|show)\s+(?:to\s+)?(?:contracts?\s+)?(?:in\s+)?(grid|list|table|kanban)\s*(?:view)?/i);
  if (viewMatch) {
    return {
      type: 'action',
      action: 'change_view',
      entities: { viewMode: viewMatch[1].toLowerCase() },
      confidence: 0.85,
    };
  }

  // Filter contracts (generic)
  if (/(?:filter|show\s+me|display|list)\s+contracts?\s+(?:by|with|where|that|having)/i.test(lowerQuery)) {
    return {
      type: 'list',
      action: 'filter_contracts',
      entities: {},
      confidence: 0.75,
    };
  }

  // ============================================
  // WORKFLOW / APPROVAL PATTERNS
  // ============================================

  // Start a workflow
  const startWorkflowMatch = lowerQuery.match(/(?:start|initiate|begin|kick\s*off|launch)\s+(?:an?\s+)?(?:approval\s+)?(?:workflow|process|review)(?:\s+(?:for|on)\s+(?:this\s+)?(?:contract)?)?/i);
  if (startWorkflowMatch) {
    return {
      type: 'workflow',
      action: 'start_workflow',
      entities: {},
      confidence: 0.9,
    };
  }

  // List workflows
  if (/(?:list|show|get)\s+(?:all\s+)?(?:my\s+)?(?:available\s+)?workflows?/i.test(lowerQuery) ||
      /(?:what|which)\s+workflows?\s+(?:are\s+)?available/i.test(lowerQuery)) {
    return {
      type: 'workflow',
      action: 'list_workflows',
      entities: {},
      confidence: 0.9,
    };
  }

  // Pending approvals
  if (/(?:my\s+)?(?:pending|waiting|outstanding)\s+approvals?/i.test(lowerQuery) ||
      /what\s+(?:do\s+i\s+)?(?:need\s+to|have\s+to)\s+approve/i.test(lowerQuery) ||
      /contracts?\s+waiting\s+(?:for\s+)?(?:my\s+)?approval/i.test(lowerQuery) ||
      /approvals?\s+(?:i\s+)?need\s+to\s+(?:review|handle)/i.test(lowerQuery)) {
    return {
      type: 'workflow',
      action: 'pending_approvals',
      entities: {},
      confidence: 0.9,
    };
  }

  // Approve step
  const approveMatch = lowerQuery.match(/(?:approve|accept|ok|lgtm)\s+(?:this|the|current)?\s*(?:step|contract|workflow)?/i);
  if (approveMatch) {
    return {
      type: 'workflow',
      action: 'approve_step',
      entities: {},
      confidence: 0.85,
    };
  }

  // Reject step
  const rejectMatch = lowerQuery.match(/(?:reject|decline|deny)\s+(?:this|the|current)?\s*(?:step|contract|workflow)?(?:\s+(?:because|due\s+to|reason)[\s:]+(.+))?/i);
  if (rejectMatch) {
    return {
      type: 'workflow',
      action: 'reject_step',
      entities: { reason: rejectMatch[1]?.trim() },
      confidence: 0.85,
    };
  }

  // Workflow status
  if (/(?:what(?:'s|s)?|check|show)\s+(?:the\s+)?(?:workflow|approval)\s+status/i.test(lowerQuery) ||
      /(?:where|how)\s+is\s+(?:the|this)\s+(?:workflow|approval|contract)/i.test(lowerQuery) ||
      /is\s+(?:this|the)\s+(?:contract\s+)?(?:approved|in\s+review|pending)/i.test(lowerQuery)) {
    return {
      type: 'workflow',
      action: 'workflow_status',
      entities: {},
      confidence: 0.85,
    };
  }

  // Assign to someone
  const assignMatch = lowerQuery.match(/(?:assign|delegate|forward|send)\s+(?:this|the|current)?\s*(?:step|approval|task|review)?\s*(?:to)\s+(.+)/i);
  if (assignMatch) {
    return {
      type: 'workflow',
      action: 'assign_approver',
      entities: { assignee: assignMatch[1].trim() },
      confidence: 0.85,
    };
  }

  // Escalate
  if (/(?:escalate|urgent|priority|expedite)\s+(?:this|the)?\s*(?:workflow|approval|review)?/i.test(lowerQuery)) {
    return {
      type: 'workflow',
      action: 'escalate',
      entities: {},
      confidence: 0.85,
    };
  }

  // Cancel workflow
  const cancelMatch = lowerQuery.match(/(?:cancel|stop|abort|terminate)\s+(?:the\s+)?(?:workflow|approval|review|process)(?:\s+(?:because|due\s+to|reason)[\s:]+(.+))?/i);
  if (cancelMatch) {
    return {
      type: 'workflow',
      action: 'cancel_workflow',
      entities: { reason: cancelMatch[1]?.trim() },
      confidence: 0.85,
    };
  }

  // Create a new workflow template
  if (/(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?(?:workflow|approval)\s+(?:template|process)/i.test(lowerQuery)) {
    return {
      type: 'workflow',
      action: 'create_workflow',
      entities: {},
      confidence: 0.85,
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

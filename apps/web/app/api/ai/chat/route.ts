import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { hybridSearch } from '@/lib/rag/advanced-rag.service'
import { prisma } from '@/lib/prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Intent detection for actionable requests
interface DetectedIntent {
  type: 'search' | 'action' | 'question' | 'workflow' | 'list' | 'analytics' | 'procurement';
  action?: 'renew' | 'generate' | 'approve' | 'create' | 'start_workflow' | 'list_by_supplier' | 'list_expiring' | 'list_by_status' | 'list_by_value' | 'count' | 'summarize' | 'create_linked' | 'link_contracts' | 'show_hierarchy' | 'find_master' | 
    // New procurement actions
    'spend_analysis' | 'cost_savings' | 'rate_comparison' | 'risk_assessment' | 'compliance_check' | 'compliance_status' | 'budget_status' | 'supplier_performance' | 'negotiate_terms' | 'category_spend' | 'top_suppliers' | 'savings_opportunities' | 'contract_risks' | 'auto_renewals' | 'payment_terms';
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
    timePeriod?: string;  // 'this_year', 'last_year', 'q1', 'q2', etc.
    riskLevel?: string;   // 'high', 'medium', 'low', 'critical'
    savingsCategory?: string;
    topN?: number;        // For "top 5 suppliers", "top 10 contracts"
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
async function getContractContext(contractId: string): Promise<string> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        artifacts: {
          select: {
            type: true,
            data: true,
          },
          take: 5,
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

    // Add artifact summaries
    if (contract.artifacts && contract.artifacts.length > 0) {
      context += `\n**Analysis Artifacts Available:**\n`;
      for (const artifact of contract.artifacts) {
        if (artifact.type === 'OVERVIEW' && artifact.data) {
          try {
            const overview = typeof artifact.data === 'string' 
              ? JSON.parse(artifact.data) 
              : artifact.data;
            if (overview.summary) {
              context += `\n**Summary:** ${String(overview.summary).slice(0, 500)}...\n`;
            }
            if (overview.keyTerms && overview.keyTerms.length > 0) {
              context += `**Key Terms:** ${overview.keyTerms.slice(0, 5).join(', ')}\n`;
            }
          } catch (e) {
            // Skip if can't parse
          }
        }
        if (artifact.type === 'RISK' && artifact.data) {
          try {
            const risk = typeof artifact.data === 'string' 
              ? JSON.parse(artifact.data) 
              : artifact.data;
            if (risk.overallScore !== undefined) {
              context += `**Risk Score:** ${risk.overallScore}/100\n`;
            }
          } catch (e) {
            // Skip if can't parse
          }
        }
      }
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
      
      return `${i + 1}. ${urgency} **${c.contractTitle || c.name}**
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
   **${c.contractTitle || c.name}**
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
      return `${i + 1}. **${c.contractTitle || c.name}**
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
      return `${i + 1}. ${riskIcon} **${c.contractTitle}**\n   • Risk: ${c.expirationRisk || 'HIGH'} | Days Left: ${c.daysUntilExpiry || 'N/A'}\n   • Supplier: ${c.supplierName || 'Unknown'}\n   • Auto-Renew: ${c.autoRenewalEnabled ? '⚠️ Yes' : 'No'}`;
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
      return `${i + 1}. ${urgent} **${c.contractTitle}**\n   • Supplier: ${c.supplierName} | Renews: ${expiry}`;
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
      return `${i + 1}. ${issueIcon} **${c.contractTitle}**\n   • Score: ${c.complianceScore}% | Issues: ${c.issueCount}\n   • Supplier: ${c.supplierName || 'Unknown'}\n   • Last Audit: ${c.lastAuditDate || 'Never'}`;
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
        const ragResults = await hybridSearch(message, {
          mode: 'hybrid',
          k: 5,
          rerank: true,
          expandQuery: true,
          filters: context?.tenantId ? { tenantId: context.tenantId } : {},
        });

        if (ragResults.length > 0) {
          ragContext = `\n\n**Relevant Contract Information Found:**\n${ragResults.map((r, i) => 
            `[${i + 1}] From "${r.contractName}" (${Math.round(r.score * 100)}% match):\n${r.text.slice(0, 500)}...`
          ).join('\n\n')}`;
          
          ragSources = [...ragSources, ...ragResults.map(r => `Contract: ${r.contractName} (ID: ${r.contractId})`)];
        }
      } catch (ragError) {
        console.error('RAG search error:', ragError);
        // Continue without RAG results
      }
    }

    const systemPrompt = `You are an AI assistant for a Contract Lifecycle Management (CLM) system. You help users with:
- Searching and analyzing contracts
- Managing deadlines and renewals
- Creating templates and clauses
- Identifying risks and compliance issues
- Workflow approvals and signatures
- Generating reports and insights
- **Starting contract renewals and approval workflows**

Current context: ${context?.context || 'global'}
Contract ID: ${context?.contractId || 'none'}
Detected Intent: ${context?.intent ? JSON.stringify(context.intent) : 'general inquiry'}
${contractContext}
${ragContext}
${context?.additionalContext || ''}

**IMPORTANT: You can help users start contract renewal and approval workflows!**

When a user wants to:
1. **Renew a contract**: Search for the contract, show details, and offer to start the renewal workflow
2. **Start an approval flow**: Find the relevant contract and initiate the approval process
3. **Generate a new contract**: Help them choose a template and start the drafting process

When answering:
1. Be concise and actionable
2. Use markdown formatting (bold, bullets, headers)
3. Reference specific contracts when relevant - if you have contract details above, use them!
4. Suggest next steps or related queries
5. If you found contract information above, cite it in your response
6. If the user wants to start a workflow, confirm the contract and offer action buttons
7. Always provide clear next steps for workflow actions`;

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
      max_tokens: 1000,
    });

    const responseContent = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    return {
      response: responseContent,
      sources: ragSources.length > 0 ? ragSources : ['AI-generated response', 'CLM Database'],
      suggestedActions: [
        { label: '🔍 Search Contracts', action: 'search-contracts' },
        { label: '📊 View Dashboard', action: 'view-dashboard' },
      ],
      suggestions: [
        'Tell me more about this',
        'What are the next steps?',
        'Show me related contracts',
      ],
    };
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
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
    const { message, contractId, context, conversationHistory } = await request.json()

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
    
    // ============================================
    // PROCUREMENT AGENT: Query real database based on intent
    // ============================================
    
    // For list intents - query database and add to context
    if (intent.type === 'list') {
      let contracts: any[] = [];
      if (intent.action === 'list_by_supplier' && intent.entities.supplierName) {
        contracts = await listContractsBySupplier(intent.entities.supplierName, tenantId);
        additionalContext = `\n\n**Contracts with ${intent.entities.supplierName}:**\n${contracts.map(c => 
          `- ${c.contractTitle} (ID: ${c.id}, Status: ${c.status}, Value: $${Number(c.totalValue || 0).toLocaleString()}, Expires: ${c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'N/A'})`
        ).join('\n') || 'No contracts found.'}`;
      } else if (intent.action === 'list_expiring') {
        contracts = await listExpiringContracts(intent.entities.daysUntilExpiry || 30, tenantId, intent.entities.supplierName);
        additionalContext = `\n\n**Contracts Expiring in ${intent.entities.daysUntilExpiry || 30} Days:**\n${contracts.map(c => 
          `- ${c.contractTitle} (Expires: ${c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'N/A'}, Supplier: ${c.supplierName}, Value: $${Number(c.totalValue || 0).toLocaleString()})`
        ).join('\n') || 'No expiring contracts found.'}`;
      } else if (intent.action === 'list_by_status' && intent.entities.status) {
        contracts = await listContractsByStatus(intent.entities.status, tenantId);
        additionalContext = `\n\n**${intent.entities.status} Contracts:**\n${contracts.map(c => 
          `- ${c.contractTitle} (Supplier: ${c.supplierName}, Value: $${Number(c.totalValue || 0).toLocaleString()})`
        ).join('\n') || 'No contracts found.'}`;
      } else if (intent.action === 'list_by_value') {
        contracts = await listHighValueContracts(intent.entities.valueThreshold || 100000, tenantId);
        additionalContext = `\n\n**High Value Contracts (>$${(intent.entities.valueThreshold || 100000).toLocaleString()}):**\n${contracts.map(c => 
          `- ${c.contractTitle} (Supplier: ${c.supplierName}, Value: $${Number(c.totalValue || 0).toLocaleString()})`
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
      }
    }
    
    // For workflow intents
    if (intent.type === 'workflow') {
      const matchedContracts = await findMatchingContracts(intent.entities, tenantId);
      const workflows = await findRenewalWorkflows(tenantId);
      
      if (matchedContracts.length > 0) {
        additionalContext += `\n\n**Matching Contracts Found:**\n${matchedContracts.map(c => 
          `- ${c.contractTitle} (ID: ${c.id}, Supplier: ${c.supplierName || 'Unknown'}, Status: ${c.status}, Value: $${Number(c.totalValue || 0).toLocaleString()})`
        ).join('\n')}`;
      }
      if (workflows.length > 0) {
        additionalContext += `\n\n**Available Workflows:**\n${workflows.map(w => 
          `- ${w.name} (${w.steps?.length || 0} steps, Type: ${w.type})`
        ).join('\n')}`;
      }
      
      // For create_linked, also find parent contracts
      if (intent.action === 'create_linked') {
        if (intent.entities.supplierName) {
          const masterAgreements = await findMasterAgreements(intent.entities.supplierName, tenantId, intent.entities.parentYear);
          if (masterAgreements.length > 0) {
            additionalContext += `\n\n**Master Agreements to link to:**\n${masterAgreements.map(m => 
              `- ${m.contractTitle} (ID: ${m.id}, Status: ${m.status}, Value: $${Number(m.totalValue || 0).toLocaleString()})`
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
            additionalContext += `\n- Parent: ${hierarchy.parentContract.contractTitle} (${hierarchy.parentContract.status})`;
          }
          additionalContext += `\n- Current: ${hierarchy.contractTitle} (${hierarchy.status}, Value: $${Number(hierarchy.totalValue || 0).toLocaleString()})`;
          if (hierarchy.childContracts && hierarchy.childContracts.length > 0) {
            additionalContext += `\n- Children (${hierarchy.childContracts.length}):\n${hierarchy.childContracts.map((c: any) => 
              `  - ${c.contractTitle} (${c.contractType}, ${c.status})`
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
            `${i + 1}. ${c.contractTitle}\n   - Risk Level: ${c.expirationRisk || 'HIGH'} | Days Until Expiry: ${c.daysUntilExpiry || 'N/A'}\n   - Supplier: ${c.supplierName} | Auto-Renew: ${c.autoRenewalEnabled ? 'Yes' : 'No'}`
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
            `- ${c.contractTitle} (Score: ${c.complianceScore}%, Issues: ${c.issueCount})`
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

    // Call OpenAI with the enriched context
    const response = await getOpenAIResponse(message, conversationHistory || [], { 
      contractId, 
      context,
      intent,
      additionalContext,
    });

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

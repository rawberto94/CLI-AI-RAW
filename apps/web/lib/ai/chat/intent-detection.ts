/**
 * Intent Detection Service
 * 
 * Pattern-based intent classification for chat queries.
 * Detects user intent from natural language to route to appropriate
 * handlers (list, search, analytics, workflow, comparison, etc.)
 * 
 * @version 1.0.0
 */

import type { 
  DetectedIntent, 
  IntentAction, 
  IntentType,
  SignatureStatusType,
  DocumentClassificationType 
} from './types';
import { normalizeContractType } from './types';

// ============================================================================
// PATTERN GROUPS
// ============================================================================

interface PatternRule {
  pattern: RegExp;
  type: IntentType;
  action: IntentAction;
  confidence: number;
  extractors?: {
    [key: string]: (match: RegExpMatchArray) => string | number | undefined;
  };
}

/**
 * Contract linking patterns
 */
const CONTRACT_LINKING_PATTERNS: PatternRule[] = [
  {
    pattern: /(?:start|create|draft|initiate|begin|I\s+need\s+to\s+start)\s+(?:a\s+)?(?:new\s+)?(sow|statement\s+of\s+work|amendment|addendum|change\s+order|po|purchase\s+order)\s*(?:contract\s+)?(?:with|for)\s+(?:supplier\s+)?([^,]+?)(?:\s*,?\s*(?:linked?\s+to|linking\s+to|under|from|referencing|based\s+on)\s+(?:the\s+)?(?:master\s+)?(?:agreement|msa|contract)(?:\s+from\s+(\d{4}))?)?$/i,
    type: 'workflow',
    action: 'create_linked',
    confidence: 0.95,
    extractors: {
      contractType: (m) => normalizeContractType(m[1]),
      supplierName: (m) => m[2]?.trim().replace(/\s*,.*$/, '').replace(/\s+linking.*$/i, '').replace(/\s+linked.*$/i, ''),
      parentYear: (m) => m[3],
    },
  },
  {
    pattern: /(?:show|display|what(?:'s|s)?|list)\s+(?:me\s+)?(?:the\s+)?(?:contract\s+)?(?:hierarchy|structure|tree|linked\s+contracts|child\s+contracts|related\s+contracts)(?:\s+(?:for|of)\s+(.+?))?(?:\?|$)/i,
    type: 'action',
    action: 'show_hierarchy',
    confidence: 0.9,
    extractors: {
      contractName: (m) => m[1]?.trim(),
    },
  },
  {
    pattern: /(?:find|show|get|what)\s+(?:is\s+)?(?:the\s+)?(?:master\s+)?(?:agreement|msa)\s+(?:do\s+we\s+have\s+)?(?:with|for)\s+(?:supplier\s+)?([^?]+)/i,
    type: 'list',
    action: 'find_master',
    confidence: 0.9,
    extractors: {
      supplierName: (m) => m[1]?.trim().replace(/\?$/, ''),
    },
  },
];

/**
 * List/query patterns
 */
const LIST_PATTERNS: PatternRule[] = [
  {
    pattern: /(?:what|show|list|get|find|display)?\s*(?:me\s+)?(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:with|from|by|for)\s+(?:supplier\s+)?([^?]+?)(?:\s+to\s+be\s+renewed|\s+expiring|\s+that|\?|$)/i,
    type: 'list',
    action: 'list_by_supplier',
    confidence: 0.9,
    extractors: {
      supplierName: (m) => m[1]?.trim().replace(/\?$/, ''),
    },
  },
  {
    pattern: /(?:what|show|list|get|find|which)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?contracts?\s+(?:that\s+)?(?:are\s+)?(?:expiring|expire|due|ending)(?:\s+(?:in|within)\s+(\d+)\s+days?)?/i,
    type: 'list',
    action: 'list_expiring',
    confidence: 0.9,
    extractors: {
      daysUntilExpiry: (m) => m[1] ? parseInt(m[1]) : 30,
    },
  },
  {
    pattern: /(?:show|list|get|find|what)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?(active|pending|expired|draft|processing|archived)\s+contracts?/i,
    type: 'list',
    action: 'list_by_status',
    confidence: 0.85,
    extractors: {
      status: (m) => m[1]?.toUpperCase(),
    },
  },
  {
    pattern: /(?:show|list|get|find|what)\s+(?:are\s+)?(?:the\s+)?(?:high[\s-]?value|large|big)\s+contracts?|contracts?\s+(?:over|above|exceeding)\s+\$?([\d,]+)/i,
    type: 'list',
    action: 'list_by_value',
    confidence: 0.85,
    extractors: {
      valueThreshold: (m) => m[1] ? parseInt(m[1].replace(/,/g, '')) : 100000,
    },
  },
];

/**
 * Signature status patterns
 */
const SIGNATURE_PATTERNS: PatternRule[] = [
  {
    pattern: /(?:unsigned|not\s+signed|missing\s+signature|without\s+signature)\s*contracts?|contracts?\s+(?:that\s+)?(?:are\s+)?(?:not\s+signed|unsigned|need\s+signature)/i,
    type: 'list',
    action: 'list_by_signature',
    confidence: 0.95,
    extractors: {
      signatureStatus: () => 'unsigned' as SignatureStatusType,
    },
  },
  {
    pattern: /(?:show|list|find|get)\s+(?:all\s+)?(?:fully\s+)?signed\s+contracts?|contracts?\s+(?:that\s+)?(?:are\s+)?(?:fully\s+)?signed|executed\s+contracts?/i,
    type: 'list',
    action: 'list_by_signature',
    confidence: 0.95,
    extractors: {
      signatureStatus: () => 'signed' as SignatureStatusType,
    },
  },
  {
    pattern: /(?:partially|partly)\s+signed\s+contracts?|contracts?\s+(?:that\s+)?(?:are\s+)?partially\s+signed|contracts?\s+(?:with\s+)?(?:some|missing)\s+signatures?/i,
    type: 'list',
    action: 'list_by_signature',
    confidence: 0.95,
    extractors: {
      signatureStatus: () => 'partially_signed' as SignatureStatusType,
    },
  },
  {
    pattern: /contracts?\s+(?:needing|requiring|need|require)\s+(?:signature\s+)?attention|contracts?\s+flagged\s+for\s+signature|signature\s+(?:issues?|problems?|attention)/i,
    type: 'list',
    action: 'list_needing_signature',
    confidence: 0.95,
  },
];

/**
 * Analytics/count patterns
 */
const ANALYTICS_PATTERNS: PatternRule[] = [
  {
    pattern: /(?:how\s+many|count|total|number\s+of)\s+(?:active\s+)?contracts?(?:\s+(?:do\s+we\s+have|with|from|by)\s+(?:supplier\s+)?([^?]+))?/i,
    type: 'analytics',
    action: 'count',
    confidence: 0.85,
    extractors: {
      supplierName: (m) => m[1]?.trim().replace(/\?$/, ''),
    },
  },
  {
    pattern: /(?:summarize|summary\s+of|overview\s+of)\s+(?:the\s+)?(?:all\s+)?contracts?\s+(?:with|from|by)\s+(?:supplier\s+)?([^?]+)/i,
    type: 'analytics',
    action: 'summarize',
    confidence: 0.85,
    extractors: {
      supplierName: (m) => m[1]?.trim().replace(/\?$/, ''),
    },
  },
];

/**
 * Procurement patterns
 */
const PROCUREMENT_PATTERNS: PatternRule[] = [
  {
    pattern: /(?:what(?:'s|s)?|show|total|how\s+much)\s+(?:is\s+)?(?:the\s+)?(?:our\s+)?(?:total\s+)?spend(?:ing)?(?:\s+(?:with|on|for)\s+(?:supplier\s+)?([^?]+))?/i,
    type: 'procurement',
    action: 'spend_analysis',
    confidence: 0.9,
    extractors: {
      supplierName: (m) => m[1]?.trim().replace(/\?$/, ''),
    },
  },
  {
    pattern: /(?:what|show|find|identify|where)\s+(?:are\s+)?(?:the\s+)?(?:potential\s+)?(?:cost\s+)?savings?(?:\s+opportunities)?|where\s+can\s+(?:we|i)\s+save|reduce\s+costs?/i,
    type: 'procurement',
    action: 'cost_savings',
    confidence: 0.9,
  },
  {
    pattern: /(?:show|what|who)\s+(?:are\s+)?(?:the\s+)?(?:our\s+)?(?:top|biggest|largest|main)\s+(\d+\s+)?suppliers?/i,
    type: 'procurement',
    action: 'top_suppliers',
    confidence: 0.9,
    extractors: {
      topN: (m) => m[1] ? parseInt(m[1]) : 10,
    },
  },
  {
    pattern: /(?:show|what|which|find)\s+(?:are\s+)?(?:the\s+)?(?:high[\s-]?risk|risky|at[\s-]?risk)\s+(?:contracts?|suppliers?)|risk\s+assessment|contract\s+risks?/i,
    type: 'procurement',
    action: 'risk_assessment',
    confidence: 0.9,
    extractors: {
      riskLevel: () => 'high',
    },
  },
  {
    pattern: /(?:show|what|which|find|list)\s+(?:are\s+)?(?:the\s+)?(?:contracts?\s+)?(?:with\s+)?auto[\s-]?renewals?|auto[\s-]?renewing\s+contracts?/i,
    type: 'procurement',
    action: 'auto_renewals',
    confidence: 0.9,
  },
  {
    pattern: /(?:spend|spending|breakdown)\s+(?:by|per)\s+category|category\s+(?:spend|breakdown|analysis)/i,
    type: 'procurement',
    action: 'category_spend',
    confidence: 0.9,
  },
  {
    pattern: /(?:supplier|vendor)\s+performance|how\s+is\s+([^\s]+)\s+performing|performance\s+of\s+([^\s?]+)/i,
    type: 'procurement',
    action: 'supplier_performance',
    confidence: 0.85,
    extractors: {
      supplierName: (m) => (m[1] || m[2])?.trim(),
    },
  },
];

/**
 * Comparison patterns
 */
const COMPARISON_PATTERNS: PatternRule[] = [
  {
    pattern: /compare\s+(?:contract\s+)?(.+?)\s+(?:with|to|and|vs\.?)\s+(?:contract\s+)?(.+?)(?:\s+contracts?)?(?:\?|$)/i,
    type: 'comparison',
    action: 'compare_contracts',
    confidence: 0.92,
    extractors: {
      contractA: (m) => m[1]?.trim(),
      contractB: (m) => m[2]?.trim().replace(/\?$/, ''),
    },
  },
  {
    pattern: /(?:what(?:'s|s)?|show)\s+(?:the\s+)?(?:difference|differences|diff)\s+(?:between|in)\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)(?:\?|$)/i,
    type: 'comparison',
    action: 'compare_contracts',
    confidence: 0.9,
    extractors: {
      contractA: (m) => m[1]?.trim(),
      contractB: (m) => m[2]?.trim().replace(/\?$/, ''),
    },
  },
  {
    pattern: /compare\s+(.+?)\s+(?:vs\.?|versus|and|to)\s+(.+?)\s+(?:terms?|pricing|rates?|contracts?)|which\s+(?:supplier|vendor)\s+has\s+better\s+(?:terms?|pricing|rates?)/i,
    type: 'comparison',
    action: 'compare_suppliers',
    confidence: 0.88,
    extractors: {
      supplierA: (m) => m[1]?.trim(),
      supplierB: (m) => m[2]?.trim(),
    },
  },
];

/**
 * Taxonomy patterns
 */
const TAXONOMY_PATTERNS: PatternRule[] = [
  {
    pattern: /(?:show|list|what|get|display)\s+(?:are\s+)?(?:the\s+)?(?:all\s+)?(?:taxonomy\s+)?(?:procurement\s+)?categories|category\s+(?:list|tree|structure)|what\s+categories\s+(?:do\s+we\s+have|exist)|browse\s+(?:the\s+)?taxonomy/i,
    type: 'taxonomy',
    action: 'list_categories',
    confidence: 0.9,
  },
  {
    pattern: /(?:what|which)\s+category\s+(?:is|for|should)\s+(.+?)(?:\?|$)|categorize\s+(?:the\s+)?(.+?)(?:\s+contract)?(?:\?|$)|suggest\s+category\s+for\s+(.+)/i,
    type: 'taxonomy',
    action: 'suggest_category',
    confidence: 0.85,
    extractors: {
      contractName: (m) => (m[1] || m[2] || m[3])?.trim(),
    },
  },
];

/**
 * System status patterns
 */
const SYSTEM_PATTERNS: PatternRule[] = [
  {
    pattern: /(?:system|health|service)\s+(?:status|health|check)|is\s+(?:the\s+)?(?:system|everything)\s+(?:working|ok|running)/i,
    type: 'system',
    action: 'system_health',
    confidence: 0.9,
  },
  {
    pattern: /(?:queue|job|task)\s+(?:status|health|progress)/i,
    type: 'system',
    action: 'queue_status',
    confidence: 0.9,
  },
  {
    pattern: /(?:ai|model|chatbot)\s+(?:performance|status|accuracy)/i,
    type: 'system',
    action: 'ai_performance',
    confidence: 0.9,
  },
];

/**
 * Conversational patterns
 */
const CONVERSATIONAL_PATTERNS: PatternRule[] = [
  {
    pattern: /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))[\s!.]*$/i,
    type: 'system',
    action: 'greeting',
    confidence: 1.0,
  },
  {
    pattern: /^(?:bye|goodbye|thanks|thank you|cheers|see you)[\s!.]*$/i,
    type: 'system',
    action: 'farewell',
    confidence: 1.0,
  },
  {
    pattern: /^(?:help|what can you do|how do I use|commands?)[\s?!.]*$/i,
    type: 'system',
    action: 'help',
    confidence: 1.0,
  },
];

// All pattern groups combined
const ALL_PATTERNS: PatternRule[] = [
  ...CONVERSATIONAL_PATTERNS,  // Check conversational first
  ...CONTRACT_LINKING_PATTERNS,
  ...SIGNATURE_PATTERNS,
  ...LIST_PATTERNS,
  ...COMPARISON_PATTERNS,
  ...PROCUREMENT_PATTERNS,
  ...TAXONOMY_PATTERNS,
  ...ANALYTICS_PATTERNS,
  ...SYSTEM_PATTERNS,
];

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect intent from a user query using pattern matching
 */
export function detectIntent(query: string): DetectedIntent {
  const trimmedQuery = query.trim();
  
  // Try each pattern group
  for (const rule of ALL_PATTERNS) {
    const match = trimmedQuery.match(rule.pattern);
    
    if (match) {
      // Extract entities using extractors
      const entities: Record<string, unknown> = {};
      
      if (rule.extractors) {
        for (const [key, extractor] of Object.entries(rule.extractors)) {
          const value = extractor(match);
          if (value !== undefined && value !== null && value !== '') {
            entities[key] = value;
          }
        }
      }
      
      return {
        type: rule.type,
        action: rule.action,
        entities,
        confidence: rule.confidence,
      };
    }
  }
  
  // Default fallback - general question intent
  return {
    type: 'question',
    action: 'general',
    entities: {
      searchQuery: trimmedQuery,
    },
    confidence: 0.5,
  };
}

/**
 * Check if a query should trigger RAG-based search
 */
export function shouldUseRAG(query: string, intentEntities?: Record<string, unknown>): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Skip RAG for simple greetings/farewells
  const skipPatterns = [
    /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))[\s!.]*$/i,
    /^(?:bye|goodbye|thanks|thank you|cheers)[\s!.]*$/i,
  ];
  if (skipPatterns.some(p => p.test(query.trim()))) {
    return false;
  }
  
  // If intent classification detected implicit contract context, always use RAG
  if (intentEntities?.hasImplicitContractContext) {
    return true;
  }
  
  // If user is asking for recommendations related to contracts, use RAG
  if (intentEntities?.isAskingRecommendation && 
      (intentEntities?.questionType === 'information' || intentEntities?.questionType === 'entity')) {
    return true;
  }
  
  // If query has urgency and relates to business context, use RAG
  if (intentEntities?.hasUrgency) {
    return true;
  }
  
  // Keywords that indicate contract search is needed
  const ragKeywords = [
    'find', 'search', 'show me', 'where', 'what', 'which', 'how',
    'contract', 'clause', 'term', 'liability', 'termination',
    'payment', 'renewal', 'expire', 'obligation', 'risk',
    'indemnif', 'sla', 'warranty', 'confidential', 'vendor',
    'supplier', 'agreement', 'msa', 'nda', 'sow', 'about',
    'tell me', 'explain', 'describe', 'summarize', 'analyze',
    'compare', 'list', 'get', 'check', 'review', 'look',
  ];
  
  // Always use RAG for queries longer than a few words
  const wordCount = query.trim().split(/\s+/).length;
  if (wordCount >= 3) {
    return true;
  }
  
  return ragKeywords.some(keyword => lowerQuery.includes(keyword));
}

export default {
  detectIntent,
  shouldUseRAG,
};

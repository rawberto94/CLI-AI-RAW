/**
 * Flexible AI Message Processor
 * 
 * Handles any type of user message dynamically with intelligent routing
 * and context-aware processing. Designed to be as flexible as possible.
 */

export interface ProcessedMessage {
  originalMessage: string;
  normalizedMessage: string;
  intent: MessageIntent;
  entities: ExtractedEntities;
  context: MessageContext;
  confidence: number;
  processingHints: ProcessingHint[];
}

export interface MessageIntent {
  primary: IntentType;
  secondary?: IntentType[];
  action?: string;
  subAction?: string;
}

export type IntentType =
  | 'search'
  | 'analyze'
  | 'compare'
  | 'summarize'
  | 'list'
  | 'count'
  | 'calculate'
  | 'explain'
  | 'recommend'
  | 'workflow'
  | 'navigation'
  | 'help'
  | 'greeting'
  | 'feedback'
  | 'report'
  | 'alert'
  | 'question'
  | 'command'
  | 'creative'
  | 'conversation'
  | 'unknown';

export interface ExtractedEntities {
  contracts?: string[];
  suppliers?: string[];
  categories?: string[];
  dates?: DateEntity[];
  values?: ValueEntity[];
  statuses?: string[];
  names?: string[];
  keywords?: string[];
  comparisons?: ComparisonEntity[];
  timeframes?: TimeframeEntity[];
  metrics?: string[];
  locations?: string[];
  roles?: string[];
  custom?: Record<string, unknown>;
}

export interface DateEntity {
  type: 'specific' | 'relative' | 'range';
  value: string;
  parsed?: Date;
  endDate?: Date;
}

export interface ValueEntity {
  amount: number;
  currency?: string;
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between';
  endAmount?: number;
}

export interface ComparisonEntity {
  entityA: string;
  entityB: string;
  aspects?: string[];
}

export interface TimeframeEntity {
  type: 'past' | 'present' | 'future';
  duration?: string;
  unit?: 'days' | 'weeks' | 'months' | 'quarters' | 'years';
}

export interface MessageContext {
  tone: 'formal' | 'casual' | 'urgent' | 'neutral';
  complexity: 'simple' | 'moderate' | 'complex';
  requiresData: boolean;
  requiresAction: boolean;
  isFollowUp: boolean;
  domain: 'contracts' | 'suppliers' | 'analytics' | 'compliance' | 'general';
  sentiment: 'positive' | 'negative' | 'neutral' | 'questioning';
}

export interface ProcessingHint {
  type: 'use_rag' | 'use_cache' | 'real_time' | 'aggregate' | 'stream' | 'batch';
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

// Intent patterns - comprehensive and flexible
const INTENT_PATTERNS: Record<IntentType, RegExp[]> = {
  search: [
    /\b(?:find|search|look(?:ing)?\s+for|locate|where\s+(?:is|are)|discover)\b/i,
    /\b(?:show\s+me|get\s+me|pull\s+up|bring\s+up)\b/i,
    /\?.*(?:find|where|which)/i,
  ],
  analyze: [
    /\b(?:analyze|analyse|assess|evaluate|examine|investigate|study|review|inspect)\b/i,
    /\b(?:deep\s+dive|break(?:down)?|drill\s+down|look\s+(?:into|at))\b/i,
    /\b(?:understand|insight|audit)\b/i,
  ],
  compare: [
    /\b(?:compare|versus|vs\.?|differ(?:ence)?|contrast|benchmark|against)\b/i,
    /\b(?:better|worse|same|similar|different)\b.*\b(?:than|from|to)\b/i,
    /\b(?:which\s+(?:is|one)|how\s+does.*compare)\b/i,
  ],
  summarize: [
    /\b(?:summar(?:y|ize|ise)|overview|brief|recap|highlight|key\s+points)\b/i,
    /\b(?:tldr|tl;dr|in\s+(?:short|brief)|give\s+me\s+(?:the\s+)?gist)\b/i,
    /\b(?:main\s+(?:points|takeaways)|quick\s+(?:summary|overview))\b/i,
  ],
  list: [
    /\b(?:list|show|display|enumerate|itemize|catalog)\b/i,
    /\b(?:what\s+are|give\s+me\s+(?:a\s+)?list|all\s+(?:the|my))\b/i,
    /\b(?:show\s+all|get\s+all|fetch\s+all)\b/i,
  ],
  count: [
    /\b(?:how\s+many|count|total|number\s+of|quantity)\b/i,
    /\b(?:amount|volume)\b/i,
  ],
  calculate: [
    /\b(?:calculate|compute|figure\s+out|what(?:'s|s)?\s+the\s+(?:sum|total|average))\b/i,
    /\b(?:add\s+up|sum\s+up|work\s+out)\b/i,
  ],
  explain: [
    /\b(?:explain|what\s+(?:is|are|does)|how\s+does|why|tell\s+me\s+about)\b/i,
    /\b(?:clarify|define|describe|elaborate)\b/i,
    /\b(?:help\s+me\s+understand|walk\s+me\s+through)\b/i,
  ],
  recommend: [
    /\b(?:recommend|suggest|advise|should\s+(?:I|we)|what\s+(?:should|would\s+you))\b/i,
    /\b(?:best\s+(?:way|option|practice)|advice|tip(?:s)?)\b/i,
    /\b(?:propose|idea(?:s)?|option(?:s)?)\b/i,
  ],
  workflow: [
    /\b(?:start|initiate|begin|create|renew|approve|submit|trigger)\b/i,
    /\b(?:workflow|process|approval|request|action)\b/i,
    /\b(?:set\s+up|kick\s+off|launch)\b/i,
  ],
  navigation: [
    /\b(?:go\s+to|navigate|open|take\s+me\s+to|show\s+(?:me\s+)?page)\b/i,
    /\b(?:link\s+to|direct\s+me|redirect)\b/i,
  ],
  help: [
    /\b(?:help|assist|support|guide|how\s+(?:do\s+I|can\s+I|to))\b/i,
    /\b(?:what\s+can\s+you\s+do|capabilities|features)\b/i,
    /\b(?:tutorial|instructions|documentation)\b/i,
  ],
  greeting: [
    /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|greetings|howdy)\b/i,
    /^(?:what(?:'s|s)?\s+up|yo|sup)\b/i,
  ],
  feedback: [
    /\b(?:thanks|thank\s+you|great|awesome|perfect|excellent|good\s+job)\b/i,
    /\b(?:not\s+(?:helpful|what\s+I\s+(?:wanted|asked))|wrong|incorrect)\b/i,
    /\b(?:feedback|rating|review)\b/i,
  ],
  report: [
    /\b(?:report|generate\s+(?:a\s+)?report|export|download)\b/i,
    /\b(?:pdf|excel|csv|document)\b/i,
  ],
  alert: [
    /\b(?:alert|notify|remind|warning|urgent)\b/i,
    /\b(?:set\s+(?:a\s+)?(?:reminder|alert)|don(?:'t|t)\s+forget)\b/i,
  ],
  question: [
    /\?$/,
    /^(?:is|are|do|does|can|could|would|will|should|may|might|has|have|did|was|were)\b/i,
  ],
  command: [
    /^(?:please\s+)?(?:do|make|run|execute|perform|apply|update|change|modify|delete|remove)\b/i,
  ],
  creative: [
    /\b(?:draft|write|compose|create\s+(?:a\s+)?(?:message|email|letter))\b/i,
    /\b(?:generate\s+(?:text|content)|brainstorm)\b/i,
  ],
  conversation: [
    /\b(?:tell\s+me\s+(?:more|about)|continue|go\s+on|and\s+then)\b/i,
    /\b(?:what\s+else|anything\s+else|more\s+info(?:rmation)?)\b/i,
  ],
  unknown: [],
};

// Entity extraction patterns
const ENTITY_PATTERNS = {
  currency: /\$\s*[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:dollars?|USD|EUR|GBP|€|£)/gi,
  percentage: /\d+(?:\.\d+)?\s*%/gi,
  date: /(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{4}[-/]\d{2}[-/]\d{2})/gi,
  timeframe: /(?:next|last|past|coming|previous)\s+\d*\s*(?:day|week|month|quarter|year)s?/gi,
  relativeTime: /(?:today|yesterday|tomorrow|this\s+(?:week|month|year)|(?:end|beginning)\s+of\s+(?:month|year|quarter))/gi,
  numbers: /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g,
  emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  quotedStrings: /"([^"]+)"|'([^']+)'/g,
};

// Prebuilt keyword lists for domain detection
const DOMAIN_KEYWORDS = {
  contracts: ['contract', 'agreement', 'clause', 'term', 'renewal', 'amendment', 'sow', 'msa', 'nda', 'po'],
  suppliers: ['supplier', 'vendor', 'provider', 'partner', 'client', 'customer'],
  analytics: ['analytics', 'dashboard', 'metric', 'kpi', 'trend', 'chart', 'graph', 'statistics', 'report'],
  compliance: ['compliance', 'audit', 'regulation', 'policy', 'standard', 'certification', 'gdpr', 'soc'],
};

/**
 * Main message processor - handles any user input flexibly
 */
export function processMessage(
  message: string,
  conversationHistory?: { role: string; content: string }[],
  currentContext?: Record<string, unknown>
): ProcessedMessage {
  const normalizedMessage = normalizeMessage(message);
  const intent = detectIntent(normalizedMessage, conversationHistory);
  const entities = extractEntities(normalizedMessage);
  const context = analyzeContext(normalizedMessage, conversationHistory);
  const confidence = calculateConfidence(intent, entities, context);
  const processingHints = generateProcessingHints(intent, entities, context);

  return {
    originalMessage: message,
    normalizedMessage,
    intent,
    entities,
    context,
    confidence,
    processingHints,
  };
}

/**
 * Normalize message for processing
 */
function normalizeMessage(message: string): string {
  return message
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

/**
 * Detect primary and secondary intents
 */
function detectIntent(
  message: string,
  history?: { role: string; content: string }[]
): MessageIntent {
  const scores: Record<IntentType, number> = {} as Record<IntentType, number>;
  
  // Score each intent type
  for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
    scores[intentType as IntentType] = 0;
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        scores[intentType as IntentType] += 1;
      }
    }
  }

  // Find top intents
  const sortedIntents = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  const primary: IntentType = sortedIntents[0]?.[0] as IntentType || 'question';
  const secondary = sortedIntents.slice(1, 3).map(([type]) => type as IntentType);

  // Determine action
  const action = determineAction(message, primary);
  const subAction = determineSubAction(message, action);

  // Check if this is a follow-up to previous conversation
  if (history && history.length > 0 && isFollowUp(message)) {
    return {
      primary: 'conversation',
      secondary: [primary, ...secondary].slice(0, 2),
      action: 'continue',
      subAction,
    };
  }

  return { primary, secondary, action, subAction };
}

/**
 * Determine the specific action for an intent
 */
function determineAction(message: string, intent: IntentType): string | undefined {
  const lowerMessage = message.toLowerCase();
  
  const actionMap: Record<string, RegExp> = {
    // Contract actions
    'view_contract': /view|open|show(?:\s+me)?\s+(?:the\s+)?contract/i,
    'renew_contract': /renew|renewal/i,
    'compare_contracts': /compare|versus|vs/i,
    'analyze_contract': /analyze|assess|evaluate/i,
    'summarize_contract': /summar/i,
    
    // List actions
    'list_all': /(?:all|every|each)\s+contracts?/i,
    'list_expiring': /expir|due|ending/i,
    'list_by_supplier': /(?:by|from|with)\s+(?:supplier|vendor)/i,
    'list_by_category': /(?:by|in)\s+category/i,
    'list_by_status': /(?:active|pending|expired|draft)/i,
    
    // Analytics actions
    'spend_analysis': /spend|spending|cost/i,
    'risk_analysis': /risk|risky|danger/i,
    'trend_analysis': /trend|pattern|over\s+time/i,
    
    // Workflow actions
    'start_approval': /approv/i,
    'create_contract': /create|new|draft/i,
    'upload_contract': /upload|import/i,
    
    // Report actions
    'generate_report': /report|export/i,
    'download': /download|pdf|excel/i,
  };

  for (const [action, pattern] of Object.entries(actionMap)) {
    if (pattern.test(lowerMessage)) {
      return action;
    }
  }

  return undefined;
}

/**
 * Determine sub-action for more granular processing
 */
function determineSubAction(message: string, action?: string): string | undefined {
  if (!action) return undefined;
  
  const lowerMessage = message.toLowerCase();
  
  // Sub-action patterns based on primary action
  if (action === 'compare_contracts') {
    if (/value|cost|price|spend/i.test(lowerMessage)) return 'compare_values';
    if (/term|clause|condition/i.test(lowerMessage)) return 'compare_terms';
    if (/duration|length|period/i.test(lowerMessage)) return 'compare_durations';
    if (/risk/i.test(lowerMessage)) return 'compare_risks';
  }
  
  if (action === 'analyze_contract') {
    if (/risk/i.test(lowerMessage)) return 'analyze_risks';
    if (/compliance/i.test(lowerMessage)) return 'analyze_compliance';
    if (/performance/i.test(lowerMessage)) return 'analyze_performance';
    if (/cost|value/i.test(lowerMessage)) return 'analyze_costs';
  }

  return undefined;
}

/**
 * Extract entities from message
 */
function extractEntities(message: string): ExtractedEntities {
  const entities: ExtractedEntities = {
    contracts: [],
    suppliers: [],
    categories: [],
    dates: [],
    values: [],
    statuses: [],
    keywords: [],
    comparisons: [],
    timeframes: [],
  };

  // Extract quoted strings (likely contract/supplier names)
  const quoted = message.match(ENTITY_PATTERNS.quotedStrings);
  if (quoted) {
    entities.names = quoted.map(q => q.replace(/["']/g, ''));
  }

  // Extract currency values
  const currencies = message.match(ENTITY_PATTERNS.currency);
  if (currencies) {
    entities.values = currencies.map(c => ({
      amount: parseFloat(c.replace(/[$,\s]/g, '')),
      currency: c.includes('€') ? 'EUR' : c.includes('£') ? 'GBP' : 'USD',
    }));
  }

  // Extract dates
  const dates = message.match(ENTITY_PATTERNS.date);
  if (dates) {
    entities.dates = dates.map(d => ({
      type: 'specific' as const,
      value: d,
    }));
  }

  // Extract relative time references
  const relativeTime = message.match(ENTITY_PATTERNS.relativeTime);
  const timeframes = message.match(ENTITY_PATTERNS.timeframe);
  if (relativeTime || timeframes) {
    entities.timeframes = [
      ...(relativeTime || []).map(t => parseTimeframe(t)),
      ...(timeframes || []).map(t => parseTimeframe(t)),
    ];
  }

  // Extract status mentions
  const statusPatterns = /\b(active|pending|expired|draft|processing|approved|rejected|archived)\b/gi;
  const statuses = message.match(statusPatterns);
  if (statuses) {
    entities.statuses = [...new Set(statuses.map(s => s.toLowerCase()))];
  }

  // Extract comparison entities
  const comparisonMatch = message.match(/compare\s+(.+?)\s+(?:with|to|vs\.?|versus|and)\s+(.+?)(?:\s|$|\.|,)/i);
  if (comparisonMatch) {
    entities.comparisons = [{
      entityA: comparisonMatch[1].trim(),
      entityB: comparisonMatch[2].trim(),
    }];
  }

  // Extract keywords (important nouns and phrases)
  entities.keywords = extractKeywords(message);

  return entities;
}

/**
 * Parse timeframe strings
 */
function parseTimeframe(text: string): TimeframeEntity {
  const lower = text.toLowerCase();
  const isFuture = /next|coming|upcoming/i.test(lower);
  const isPast = /last|past|previous/i.test(lower);
  
  let unit: TimeframeEntity['unit'] = 'days';
  if (/year/i.test(lower)) unit = 'years';
  else if (/quarter/i.test(lower)) unit = 'quarters';
  else if (/month/i.test(lower)) unit = 'months';
  else if (/week/i.test(lower)) unit = 'weeks';

  const durationMatch = lower.match(/(\d+)/);
  const duration = durationMatch ? durationMatch[1] : '1';

  return {
    type: isFuture ? 'future' : isPast ? 'past' : 'present',
    duration,
    unit,
  };
}

/**
 * Extract important keywords from message
 */
function extractKeywords(message: string): string[] {
  // Remove common words and extract significant terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'can', 'i', 'you',
    'we', 'they', 'it', 'this', 'that', 'these', 'those', 'what', 'which',
    'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'me', 'my', 'myself', 'our', 'ours', 'please', 'show', 'give', 'tell',
  ]);

  const words = message
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)].slice(0, 10);
}

/**
 * Analyze message context
 */
function analyzeContext(
  message: string,
  history?: { role: string; content: string }[]
): MessageContext {
  const lowerMessage = message.toLowerCase();

  // Detect tone
  let tone: MessageContext['tone'] = 'neutral';
  if (/urgent|asap|immediately|critical|emergency/i.test(message)) {
    tone = 'urgent';
  } else if (/please|thank|appreciate|kind/i.test(message)) {
    tone = 'formal';
  } else if (/hey|yo|sup|cool|awesome/i.test(message)) {
    tone = 'casual';
  }

  // Detect complexity
  const wordCount = message.split(/\s+/).length;
  const hasMultipleClauses = /and|or|but|also|additionally|furthermore/i.test(message);
  const complexity: MessageContext['complexity'] = 
    wordCount > 30 || hasMultipleClauses ? 'complex' :
    wordCount > 15 ? 'moderate' : 'simple';

  // Check if requires data
  const requiresData = /show|list|find|search|get|fetch|display|compare|analyze/i.test(message);

  // Check if requires action
  const requiresAction = /create|update|delete|start|initiate|submit|approve|renew|upload/i.test(message);

  // Check if follow-up
  const isFollowUp = history ? isFollowUpMessage(message, history) : false;

  // Detect domain
  let domain: MessageContext['domain'] = 'general';
  for (const [domainName, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(k => lowerMessage.includes(k))) {
      domain = domainName as MessageContext['domain'];
      break;
    }
  }

  // Detect sentiment
  let sentiment: MessageContext['sentiment'] = 'neutral';
  if (message.includes('?')) {
    sentiment = 'questioning';
  } else if (/great|good|excellent|perfect|thanks|love|happy/i.test(message)) {
    sentiment = 'positive';
  } else if (/bad|wrong|error|issue|problem|hate|frustrated/i.test(message)) {
    sentiment = 'negative';
  }

  return {
    tone,
    complexity,
    requiresData,
    requiresAction,
    isFollowUp,
    domain,
    sentiment,
  };
}

/**
 * Check if message is a follow-up to previous conversation
 */
function isFollowUp(message: string): boolean {
  return /^(?:and|also|what about|how about|tell me more|continue|yes|no|ok|okay|sure|right|exactly)/i.test(message);
}

function isFollowUpMessage(
  message: string,
  history: { role: string; content: string }[]
): boolean {
  if (history.length === 0) return false;
  
  const lowMessage = message.toLowerCase();
  
  // Short responses are likely follow-ups
  if (message.split(/\s+/).length <= 5) return true;
  
  // Check for follow-up indicators
  return /^(?:and|also|what about|how about|tell me more|continue|yes|no|that|this|those|these)/i.test(lowMessage);
}

/**
 * Calculate confidence score for processing
 */
function calculateConfidence(
  intent: MessageIntent,
  entities: ExtractedEntities,
  context: MessageContext
): number {
  let confidence = 0.5; // Base confidence

  // Intent clarity
  if (intent.primary !== 'unknown') confidence += 0.2;
  if (intent.action) confidence += 0.1;
  
  // Entity richness
  const entityCount = Object.values(entities).filter(v => 
    Array.isArray(v) ? v.length > 0 : v !== undefined
  ).length;
  confidence += Math.min(entityCount * 0.05, 0.2);

  // Context clarity
  if (context.complexity === 'simple') confidence += 0.1;
  if (context.requiresData || context.requiresAction) confidence += 0.05;

  return Math.min(confidence, 1);
}

/**
 * Generate processing hints for optimization
 */
function generateProcessingHints(
  intent: MessageIntent,
  entities: ExtractedEntities,
  context: MessageContext
): ProcessingHint[] {
  const hints: ProcessingHint[] = [];

  // RAG usage hints
  if (context.requiresData || ['search', 'list', 'compare', 'analyze'].includes(intent.primary)) {
    hints.push({
      type: 'use_rag',
      priority: 'high',
      reason: 'Query requires contract data lookup',
    });
  }

  // Streaming hints
  if (context.complexity === 'complex' || intent.primary === 'analyze') {
    hints.push({
      type: 'stream',
      priority: 'medium',
      reason: 'Complex response expected - stream for better UX',
    });
  }

  // Caching hints
  if (intent.primary === 'list' && entities.statuses && entities.statuses.length > 0) {
    hints.push({
      type: 'use_cache',
      priority: 'medium',
      reason: 'Status-based list may be cached',
    });
  }

  // Aggregation hints
  if (['count', 'calculate'].includes(intent.primary) || intent.action?.includes('analysis')) {
    hints.push({
      type: 'aggregate',
      priority: 'high',
      reason: 'Requires data aggregation',
    });
  }

  return hints;
}

/**
 * Generate dynamic system prompt based on context
 */
export function generateDynamicSystemPrompt(
  processedMessage: ProcessedMessage,
  additionalContext?: string
): string {
  const { intent, context, entities } = processedMessage;

  // Base personality and capabilities
  let prompt = `You are ConTigo AI, a friendly and highly capable assistant for the ConTigo Contract Management platform.

**Your Personality:**
- Professional yet approachable - like a trusted colleague
- Proactive - anticipate what users might need next
- Clear and concise - respect users' time
- Helpful - always provide actionable next steps
- Adaptive - match the user's tone and expertise level

**Your Core Capabilities:**
1. 📋 **Contract Intelligence** - Search, analyze, summarize, and compare contracts
2. 📊 **Analytics & Insights** - Spend analysis, risk assessment, trend identification
3. 🔄 **Workflow Support** - Guide renewals, approvals, and contract lifecycle
4. 🔍 **Smart Search** - Find contracts by any criteria using natural language
5. 📈 **Reporting** - Generate insights and data-driven recommendations
6. 💬 **Conversation** - Answer questions, explain concepts, provide guidance

**Key Guidelines:**
- ALWAYS use markdown formatting for clarity
- ALWAYS include clickable links: [Contract Name](/contracts/ID)
- When listing items, use numbered lists with links
- Provide 2-3 suggested follow-up questions
- If uncertain, ask clarifying questions
- Be honest about limitations

`;

  // Add context-specific instructions
  if (intent.primary === 'search' || intent.primary === 'list') {
    prompt += `
**For this search/list query:**
- Format results as a numbered list
- Include contract value, supplier, and status for each
- Group by category if more than 5 results
- Highlight any urgent items (expiring soon, high risk)
`;
  }

  if (intent.primary === 'analyze') {
    prompt += `
**For this analysis query:**
- Structure with clear sections: Overview → Details → Risks → Recommendations
- Use bullet points for key findings
- Quantify insights where possible
- Provide actionable recommendations
`;
  }

  if (intent.primary === 'compare') {
    prompt += `
**For this comparison query:**
- Use a structured comparison format
- Highlight key differences and similarities
- Provide a clear recommendation
- Include relevant metrics for each item
`;
  }

  if (context.tone === 'urgent') {
    prompt += `
**⚠️ Urgent Request Detected:**
- Prioritize actionable information
- Be extra concise
- Highlight critical items first
`;
  }

  if (context.complexity === 'complex') {
    prompt += `
**Complex Query Handling:**
- Break down the response into clear sections
- Consider multiple aspects of the question
- Provide comprehensive coverage
`;
  }

  // Add any additional context (RAG results, contract context, etc.)
  if (additionalContext) {
    prompt += `\n**Context Available:**\n${additionalContext}\n`;
  }

  // Add extracted entities for reference
  if (entities.keywords && entities.keywords.length > 0) {
    prompt += `\n**Key Terms to Address:** ${entities.keywords.join(', ')}\n`;
  }

  return prompt;
}

export default {
  processMessage,
  generateDynamicSystemPrompt,
};

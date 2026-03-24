/**
 * Custom AI Analysis Service
 * 
 * Allows users to ask AI custom questions about contracts.
 * All processing uses anonymization for data protection.
 * 
 * Features:
 * - Custom prompts for any analysis
 * - Pre-built analysis templates
 * - Conversation history support
 * - Multi-language support
 * - Swiss/EU data protection compliant
 */

import { ContractAnonymizer, processWithAnonymization } from './anonymizer';
import OpenAI from 'openai';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';

// Initialize OpenAI client
const openai = createOpenAIClient();

// ============================================================================
// Types
// ============================================================================

export interface CustomAnalysisRequest {
  /** The user's question or prompt */
  prompt: string;
  /** Contract text to analyze */
  contractText: string;
  /** Optional: Previous conversation context */
  conversationHistory?: ConversationMessage[];
  /** Optional: Use a pre-built template */
  template?: AnalysisTemplate;
  /** Optional: Specific focus areas */
  focusAreas?: string[];
  /** Language for response */
  language?: 'en' | 'de' | 'fr' | 'it';
  /** Model to use */
  model?: string;
  /** Response format */
  format?: 'text' | 'json' | 'markdown' | 'bullet-points';
}

export interface CustomAnalysisResponse {
  /** The AI's response */
  answer: string;
  /** Extracted key points */
  keyPoints?: string[];
  /** Confidence score */
  confidence: number;
  /** Source references (clause numbers, sections) */
  sources?: string[];
  /** Follow-up questions the user might ask */
  suggestedFollowUps?: string[];
  /** Processing metadata */
  metadata: {
    model: string;
    processingTime: number;
    tokensUsed: number;
    anonymizationApplied: boolean;
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type AnalysisTemplate = 
  | 'risk-assessment'
  | 'financial-analysis'
  | 'compliance-check'
  | 'obligation-extraction'
  | 'term-comparison'
  | 'clause-explanation'
  | 'negotiation-points'
  | 'summary'
  | 'key-dates'
  | 'liability-analysis'
  | 'termination-clauses'
  | 'ip-rights'
  | 'data-protection'
  | 'sla-requirements'
  | 'penalty-clauses'
  | 'custom';

// ============================================================================
// Pre-built Analysis Templates
// ============================================================================

const ANALYSIS_TEMPLATES: Record<AnalysisTemplate, { 
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  suggestedFollowUps: string[];
}> = {
  'risk-assessment': {
    name: 'Risk Assessment',
    description: 'Identify potential risks and liabilities in the contract',
    systemPrompt: `You are a legal risk analyst specializing in contract review. Identify all potential risks, 
categorize them by severity (high/medium/low), and provide mitigation recommendations.
Focus on: liability exposure, indemnification gaps, termination risks, compliance issues, and hidden obligations.`,
    userPromptTemplate: `Analyze the following contract for risks:

{contractText}

Provide:
1. Overall risk level (low/medium/high)
2. Top 5 risks with severity ratings
3. Specific clauses of concern
4. Mitigation recommendations
5. Red flags that require immediate attention`,
    suggestedFollowUps: [
      'What are the indemnification obligations?',
      'Are there any unlimited liability clauses?',
      'What happens if we breach the contract?',
      'Are there any hidden penalties?',
    ],
  },

  'financial-analysis': {
    name: 'Financial Analysis',
    description: 'Extract and analyze all financial terms and obligations',
    systemPrompt: `You are a financial analyst specializing in contract review. Extract all financial terms, 
payment schedules, pricing structures, and monetary obligations. Calculate total contract value where possible.`,
    userPromptTemplate: `Analyze the financial aspects of this contract:

{contractText}

Extract:
1. Total contract value
2. Payment terms and schedule
3. Pricing structure (fixed/variable/milestone-based)
4. Price adjustment mechanisms
5. Penalties and late fees
6. Expense reimbursements
7. Currency and payment methods`,
    suggestedFollowUps: [
      'What is the payment schedule?',
      'Are there any price escalation clauses?',
      'What expenses are reimbursable?',
      'What are the late payment penalties?',
    ],
  },

  'compliance-check': {
    name: 'Compliance Check',
    description: 'Check for regulatory and legal compliance requirements',
    systemPrompt: `You are a compliance specialist. Review contracts for regulatory compliance, including GDPR, 
FADP (Swiss data protection), industry-specific regulations, and standard legal requirements.`,
    userPromptTemplate: `Review this contract for compliance requirements:

{contractText}

Check for:
1. Data protection compliance (GDPR/FADP)
2. Industry-specific regulations
3. Required legal clauses
4. Insurance requirements
5. Certification requirements
6. Audit rights
7. Reporting obligations`,
    suggestedFollowUps: [
      'Is this contract GDPR compliant?',
      'What certifications are required?',
      'Are there audit rights included?',
      'What data protection measures are specified?',
    ],
  },

  'obligation-extraction': {
    name: 'Obligation Extraction',
    description: 'Extract all obligations and deliverables',
    systemPrompt: `You are a contract obligations analyst. Extract all obligations, deliverables, milestones, 
and commitments from both parties. Organize them chronologically with deadlines.`,
    userPromptTemplate: `Extract all obligations from this contract:

{contractText}

List:
1. Our obligations (things we must do)
2. Their obligations (things they must do)
3. Deliverables with deadlines
4. Milestones and checkpoints
5. Ongoing/recurring obligations
6. Conditions and prerequisites`,
    suggestedFollowUps: [
      'What are the key deadlines?',
      'What deliverables are expected from us?',
      'Are there any acceptance criteria?',
      'What happens if a milestone is missed?',
    ],
  },

  'term-comparison': {
    name: 'Term Comparison',
    description: 'Compare terms against standard or previous contracts',
    systemPrompt: `You are a contract comparison specialist. Analyze contract terms and identify deviations 
from standard practices or unfavorable conditions that should be negotiated.`,
    userPromptTemplate: `Analyze these contract terms for negotiation opportunities:

{contractText}

Identify:
1. Non-standard or unusual terms
2. Terms that favor the other party
3. Missing standard protections
4. Negotiation priorities
5. Deal-breaker clauses
6. Recommended counter-terms`,
    suggestedFollowUps: [
      'What terms should we negotiate?',
      'What standard clauses are missing?',
      'Is the liability cap reasonable?',
      'Are the termination terms fair?',
    ],
  },

  'clause-explanation': {
    name: 'Clause Explanation',
    description: 'Get plain-language explanations of complex clauses',
    systemPrompt: `You are a legal translator who explains complex contract language in simple, plain terms. 
Make legal jargon understandable for business users without legal training.`,
    userPromptTemplate: `Explain the following contract in plain language:

{contractText}

For each major clause:
1. What it means in simple terms
2. What it requires from each party
3. Potential implications
4. What to watch out for`,
    suggestedFollowUps: [
      'What does the indemnification clause mean?',
      'Explain the limitation of liability',
      'What does "force majeure" mean here?',
      'What are our termination rights?',
    ],
  },

  'negotiation-points': {
    name: 'Negotiation Points',
    description: 'Identify key points for contract negotiation',
    systemPrompt: `You are a contract negotiation strategist. Identify leverage points, areas for improvement, 
and specific language changes that would benefit your client.`,
    userPromptTemplate: `Identify negotiation opportunities in this contract:

{contractText}

Provide:
1. Top 5 negotiation priorities
2. Specific language to request changes
3. Fallback positions
4. Items to trade for concessions
5. Absolute requirements vs. nice-to-haves`,
    suggestedFollowUps: [
      'What is our strongest negotiation point?',
      'What should we absolutely not accept?',
      'What can we offer as a trade-off?',
      'How can we improve the liability terms?',
    ],
  },

  'summary': {
    name: 'Executive Summary',
    description: 'Get a quick executive summary of the contract',
    systemPrompt: `You are an executive briefing specialist. Provide concise, actionable summaries 
for busy executives who need to understand contracts quickly.`,
    userPromptTemplate: `Provide an executive summary of this contract:

{contractText}

Include:
1. One-paragraph overview
2. Key parties and their roles
3. Main value proposition
4. Critical dates and deadlines
5. Major obligations
6. Key risks or concerns
7. Recommended actions`,
    suggestedFollowUps: [
      'What are the key dates I need to know?',
      'What are our main obligations?',
      'Is this a good deal for us?',
      'What should I be concerned about?',
    ],
  },

  'key-dates': {
    name: 'Key Dates',
    description: 'Extract all important dates and deadlines',
    systemPrompt: `You are a contract timeline specialist. Extract every date, deadline, and time-sensitive 
obligation from contracts and organize them chronologically.`,
    userPromptTemplate: `Extract all dates and deadlines from this contract:

{contractText}

Create a timeline showing:
1. Contract start/effective date
2. All milestone dates
3. Payment due dates
4. Notice deadlines
5. Renewal/termination dates
6. Any recurring dates`,
    suggestedFollowUps: [
      'When does the contract expire?',
      'What is the notice period for termination?',
      'When is the first payment due?',
      'Are there any auto-renewal clauses?',
    ],
  },

  'liability-analysis': {
    name: 'Liability Analysis',
    description: 'Analyze liability and indemnification terms',
    systemPrompt: `You are a liability risk specialist. Analyze all liability, indemnification, and 
limitation of liability clauses with a focus on financial exposure.`,
    userPromptTemplate: `Analyze liability terms in this contract:

{contractText}

Evaluate:
1. Liability caps and limits
2. Indemnification obligations (both parties)
3. Exclusions and carve-outs
4. Insurance requirements
5. Maximum financial exposure
6. Recommendations for protection`,
    suggestedFollowUps: [
      'What is our maximum liability?',
      'What are we indemnifying them for?',
      'Are consequential damages excluded?',
      'Is the liability cap adequate?',
    ],
  },

  'termination-clauses': {
    name: 'Termination Analysis',
    description: 'Analyze termination rights and exit strategies',
    systemPrompt: `You are a contract exit strategy specialist. Analyze all termination clauses, 
exit rights, and obligations upon termination.`,
    userPromptTemplate: `Analyze termination terms in this contract:

{contractText}

Cover:
1. Termination for convenience rights
2. Termination for cause triggers
3. Notice requirements
4. Obligations upon termination
5. Transition assistance
6. Surviving obligations
7. Recommended exit strategy`,
    suggestedFollowUps: [
      'How can we terminate early?',
      'What is the notice period?',
      'What happens to our data after termination?',
      'Are there any penalties for early termination?',
    ],
  },

  'ip-rights': {
    name: 'IP Rights Analysis',
    description: 'Analyze intellectual property rights and ownership',
    systemPrompt: `You are an intellectual property specialist. Analyze IP clauses including ownership, 
licensing, work-for-hire provisions, and pre-existing IP protections.`,
    userPromptTemplate: `Analyze IP rights in this contract:

{contractText}

Examine:
1. IP ownership (created during contract)
2. Background IP protections
3. License grants
4. Restrictions on IP use
5. Confidentiality provisions
6. Non-compete clauses`,
    suggestedFollowUps: [
      'Who owns the deliverables?',
      'What IP rights are we granting?',
      'Is our background IP protected?',
      'Can they use our work for other clients?',
    ],
  },

  'data-protection': {
    name: 'Data Protection Analysis',
    description: 'Analyze data protection and privacy terms',
    systemPrompt: `You are a data protection specialist familiar with GDPR, FADP (Swiss), and other 
privacy regulations. Analyze data handling, processing, and protection provisions.`,
    userPromptTemplate: `Analyze data protection terms in this contract:

{contractText}

Review:
1. Data processing activities
2. Controller/processor relationship
3. Data transfer mechanisms
4. Security requirements
5. Breach notification procedures
6. Data subject rights
7. Subprocessor requirements
8. Data retention and deletion`,
    suggestedFollowUps: [
      'Is there a Data Processing Agreement?',
      'Where will our data be stored?',
      'How is data breach notification handled?',
      'Can they use subprocessors?',
    ],
  },

  'sla-requirements': {
    name: 'SLA Analysis',
    description: 'Analyze Service Level Agreement terms',
    systemPrompt: `You are an SLA specialist. Analyze service level commitments, performance metrics, 
remedies for breaches, and reporting requirements.`,
    userPromptTemplate: `Analyze SLA terms in this contract:

{contractText}

Extract:
1. Service level metrics
2. Uptime/availability commitments
3. Response time requirements
4. Remedies for SLA breaches (credits, termination)
5. Exclusions from SLA
6. Reporting and monitoring
7. Escalation procedures`,
    suggestedFollowUps: [
      'What uptime is guaranteed?',
      'What are the remedies for SLA breaches?',
      'How are SLA credits calculated?',
      'What is excluded from the SLA?',
    ],
  },

  'penalty-clauses': {
    name: 'Penalty Analysis',
    description: 'Identify all penalty and damage clauses',
    systemPrompt: `You are a contract penalty specialist. Identify all penalties, liquidated damages, 
late fees, and financial consequences throughout the contract.`,
    userPromptTemplate: `Identify all penalty clauses in this contract:

{contractText}

Find:
1. Late payment penalties
2. Liquidated damages
3. Penalty for delays
4. Non-compliance penalties
5. Early termination fees
6. Breach consequences
7. Compare to industry standards`,
    suggestedFollowUps: [
      'What are the late payment penalties?',
      'Are the liquidated damages reasonable?',
      'What happens if we miss a deadline?',
      'Is there a cap on penalties?',
    ],
  },

  'custom': {
    name: 'Custom Analysis',
    description: 'Ask any custom question about the contract',
    systemPrompt: `You are a versatile contract analysis assistant. Answer questions about contracts 
accurately and thoroughly, citing specific clauses where relevant.`,
    userPromptTemplate: `{prompt}

Contract:
{contractText}`,
    suggestedFollowUps: [],
  },
};

// ============================================================================
// Main Custom Analysis Function
// ============================================================================

/**
 * Analyze a contract with a custom prompt or template
 * 
 * @example
 * // Custom question
 * const result = await customContractAnalysis({
 *   prompt: "What are the termination rights for both parties?",
 *   contractText: contractContent,
 *   format: 'bullet-points',
 * });
 * 
 * // Using a template
 * const result = await customContractAnalysis({
 *   template: 'risk-assessment',
 *   contractText: contractContent,
 *   language: 'de',
 * });
 */
export async function customContractAnalysis(
  request: CustomAnalysisRequest
): Promise<CustomAnalysisResponse> {
  const startTime = Date.now();
  const {
    prompt,
    contractText,
    conversationHistory = [],
    template = 'custom',
    focusAreas = [],
    language = 'en',
    model = 'gpt-4o-mini',
    format = 'text',
  } = request;

  // Get template configuration
  const templateConfig = ANALYSIS_TEMPLATES[template];
  
  // Build system prompt
  let systemPrompt = templateConfig.systemPrompt;
  
  // Add language instruction
  const languageInstructions: Record<string, string> = {
    en: 'Respond in English.',
    de: 'Antworte auf Deutsch.',
    fr: 'Répondez en français.',
    it: 'Rispondi in italiano.',
  };
  systemPrompt += `\n\n${languageInstructions[language] || languageInstructions.en}`;

  // Add format instruction
  const formatInstructions: Record<string, string> = {
    text: 'Provide a clear, well-structured text response.',
    json: 'Respond in valid JSON format.',
    markdown: 'Use Markdown formatting with headers, bullet points, and emphasis.',
    'bullet-points': 'Organize your response using bullet points for easy scanning.',
  };
  systemPrompt += `\n${formatInstructions[format]}`;

  // Add focus areas if specified
  if (focusAreas.length > 0) {
    systemPrompt += `\n\nPay special attention to these areas: ${focusAreas.join(', ')}.`;
  }

  // Anonymize the contract text
  const anonymizer = new ContractAnonymizer();
  const { anonymizedText, mappings } = anonymizer.anonymize(contractText);

  // Build user prompt
  let userPrompt: string;
  if (template === 'custom') {
    userPrompt = templateConfig.userPromptTemplate
      .replace('{prompt}', prompt)
      .replace('{contractText}', anonymizedText);
  } else {
    userPrompt = templateConfig.userPromptTemplate
      .replace('{contractText}', anonymizedText);
    
    // If custom prompt also provided with template, append it
    if (prompt) {
      userPrompt += `\n\nAdditionally, please address this specific question: ${prompt}`;
    }
  }

  // Build messages array with conversation history
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add anonymized conversation history
  for (const msg of conversationHistory) {
    const anonymizedContent = anonymizer.anonymize(msg.content).anonymizedText;
    messages.push({
      role: msg.role,
      content: anonymizedContent,
    });
  }

  // Add current user message
  messages.push({ role: 'user', content: userPrompt });

  // Call OpenAI
  const response = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    messages,
    response_format: format === 'json' ? { type: 'json_object' } : undefined,
  });

  const aiResponseText = response.choices[0]?.message?.content || '';
  const tokensUsed = response.usage?.total_tokens || 0;

  // De-anonymize the response
  const deAnonymizedResponse = anonymizer.deAnonymize(aiResponseText, mappings);

  // Extract key points if not in JSON format
  let keyPoints: string[] | undefined;
  if (format !== 'json') {
    keyPoints = extractKeyPoints(deAnonymizedResponse);
  }

  // Calculate processing time
  const processingTime = Date.now() - startTime;

  return {
    answer: deAnonymizedResponse,
    keyPoints,
    confidence: calculateConfidence(deAnonymizedResponse, contractText),
    sources: extractSourceReferences(deAnonymizedResponse),
    suggestedFollowUps: template !== 'custom' 
      ? templateConfig.suggestedFollowUps 
      : generateFollowUps(prompt, deAnonymizedResponse),
    metadata: {
      model,
      processingTime,
      tokensUsed,
      anonymizationApplied: true,
    },
  };
}

// ============================================================================
// Conversation Support
// ============================================================================

/**
 * Continue a conversation about a contract
 */
export async function continueConversation(
  contractText: string,
  conversationHistory: ConversationMessage[],
  newMessage: string,
  options: Partial<CustomAnalysisRequest> = {}
): Promise<CustomAnalysisResponse> {
  return customContractAnalysis({
    prompt: newMessage,
    contractText,
    conversationHistory,
    template: 'custom',
    ...options,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractKeyPoints(text: string): string[] {
  const points: string[] = [];
  
  // Extract bullet points
  const bulletMatches = text.match(/^[\s]*[-•*]\s+(.+)$/gm);
  if (bulletMatches) {
    points.push(...bulletMatches.map(m => m.replace(/^[\s]*[-•*]\s+/, '').trim()));
  }
  
  // Extract numbered items
  const numberedMatches = text.match(/^\d+\.\s+(.+)$/gm);
  if (numberedMatches) {
    points.push(...numberedMatches.map(m => m.replace(/^\d+\.\s+/, '').trim()));
  }

  return points.slice(0, 10); // Return top 10
}

function extractSourceReferences(text: string): string[] {
  const sources: string[] = [];
  
  // Match section/clause references like "Section 5.2", "Clause 3", "Article 7"
  const sectionMatches = text.match(/(Section|Clause|Article|Paragraph|§)\s*[\d.]+/gi);
  if (sectionMatches) {
    sources.push(...[...new Set(sectionMatches)]);
  }
  
  return sources;
}

function calculateConfidence(response: string, originalText: string): number {
  // Simple confidence heuristic
  let confidence = 0.7;
  
  // Increase confidence if response cites specific sections
  const citationCount = (response.match(/(Section|Clause|Article|Paragraph)\s*[\d.]+/gi) || []).length;
  confidence += Math.min(citationCount * 0.02, 0.15);
  
  // Increase confidence for longer, more detailed responses
  if (response.length > 1000) confidence += 0.05;
  if (response.length > 2000) confidence += 0.05;
  
  // Cap at 0.95
  return Math.min(confidence, 0.95);
}

function generateFollowUps(question: string, response: string): string[] {
  // Generate contextual follow-up questions based on the response
  const followUps: string[] = [];
  
  // If response mentions risks
  if (/risk|liability|exposure/i.test(response)) {
    followUps.push('How can we mitigate these risks?');
  }
  
  // If response mentions dates
  if (/deadline|date|expire|renew/i.test(response)) {
    followUps.push('What are all the key dates in this contract?');
  }
  
  // If response mentions payment
  if (/payment|fee|cost|price/i.test(response)) {
    followUps.push('What are the payment terms and schedule?');
  }
  
  // If response mentions termination
  if (/terminat|cancel|exit/i.test(response)) {
    followUps.push('What are our termination rights?');
  }
  
  // Default follow-ups
  if (followUps.length === 0) {
    followUps.push(
      'What are the key risks in this contract?',
      'What are our main obligations?',
      'What are the termination conditions?'
    );
  }
  
  return followUps.slice(0, 4);
}

// ============================================================================
// Template Helpers
// ============================================================================

/**
 * Get all available analysis templates
 */
export function getAnalysisTemplates(): Array<{
  id: AnalysisTemplate;
  name: string;
  description: string;
}> {
  return Object.entries(ANALYSIS_TEMPLATES).map(([id, template]) => ({
    id: id as AnalysisTemplate,
    name: template.name,
    description: template.description,
  }));
}

/**
 * Get template details by ID
 */
export function getTemplateDetails(templateId: AnalysisTemplate) {
  return ANALYSIS_TEMPLATES[templateId];
}

// ============================================================================
// Exports
// ============================================================================

export {
  ANALYSIS_TEMPLATES,
};

export default customContractAnalysis;

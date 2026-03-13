/**
 * ReAct Agent Pattern Implementation
 * 
 * Implements the Reasoning + Acting pattern for autonomous decision-making.
 * The agent iterates through Thought → Action → Observation cycles until
 * the goal is achieved or max iterations are reached.
 * 
 * @version 1.0.0
 */

import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

// =============================================================================
// TYPES
// =============================================================================

export interface ReActTool {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (params: any, context: ReActContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
}

export interface ReActStep {
  stepNumber: number;
  thought: string;
  action: {
    tool: string;
    parameters: Record<string, any>;
  } | null;
  observation: string;
  timestamp: Date;
}

export interface ReActContext {
  goal: string;
  contractId?: string;
  contractText?: string;
  tenantId: string;
  userId: string;
  additionalContext?: Record<string, any>;
}

export interface ReActResult {
  success: boolean;
  goal: string;
  finalAnswer: string;
  steps: ReActStep[];
  totalIterations: number;
  totalTokensUsed: number;
  processingTimeMs: number;
  toolsUsed: string[];
}

export interface ReActConfig {
  maxIterations: number;
  temperature: number;
  model: string;
  enableSelfReflection: boolean;
  confidenceThreshold: number;
}

// =============================================================================
// BUILT-IN TOOLS
// =============================================================================

const BUILT_IN_TOOLS: ReActTool[] = [
  {
    name: 'extract_clause',
    description: 'Extract a specific clause type from the contract text. Types: termination, liability, confidentiality, indemnity, payment, renewal, ip_ownership, force_majeure, dispute_resolution, warranties',
    parameters: z.object({
      clauseType: z.string(),
      detailed: z.boolean().optional().default(false),
    }),
    execute: async (params, context) => {
      const text = context.contractText || '';
      if (!text) {
        return { success: false, data: { clauseType: params.clauseType, found: false, excerpts: [], matchCount: 0 } };
      }

      // ── Primary: LLM-powered clause extraction ──
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        try {
          const { ChatOpenAI } = await import('@langchain/openai');
          const llm = new ChatOpenAI({
            openAIApiKey: apiKey,
            modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0,
            maxTokens: 1000,
          });
          const textPreview = text.slice(0, 12000); // Limit to ~3k tokens
          const response = await llm.invoke([
            new SystemMessage(
              `Extract the ${params.clauseType} clause(s) from the contract text below. ` +
              `Return a JSON object: { "found": boolean, "excerpts": string[], "summary": string }. ` +
              `Each excerpt should be the exact text from the contract (max 500 chars each, up to 3 excerpts). ` +
              `The summary should be a 1-2 sentence plain English description of what the clause says. ` +
              `If no matching clause exists, return { "found": false, "excerpts": [], "summary": "No ${params.clauseType} clause found." }.`
            ),
            new HumanMessage(textPreview),
          ]);
          const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              success: !!parsed.found,
              data: {
                clauseType: params.clauseType,
                found: !!parsed.found,
                excerpts: (parsed.excerpts || []).slice(0, 3),
                matchCount: (parsed.excerpts || []).length,
                summary: parsed.summary || '',
              },
            };
          }
        } catch {
          // LLM extraction failed — fall through to regex fallback
        }
      }

      // ── Fallback: regex-based extraction ──
      const clausePatterns: Record<string, RegExp[]> = {
        termination: [/terminat(e|ion)/gi, /cancel(lation)?/gi, /end\s+of\s+agreement/gi],
        liability: [/liabilit(y|ies)/gi, /limit(ation)?\s+of\s+liability/gi, /cap\s+on\s+damages/gi],
        confidentiality: [/confidential(ity)?/gi, /non-disclosure/gi, /proprietary\s+information/gi],
        indemnity: [/indemnif(y|ication)/gi, /hold\s+harmless/gi, /defense\s+obligation/gi],
        payment: [/payment\s+terms?/gi, /invoice/gi, /net\s+\d+\s+days/gi, /compensation/gi],
        renewal: [/renewal/gi, /auto(-|\s)?renew/gi, /extend/gi, /continuation/gi],
        ip_ownership: [/intellectual\s+property/gi, /work\s+product/gi, /ownership\s+of/gi],
        force_majeure: [/force\s+majeure/gi, /act\s+of\s+god/gi, /unforeseeable/gi],
        dispute_resolution: [/dispute/gi, /arbitration/gi, /mediation/gi, /litigation/gi],
        warranties: [/warrant(y|ies)/gi, /represent(ation)?s?/gi, /covenant/gi],
      };

      const patterns = clausePatterns[params.clauseType.toLowerCase()] || [];
      const matches: string[] = [];

      for (const pattern of patterns) {
        const found = text.match(pattern);
        if (found) {
          const index = text.search(pattern);
          if (index > -1) {
            const start = Math.max(0, index - 200);
            const end = Math.min(text.length, index + 500);
            matches.push(text.slice(start, end).trim());
          }
        }
      }

      return {
        success: matches.length > 0,
        data: {
          clauseType: params.clauseType,
          found: matches.length > 0,
          excerpts: matches.slice(0, 3),
          matchCount: matches.length,
        },
      };
    },
  },
  {
    name: 'analyze_risk',
    description: 'Analyze risks in the contract. Types: financial, legal, operational, compliance, reputational',
    parameters: z.object({
      riskType: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    }),
    execute: async (params, context) => {
      const riskIndicators: Record<string, { keywords: string[]; severity: string }> = {
        financial: {
          keywords: ['unlimited liability', 'penalty', 'liquidated damages', 'no cap', 'indemnify without limit'],
          severity: 'high',
        },
        legal: {
          keywords: ['governing law', 'jurisdiction', 'arbitration', 'class action waiver'],
          severity: 'medium',
        },
        operational: {
          keywords: ['sla', 'uptime', 'performance guarantee', 'availability'],
          severity: 'medium',
        },
        compliance: {
          keywords: ['gdpr', 'hipaa', 'sox', 'pci', 'regulatory', 'audit rights'],
          severity: 'high',
        },
        reputational: {
          keywords: ['publicity', 'public statement', 'press release', 'endorsement'],
          severity: 'low',
        },
      };

      const text = (context.contractText || '').toLowerCase();
      const indicators = riskIndicators[params.riskType.toLowerCase()] || { keywords: [], severity: 'unknown' };
      const foundIssues: string[] = [];

      for (const keyword of indicators.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          foundIssues.push(keyword);
        }
      }

      return {
        success: true,
        data: {
          riskType: params.riskType,
          foundIssues,
          severity: foundIssues.length > 2 ? 'high' : foundIssues.length > 0 ? 'medium' : 'low',
          recommendation: foundIssues.length > 0 
            ? `Review these ${params.riskType} risk indicators: ${foundIssues.join(', ')}`
            : `No significant ${params.riskType} risks detected`,
        },
      };
    },
  },
  {
    name: 'extract_dates',
    description: 'Extract key dates from the contract: effective_date, expiration_date, renewal_deadline, payment_due',
    parameters: z.object({
      dateType: z.string(),
    }),
    execute: async (params, context) => {
      const text = context.contractText || '';
      
      // Common date patterns
      const datePatterns = [
        /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
        /\b(\d{1,2}-\d{1,2}-\d{2,4})\b/g,
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
        /\b(\d{4}-\d{2}-\d{2})\b/g,
      ];

      const contextKeywords: Record<string, string[]> = {
        effective_date: ['effective', 'commence', 'start', 'begin', 'as of'],
        expiration_date: ['expire', 'expiration', 'end', 'terminate', 'until'],
        renewal_deadline: ['renew', 'renewal', 'notice period', 'opt out'],
        payment_due: ['payment', 'due', 'invoice', 'pay within'],
      };

      const keywords = contextKeywords[params.dateType.toLowerCase()] || [];
      const foundDates: Array<{ date: string; context: string }> = [];

      for (const pattern of datePatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          const index = match.index || 0;
          const surroundingText = text.slice(Math.max(0, index - 100), Math.min(text.length, index + 100));
          
          // Check if any relevant keyword is nearby
          const hasRelevantContext = keywords.some(kw => 
            surroundingText.toLowerCase().includes(kw.toLowerCase())
          );
          
          if (hasRelevantContext || keywords.length === 0) {
            foundDates.push({
              date: match[0],
              context: surroundingText.trim(),
            });
          }
        }
      }

      return {
        success: foundDates.length > 0,
        data: {
          dateType: params.dateType,
          dates: foundDates.slice(0, 5),
          bestMatch: foundDates[0] || null,
        },
      };
    },
  },
  {
    name: 'extract_parties',
    description: 'Extract party information from the contract: names, roles, addresses',
    parameters: z.object({
      includeAddresses: z.boolean().optional().default(false),
    }),
    execute: async (params, context) => {
      const text = context.contractText || '';
      
      // Look for party indicators
      const partyPatterns = [
        /(?:between|by and between)\s+([A-Z][A-Za-z\s,\.]+(?:Inc|LLC|Ltd|Corp|Corporation|Company|LLP)?)/gi,
        /(?:party|parties):\s*([A-Z][A-Za-z\s,\.]+)/gi,
        /"([A-Z][a-zA-Z\s]+)"\s*(?:\(the\s*"(?:Company|Client|Vendor|Provider|Customer|Contractor)"\))/gi,
      ];

      const parties: Array<{ name: string; role?: string }> = [];
      
      for (const pattern of partyPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length > 2 && match[1].length < 200) {
            parties.push({
              name: match[1].trim(),
              role: match[2] || undefined,
            });
          }
        }
      }

      // Dedupe
      const uniqueParties = parties.filter((party, index, self) =>
        index === self.findIndex(p => p.name.toLowerCase() === party.name.toLowerCase())
      );

      return {
        success: uniqueParties.length > 0,
        data: {
          parties: uniqueParties.slice(0, 10),
          partyCount: uniqueParties.length,
        },
      };
    },
  },
  {
    name: 'calculate_value',
    description: 'Extract and calculate contract value, payment terms, and financial obligations',
    parameters: z.object({
      includeBreakdown: z.boolean().optional().default(true),
    }),
    execute: async (params, context) => {
      const text = context.contractText || '';
      
      // Money patterns
      const currencyPattern = /(?:\$|USD|EUR|GBP|£|€)\s?[\d,]+(?:\.\d{2})?(?:\s?(?:million|thousand|k|m|bn|billion))?/gi;
      const amounts: Array<{ value: string; context: string }> = [];
      
      const matches = text.matchAll(currencyPattern);
      for (const match of matches) {
        const index = match.index || 0;
        amounts.push({
          value: match[0],
          context: text.slice(Math.max(0, index - 50), Math.min(text.length, index + 100)).trim(),
        });
      }

      // Try to identify the main contract value
      let mainValue: { value: string; context: string } | null = null;
      for (const amount of amounts) {
        if (/total|contract value|aggregate|not to exceed|maximum/i.test(amount.context)) {
          mainValue = amount;
          break;
        }
      }

      return {
        success: amounts.length > 0,
        data: {
          mainValue: mainValue?.value || amounts[0]?.value || null,
          allAmounts: amounts.slice(0, 10),
          paymentTerms: /net\s+\d+/i.test(text) ? text.match(/net\s+\d+/i)?.[0] : null,
        },
      };
    },
  },
  {
    name: 'check_completeness',
    description: 'Check if essential contract elements are present',
    parameters: z.object({
      elements: z.array(z.string()).optional(),
    }),
    execute: async (params, context) => {
      const text = (context.contractText || '').toLowerCase();
      
      const essentialElements = params.elements || [
        'parties',
        'effective_date',
        'term',
        'termination',
        'payment',
        'governing_law',
        'signatures',
      ];

      const checks: Record<string, { present: boolean; indicators: string[] }> = {};

      const elementPatterns: Record<string, string[]> = {
        parties: ['between', 'party', 'parties', 'company', 'client'],
        effective_date: ['effective', 'commence', 'dated', 'as of'],
        term: ['term', 'duration', 'period', 'years', 'months'],
        termination: ['terminat', 'cancel', 'end of agreement'],
        payment: ['payment', 'fee', 'compensation', 'price', '$'],
        governing_law: ['governing law', 'jurisdiction', 'laws of'],
        signatures: ['signature', 'signed', 'executed', 'witness'],
      };

      for (const element of essentialElements) {
        const patterns = elementPatterns[element] || [element];
        const found = patterns.filter(p => text.includes(p.toLowerCase()));
        checks[element] = {
          present: found.length > 0,
          indicators: found,
        };
      }

      const presentCount = Object.values(checks).filter(c => c.present).length;
      const completenessScore = presentCount / essentialElements.length;

      return {
        success: true,
        data: {
          checks,
          completenessScore,
          missingElements: Object.entries(checks)
            .filter(([_, v]) => !v.present)
            .map(([k]) => k),
        },
      };
    },
  },
  {
    name: 'summarize_section',
    description: 'Generate a summary of a specific section or the entire contract',
    parameters: z.object({
      sectionName: z.string().optional(),
      maxLength: z.number().optional().default(500),
    }),
    execute: async (params, context) => {
      const text = context.contractText || '';
      
      // If section specified, try to find it
      let targetText = text;
      if (params.sectionName) {
        const sectionPattern = new RegExp(
          `${params.sectionName}[:\\s]*([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]+:|$)`,
          'gi'
        );
        const match = text.match(sectionPattern);
        if (match) {
          targetText = match[0];
        }
      }

      // Simple extractive summary (first sentences of paragraphs)
      const paragraphs = targetText.split(/\n\n+/).filter(p => p.trim().length > 50);
      const summaryParts = paragraphs.slice(0, 5).map(p => {
        const sentences = p.match(/[^.!?]+[.!?]+/g) || [];
        return sentences[0]?.trim() || '';
      }).filter(Boolean);

      return {
        success: summaryParts.length > 0,
        data: {
          section: params.sectionName || 'full document',
          summary: summaryParts.join(' ').slice(0, params.maxLength),
          paragraphCount: paragraphs.length,
        },
      };
    },
  },
  {
    name: 'final_answer',
    description: 'Provide the final answer to the user goal. Use this when you have gathered enough information.',
    parameters: z.object({
      answer: z.string(),
      confidence: z.number().min(0).max(1),
      supportingEvidence: z.array(z.string()).optional(),
    }),
    execute: async (params) => {
      return {
        success: true,
        data: {
          answer: params.answer,
          confidence: params.confidence,
          supportingEvidence: params.supportingEvidence || [],
          isFinal: true,
        },
      };
    },
  },
];

// =============================================================================
// REACT AGENT CLASS
// =============================================================================

export class ReActAgent {
  private llm: ChatOpenAI;
  private tools: Map<string, ReActTool>;
  private config: ReActConfig;

  constructor(
    config: Partial<ReActConfig> = {},
    additionalTools: ReActTool[] = []
  ) {
    this.config = {
      maxIterations: config.maxIterations || 10,
      temperature: config.temperature || 0.2,
      model: config.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      enableSelfReflection: config.enableSelfReflection ?? true,
      confidenceThreshold: config.confidenceThreshold || 0.85,
    };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for ReAct agent');
    }

    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      azureOpenAIApiKey: undefined,
      modelName: this.config.model,
      temperature: this.config.temperature,
    });

    this.tools = new Map();
    for (const tool of [...BUILT_IN_TOOLS, ...additionalTools]) {
      this.tools.set(tool.name, tool);
    }
  }

  private buildSystemPrompt(): string {
    const toolDescriptions = Array.from(this.tools.values())
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');

    return `You are an intelligent contract analysis agent using the ReAct (Reasoning and Acting) pattern.

Your goal is to help users analyze contracts by iteratively thinking about what you need to do, taking actions using available tools, and observing the results.

## Available Tools:
${toolDescriptions}

## Response Format:
You must respond in exactly this JSON format:
{
  "thought": "Your reasoning about what to do next",
  "action": {
    "tool": "tool_name",
    "parameters": { ... }
  }
}

OR if you have gathered enough information:
{
  "thought": "I have enough information to answer",
  "action": {
    "tool": "final_answer",
    "parameters": {
      "answer": "Your comprehensive answer",
      "confidence": 0.95,
      "supportingEvidence": ["evidence1", "evidence2"]
    }
  }
}

## Guidelines:
1. Think step by step about what information you need
2. Use tools to gather facts - don't make assumptions
3. After each observation, reflect on what you learned
4. Continue until you can provide a confident answer
5. If you cannot find information, acknowledge uncertainty
6. Always use the final_answer tool when ready to conclude`;
  }

  private buildUserPrompt(context: ReActContext, steps: ReActStep[]): string {
    let prompt = `## Goal:\n${context.goal}\n\n`;

    if (context.contractText) {
      const preview = context.contractText.slice(0, 2000);
      prompt += `## Contract Preview (first 2000 chars):\n${preview}\n\n`;
    }

    if (context.additionalContext) {
      prompt += `## Additional Context:\n${JSON.stringify(context.additionalContext, null, 2)}\n\n`;
    }

    if (steps.length > 0) {
      prompt += `## Previous Steps:\n`;
      for (const step of steps) {
        prompt += `\n### Step ${step.stepNumber}:\n`;
        prompt += `Thought: ${step.thought}\n`;
        if (step.action) {
          prompt += `Action: ${step.action.tool}(${JSON.stringify(step.action.parameters)})\n`;
        }
        prompt += `Observation: ${step.observation}\n`;
      }
      prompt += `\n## Now continue with your next thought and action:`;
    } else {
      prompt += `\n## Begin your analysis. What is your first thought and action?`;
    }

    return prompt;
  }

  async run(context: ReActContext): Promise<ReActResult> {
    const startTime = Date.now();
    const steps: ReActStep[] = [];
    const toolsUsed = new Set<string>();
    let totalTokens = 0;

    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(context, steps);

      try {
        const response = await this.llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt),
        ]);

        const content = typeof response.content === 'string' 
          ? response.content 
          : JSON.stringify(response.content);

        // Track token usage (approximate)
        totalTokens += (systemPrompt.length + userPrompt.length + content.length) / 4;

        // Parse the response
        let parsed: { thought: string; action: { tool: string; parameters: any } | null };
        try {
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch {
          // If parsing fails, treat the whole response as a thought
          parsed = {
            thought: content,
            action: null,
          };
        }

        const step: ReActStep = {
          stepNumber: iteration + 1,
          thought: parsed.thought || 'No thought provided',
          action: parsed.action,
          observation: '',
          timestamp: new Date(),
        };

        // Execute the action if provided
        if (parsed.action && parsed.action.tool) {
          const tool = this.tools.get(parsed.action.tool);
          if (tool) {
            toolsUsed.add(parsed.action.tool);
            try {
              const result = await tool.execute(parsed.action.parameters || {}, context);
              step.observation = JSON.stringify(result.data, null, 2);

              // Check if this is the final answer
              if (parsed.action.tool === 'final_answer' && result.data.isFinal) {
                steps.push(step);
                return {
                  success: true,
                  goal: context.goal,
                  finalAnswer: result.data.answer,
                  steps,
                  totalIterations: iteration + 1,
                  totalTokensUsed: Math.round(totalTokens),
                  processingTimeMs: Date.now() - startTime,
                  toolsUsed: Array.from(toolsUsed),
                };
              }
            } catch (error: any) {
              step.observation = `Error executing tool: ${error.message}`;
            }
          } else {
            step.observation = `Unknown tool: ${parsed.action.tool}. Available tools: ${Array.from(this.tools.keys()).join(', ')}`;
          }
        } else {
          step.observation = 'No action taken. Please specify a tool to use.';
        }

        steps.push(step);

      } catch (error: any) {
        steps.push({
          stepNumber: iteration + 1,
          thought: 'Error occurred during reasoning',
          action: null,
          observation: `Error: ${error.message}`,
          timestamp: new Date(),
        });
      }
    }

    // Max iterations reached
    return {
      success: false,
      goal: context.goal,
      finalAnswer: `Maximum iterations (${this.config.maxIterations}) reached without a confident answer. Here's what I found:\n\n${steps.map(s => `- ${s.thought}`).join('\n')}`,
      steps,
      totalIterations: this.config.maxIterations,
      totalTokensUsed: Math.round(totalTokens),
      processingTimeMs: Date.now() - startTime,
      toolsUsed: Array.from(toolsUsed),
    };
  }

  /**
   * Run with self-reflection step before returning
   */
  async runWithReflection(context: ReActContext): Promise<ReActResult> {
    const initialResult = await this.run(context);

    if (!this.config.enableSelfReflection || !initialResult.success) {
      return initialResult;
    }

    // Self-reflection step
    const reflectionPrompt = `You just completed an analysis with this answer:

"${initialResult.finalAnswer}"

Based on these steps:
${initialResult.steps.map(s => `- Thought: ${s.thought}\n  Observation: ${s.observation.slice(0, 200)}`).join('\n')}

Self-reflect on your answer:
1. Is the answer complete and addresses the goal: "${context.goal}"?
2. Did you miss any important information?
3. Are there any potential errors or hallucinations?
4. What is your confidence level (0-1)?

Respond in JSON:
{
  "isComplete": true/false,
  "missedInfo": ["..."],
  "potentialIssues": ["..."],
  "confidence": 0.95,
  "improvedAnswer": "..." // Only if you need to revise
}`;

    try {
      const reflectionResponse = await this.llm.invoke([
        new SystemMessage('You are a quality assurance agent reviewing AI analysis results.'),
        new HumanMessage(reflectionPrompt),
      ]);

      const content = typeof reflectionResponse.content === 'string'
        ? reflectionResponse.content
        : JSON.stringify(reflectionResponse.content);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const reflection = JSON.parse(jsonMatch[0]);
        
        if (reflection.improvedAnswer && reflection.confidence > initialResult.steps.slice(-1)[0]?.action?.parameters?.confidence) {
          return {
            ...initialResult,
            finalAnswer: reflection.improvedAnswer,
            steps: [
              ...initialResult.steps,
              {
                stepNumber: initialResult.steps.length + 1,
                thought: 'Self-reflection improved the answer',
                action: { tool: 'self_reflection', parameters: reflection },
                observation: `Confidence improved to ${reflection.confidence}`,
                timestamp: new Date(),
              },
            ],
          };
        }
      }
    } catch {
      // Reflection failed, return original result
    }

    return initialResult;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createReActAgent(
  config?: Partial<ReActConfig>,
  additionalTools?: ReActTool[]
): ReActAgent {
  return new ReActAgent(config, additionalTools);
}

// =============================================================================
// SPECIALIZED AGENT PRESETS
// =============================================================================

export const ReActPresets = {
  contractAnalysis: (config?: Partial<ReActConfig>) => 
    new ReActAgent({ maxIterations: 8, ...config }),
  
  riskAssessment: (config?: Partial<ReActConfig>) => 
    new ReActAgent({ maxIterations: 10, enableSelfReflection: true, ...config }),
  
  quickExtraction: (config?: Partial<ReActConfig>) => 
    new ReActAgent({ maxIterations: 5, temperature: 0.1, ...config }),
  
  deepAnalysis: (config?: Partial<ReActConfig>) => 
    new ReActAgent({ maxIterations: 15, enableSelfReflection: true, confidenceThreshold: 0.9, ...config }),
};

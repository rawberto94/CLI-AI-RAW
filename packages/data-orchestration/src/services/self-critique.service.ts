/**
 * Self-Critique Layer Service
 * 
 * Implements automatic quality validation and self-reflection before
 * returning AI outputs. Catches hallucinations, validates consistency,
 * and ensures completeness.
 * 
 * @version 1.0.0
 */

import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

export interface CritiqueResult {
  passed: boolean;
  score: number; // 0-1
  issues: CritiqueIssue[];
  suggestions: string[];
  revisedOutput?: any;
  metadata: {
    critiqueTimeMs: number;
    tokensUsed: number;
    checksPerformed: string[];
  };
}

export interface CritiqueIssue {
  type: 'hallucination' | 'inconsistency' | 'incompleteness' | 'formatting' | 'factual_error' | 'missing_citation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
  suggestedFix?: string;
}

export interface CritiqueConfig {
  minScore: number; // Minimum score to pass (0-1)
  enableAutoRevision: boolean;
  maxRevisionAttempts: number;
  checks: CritiqueCheck[];
  model: string;
  temperature: number;
}

export type CritiqueCheck = 
  | 'hallucination'
  | 'consistency'
  | 'completeness'
  | 'formatting'
  | 'factual'
  | 'citation'
  | 'tone'
  | 'relevance';

export interface ArtifactContext {
  contractId: string;
  contractText: string;
  artifactType: string;
  originalPrompt?: string;
  expectedFields?: string[];
  tenantId?: string;
}

// =============================================================================
// CRITIQUE PROMPTS
// =============================================================================

const CRITIQUE_PROMPTS: Record<CritiqueCheck, string> = {
  hallucination: `Check for HALLUCINATIONS in the AI output:
- Are there any claims not supported by the source contract?
- Are there made-up names, dates, or numbers?
- Are there any statements that seem fabricated?

For each hallucination found, specify:
1. The exact text that is hallucinated
2. Why it's likely a hallucination (not in source)
3. Severity: high if factual claim, medium if interpretive`,

  consistency: `Check for INCONSISTENCIES in the AI output:
- Are there contradictory statements?
- Do dates/numbers match across sections?
- Are party names consistently spelled?
- Do cross-references make sense?

For each inconsistency found, specify:
1. The contradictory statements
2. Which one is likely correct
3. Severity based on impact`,

  completeness: `Check for COMPLETENESS of the AI output:
- Are all expected sections present?
- Are there placeholder values like "N/A" or "TBD" that should be filled?
- Is any critical information missing?
- Are answers truncated or incomplete?

For each incompleteness issue found, specify:
1. What is missing
2. Where it should appear
3. Severity based on importance`,

  formatting: `Check for FORMATTING issues in the AI output:
- Is the structure correct (JSON/markdown/etc.)?
- Are there broken links or references?
- Is the output properly escaped?
- Are lists and tables formatted correctly?

For each formatting issue, specify:
1. The formatting problem
2. How to fix it
3. Severity: low for cosmetic, medium for readability, high for parsing errors`,

  factual: `Check for FACTUAL ERRORS in the AI output:
- Are extracted dates in valid formats?
- Are monetary values correctly parsed?
- Are calculations correct?
- Are legal terms used correctly?

For each factual error, specify:
1. The error
2. The correct value (if determinable from source)
3. Severity based on importance`,

  citation: `Check for CITATION quality in the AI output:
- Are claims properly cited with source location?
- Can citations be verified in the source document?
- Are quote excerpts accurate?

For each citation issue, specify:
1. The claim needing citation
2. Suggested source location if found
3. Severity: medium for missing, high for incorrect citations`,

  tone: `Check for TONE appropriateness in the AI output:
- Is the language professional?
- Is it appropriately neutral for legal analysis?
- Are there any inappropriate characterizations?

For each tone issue, specify:
1. The problematic text
2. Suggested revision
3. Severity: low for minor, medium for unprofessional`,

  relevance: `Check for RELEVANCE of the AI output:
- Does the output address the original request?
- Is there irrelevant information included?
- Is the analysis focused on the right aspects?

For each relevance issue, specify:
1. The irrelevant content
2. Why it doesn't belong
3. Severity based on distraction level`,
};

// =============================================================================
// SELF-CRITIQUE SERVICE
// =============================================================================

export class SelfCritiqueService {
  private static instance: SelfCritiqueService;
  private llm: ChatOpenAI;
  private defaultConfig: CritiqueConfig;

  private constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey || '',
      azureOpenAIApiKey: undefined,
      modelName: process.env.CRITIQUE_MODEL || 'gpt-4o-mini',
      temperature: 0.1, // Low temperature for consistent critique
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL || undefined,
      },
    });

    this.defaultConfig = {
      minScore: 0.8,
      enableAutoRevision: true,
      maxRevisionAttempts: 2,
      checks: ['hallucination', 'consistency', 'completeness', 'formatting'],
      model: 'gpt-4o-mini',
      temperature: 0.1,
    };
  }

  public static getInstance(): SelfCritiqueService {
    if (!SelfCritiqueService.instance) {
      SelfCritiqueService.instance = new SelfCritiqueService();
    }
    return SelfCritiqueService.instance;
  }

  /**
   * Critique an AI-generated artifact before returning to user
   */
  async critique(
    output: any,
    context: ArtifactContext,
    config?: Partial<CritiqueConfig>
  ): Promise<CritiqueResult> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };
    const issues: CritiqueIssue[] = [];
    let tokensUsed = 0;

    // Run each critique check
    for (const check of mergedConfig.checks) {
      const checkResult = await this.runCheck(check, output, context);
      issues.push(...checkResult.issues);
      tokensUsed += checkResult.tokensUsed;
    }

    // Calculate score
    const score = this.calculateScore(issues);
    const passed = score >= mergedConfig.minScore;

    // Generate suggestions
    const suggestions = this.generateSuggestions(issues);

    // Auto-revision if enabled and not passed
    let revisedOutput: any = undefined;
    if (!passed && mergedConfig.enableAutoRevision) {
      const revisionResult = await this.attemptRevision(
        output,
        context,
        issues,
        mergedConfig.maxRevisionAttempts
      );
      if (revisionResult.success) {
        revisedOutput = revisionResult.output;
        tokensUsed += revisionResult.tokensUsed;
      }
    }

    return {
      passed,
      score,
      issues,
      suggestions,
      revisedOutput,
      metadata: {
        critiqueTimeMs: Date.now() - startTime,
        tokensUsed,
        checksPerformed: mergedConfig.checks,
      },
    };
  }

  private async runCheck(
    check: CritiqueCheck,
    output: any,
    context: ArtifactContext
  ): Promise<{ issues: CritiqueIssue[]; tokensUsed: number }> {
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    const sourcePreview = context.contractText.slice(0, 4000);

    const systemPrompt = `You are a quality assurance AI that critiques other AI outputs.
Your job is to find issues with the following AI-generated analysis.

${CRITIQUE_PROMPTS[check]}

Respond in JSON format:
{
  "issues": [
    {
      "type": "${check}",
      "severity": "low|medium|high|critical",
      "description": "...",
      "location": "optional location in output",
      "suggestedFix": "optional fix"
    }
  ],
  "overallAssessment": "brief summary"
}

If no issues found, return: { "issues": [], "overallAssessment": "No issues found" }`;

    const userPrompt = `## Source Contract (preview):
${sourcePreview}

## AI Output to Critique:
${outputStr}

## Artifact Type: ${context.artifactType}

Now perform the ${check} check:`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const tokensUsed = Math.round((systemPrompt.length + userPrompt.length + content.length) / 4);

      // Parse response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const issues: CritiqueIssue[] = (parsed.issues || []).map((issue: any) => ({
          type: issue.type || check,
          severity: issue.severity || 'medium',
          description: issue.description || 'Unknown issue',
          location: issue.location,
          suggestedFix: issue.suggestedFix,
        }));
        return { issues, tokensUsed };
      }
    } catch (error) {
      console.error(`Critique check ${check} failed:`, error);
    }

    return { issues: [], tokensUsed: 0 };
  }

  private calculateScore(issues: CritiqueIssue[]): number {
    if (issues.length === 0) return 1.0;

    const severityWeights: Record<string, number> = {
      critical: 0.4,
      high: 0.2,
      medium: 0.1,
      low: 0.05,
    };

    let totalPenalty = 0;
    for (const issue of issues) {
      totalPenalty += severityWeights[issue.severity] || 0.1;
    }

    return Math.max(0, 1 - totalPenalty);
  }

  private generateSuggestions(issues: CritiqueIssue[]): string[] {
    const suggestions: string[] = [];

    // Group issues by type
    const byType = issues.reduce((acc, issue) => {
      acc[issue.type] = acc[issue.type] || [];
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, CritiqueIssue[]>);

    // Generate aggregate suggestions
    if (byType.hallucination?.length) {
      suggestions.push(`Found ${byType.hallucination.length} potential hallucination(s). Verify all claims against source document.`);
    }
    if (byType.inconsistency?.length) {
      suggestions.push(`Found ${byType.inconsistency.length} inconsistency(ies). Review for contradictory information.`);
    }
    if (byType.incompleteness?.length) {
      suggestions.push(`Found ${byType.incompleteness.length} incomplete section(s). Consider re-running extraction.`);
    }
    if (byType.factual_error?.length) {
      suggestions.push(`Found ${byType.factual_error.length} factual error(s). Manual verification recommended.`);
    }

    // Add specific fixes
    for (const issue of issues) {
      if (issue.suggestedFix && issue.severity !== 'low') {
        suggestions.push(issue.suggestedFix);
      }
    }

    return [...new Set(suggestions)].slice(0, 10); // Dedupe and limit
  }

  private async attemptRevision(
    output: any,
    context: ArtifactContext,
    issues: CritiqueIssue[],
    maxAttempts: number
  ): Promise<{ success: boolean; output?: any; tokensUsed: number }> {
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    let tokensUsed = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const issuesSummary = issues
        .filter(i => i.severity !== 'low')
        .map(i => `- [${i.severity}] ${i.type}: ${i.description}`)
        .join('\n');

      const systemPrompt = `You are tasked with revising an AI-generated output to fix identified issues.
Preserve the overall structure and good content while fixing the problems.`;

      const userPrompt = `## Original Output:
${outputStr}

## Issues to Fix:
${issuesSummary}

## Source Contract (for reference):
${context.contractText.slice(0, 3000)}

Provide the REVISED output only, in the same format as the original. Fix all the issues while preserving correct information:`;

      try {
        const response = await this.llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt),
        ]);

        const content = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

        tokensUsed += Math.round((systemPrompt.length + userPrompt.length + content.length) / 4);

        // Try to parse as JSON if original was JSON
        if (typeof output === 'object') {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return { success: true, output: JSON.parse(jsonMatch[0]), tokensUsed };
          }
        }

        return { success: true, output: content, tokensUsed };
      } catch (error) {
        console.error(`Revision attempt ${attempt + 1} failed:`, error);
      }
    }

    return { success: false, tokensUsed };
  }

  /**
   * Quick validation for simple outputs
   */
  async quickValidate(
    output: any,
    context: ArtifactContext
  ): Promise<{ valid: boolean; confidence: number; reason?: string }> {
    const result = await this.critique(output, context, {
      checks: ['hallucination', 'completeness'],
      enableAutoRevision: false,
    });

    return {
      valid: result.passed,
      confidence: result.score,
      reason: result.issues.length > 0 
        ? result.issues[0].description 
        : undefined,
    };
  }

  /**
   * Full validation with all checks
   */
  async fullValidate(
    output: any,
    context: ArtifactContext
  ): Promise<CritiqueResult> {
    return this.critique(output, context, {
      checks: ['hallucination', 'consistency', 'completeness', 'formatting', 'factual', 'citation'],
      enableAutoRevision: true,
      maxRevisionAttempts: 3,
      minScore: 0.85,
    });
  }
}

// =============================================================================
// ARTIFACT CRITIQUE MIDDLEWARE
// =============================================================================

/**
 * Middleware function to wrap artifact generation with self-critique
 */
export async function withSelfCritique<T>(
  generateFn: () => Promise<T>,
  context: ArtifactContext,
  config?: Partial<CritiqueConfig>
): Promise<{ output: T; critique: CritiqueResult }> {
  const critiqueService = SelfCritiqueService.getInstance();
  
  // Generate the artifact
  const output = await generateFn();
  
  // Critique it
  const critique = await critiqueService.critique(output, context, config);
  
  // Return revised output if available and passed
  if (critique.revisedOutput && critique.passed) {
    return { output: critique.revisedOutput as T, critique };
  }
  
  return { output, critique };
}

// =============================================================================
// VALIDATION SCHEMAS FOR COMMON ARTIFACTS
// =============================================================================

export const ArtifactValidationSchemas = {
  overview: z.object({
    summary: z.string().min(50).max(2000),
    parties: z.array(z.string()).min(1),
    effectiveDate: z.string().optional(),
    expirationDate: z.string().optional(),
    contractValue: z.string().optional(),
    contractType: z.string(),
  }),

  clauses: z.object({
    clauses: z.array(z.object({
      name: z.string(),
      present: z.boolean(),
      excerpt: z.string().optional(),
      riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    })),
  }),

  financial: z.object({
    totalValue: z.string().optional(),
    currency: z.string().optional(),
    paymentTerms: z.string().optional(),
    paymentSchedule: z.array(z.object({
      milestone: z.string(),
      amount: z.string(),
      dueDate: z.string().optional(),
    })).optional(),
  }),

  risk: z.object({
    overallRiskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    risks: z.array(z.object({
      category: z.string(),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      mitigation: z.string().optional(),
    })),
    recommendations: z.array(z.string()),
  }),
};

// =============================================================================
// FACTORY FUNCTION & SINGLETON
// =============================================================================

export function getSelfCritiqueService(): SelfCritiqueService {
  return SelfCritiqueService.getInstance();
}

// Lazy singleton - only created when first accessed
let _selfCritiqueService: SelfCritiqueService | null = null;
export const selfCritiqueService = {
  get instance(): SelfCritiqueService {
    if (!_selfCritiqueService) {
      _selfCritiqueService = getSelfCritiqueService();
    }
    return _selfCritiqueService;
  }
};

/**
 * Auto-Prompt Optimization Service
 * 
 * Automatically improves prompts based on:
 * - User correction patterns
 * - Success/failure rates
 * - A/B test results
 * - Field-specific performance
 * 
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger';
import { cacheAdaptor } from '../dal/cache.adaptor';
import OpenAI from 'openai';

const logger = createLogger('auto-prompt-optimizer');

// =============================================================================
// TYPES
// =============================================================================

export interface PromptVersion {
  id: string;
  artifactType: string;
  tenantId: string;
  version: number;
  prompt: string;
  systemPrompt?: string;
  
  // Performance metrics
  metrics: PromptMetrics;
  
  // Status
  status: 'draft' | 'testing' | 'active' | 'retired';
  
  // Lineage
  parentVersionId?: string;
  optimizationReason?: string;
  
  createdAt: Date;
  activatedAt?: Date;
  retiredAt?: Date;
}

export interface PromptMetrics {
  totalExtractions: number;
  correctExtractions: number;
  correctedExtractions: number;
  averageConfidence: number;
  averageQuality: number;
  averageLatencyMs: number;
  averageCost: number;
  fieldAccuracy: Record<string, number>;
  commonErrors: Array<{
    fieldName: string;
    errorType: string;
    frequency: number;
  }>;
  lastUpdated: Date;
}

export interface OptimizationSuggestion {
  type: 'add_instruction' | 'add_example' | 'clarify_format' | 'add_constraint' | 'restructure';
  fieldName?: string;
  suggestion: string;
  reasoning: string;
  expectedImprovement: number; // 0-1
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface OptimizationResult {
  originalPrompt: string;
  optimizedPrompt: string;
  changes: Array<{
    type: string;
    description: string;
    location: string;
  }>;
  expectedImprovements: {
    overallAccuracy: number;
    fieldImprovements: Record<string, number>;
  };
  confidence: number;
}

// =============================================================================
// PROMPT OPTIMIZATION SERVICE
// =============================================================================

export class AutoPromptOptimizerService {
  private static instance: AutoPromptOptimizerService;
  private openai: OpenAI | null = null;
  private promptVersions: Map<string, PromptVersion[]> = new Map();

  private constructor() {
    this.initializeClient();
  }

  static getInstance(): AutoPromptOptimizerService {
    if (!AutoPromptOptimizerService.instance) {
      AutoPromptOptimizerService.instance = new AutoPromptOptimizerService();
    }
    return AutoPromptOptimizerService.instance;
  }

  private initializeClient(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  // ===========================================================================
  // PROMPT VERSION MANAGEMENT
  // ===========================================================================

  async createPromptVersion(
    artifactType: string,
    prompt: string,
    tenantId: string = 'default',
    options?: {
      systemPrompt?: string;
      parentVersionId?: string;
      optimizationReason?: string;
    }
  ): Promise<PromptVersion> {
    const key = `${tenantId}:${artifactType}`;
    const existing = this.promptVersions.get(key) || [];
    const nextVersion = existing.length > 0 
      ? Math.max(...existing.map(p => p.version)) + 1 
      : 1;

    const newVersion: PromptVersion = {
      id: `pv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      artifactType,
      tenantId,
      version: nextVersion,
      prompt,
      systemPrompt: options?.systemPrompt,
      metrics: {
        totalExtractions: 0,
        correctExtractions: 0,
        correctedExtractions: 0,
        averageConfidence: 0,
        averageQuality: 0,
        averageLatencyMs: 0,
        averageCost: 0,
        fieldAccuracy: {},
        commonErrors: [],
        lastUpdated: new Date(),
      },
      status: 'draft',
      parentVersionId: options?.parentVersionId,
      optimizationReason: options?.optimizationReason,
      createdAt: new Date(),
    };

    existing.push(newVersion);
    this.promptVersions.set(key, existing);

    await this.persistPromptVersions(key);
    logger.info({ id: newVersion.id, version: nextVersion }, 'Created prompt version');

    return newVersion;
  }

  async activatePromptVersion(versionId: string): Promise<boolean> {
    for (const [key, versions] of this.promptVersions) {
      const version = versions.find(v => v.id === versionId);
      if (version) {
        // Retire current active version
        const currentActive = versions.find(v => v.status === 'active');
        if (currentActive) {
          currentActive.status = 'retired';
          currentActive.retiredAt = new Date();
        }

        // Activate new version
        version.status = 'active';
        version.activatedAt = new Date();

        await this.persistPromptVersions(key);
        logger.info({ versionId }, 'Activated prompt version');
        return true;
      }
    }
    return false;
  }

  getActivePrompt(artifactType: string, tenantId: string = 'default'): PromptVersion | null {
    const key = `${tenantId}:${artifactType}`;
    const versions = this.promptVersions.get(key) || [];
    return versions.find(v => v.status === 'active') || null;
  }

  // ===========================================================================
  // METRICS TRACKING
  // ===========================================================================

  async recordExtractionResult(
    artifactType: string,
    tenantId: string,
    result: {
      wasCorrect: boolean;
      wasCorrected: boolean;
      confidence: number;
      quality: number;
      latencyMs: number;
      cost: number;
      fieldResults?: Record<string, boolean>;
    }
  ): Promise<void> {
    const activeVersion = this.getActivePrompt(artifactType, tenantId);
    if (!activeVersion) return;

    const metrics = activeVersion.metrics;
    const n = metrics.totalExtractions;

    // Update running averages
    metrics.totalExtractions++;
    if (result.wasCorrect) metrics.correctExtractions++;
    if (result.wasCorrected) metrics.correctedExtractions++;

    // Incremental average calculation
    metrics.averageConfidence = (metrics.averageConfidence * n + result.confidence) / (n + 1);
    metrics.averageQuality = (metrics.averageQuality * n + result.quality) / (n + 1);
    metrics.averageLatencyMs = (metrics.averageLatencyMs * n + result.latencyMs) / (n + 1);
    metrics.averageCost = (metrics.averageCost * n + result.cost) / (n + 1);

    // Update field accuracy
    if (result.fieldResults) {
      for (const [field, correct] of Object.entries(result.fieldResults)) {
        const current = metrics.fieldAccuracy[field] || 0.5;
        const fieldN = n; // Simplified; in production track per-field counts
        metrics.fieldAccuracy[field] = (current * fieldN + (correct ? 1 : 0)) / (fieldN + 1);
      }
    }

    metrics.lastUpdated = new Date();
    await this.persistPromptVersions(`${tenantId}:${artifactType}`);
  }

  // ===========================================================================
  // AUTO OPTIMIZATION
  // ===========================================================================

  async analyzeAndSuggestOptimizations(
    artifactType: string,
    tenantId: string = 'default'
  ): Promise<OptimizationSuggestion[]> {
    const activeVersion = this.getActivePrompt(artifactType, tenantId);
    if (!activeVersion) {
      return [];
    }

    const suggestions: OptimizationSuggestion[] = [];
    const metrics = activeVersion.metrics;

    // Analyze overall accuracy
    const overallAccuracy = metrics.totalExtractions > 0
      ? metrics.correctExtractions / metrics.totalExtractions
      : 0;

    if (overallAccuracy < 0.8 && metrics.totalExtractions >= 10) {
      suggestions.push({
        type: 'restructure',
        suggestion: 'Consider restructuring the prompt with clearer sections and more specific instructions',
        reasoning: `Overall accuracy is ${(overallAccuracy * 100).toFixed(1)}%, below 80% threshold`,
        expectedImprovement: 0.15,
        priority: 'high',
      });
    }

    // Analyze field-specific issues
    for (const [field, accuracy] of Object.entries(metrics.fieldAccuracy)) {
      if (accuracy < 0.7) {
        suggestions.push({
          type: 'add_instruction',
          fieldName: field,
          suggestion: `Add specific extraction instructions for "${field}" with examples of correct values`,
          reasoning: `Field "${field}" has ${(accuracy * 100).toFixed(1)}% accuracy`,
          expectedImprovement: 0.2,
          priority: accuracy < 0.5 ? 'critical' : 'high',
        });
      }
    }

    // Analyze common errors
    for (const error of metrics.commonErrors.slice(0, 5)) {
      if (error.frequency >= 3) {
        suggestions.push({
          type: 'add_constraint',
          fieldName: error.fieldName,
          suggestion: `Add constraint to prevent "${error.errorType}" errors in "${error.fieldName}"`,
          reasoning: `Error occurred ${error.frequency} times`,
          expectedImprovement: 0.1,
          priority: error.frequency >= 5 ? 'high' : 'medium',
        });
      }
    }

    // Use AI to generate more sophisticated suggestions
    if (this.openai && metrics.totalExtractions >= 20) {
      const aiSuggestions = await this.getAISuggestions(activeVersion);
      suggestions.push(...aiSuggestions);
    }

    // Sort by priority and expected improvement
    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.expectedImprovement - a.expectedImprovement;
    });
  }

  async optimizePrompt(
    artifactType: string,
    tenantId: string = 'default',
    suggestions?: OptimizationSuggestion[]
  ): Promise<OptimizationResult | null> {
    const activeVersion = this.getActivePrompt(artifactType, tenantId);
    if (!activeVersion) {
      return null;
    }

    // Get suggestions if not provided
    const applySuggestions = suggestions || await this.analyzeAndSuggestOptimizations(artifactType, tenantId);
    
    if (applySuggestions.length === 0) {
      return null;
    }

    // Filter to high-priority suggestions
    const highPriority = applySuggestions.filter(s => 
      s.priority === 'critical' || s.priority === 'high'
    ).slice(0, 5);

    if (highPriority.length === 0) {
      return null;
    }

    // Use AI to apply optimizations
    const optimized = await this.applyOptimizations(activeVersion.prompt, highPriority);
    
    if (!optimized) {
      return null;
    }

    // Create new version with optimized prompt
    await this.createPromptVersion(
      artifactType,
      optimized.optimizedPrompt,
      tenantId,
      {
        systemPrompt: activeVersion.systemPrompt,
        parentVersionId: activeVersion.id,
        optimizationReason: `Auto-optimized based on ${highPriority.length} suggestions`,
      }
    );

    return optimized;
  }

  private async getAISuggestions(version: PromptVersion): Promise<OptimizationSuggestion[]> {
    if (!this.openai) return [];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a prompt engineering expert. Analyze the given prompt and its performance metrics, then suggest specific improvements. Return valid JSON only.`,
          },
          {
            role: 'user',
            content: `Analyze this extraction prompt and suggest improvements:

PROMPT:
${version.prompt.substring(0, 2000)}

METRICS:
- Total extractions: ${version.metrics.totalExtractions}
- Accuracy: ${((version.metrics.correctExtractions / Math.max(1, version.metrics.totalExtractions)) * 100).toFixed(1)}%
- Correction rate: ${((version.metrics.correctedExtractions / Math.max(1, version.metrics.totalExtractions)) * 100).toFixed(1)}%
- Field accuracy: ${JSON.stringify(version.metrics.fieldAccuracy)}
- Common errors: ${JSON.stringify(version.metrics.commonErrors.slice(0, 3))}

Return JSON array of suggestions:
[{"type": "add_instruction|add_example|clarify_format|add_constraint", "fieldName": "optional", "suggestion": "specific suggestion", "reasoning": "why", "expectedImprovement": 0.1, "priority": "low|medium|high|critical"}]`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const parsed = JSON.parse(content);
      return (parsed.suggestions || parsed || []).slice(0, 3);
    } catch (error) {
      logger.warn({ error }, 'Failed to get AI suggestions');
      return [];
    }
  }

  private async applyOptimizations(
    originalPrompt: string,
    suggestions: OptimizationSuggestion[]
  ): Promise<OptimizationResult | null> {
    if (!this.openai) {
      // Manual optimization without AI
      return this.applyManualOptimizations(originalPrompt, suggestions);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a prompt engineering expert. Apply the suggested improvements to the given prompt while maintaining its core functionality. Return the improved prompt in valid JSON format.`,
          },
          {
            role: 'user',
            content: `Apply these improvements to the prompt:

ORIGINAL PROMPT:
${originalPrompt}

IMPROVEMENTS TO APPLY:
${suggestions.map((s, i) => `${i + 1}. [${s.type}] ${s.suggestion} (Reason: ${s.reasoning})`).join('\n')}

Return JSON:
{
  "optimizedPrompt": "the improved prompt text",
  "changes": [{"type": "...", "description": "...", "location": "..."}],
  "expectedImprovements": {"overallAccuracy": 0.1, "fieldImprovements": {"field": 0.2}}
}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      return {
        originalPrompt,
        optimizedPrompt: parsed.optimizedPrompt,
        changes: parsed.changes || [],
        expectedImprovements: parsed.expectedImprovements || { overallAccuracy: 0, fieldImprovements: {} },
        confidence: 0.8,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to apply AI optimizations');
      return this.applyManualOptimizations(originalPrompt, suggestions);
    }
  }

  private applyManualOptimizations(
    originalPrompt: string,
    suggestions: OptimizationSuggestion[]
  ): OptimizationResult {
    let optimizedPrompt = originalPrompt;
    const changes: Array<{ type: string; description: string; location: string }> = [];

    for (const suggestion of suggestions) {
      if (suggestion.type === 'add_instruction' && suggestion.fieldName) {
        const instruction = `\n\nIMPORTANT for "${suggestion.fieldName}": ${suggestion.suggestion}`;
        optimizedPrompt += instruction;
        changes.push({
          type: 'add_instruction',
          description: `Added instruction for ${suggestion.fieldName}`,
          location: 'end of prompt',
        });
      }

      if (suggestion.type === 'add_constraint') {
        const constraint = `\n\nCONSTRAINT: ${suggestion.suggestion}`;
        optimizedPrompt += constraint;
        changes.push({
          type: 'add_constraint',
          description: suggestion.suggestion,
          location: 'end of prompt',
        });
      }
    }

    return {
      originalPrompt,
      optimizedPrompt,
      changes,
      expectedImprovements: {
        overallAccuracy: suggestions.reduce((sum, s) => sum + s.expectedImprovement, 0) / suggestions.length,
        fieldImprovements: {},
      },
      confidence: 0.5, // Lower confidence for manual optimization
    };
  }

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================

  private async persistPromptVersions(key: string): Promise<void> {
    const versions = this.promptVersions.get(key);
    if (versions) {
      await cacheAdaptor.set(`prompt-versions:${key}`, versions, 86400 * 365);
    }
  }

  async loadPromptVersions(): Promise<void> {
    // In production, load from database
    logger.info('Prompt optimizer initialized');
  }

  // ===========================================================================
  // ANALYTICS
  // ===========================================================================

  getPromptHistory(
    artifactType: string,
    tenantId: string = 'default'
  ): PromptVersion[] {
    const key = `${tenantId}:${artifactType}`;
    return this.promptVersions.get(key) || [];
  }

  async compareVersions(
    versionId1: string,
    versionId2: string
  ): Promise<{
    metrics1: PromptMetrics;
    metrics2: PromptMetrics;
    comparison: Record<string, { v1: number; v2: number; diff: number }>;
    recommendation: string;
  } | null> {
    let version1: PromptVersion | undefined;
    let version2: PromptVersion | undefined;

    for (const versions of this.promptVersions.values()) {
      if (!version1) version1 = versions.find(v => v.id === versionId1);
      if (!version2) version2 = versions.find(v => v.id === versionId2);
      if (version1 && version2) break;
    }

    if (!version1 || !version2) return null;

    const m1 = version1.metrics;
    const m2 = version2.metrics;

    const accuracy1 = m1.totalExtractions > 0 ? m1.correctExtractions / m1.totalExtractions : 0;
    const accuracy2 = m2.totalExtractions > 0 ? m2.correctExtractions / m2.totalExtractions : 0;

    const comparison = {
      accuracy: { v1: accuracy1, v2: accuracy2, diff: accuracy2 - accuracy1 },
      confidence: { v1: m1.averageConfidence, v2: m2.averageConfidence, diff: m2.averageConfidence - m1.averageConfidence },
      quality: { v1: m1.averageQuality, v2: m2.averageQuality, diff: m2.averageQuality - m1.averageQuality },
      latency: { v1: m1.averageLatencyMs, v2: m2.averageLatencyMs, diff: m2.averageLatencyMs - m1.averageLatencyMs },
      cost: { v1: m1.averageCost, v2: m2.averageCost, diff: m2.averageCost - m1.averageCost },
    };

    const betterVersion = comparison.accuracy.diff > 0 ? 'v2' : comparison.accuracy.diff < 0 ? 'v1' : 'equal';
    const recommendation = betterVersion === 'v2'
      ? `Version 2 shows ${(comparison.accuracy.diff * 100).toFixed(1)}% higher accuracy. Consider activating it.`
      : betterVersion === 'v1'
      ? `Version 1 performs better with ${(-comparison.accuracy.diff * 100).toFixed(1)}% higher accuracy.`
      : 'Both versions perform similarly. Consider other factors like cost and latency.';

    return {
      metrics1: m1,
      metrics2: m2,
      comparison,
      recommendation,
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const autoPromptOptimizerService = AutoPromptOptimizerService.getInstance();

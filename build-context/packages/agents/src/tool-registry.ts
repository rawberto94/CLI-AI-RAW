/**
 * Dynamic Tool Registry & Discovery Service
 * 
 * Implements a centralized registry for AI agent tools that allows
 * dynamic registration, discovery, and execution without code changes.
 * Supports versioning, permissions, and usage analytics.
 * 
 * Key Features:
 * - Dynamic tool registration at runtime
 * - Tool versioning and deprecation
 * - Permission-based access control
 * - Usage analytics and optimization
 * - Tool composition (combining tools)
 * - A/B testing of tool variants
 * 
 * @version 1.0.0
 */

import { z, ZodType } from 'zod';
import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

export interface ToolDefinition<TParams = any, TResult = any> {
  id: string;
  name: string;
  description: string;
  version: string;
  category: ToolCategory;
  tags: string[];
  parameters: ZodType<TParams>;
  returnType: ZodType<TResult>;
  execute: (params: TParams, context: ToolExecutionContext) => Promise<TResult>;
  examples?: ToolExample[];
  metadata?: ToolMetadata;
}

export type ToolCategory = 
  | 'extraction'
  | 'analysis'
  | 'validation'
  | 'transformation'
  | 'search'
  | 'generation'
  | 'integration'
  | 'utility'
  | 'custom';

export interface ToolExample {
  name: string;
  description: string;
  input: Record<string, any>;
  expectedOutput?: any;
}

export interface ToolMetadata {
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  deprecated?: boolean;
  deprecationMessage?: string;
  successorToolId?: string;
  avgExecutionTimeMs?: number;
  successRate?: number;
  permissions?: ToolPermissions;
  costEstimate?: number; // In AI credits/tokens
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

export interface ToolPermissions {
  roles: string[];
  tenantIds?: string[];
  features?: string[];
}

export interface ToolExecutionContext {
  tenantId: string;
  userId: string;
  sessionId?: string;
  contractId?: string;
  contractText?: string;
  additionalContext?: Record<string, any>;
  traceId?: string;
}

export interface ToolExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs: number;
  toolId: string;
  toolVersion: string;
  metadata?: Record<string, any>;
}

export interface ToolUsageStats {
  toolId: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgExecutionTimeMs: number;
  lastUsed: Date;
  usageByTenant: Map<string, number>;
  usageByDay: Map<string, number>;
}

export interface ComposedTool {
  id: string;
  name: string;
  description: string;
  toolIds: string[];
  composition: 'sequential' | 'parallel' | 'conditional';
  condition?: (results: Map<string, any>) => string; // Returns next tool ID
}

export interface ToolSearchQuery {
  query?: string;
  category?: ToolCategory;
  tags?: string[];
  includeDeprecated?: boolean;
  limit?: number;
}

export interface ToolSearchResult {
  tool: ToolDefinition;
  score: number;
  matchedOn: ('name' | 'description' | 'tags' | 'category')[];
}

// =============================================================================
// BUILT-IN TOOL SCHEMAS
// =============================================================================

const ContractAnalysisParamsSchema = z.object({
  contractText: z.string().min(10),
  analysisType: z.enum(['summary', 'risks', 'obligations', 'dates', 'parties', 'full']),
  depth: z.enum(['quick', 'standard', 'thorough']).optional().default('standard'),
});

const ClauseExtractionParamsSchema = z.object({
  contractText: z.string().min(10),
  clauseTypes: z.array(z.string()),
  includeConfidence: z.boolean().optional().default(true),
});

const DocumentComparisonParamsSchema = z.object({
  document1: z.string().min(10),
  document2: z.string().min(10),
  comparisonType: z.enum(['diff', 'semantic', 'structure', 'full']),
});

const TextTransformationParamsSchema = z.object({
  text: z.string().min(1),
  transformation: z.enum(['summarize', 'simplify', 'formalize', 'translate', 'expand']),
  targetLanguage: z.string().optional(),
});

const ValidationParamsSchema = z.object({
  data: z.any(),
  validationType: z.enum(['schema', 'business_rules', 'compliance', 'format']),
  rules: z.array(z.string()).optional(),
});

const SearchParamsSchema = z.object({
  query: z.string().min(1),
  searchType: z.enum(['semantic', 'keyword', 'hybrid']),
  filters: z.record(z.any()).optional(),
  limit: z.number().optional().default(10),
});

// =============================================================================
// BUILT-IN TOOLS
// =============================================================================

const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    id: 'contract-analyzer',
    name: 'Contract Analyzer',
    description: 'Analyze contracts to extract key information, risks, and obligations',
    version: '1.0.0',
    category: 'analysis',
    tags: ['contract', 'analysis', 'extraction', 'core'],
    parameters: ContractAnalysisParamsSchema,
    returnType: z.object({
      summary: z.string(),
      keyPoints: z.array(z.string()),
      risks: z.array(z.object({ description: z.string(), severity: z.string() })),
      dates: z.array(z.object({ type: z.string(), date: z.string() })),
    }),
    execute: async (params, context) => {
      // Placeholder implementation - would call actual AI service
      return {
        summary: `Analysis of contract for ${context.tenantId}`,
        keyPoints: ['Key point 1', 'Key point 2'],
        risks: [{ description: 'Sample risk', severity: 'medium' }],
        dates: [{ type: 'effective', date: new Date().toISOString() }],
      };
    },
    examples: [
      {
        name: 'Quick Risk Analysis',
        description: 'Perform a quick risk analysis on a contract',
        input: { analysisType: 'risks', depth: 'quick' },
      },
    ],
    metadata: {
      author: 'ConTigo Platform',
      createdAt: new Date(),
      updatedAt: new Date(),
      avgExecutionTimeMs: 2000,
      successRate: 0.95,
      costEstimate: 100,
    },
  },
  {
    id: 'clause-extractor',
    name: 'Clause Extractor',
    description: 'Extract specific clauses from contract documents',
    version: '1.0.0',
    category: 'extraction',
    tags: ['clause', 'extraction', 'contract', 'core'],
    parameters: ClauseExtractionParamsSchema,
    returnType: z.object({
      clauses: z.array(z.object({
        type: z.string(),
        text: z.string(),
        confidence: z.number(),
        location: z.object({ start: z.number(), end: z.number() }),
      })),
    }),
    execute: async (params, context) => {
      return {
        clauses: params.clauseTypes.map((type: string) => ({
          type,
          text: `Extracted ${type} clause content`,
          confidence: 0.85,
          location: { start: 0, end: 100 },
        })),
      };
    },
    metadata: {
      author: 'ConTigo Platform',
      createdAt: new Date(),
      updatedAt: new Date(),
      avgExecutionTimeMs: 1500,
      successRate: 0.92,
    },
  },
  {
    id: 'document-comparator',
    name: 'Document Comparator',
    description: 'Compare two documents to identify differences and similarities',
    version: '1.0.0',
    category: 'analysis',
    tags: ['comparison', 'diff', 'documents', 'core'],
    parameters: DocumentComparisonParamsSchema,
    returnType: z.object({
      similarities: z.array(z.string()),
      differences: z.array(z.object({
        section: z.string(),
        doc1: z.string(),
        doc2: z.string(),
        significance: z.string(),
      })),
      overallSimilarityScore: z.number(),
    }),
    execute: async (params, context) => {
      return {
        similarities: ['Both documents have termination clauses'],
        differences: [{
          section: 'Liability',
          doc1: 'Unlimited liability',
          doc2: 'Capped liability at $1M',
          significance: 'high',
        }],
        overallSimilarityScore: 0.75,
      };
    },
    metadata: {
      author: 'ConTigo Platform',
      createdAt: new Date(),
      updatedAt: new Date(),
      avgExecutionTimeMs: 3000,
      successRate: 0.88,
    },
  },
  {
    id: 'text-transformer',
    name: 'Text Transformer',
    description: 'Transform text through various operations like summarization, simplification, or translation',
    version: '1.0.0',
    category: 'transformation',
    tags: ['text', 'transformation', 'nlp', 'utility'],
    parameters: TextTransformationParamsSchema,
    returnType: z.object({
      originalLength: z.number(),
      transformedText: z.string(),
      transformedLength: z.number(),
    }),
    execute: async (params, context) => {
      return {
        originalLength: params.text.length,
        transformedText: `Transformed: ${params.text.substring(0, 100)}...`,
        transformedLength: 100,
      };
    },
    metadata: {
      author: 'ConTigo Platform',
      createdAt: new Date(),
      updatedAt: new Date(),
      avgExecutionTimeMs: 1000,
      successRate: 0.97,
    },
  },
  {
    id: 'data-validator',
    name: 'Data Validator',
    description: 'Validate data against schemas, business rules, or compliance requirements',
    version: '1.0.0',
    category: 'validation',
    tags: ['validation', 'compliance', 'quality', 'core'],
    parameters: ValidationParamsSchema,
    returnType: z.object({
      isValid: z.boolean(),
      errors: z.array(z.object({
        field: z.string(),
        message: z.string(),
        severity: z.string(),
      })),
      warnings: z.array(z.string()),
    }),
    execute: async (params, context) => {
      return {
        isValid: true,
        errors: [],
        warnings: ['Consider adding more details'],
      };
    },
    metadata: {
      author: 'ConTigo Platform',
      createdAt: new Date(),
      updatedAt: new Date(),
      avgExecutionTimeMs: 500,
      successRate: 0.99,
    },
  },
  {
    id: 'semantic-search',
    name: 'Semantic Search',
    description: 'Search through documents using semantic understanding',
    version: '1.0.0',
    category: 'search',
    tags: ['search', 'semantic', 'rag', 'core'],
    parameters: SearchParamsSchema,
    returnType: z.object({
      results: z.array(z.object({
        documentId: z.string(),
        snippet: z.string(),
        score: z.number(),
        metadata: z.record(z.any()).optional(),
      })),
      totalResults: z.number(),
    }),
    execute: async (params, context) => {
      return {
        results: [{
          documentId: 'doc-1',
          snippet: `Match for: ${params.query}`,
          score: 0.9,
        }],
        totalResults: 1,
      };
    },
    metadata: {
      author: 'ConTigo Platform',
      createdAt: new Date(),
      updatedAt: new Date(),
      avgExecutionTimeMs: 800,
      successRate: 0.94,
    },
  },
];

// =============================================================================
// TOOL REGISTRY SERVICE
// =============================================================================

export class ToolRegistryService extends EventEmitter {
  private tools: Map<string, ToolDefinition>;
  private composedTools: Map<string, ComposedTool>;
  private usageStats: Map<string, ToolUsageStats>;
  private rateLimitTrackers: Map<string, { count: number; resetAt: Date }>;

  constructor() {
    super();
    this.tools = new Map();
    this.composedTools = new Map();
    this.usageStats = new Map();
    this.rateLimitTrackers = new Map();

    // Register built-in tools
    BUILT_IN_TOOLS.forEach(tool => this.registerTool(tool));
  }

  // ---------------------------------------------------------------------------
  // TOOL REGISTRATION
  // ---------------------------------------------------------------------------

  /**
   * Register a new tool in the registry
   */
  registerTool<TParams, TResult>(tool: ToolDefinition<TParams, TResult>): void {
    // Validate tool definition
    if (!tool.id || !tool.name || !tool.execute) {
      throw new Error('Invalid tool definition: id, name, and execute are required');
    }

    // Check for version conflicts
    const existingTool = this.tools.get(tool.id);
    if (existingTool && existingTool.version === tool.version) {
      throw new Error(`Tool ${tool.id} version ${tool.version} already exists`);
    }

    // Store tool
    this.tools.set(tool.id, tool);

    // Initialize usage stats
    this.usageStats.set(tool.id, {
      toolId: tool.id,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      avgExecutionTimeMs: 0,
      lastUsed: new Date(),
      usageByTenant: new Map(),
      usageByDay: new Map(),
    });

    this.emit('tool:registered', { toolId: tool.id, version: tool.version });
  }

  /**
   * Unregister a tool from the registry
   */
  unregisterTool(toolId: string): boolean {
    const success = this.tools.delete(toolId);
    if (success) {
      this.emit('tool:unregistered', { toolId });
    }
    return success;
  }

  /**
   * Deprecate a tool (mark as deprecated but keep available)
   */
  deprecateTool(toolId: string, message: string, successorToolId?: string): void {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    if (!tool.metadata) {
      tool.metadata = { createdAt: new Date(), updatedAt: new Date() };
    }

    tool.metadata.deprecated = true;
    tool.metadata.deprecationMessage = message;
    tool.metadata.successorToolId = successorToolId;
    tool.metadata.updatedAt = new Date();

    this.emit('tool:deprecated', { toolId, message, successorToolId });
  }

  // ---------------------------------------------------------------------------
  // TOOL DISCOVERY
  // ---------------------------------------------------------------------------

  /**
   * Get a tool by ID
   */
  getTool(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all registered tools
   */
  getAllTools(includeDeprecated = false): ToolDefinition[] {
    const tools = Array.from(this.tools.values());
    if (includeDeprecated) {
      return tools;
    }
    return tools.filter(t => !t.metadata?.deprecated);
  }

  /**
   * Search for tools
   */
  searchTools(query: ToolSearchQuery): ToolSearchResult[] {
    let tools = this.getAllTools(query.includeDeprecated);

    // Filter by category
    if (query.category) {
      tools = tools.filter(t => t.category === query.category);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      tools = tools.filter(t => 
        query.tags!.some(tag => t.tags.includes(tag))
      );
    }

    // Score and rank by query match
    const results: ToolSearchResult[] = tools.map(tool => {
      let score = 0;
      const matchedOn: ('name' | 'description' | 'tags' | 'category')[] = [];

      if (query.query) {
        const queryLower = query.query.toLowerCase();

        if (tool.name.toLowerCase().includes(queryLower)) {
          score += 10;
          matchedOn.push('name');
        }
        if (tool.description.toLowerCase().includes(queryLower)) {
          score += 5;
          matchedOn.push('description');
        }
        if (tool.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
          score += 3;
          matchedOn.push('tags');
        }
        if (tool.category.toLowerCase().includes(queryLower)) {
          score += 2;
          matchedOn.push('category');
        }
      } else {
        score = 1; // Default score when no query
      }

      return { tool, score, matchedOn };
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    if (query.limit) {
      return results.slice(0, query.limit);
    }

    return results.filter(r => r.score > 0);
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getAllTools().filter(t => t.category === category);
  }

  /**
   * Get tools by tags
   */
  getToolsByTags(tags: string[]): ToolDefinition[] {
    return this.getAllTools().filter(t => 
      tags.some(tag => t.tags.includes(tag))
    );
  }

  /**
   * Get tool schema for LLM
   */
  getToolSchema(toolId: string): object | undefined {
    const tool = this.tools.get(toolId);
    if (!tool) return undefined;

    return {
      name: tool.id,
      description: tool.description,
      parameters: this.zodToJsonSchema(tool.parameters),
    };
  }

  /**
   * Get all tool schemas for LLM function calling
   */
  getAllToolSchemas(): object[] {
    return this.getAllTools().map(tool => ({
      name: tool.id,
      description: tool.description,
      parameters: this.zodToJsonSchema(tool.parameters),
    }));
  }

  // ---------------------------------------------------------------------------
  // TOOL EXECUTION
  // ---------------------------------------------------------------------------

  /**
   * Execute a tool
   */
  async executeTool<TResult = any>(
    toolId: string,
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<TResult>> {
    const startTime = Date.now();
    const tool = this.tools.get(toolId);

    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolId} not found`,
        executionTimeMs: Date.now() - startTime,
        toolId,
        toolVersion: 'unknown',
      };
    }

    // Check deprecation warning
    if (tool.metadata?.deprecated) {
      this.emit('tool:deprecation-warning', {
        toolId,
        message: tool.metadata.deprecationMessage,
        successorToolId: tool.metadata.successorToolId,
      });
    }

    // Check rate limit
    if (!this.checkRateLimit(toolId, tool)) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        executionTimeMs: Date.now() - startTime,
        toolId,
        toolVersion: tool.version,
      };
    }

    // Check permissions
    if (!this.checkPermissions(tool, context)) {
      return {
        success: false,
        error: 'Permission denied',
        executionTimeMs: Date.now() - startTime,
        toolId,
        toolVersion: tool.version,
      };
    }

    try {
      // Validate parameters
      const validatedParams = tool.parameters.parse(params);

      // Execute tool
      const result = await tool.execute(validatedParams, context);

      const executionTimeMs = Date.now() - startTime;

      // Update usage stats
      this.updateUsageStats(toolId, context.tenantId, executionTimeMs, true);

      this.emit('tool:executed', {
        toolId,
        version: tool.version,
        tenantId: context.tenantId,
        executionTimeMs,
        success: true,
      });

      return {
        success: true,
        data: result,
        executionTimeMs,
        toolId,
        toolVersion: tool.version,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      this.updateUsageStats(toolId, context.tenantId, executionTimeMs, false);

      this.emit('tool:error', {
        toolId,
        version: tool.version,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs,
        toolId,
        toolVersion: tool.version,
      };
    }
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeToolChain(
    toolIds: string[],
    initialParams: Record<string, any>,
    context: ToolExecutionContext,
    paramMapper?: (prevResult: any, nextToolId: string) => Record<string, any>
  ): Promise<Map<string, ToolExecutionResult>> {
    const results = new Map<string, ToolExecutionResult>();
    let currentParams = initialParams;

    for (const toolId of toolIds) {
      const result = await this.executeTool(toolId, currentParams, context);
      results.set(toolId, result);

      if (!result.success) {
        break; // Stop chain on error
      }

      // Map params for next tool
      if (paramMapper) {
        currentParams = paramMapper(result.data, toolId);
      } else {
        currentParams = { ...currentParams, previousResult: result.data };
      }
    }

    return results;
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeToolsParallel(
    toolConfigs: Array<{ toolId: string; params: Record<string, any> }>,
    context: ToolExecutionContext
  ): Promise<Map<string, ToolExecutionResult>> {
    const results = new Map<string, ToolExecutionResult>();

    const promises = toolConfigs.map(async ({ toolId, params }) => {
      const result = await this.executeTool(toolId, params, context);
      return { toolId, result };
    });

    const outcomes = await Promise.all(promises);
    
    for (const { toolId, result } of outcomes) {
      results.set(toolId, result);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // COMPOSED TOOLS
  // ---------------------------------------------------------------------------

  /**
   * Register a composed tool (combination of multiple tools)
   */
  registerComposedTool(composedTool: ComposedTool): void {
    // Validate that all component tools exist
    for (const toolId of composedTool.toolIds) {
      if (!this.tools.has(toolId)) {
        throw new Error(`Component tool ${toolId} not found`);
      }
    }

    this.composedTools.set(composedTool.id, composedTool);
    this.emit('composed-tool:registered', { composedToolId: composedTool.id });
  }

  /**
   * Execute a composed tool
   */
  async executeComposedTool(
    composedToolId: string,
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Map<string, ToolExecutionResult>> {
    const composedTool = this.composedTools.get(composedToolId);
    if (!composedTool) {
      throw new Error(`Composed tool ${composedToolId} not found`);
    }

    switch (composedTool.composition) {
      case 'sequential':
        return this.executeToolChain(composedTool.toolIds, params, context);

      case 'parallel':
        return this.executeToolsParallel(
          composedTool.toolIds.map(toolId => ({ toolId, params })),
          context
        );

      case 'conditional':
        return this.executeConditionalChain(composedTool, params, context);

      default:
        throw new Error(`Unknown composition type: ${composedTool.composition}`);
    }
  }

  private async executeConditionalChain(
    composedTool: ComposedTool,
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Map<string, ToolExecutionResult>> {
    const results = new Map<string, ToolExecutionResult>();

    if (!composedTool.condition) {
      throw new Error('Conditional composed tool requires a condition function');
    }

    // Start with first tool
    let currentToolId = composedTool.toolIds[0];
    let currentParams = params;

    while (currentToolId) {
      const result = await this.executeTool(currentToolId, currentParams, context);
      results.set(currentToolId, result);

      if (!result.success) break;

      // Determine next tool based on condition
      currentToolId = composedTool.condition(results);
      currentParams = { ...currentParams, previousResult: result.data };

      // Prevent infinite loops
      if (results.size > 20) {
        throw new Error('Max iterations exceeded in conditional chain');
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // USAGE ANALYTICS
  // ---------------------------------------------------------------------------

  /**
   * Get usage statistics for a tool
   */
  getUsageStats(toolId: string): ToolUsageStats | undefined {
    return this.usageStats.get(toolId);
  }

  /**
   * Get all usage statistics
   */
  getAllUsageStats(): ToolUsageStats[] {
    return Array.from(this.usageStats.values());
  }

  /**
   * Get most used tools
   */
  getMostUsedTools(limit = 10): Array<{ tool: ToolDefinition; stats: ToolUsageStats }> {
    const statsWithTools: Array<{ tool: ToolDefinition; stats: ToolUsageStats }> = [];

    for (const [toolId, stats] of this.usageStats) {
      const tool = this.tools.get(toolId);
      if (tool) {
        statsWithTools.push({ tool, stats });
      }
    }

    return statsWithTools
      .sort((a, b) => b.stats.totalCalls - a.stats.totalCalls)
      .slice(0, limit);
  }

  /**
   * Get tool recommendations based on context
   */
  getRecommendedTools(context: {
    taskType?: string;
    contractType?: string;
    recentTools?: string[];
  }): ToolDefinition[] {
    const recommendations: Array<{ tool: ToolDefinition; score: number }> = [];

    for (const tool of this.getAllTools()) {
      let score = 0;

      // Score based on task type match
      if (context.taskType) {
        if (tool.category === context.taskType) score += 5;
        if (tool.tags.includes(context.taskType)) score += 3;
      }

      // Score based on usage frequency (popularity)
      const stats = this.usageStats.get(tool.id);
      if (stats) {
        score += Math.min(stats.totalCalls / 100, 3);
        score += ((stats as any).successRate ?? 0) * 2;
      }

      // Boost if recently used (continuity)
      if (context.recentTools?.includes(tool.id)) {
        score += 2;
      }

      recommendations.push({ tool, score });
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(r => r.tool);
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  private checkRateLimit(toolId: string, tool: ToolDefinition): boolean {
    if (!tool.metadata?.rateLimit) return true;

    const key = `ratelimit:${toolId}`;
    const tracker = this.rateLimitTrackers.get(key);

    if (!tracker || new Date() > tracker.resetAt) {
      this.rateLimitTrackers.set(key, {
        count: 1,
        resetAt: new Date(Date.now() + tool.metadata.rateLimit.windowMs),
      });
      return true;
    }

    if (tracker.count >= tool.metadata.rateLimit.maxCalls) {
      return false;
    }

    tracker.count++;
    return true;
  }

  private checkPermissions(tool: ToolDefinition, context: ToolExecutionContext): boolean {
    if (!tool.metadata?.permissions) return true;

    const { roles, tenantIds } = tool.metadata.permissions;

    // Check tenant access
    if (tenantIds && tenantIds.length > 0) {
      if (!tenantIds.includes(context.tenantId)) {
        return false;
      }
    }

    // Role checking would require integration with auth system
    // For now, return true
    return true;
  }

  private updateUsageStats(
    toolId: string,
    tenantId: string,
    executionTimeMs: number,
    success: boolean
  ): void {
    const stats = this.usageStats.get(toolId);
    if (!stats) return;

    stats.totalCalls++;
    if (success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }

    // Update rolling average execution time
    stats.avgExecutionTimeMs = 
      (stats.avgExecutionTimeMs * (stats.totalCalls - 1) + executionTimeMs) / stats.totalCalls;

    stats.lastUsed = new Date();

    // Track by tenant
    const tenantCount = stats.usageByTenant.get(tenantId) || 0;
    stats.usageByTenant.set(tenantId, tenantCount + 1);

    // Track by day
    const today = new Date().toISOString().split('T')[0] ?? '';
    const dayCount = stats.usageByDay.get(today) || 0;
    stats.usageByDay.set(today, dayCount + 1);
  }

  private zodToJsonSchema(schema: ZodType<any>): object {
    // Simplified Zod to JSON Schema conversion
    // In production, use zod-to-json-schema library
    return {
      type: 'object',
      properties: {},
      additionalProperties: true,
    };
  }

  // ---------------------------------------------------------------------------
  // A/B TESTING
  // ---------------------------------------------------------------------------

  /**
   * Register an A/B test variant for a tool
   */
  registerToolVariant(
    originalToolId: string,
    variantId: string,
    variantTool: ToolDefinition,
    trafficPercentage: number
  ): void {
    if (trafficPercentage < 0 || trafficPercentage > 100) {
      throw new Error('Traffic percentage must be between 0 and 100');
    }

    // Store variant with metadata
    variantTool.metadata = {
      ...variantTool.metadata,
      createdAt: variantTool.metadata?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.tools.set(variantId, variantTool);

    this.emit('tool:variant-registered', {
      originalToolId,
      variantId,
      trafficPercentage,
    });
  }

  /**
   * Get tool with A/B test routing
   */
  getToolWithAbTest(toolId: string, userId: string): ToolDefinition | undefined {
    // Simple hash-based routing
    // In production, use a proper A/B testing framework
    return this.tools.get(toolId);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let registryInstance: ToolRegistryService | null = null;

export function getToolRegistry(): ToolRegistryService {
  if (!registryInstance) {
    registryInstance = new ToolRegistryService();
  }
  return registryInstance;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export function registerTool<TParams, TResult>(
  tool: ToolDefinition<TParams, TResult>
): void {
  getToolRegistry().registerTool(tool);
}

export function getTool(toolId: string): ToolDefinition | undefined {
  return getToolRegistry().getTool(toolId);
}

export async function executeTool<TResult = any>(
  toolId: string,
  params: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult<TResult>> {
  return getToolRegistry().executeTool<TResult>(toolId, params, context);
}

export function searchTools(query: ToolSearchQuery): ToolSearchResult[] {
  return getToolRegistry().searchTools(query);
}

export function getAllToolSchemas(): object[] {
  return getToolRegistry().getAllToolSchemas();
}

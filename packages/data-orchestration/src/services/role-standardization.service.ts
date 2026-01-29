/**
 * Role Standardization Service
 * AI-powered role standardization with taxonomy and learning from user corrections
 */

import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RoleTaxonomy {
  id: string;
  standardizedName: string;
  category: string;
  subCategory?: string;
  aliases: string[];
  keywords: string[];
  industry?: string;
  lineOfService?: string;
  seniorityLevel?: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleMapping {
  id: string;
  originalRole: string;
  standardizedRole: string;
  confidence: number;
  source: 'AI' | 'USER_CORRECTION' | 'MANUAL';
  userId?: string;
  tenantId: string;
  createdAt: Date;
}

export interface StandardizationResult {
  standardized: string;
  confidence: number;
  category: string;
  subCategory?: string;
  alternatives: string[];
  source: 'TAXONOMY' | 'AI' | 'CACHE';
  reasoning?: string;
}

export interface LearningFeedback {
  originalRole: string;
  suggestedRole: string;
  correctedRole: string;
  userId: string;
  tenantId: string;
  context?: {
    industry?: string;
    lineOfService?: string;
    seniority?: string;
  };
}

export class RoleStandardizationService {
  private readonly llm: ChatOpenAI;
  private readonly cache: Map<string, StandardizationResult>;

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY || '',
      azureOpenAIApiKey: undefined,
    });
    this.cache = new Map();
  }

  /**
   * Standardize a role name using taxonomy, cache, and AI
   */
  async standardizeRole(
    originalRole: string,
    tenantId: string,
    context?: {
      industry?: string;
      lineOfService?: string;
      seniority?: string;
      existingRoles?: string[];
    }
  ): Promise<StandardizationResult> {
    // Normalize input
    const normalized = originalRole.trim();
    const cacheKey = this.getCacheKey(normalized, tenantId, context);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return { ...cached, source: 'CACHE' };
    }

    // Check existing mappings (user corrections)
    const existingMapping = await this.findExistingMapping(normalized, tenantId);
    if (existingMapping) {
      const result: StandardizationResult = {
        standardized: existingMapping.standardizedRole,
        confidence: existingMapping.confidence,
        category: 'General',
        alternatives: [],
        source: 'TAXONOMY',
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // Check taxonomy database
    const taxonomyMatch = await this.findTaxonomyMatch(normalized, context);
    if (taxonomyMatch) {
      const result: StandardizationResult = {
        standardized: taxonomyMatch.standardizedName,
        confidence: 0.95,
        category: taxonomyMatch.category,
        subCategory: taxonomyMatch.subCategory,
        alternatives: taxonomyMatch.aliases.slice(0, 3),
        source: 'TAXONOMY',
      };
      this.cache.set(cacheKey, result);
      
      // Update usage count
      await this.incrementTaxonomyUsage(taxonomyMatch.id);
      
      return result;
    }

    // Use AI for new roles
    const aiResult = await this.standardizeWithAI(normalized, context);
    this.cache.set(cacheKey, aiResult);

    // Store the mapping for future use
    await this.storeMappingAsync(normalized, aiResult, tenantId);

    return aiResult;
  }

  /**
   * Standardize role using AI
   */
  private async standardizeWithAI(
    originalRole: string,
    context?: {
      industry?: string;
      lineOfService?: string;
      seniority?: string;
      existingRoles?: string[];
    }
  ): Promise<StandardizationResult> {
    const contextInfo = this.buildContextInfo(context);

    const systemPrompt = `You are an expert at standardizing job titles and role names across industries.

Your task is to convert varied role titles into standardized, consistent names that:
1. Preserve the core function and expertise level
2. Use industry-standard terminology
3. Are clear and unambiguous
4. Can be used for benchmarking and comparison

Return JSON with:
- standardized: The standardized role name (concise, professional)
- confidence: Confidence score 0-1 (be conservative)
- category: Primary category (Engineering, Consulting, Finance, Legal, Data & Analytics, Product, Design, Operations, Sales, Marketing, HR, etc.)
- subCategory: More specific category if applicable
- alternatives: Array of 2-3 alternative standardized names
- reasoning: Brief explanation of standardization choice`;

    const userPrompt = `Standardize this role: "${originalRole}"

${contextInfo}

STANDARDIZATION EXAMPLES:
- "Sr. Java Dev" → "Software Engineer" (category: Engineering, subCategory: Backend)
- "Lead Data Scientist" → "Data Scientist" (category: Data & Analytics)
- "Junior Full Stack Developer" → "Software Engineer" (category: Engineering, subCategory: Full Stack)
- "Principal Solution Architect" → "Solution Architect" (category: Architecture)
- "SAP Consultant" → "SAP Consultant" (category: ERP Consulting)
- "Business Analyst II" → "Business Analyst" (category: Consulting)
- "DevOps Engineer III" → "DevOps Engineer" (category: Engineering, subCategory: DevOps)
- "Product Manager - Senior" → "Product Manager" (category: Product)
- "UX/UI Designer" → "UX Designer" (category: Design)

RULES:
- Remove seniority indicators (Junior, Senior, Lead, Principal, etc.) from the standardized name
- Keep specialized certifications or technologies (SAP, Salesforce, AWS, etc.)
- Use singular form (Engineer, not Engineers)
- Avoid abbreviations unless industry-standard (UX, DevOps, etc.)
- Be consistent with existing standards

Return JSON format:
{
  "standardized": "Software Engineer",
  "confidence": 0.90,
  "category": "Engineering",
  "subCategory": "Backend",
  "alternatives": ["Backend Developer", "Java Developer"],
  "reasoning": "Standardized to Software Engineer as it's the industry-standard term for software development roles"
}`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      const content = response.content;
      if (!content || typeof content !== 'string') {
        throw new Error('No content returned from AI');
      }

      const result = JSON.parse(content);

      return {
        standardized: result.standardized || originalRole,
        confidence: Math.max(0, Math.min(1, result.confidence || 0.7)),
        category: result.category || 'General',
        subCategory: result.subCategory,
        alternatives: Array.isArray(result.alternatives) ? result.alternatives : [],
        source: 'AI',
        reasoning: result.reasoning,
      };
    } catch {
      // Fallback
      return {
        standardized: originalRole,
        confidence: 0.5,
        category: 'General',
        alternatives: [],
        source: 'AI',
      };
    }
  }

  /**
   * Learn from user correction
   */
  async learnFromCorrection(feedback: LearningFeedback): Promise<void> {
    try {
      // Store the correction as a high-confidence mapping
      await (prisma as any).roleMapping.create({
        data: {
          tenantId: feedback.tenantId,
          originalRole: feedback.originalRole,
          standardizedRole: feedback.correctedRole,
          confidence: 1.0,
          source: 'USER_CORRECTION',
          userId: feedback.userId,
          context: feedback.context || {},
        },
      });

      // Update or create taxonomy entry
      await this.updateTaxonomy(
        feedback.correctedRole,
        feedback.originalRole,
        feedback.context
      );

      // Clear cache for this role
      this.clearCacheForRole(feedback.originalRole, feedback.tenantId);
    } catch {
      // Error learning from correction - silent fail
    }
  }

  /**
   * Get role suggestions for autocomplete
   */
  async getRoleSuggestions(
    partial: string,
    tenantId: string,
    limit: number = 10
  ): Promise<string[]> {
    try {
      // Get from taxonomy
      const taxonomyResults = await (prisma as any).roleTaxonomy.findMany({
        where: {
          OR: [
            { standardizedName: { contains: partial, mode: 'insensitive' } },
            { aliases: { has: partial } },
          ],
        },
        orderBy: { usageCount: 'desc' },
        take: limit,
        select: { standardizedName: true },
      });

      // Get from recent mappings
      const mappingResults = await (prisma as any).roleMapping.findMany({
        where: {
          tenantId,
          standardizedRole: { contains: partial, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        distinct: ['standardizedRole'],
        select: { standardizedRole: true },
      });

      // Combine and deduplicate
      const suggestions = new Set<string>();
      taxonomyResults.forEach((r) => suggestions.add(r.standardizedName));
      mappingResults.forEach((r) => suggestions.add(r.standardizedRole));

      return Array.from(suggestions).slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Get role taxonomy statistics
   */
  async getTaxonomyStats(tenantId?: string): Promise<{
    totalRoles: number;
    totalMappings: number;
    topCategories: Array<{ category: string; count: number }>;
    recentlyAdded: string[];
  }> {
    try {
      const [totalRoles, totalMappings, categories, recent] = await Promise.all([
        (prisma as any).roleTaxonomy.count(),
        (prisma as any).roleMapping.count({ where: tenantId ? { tenantId } : {} }),
        (prisma as any).roleTaxonomy.groupBy({
          by: ['category'],
          _count: true,
          orderBy: { _count: { category: 'desc' } },
          take: 10,
        }),
        (prisma as any).roleTaxonomy.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { standardizedName: true },
        }),
      ]);

      return {
        totalRoles,
        totalMappings,
        topCategories: categories.map((c) => ({
          category: c.category,
          count: c._count,
        })),
        recentlyAdded: recent.map((r) => r.standardizedName),
      };
    } catch {
      return {
        totalRoles: 0,
        totalMappings: 0,
        topCategories: [],
        recentlyAdded: [],
      };
    }
  }

  /**
   * Build context information for AI
   */
  private buildContextInfo(context?: {
    industry?: string;
    lineOfService?: string;
    seniority?: string;
    existingRoles?: string[];
  }): string {
    if (!context) return '';

    const parts: string[] = [];
    if (context.industry) parts.push(`Industry: ${context.industry}`);
    if (context.lineOfService) parts.push(`Line of Service: ${context.lineOfService}`);
    if (context.seniority) parts.push(`Seniority: ${context.seniority}`);
    if (context.existingRoles && context.existingRoles.length > 0) {
      parts.push(`Existing Roles: ${context.existingRoles.slice(0, 5).join(', ')}`);
    }

    return parts.length > 0 ? `\nCONTEXT:\n${parts.join('\n')}` : '';
  }

  /**
   * Find existing mapping
   */
  private async findExistingMapping(
    originalRole: string,
    tenantId: string
  ): Promise<RoleMapping | null> {
    try {
      const mapping = await (prisma as any).roleMapping.findFirst({
        where: {
          tenantId,
          originalRole: { equals: originalRole, mode: 'insensitive' },
        },
        orderBy: [{ source: 'asc' }, { createdAt: 'desc' }],
      });

      return mapping as RoleMapping | null;
    } catch {
      return null;
    }
  }

  /**
   * Find taxonomy match
   */
  private async findTaxonomyMatch(
    originalRole: string,
    context?: any
  ): Promise<RoleTaxonomy | null> {
    try {
      // Exact match on standardized name
      let match = await (prisma as any).roleTaxonomy.findFirst({
        where: {
          standardizedName: { equals: originalRole, mode: 'insensitive' },
        },
      });

      if (match) return match as RoleTaxonomy;

      // Match on aliases
      match = await (prisma as any).roleTaxonomy.findFirst({
        where: {
          aliases: { has: originalRole.toLowerCase() },
        },
      });

      if (match) return match as RoleTaxonomy;

      // Fuzzy match on keywords
      const keywords = originalRole.toLowerCase().split(/\s+/);
      match = await (prisma as any).roleTaxonomy.findFirst({
        where: {
          keywords: { hasSome: keywords },
        },
        orderBy: { usageCount: 'desc' },
      });

      return match as RoleTaxonomy | null;
    } catch {
      return null;
    }
  }

  /**
   * Update taxonomy with new information
   */
  private async updateTaxonomy(
    standardizedRole: string,
    originalRole: string,
    context?: any
  ): Promise<void> {
    try {
      const existing = await (prisma as any).roleTaxonomy.findFirst({
        where: { standardizedName: standardizedRole },
      });

      if (existing) {
        // Add alias if not already present
        const aliases = existing.aliases || [];
        if (!aliases.includes(originalRole.toLowerCase())) {
          await (prisma as any).roleTaxonomy.update({
            where: { id: existing.id },
            data: {
              aliases: [...aliases, originalRole.toLowerCase()],
              usageCount: { increment: 1 },
            },
          });
        }
      } else {
        // Create new taxonomy entry
        await (prisma as any).roleTaxonomy.create({
          data: {
            standardizedName: standardizedRole,
            category: context?.category || 'General',
            subCategory: context?.subCategory,
            aliases: [originalRole.toLowerCase()],
            keywords: standardizedRole.toLowerCase().split(/\s+/),
            industry: context?.industry,
            lineOfService: context?.lineOfService,
            usageCount: 1,
          },
        });
      }
    } catch {
      // Error updating taxonomy - silent fail
    }
  }

  /**
   * Increment taxonomy usage count
   */
  private async incrementTaxonomyUsage(taxonomyId: string): Promise<void> {
    try {
      await (prisma as any).roleTaxonomy.update({
        where: { id: taxonomyId },
        data: { usageCount: { increment: 1 } },
      });
    } catch {
      // Error incrementing taxonomy usage - silent fail
    }
  }

  /**
   * Store mapping asynchronously (fire and forget)
   */
  private storeMappingAsync(
    originalRole: string,
    result: StandardizationResult,
    tenantId: string
  ): void {
    (prisma as any).roleMapping
      .create({
        data: {
          tenantId,
          originalRole,
          standardizedRole: result.standardized,
          confidence: result.confidence,
          source: 'AI',
          context: {
            category: result.category,
            subCategory: result.subCategory,
          },
        },
      })
      .catch(() => {
        // Error storing mapping - silent fail
      });
  }

  /**
   * Get cache key
   */
  private getCacheKey(
    role: string,
    tenantId: string,
    context?: any
  ): string {
    const contextKey = context
      ? `${context.industry || ''}_${context.lineOfService || ''}_${context.seniority || ''}`
      : '';
    return `${tenantId}_${role.toLowerCase()}_${contextKey}`;
  }

  /**
   * Clear cache for a role
   */
  private clearCacheForRole(role: string, tenantId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(role.toLowerCase()) && key.startsWith(tenantId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Lazy singleton - only created when first accessed
let _roleStandardizationService: RoleStandardizationService | null = null;

export function getRoleStandardizationService(): RoleStandardizationService {
  if (!_roleStandardizationService) {
    _roleStandardizationService = new RoleStandardizationService();
  }
  return _roleStandardizationService;
}

// Backward compatible export
export const roleStandardizationService = {
  get instance(): RoleStandardizationService {
    return getRoleStandardizationService();
  },
  standardizeRole: (role: string, tenantId: string, context?: Parameters<RoleStandardizationService['standardizeRole']>[2]) => 
    getRoleStandardizationService().standardizeRole(role, tenantId, context),
  standardizeRoles: async (roles: string[], tenantId: string) => {
    // Batch standardize roles - convenience method
    const service = getRoleStandardizationService();
    return Promise.all(roles.map(role => service.standardizeRole(role, tenantId)));
  },
  getRoleSuggestions: (query: string, tenantId: string, limit?: number) =>
    getRoleStandardizationService().getRoleSuggestions(query, tenantId, limit),
  clearCache: () => 
    getRoleStandardizationService().clearCache(),
};

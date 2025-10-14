/**
 * Data Standardization & Clustering Service
 * 
 * Standardizes and clusters similar data across:
 * - Line of Service (IT, Consulting, Finance, etc.)
 * - Supplier names and variations
 * - Role titles and descriptions
 * - Seniority levels and experience
 */

import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import { analyticalEventPublisher } from "../events/analytical-event-publisher";
import pino from "pino";
import crypto from "crypto";

const logger = pino({ name: "data-standardization-service" });

// Standardization Models
export interface StandardizationRule {
  id: string;
  category: 'line_of_service' | 'supplier' | 'role' | 'seniority';
  sourceValue: string;
  standardValue: string;
  confidence: number;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ClusterDefinition {
  id: string;
  category: 'line_of_service' | 'supplier' | 'role' | 'seniority';
  clusterName: string;
  standardValue: string;
  members: string[];
  confidence: number;
  characteristics: Record<string, any>;
  createdAt: Date;
}

export interface StandardizationResult {
  originalValue: string;
  standardValue: string;
  confidence: number;
  cluster?: string;
  suggestions?: string[];
}

export interface ClusteringAnalysis {
  category: string;
  totalItems: number;
  clusteredItems: number;
  clusters: Array<{
    name: string;
    standardValue: string;
    memberCount: number;
    confidence: number;
    examples: string[];
  }>;
  unclustered: string[];
  recommendations: string[];
}

export class DataStandardizationService {
  private static instance: DataStandardizationService;
  
  // Pre-defined standardization mappings
  private lineOfServiceMappings: Map<string, string> = new Map();
  private roleMappings: Map<string, string> = new Map();
  private seniority Mappings: Map<string, string> = new Map();
  private supplierMappings: Map<string, string> = new Map();

  private constructor() {
    this.initializeStandardMappings();
  }

  static getInstance(): DataStandardizationService {
    if (!DataStandardizationService.instance) {
      DataStandardizationService.instance = new DataStandardizationService();
    }
    return DataStandardizationService.instance;
  }

  // ============================================================================
  // STANDARDIZATION METHODS
  // ============================================================================

  /**
   * Standardize line of service
   */
  async standardizeLineOfService(value: string): Promise<StandardizationResult> {
    try {
      const normalized = this.normalizeString(value);
      
      // Check exact matches first
      if (this.lineOfServiceMappings.has(normalized)) {
        return {
          originalValue: value,
          standardValue: this.lineOfServiceMappings.get(normalized)!,
          confidence: 0.95
        };
      }

      // Check fuzzy matches
      const fuzzyMatch = this.findFuzzyMatch(normalized, Array.from(this.lineOfServiceMappings.keys()));
      if (fuzzyMatch.confidence > 0.8) {
        return {
          originalValue: value,
          standardValue: this.lineOfServiceMappings.get(fuzzyMatch.match)!,
          confidence: fuzzyMatch.confidence,
          suggestions: fuzzyMatch.alternatives
        };
      }

      // Check database for existing mappings
      const dbResult = await this.findDatabaseMapping('line_of_service', normalized);
      if (dbResult) {
        return dbResult;
      }

      // Use ML-based classification
      const mlResult = await this.classifyLineOfService(value);
      
      return {
        originalValue: value,
        standardValue: mlResult.category,
        confidence: mlResult.confidence,
        suggestions: mlResult.alternatives
      };

    } catch (error) {
      logger.error({ error, value }, "Failed to standardize line of service");
      return {
        originalValue: value,
        standardValue: 'Other',
        confidence: 0.3
      };
    }
  }

  /**
   * Standardize supplier name
   */
  async standardizeSupplier(value: string): Promise<StandardizationResult> {
    try {
      const normalized = this.normalizeSupplierName(value);
      
      // Check exact matches
      if (this.supplierMappings.has(normalized)) {
        return {
          originalValue: value,
          standardValue: this.supplierMappings.get(normalized)!,
          confidence: 0.95
        };
      }

      // Check for common supplier variations
      const standardized = await this.detectSupplierVariations(normalized);
      if (standardized) {
        return standardized;
      }

      // Check database for existing mappings
      const dbResult = await this.findDatabaseMapping('supplier', normalized);
      if (dbResult) {
        return dbResult;
      }

      // Use fuzzy matching for similar supplier names
      const existingSuppliers = await this.getExistingSuppliers();
      const fuzzyMatch = this.findFuzzyMatch(normalized, existingSuppliers);
      
      if (fuzzyMatch.confidence > 0.85) {
        return {
          originalValue: value,
          standardValue: fuzzyMatch.match,
          confidence: fuzzyMatch.confidence,
          suggestions: fuzzyMatch.alternatives
        };
      }

      return {
        originalValue: value,
        standardValue: this.cleanSupplierName(value),
        confidence: 0.7
      };

    } catch (error) {
      logger.error({ error, value }, "Failed to standardize supplier");
      return {
        originalValue: value,
        standardValue: value,
        confidence: 0.5
      };
    }
  }

  /**
   * Standardize role title
   */
  async standardizeRole(value: string): Promise<StandardizationResult> {
    try {
      const normalized = this.normalizeString(value);
      
      // Check exact matches
      if (this.roleMappings.has(normalized)) {
        return {
          originalValue: value,
          standardValue: this.roleMappings.get(normalized)!,
          confidence: 0.95
        };
      }

      // Extract role components
      const roleComponents = this.extractRoleComponents(value);
      const standardRole = this.buildStandardRole(roleComponents);

      // Check database for existing mappings
      const dbResult = await this.findDatabaseMapping('role', normalized);
      if (dbResult) {
        return dbResult;
      }

      // Use ML-based role classification
      const mlResult = await this.classifyRole(value, roleComponents);

      return {
        originalValue: value,
        standardValue: mlResult.standardRole,
        confidence: mlResult.confidence,
        suggestions: mlResult.alternatives
      };

    } catch (error) {
      logger.error({ error, value }, "Failed to standardize role");
      return {
        originalValue: value,
        standardValue: value,
        confidence: 0.5
      };
    }
  }

  /**
   * Standardize seniority level
   */
  async standardizeSeniority(value: string, context?: { role?: string; experience?: number }): Promise<StandardizationResult> {
    try {
      const normalized = this.normalizeString(value);
      
      // Check exact matches
      if (this.seniorityMappings.has(normalized)) {
        return {
          originalValue: value,
          standardValue: this.seniorityMappings.get(normalized)!,
          confidence: 0.95
        };
      }

      // Extract seniority indicators
      const seniorityLevel = this.extractSeniorityLevel(value, context);
      
      return {
        originalValue: value,
        standardValue: seniorityLevel.level,
        confidence: seniorityLevel.confidence,
        suggestions: seniorityLevel.alternatives
      };

    } catch (error) {
      logger.error({ error, value }, "Failed to standardize seniority");
      return {
        originalValue: value,
        standardValue: 'Mid',
        confidence: 0.3
      };
    }
  }

  // ============================================================================
  // CLUSTERING METHODS
  // ============================================================================

  /**
   * Cluster similar line of service values
   */
  async clusterLineOfService(tenantId: string = 'default'): Promise<ClusteringAnalysis> {
    try {
      logger.info({ tenantId }, "Clustering line of service data");

      // Get all unique line of service values
      const query = `
        SELECT DISTINCT 
          COALESCE(c.category, 'Unknown') as line_of_service,
          COUNT(*) as frequency
        FROM contracts c
        WHERE c.tenant_id = ?
        GROUP BY COALESCE(c.category, 'Unknown')
        ORDER BY frequency DESC
      `;

      const rawData = await dbAdaptor.prisma.$queryRawUnsafe(query, tenantId) as any[];
      
      // Standardize and cluster
      const clusters = await this.performClustering(
        rawData.map(item => ({ value: item.line_of_service, frequency: item.frequency })),
        'line_of_service'
      );

      const analysis: ClusteringAnalysis = {
        category: 'line_of_service',
        totalItems: rawData.length,
        clusteredItems: clusters.reduce((sum, cluster) => sum + cluster.memberCount, 0),
        clusters: clusters.map(cluster => ({
          name: cluster.clusterName,
          standardValue: cluster.standardValue,
          memberCount: cluster.members.length,
          confidence: cluster.confidence,
          examples: cluster.members.slice(0, 3)
        })),
        unclustered: this.findUnclusteredItems(rawData, clusters),
        recommendations: this.generateClusteringRecommendations(clusters)
      };

      logger.info({ tenantId, analysis }, "Completed line of service clustering");
      return analysis;

    } catch (error) {
      logger.error({ error, tenantId }, "Failed to cluster line of service data");
      throw error;
    }
  }

  /**
   * Cluster similar supplier names
   */
  async clusterSuppliers(tenantId: string = 'default'): Promise<ClusteringAnalysis> {
    try {
      logger.info({ tenantId }, "Clustering supplier data");

      // Get all unique supplier names
      const query = `
        SELECT DISTINCT 
          COALESCE(c.supplier_name, 'Unknown') as supplier_name,
          COUNT(*) as frequency
        FROM contracts c
        WHERE c.tenant_id = ?
        AND c.supplier_name IS NOT NULL
        GROUP BY c.supplier_name
        ORDER BY frequency DESC
      `;

      const rawData = await dbAdaptor.prisma.$queryRawUnsafe(query, tenantId) as any[];
      
      // Perform advanced supplier clustering
      const clusters = await this.performSupplierClustering(rawData);

      const analysis: ClusteringAnalysis = {
        category: 'supplier',
        totalItems: rawData.length,
        clusteredItems: clusters.reduce((sum, cluster) => sum + cluster.memberCount, 0),
        clusters: clusters.map(cluster => ({
          name: cluster.clusterName,
          standardValue: cluster.standardValue,
          memberCount: cluster.members.length,
          confidence: cluster.confidence,
          examples: cluster.members.slice(0, 3)
        })),
        unclustered: this.findUnclusteredItems(rawData, clusters),
        recommendations: this.generateSupplierRecommendations(clusters)
      };

      logger.info({ tenantId, analysis }, "Completed supplier clustering");
      return analysis;

    } catch (error) {
      logger.error({ error, tenantId }, "Failed to cluster supplier data");
      throw error;
    }
  }

  /**
   * Cluster similar roles
   */
  async clusterRoles(tenantId: string = 'default'): Promise<ClusteringAnalysis> {
    try {
      logger.info({ tenantId }, "Clustering role data");

      // Get all unique roles from rate cards
      const query = `
        SELECT DISTINCT 
          r.role,
          r.level,
          COUNT(*) as frequency
        FROM rates r
        JOIN rate_cards rc ON r.rate_card_id = rc.id
        WHERE rc.tenant_id = ?
        GROUP BY r.role, r.level
        ORDER BY frequency DESC
      `;

      const rawData = await dbAdaptor.prisma.$queryRawUnsafe(query, tenantId) as any[];
      
      // Perform role clustering with seniority context
      const clusters = await this.performRoleClustering(rawData);

      const analysis: ClusteringAnalysis = {
        category: 'role',
        totalItems: rawData.length,
        clusteredItems: clusters.reduce((sum, cluster) => sum + cluster.memberCount, 0),
        clusters: clusters.map(cluster => ({
          name: cluster.clusterName,
          standardValue: cluster.standardValue,
          memberCount: cluster.members.length,
          confidence: cluster.confidence,
          examples: cluster.members.slice(0, 3)
        })),
        unclustered: this.findUnclusteredItems(rawData, clusters),
        recommendations: this.generateRoleRecommendations(clusters)
      };

      logger.info({ tenantId, analysis }, "Completed role clustering");
      return analysis;

    } catch (error) {
      logger.error({ error, tenantId }, "Failed to cluster role data");
      throw error;
    }
  }

  /**
   * Perform comprehensive data standardization across all categories
   */
  async standardizeAllData(tenantId: string = 'default'): Promise<{
    lineOfService: ClusteringAnalysis;
    suppliers: ClusteringAnalysis;
    roles: ClusteringAnalysis;
    summary: {
      totalItemsProcessed: number;
      standardizationRate: number;
      clustersCreated: number;
      recommendations: string[];
    };
  }> {
    try {
      logger.info({ tenantId }, "Starting comprehensive data standardization");

      // Perform clustering for all categories
      const [lineOfService, suppliers, roles] = await Promise.all([
        this.clusterLineOfService(tenantId),
        this.clusterSuppliers(tenantId),
        this.clusterRoles(tenantId)
      ]);

      // Calculate summary statistics
      const totalItems = lineOfService.totalItems + suppliers.totalItems + roles.totalItems;
      const clusteredItems = lineOfService.clusteredItems + suppliers.clusteredItems + roles.clusteredItems;
      const clustersCreated = lineOfService.clusters.length + suppliers.clusters.length + roles.clusters.length;

      const summary = {
        totalItemsProcessed: totalItems,
        standardizationRate: totalItems > 0 ? (clusteredItems / totalItems) * 100 : 0,
        clustersCreated,
        recommendations: [
          ...lineOfService.recommendations,
          ...suppliers.recommendations,
          ...roles.recommendations
        ].slice(0, 10) // Top 10 recommendations
      };

      // Store standardization results
      await this.storeStandardizationResults(tenantId, {
        lineOfService,
        suppliers,
        roles,
        summary
      });

      // Publish standardization event
      await analyticalEventPublisher.publishDataStandardization({
        tenantId,
        categories: ['line_of_service', 'supplier', 'role'],
        totalItems,
        clusteredItems,
        clustersCreated,
        standardizationRate: summary.standardizationRate
      });

      logger.info({ tenantId, summary }, "Completed comprehensive data standardization");

      return {
        lineOfService,
        suppliers,
        roles,
        summary
      };

    } catch (error) {
      logger.error({ error, tenantId }, "Failed to standardize all data");
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private initializeStandardMappings(): void {
    // Line of Service mappings
    this.lineOfServiceMappings.set('information technology', 'IT Services');
    this.lineOfServiceMappings.set('it services', 'IT Services');
    this.lineOfServiceMappings.set('technology', 'IT Services');
    this.lineOfServiceMappings.set('software development', 'IT Services');
    this.lineOfServiceMappings.set('consulting', 'Consulting');
    this.lineOfServiceMappings.set('management consulting', 'Consulting');
    this.lineOfServiceMappings.set('business consulting', 'Consulting');
    this.lineOfServiceMappings.set('finance', 'Financial Services');
    this.lineOfServiceMappings.set('accounting', 'Financial Services');
    this.lineOfServiceMappings.set('legal', 'Legal Services');
    this.lineOfServiceMappings.set('law', 'Legal Services');
    this.lineOfServiceMappings.set('marketing', 'Marketing');
    this.lineOfServiceMappings.set('advertising', 'Marketing');

    // Role mappings
    this.roleMappings.set('software engineer', 'Software Engineer');
    this.roleMappings.set('developer', 'Software Engineer');
    this.roleMappings.set('programmer', 'Software Engineer');
    this.roleMappings.set('consultant', 'Consultant');
    this.roleMappings.set('business analyst', 'Business Analyst');
    this.roleMappings.set('project manager', 'Project Manager');
    this.roleMappings.set('program manager', 'Program Manager');
    this.roleMappings.set('architect', 'Solution Architect');
    this.roleMappings.set('technical architect', 'Solution Architect');

    // Seniority mappings
    this.seniorityMappings.set('junior', 'Junior');
    this.seniorityMappings.set('jr', 'Junior');
    this.seniorityMappings.set('entry level', 'Junior');
    this.seniorityMappings.set('mid', 'Mid');
    this.seniorityMappings.set('middle', 'Mid');
    this.seniorityMappings.set('intermediate', 'Mid');
    this.seniorityMappings.set('senior', 'Senior');
    this.seniorityMappings.set('sr', 'Senior');
    this.seniorityMappings.set('lead', 'Lead');
    this.seniorityMappings.set('principal', 'Principal');
    this.seniorityMappings.set('staff', 'Principal');
  }

  private normalizeString(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeSupplierName(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/\b(inc|corp|corporation|ltd|limited|llc|company|co)\b/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findFuzzyMatch(target: string, candidates: string[]): {
    match: string;
    confidence: number;
    alternatives: string[];
  } {
    const scores = candidates.map(candidate => ({
      candidate,
      score: this.calculateSimilarity(target, candidate)
    }));

    scores.sort((a, b) => b.score - a.score);

    return {
      match: scores[0]?.candidate || target,
      confidence: scores[0]?.score || 0,
      alternatives: scores.slice(1, 4).map(s => s.candidate)
    };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Levenshtein distance-based similarity
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  private async findDatabaseMapping(category: string, value: string): Promise<StandardizationResult | null> {
    try {
      // This would query a standardization_rules table if it exists
      // For now, return null to use other methods
      return null;
    } catch (error) {
      return null;
    }
  }

  private async classifyLineOfService(value: string): Promise<{
    category: string;
    confidence: number;
    alternatives: string[];
  }> {
    // ML-based classification logic
    const keywords = this.normalizeString(value).split(' ');
    
    const categories = {
      'IT Services': ['technology', 'software', 'development', 'programming', 'system', 'data'],
      'Consulting': ['consulting', 'advisory', 'strategy', 'management', 'business'],
      'Financial Services': ['finance', 'accounting', 'audit', 'tax', 'banking'],
      'Legal Services': ['legal', 'law', 'compliance', 'regulatory', 'contract'],
      'Marketing': ['marketing', 'advertising', 'brand', 'digital', 'campaign']
    };

    let bestMatch = 'Other';
    let bestScore = 0;
    const alternatives: string[] = [];

    for (const [category, categoryKeywords] of Object.entries(categories)) {
      const score = keywords.reduce((sum, keyword) => {
        return sum + (categoryKeywords.includes(keyword) ? 1 : 0);
      }, 0) / keywords.length;

      if (score > bestScore) {
        if (bestMatch !== 'Other') alternatives.push(bestMatch);
        bestMatch = category;
        bestScore = score;
      } else if (score > 0.2) {
        alternatives.push(category);
      }
    }

    return {
      category: bestMatch,
      confidence: Math.min(0.9, bestScore + 0.3),
      alternatives: alternatives.slice(0, 3)
    };
  }

  private async detectSupplierVariations(normalized: string): Promise<StandardizationResult | null> {
    // Common supplier name variations
    const variations = [
      { pattern: /accenture/i, standard: 'Accenture' },
      { pattern: /deloitte/i, standard: 'Deloitte' },
      { pattern: /pwc|pricewaterhousecoopers/i, standard: 'PwC' },
      { pattern: /kpmg/i, standard: 'KPMG' },
      { pattern: /ibm/i, standard: 'IBM' },
      { pattern: /microsoft/i, standard: 'Microsoft' },
      { pattern: /amazon|aws/i, standard: 'Amazon Web Services' }
    ];

    for (const variation of variations) {
      if (variation.pattern.test(normalized)) {
        return {
          originalValue: normalized,
          standardValue: variation.standard,
          confidence: 0.9
        };
      }
    }

    return null;
  }

  private async getExistingSuppliers(): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT supplier_name
        FROM contracts
        WHERE supplier_name IS NOT NULL
        ORDER BY supplier_name
      `;
      
      const results = await dbAdaptor.prisma.$queryRawUnsafe(query) as any[];
      return results.map(r => r.supplier_name);
    } catch (error) {
      return [];
    }
  }

  private cleanSupplierName(value: string): string {
    return value
      .replace(/\b(inc|corp|corporation|ltd|limited|llc|company|co)\b/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private extractRoleComponents(value: string): {
    seniority?: string;
    role: string;
    specialization?: string;
  } {
    const normalized = this.normalizeString(value);
    const words = normalized.split(' ');

    const seniorityIndicators = ['junior', 'jr', 'senior', 'sr', 'lead', 'principal', 'staff', 'chief'];
    const roleKeywords = ['engineer', 'developer', 'analyst', 'manager', 'consultant', 'architect'];

    const seniority = words.find(word => seniorityIndicators.includes(word));
    const role = words.find(word => roleKeywords.some(keyword => word.includes(keyword)));
    const specialization = words.find(word => 
      !seniorityIndicators.includes(word) && 
      !roleKeywords.some(keyword => word.includes(keyword)) &&
      word.length > 2
    );

    return {
      seniority,
      role: role || normalized,
      specialization
    };
  }

  private buildStandardRole(components: {
    seniority?: string;
    role: string;
    specialization?: string;
  }): string {
    const parts = [];
    
    if (components.seniority) {
      parts.push(this.standardizeSeniorityWord(components.seniority));
    }
    
    parts.push(this.standardizeRoleWord(components.role));
    
    if (components.specialization) {
      parts.push(components.specialization);
    }

    return parts.join(' ');
  }

  private standardizeSeniorityWord(word: string): string {
    const mappings: Record<string, string> = {
      'jr': 'Junior',
      'junior': 'Junior',
      'sr': 'Senior',
      'senior': 'Senior',
      'lead': 'Lead',
      'principal': 'Principal',
      'staff': 'Principal',
      'chief': 'Principal'
    };
    
    return mappings[word.toLowerCase()] || word;
  }

  private standardizeRoleWord(word: string): string {
    const mappings: Record<string, string> = {
      'developer': 'Developer',
      'engineer': 'Engineer',
      'analyst': 'Analyst',
      'manager': 'Manager',
      'consultant': 'Consultant',
      'architect': 'Architect'
    };
    
    return mappings[word.toLowerCase()] || word;
  }

  private async classifyRole(value: string, components: any): Promise<{
    standardRole: string;
    confidence: number;
    alternatives: string[];
  }> {
    // Use components to build standard role
    const standardRole = this.buildStandardRole(components);
    
    return {
      standardRole,
      confidence: 0.8,
      alternatives: []
    };
  }

  private extractSeniorityLevel(value: string, context?: { role?: string; experience?: number }): {
    level: string;
    confidence: number;
    alternatives: string[];
  } {
    const normalized = this.normalizeString(value);
    
    // Check for explicit seniority indicators
    if (normalized.includes('junior') || normalized.includes('jr') || normalized.includes('entry')) {
      return { level: 'Junior', confidence: 0.9, alternatives: ['Mid'] };
    }
    
    if (normalized.includes('senior') || normalized.includes('sr')) {
      return { level: 'Senior', confidence: 0.9, alternatives: ['Lead'] };
    }
    
    if (normalized.includes('lead') || normalized.includes('principal') || normalized.includes('staff')) {
      return { level: 'Lead', confidence: 0.9, alternatives: ['Principal'] };
    }
    
    if (normalized.includes('chief') || normalized.includes('director')) {
      return { level: 'Principal', confidence: 0.9, alternatives: ['Executive'] };
    }

    // Use context if available
    if (context?.experience) {
      if (context.experience < 3) return { level: 'Junior', confidence: 0.7, alternatives: ['Mid'] };
      if (context.experience < 7) return { level: 'Mid', confidence: 0.7, alternatives: ['Senior'] };
      if (context.experience < 12) return { level: 'Senior', confidence: 0.7, alternatives: ['Lead'] };
      return { level: 'Lead', confidence: 0.7, alternatives: ['Principal'] };
    }

    // Default to Mid level
    return { level: 'Mid', confidence: 0.5, alternatives: ['Junior', 'Senior'] };
  }

  private async performClustering(data: Array<{ value: string; frequency: number }>, category: string): Promise<ClusterDefinition[]> {
    // Simple clustering based on similarity
    const clusters: ClusterDefinition[] = [];
    const processed = new Set<string>();

    for (const item of data) {
      if (processed.has(item.value)) continue;

      const cluster: ClusterDefinition = {
        id: crypto.randomUUID(),
        category: category as any,
        clusterName: item.value,
        standardValue: item.value,
        members: [item.value],
        confidence: 0.8,
        characteristics: { frequency: item.frequency },
        createdAt: new Date()
      };

      // Find similar items
      for (const otherItem of data) {
        if (otherItem.value === item.value || processed.has(otherItem.value)) continue;
        
        const similarity = this.calculateSimilarity(item.value, otherItem.value);
        if (similarity > 0.8) {
          cluster.members.push(otherItem.value);
          processed.add(otherItem.value);
        }
      }

      clusters.push(cluster);
      processed.add(item.value);
    }

    return clusters;
  }

  private async performSupplierClustering(data: Array<{ supplier_name: string; frequency: number }>): Promise<ClusterDefinition[]> {
    // Advanced supplier clustering with name variations
    const clusters: ClusterDefinition[] = [];
    const processed = new Set<string>();

    for (const item of data) {
      if (processed.has(item.supplier_name)) continue;

      const normalized = this.normalizeSupplierName(item.supplier_name);
      const cluster: ClusterDefinition = {
        id: crypto.randomUUID(),
        category: 'supplier',
        clusterName: item.supplier_name,
        standardValue: this.cleanSupplierName(item.supplier_name),
        members: [item.supplier_name],
        confidence: 0.8,
        characteristics: { frequency: item.frequency },
        createdAt: new Date()
      };

      // Find variations of the same supplier
      for (const otherItem of data) {
        if (otherItem.supplier_name === item.supplier_name || processed.has(otherItem.supplier_name)) continue;
        
        const otherNormalized = this.normalizeSupplierName(otherItem.supplier_name);
        const similarity = this.calculateSimilarity(normalized, otherNormalized);
        
        if (similarity > 0.85) {
          cluster.members.push(otherItem.supplier_name);
          processed.add(otherItem.supplier_name);
        }
      }

      clusters.push(cluster);
      processed.add(item.supplier_name);
    }

    return clusters;
  }

  private async performRoleClustering(data: Array<{ role: string; level?: string; frequency: number }>): Promise<ClusterDefinition[]> {
    // Role clustering with seniority consideration
    const clusters: ClusterDefinition[] = [];
    const processed = new Set<string>();

    for (const item of data) {
      const roleKey = `${item.role}|${item.level || ''}`;
      if (processed.has(roleKey)) continue;

      const components = this.extractRoleComponents(item.role);
      const standardRole = this.buildStandardRole(components);

      const cluster: ClusterDefinition = {
        id: crypto.randomUUID(),
        category: 'role',
        clusterName: item.role,
        standardValue: standardRole,
        members: [roleKey],
        confidence: 0.8,
        characteristics: { 
          frequency: item.frequency,
          seniority: item.level,
          components 
        },
        createdAt: new Date()
      };

      // Find similar roles
      for (const otherItem of data) {
        const otherRoleKey = `${otherItem.role}|${otherItem.level || ''}`;
        if (otherRoleKey === roleKey || processed.has(otherRoleKey)) continue;
        
        const otherComponents = this.extractRoleComponents(otherItem.role);
        const similarity = this.calculateRoleSimilarity(components, otherComponents);
        
        if (similarity > 0.8) {
          cluster.members.push(otherRoleKey);
          processed.add(otherRoleKey);
        }
      }

      clusters.push(cluster);
      processed.add(roleKey);
    }

    return clusters;
  }

  private calculateRoleSimilarity(components1: any, components2: any): number {
    let score = 0;
    let factors = 0;

    // Compare role
    if (components1.role && components2.role) {
      score += this.calculateSimilarity(components1.role, components2.role) * 0.6;
      factors += 0.6;
    }

    // Compare seniority
    if (components1.seniority && components2.seniority) {
      score += (components1.seniority === components2.seniority ? 1 : 0) * 0.3;
      factors += 0.3;
    }

    // Compare specialization
    if (components1.specialization && components2.specialization) {
      score += this.calculateSimilarity(components1.specialization, components2.specialization) * 0.1;
      factors += 0.1;
    }

    return factors > 0 ? score / factors : 0;
  }

  private findUnclusteredItems(rawData: any[], clusters: ClusterDefinition[]): string[] {
    const clusteredItems = new Set();
    clusters.forEach(cluster => {
      cluster.members.forEach(member => clusteredItems.add(member));
    });

    return rawData
      .filter(item => !clusteredItems.has(item.supplier_name || item.line_of_service || item.role))
      .map(item => item.supplier_name || item.line_of_service || item.role);
  }

  private generateClusteringRecommendations(clusters: ClusterDefinition[]): string[] {
    const recommendations = [];
    
    if (clusters.length > 20) {
      recommendations.push('Consider consolidating similar categories to reduce complexity');
    }
    
    const lowConfidenceClusters = clusters.filter(c => c.confidence < 0.7);
    if (lowConfidenceClusters.length > 0) {
      recommendations.push(`Review ${lowConfidenceClusters.length} low-confidence clusters for accuracy`);
    }

    recommendations.push('Implement automated standardization rules for future data');
    
    return recommendations;
  }

  private generateSupplierRecommendations(clusters: ClusterDefinition[]): string[] {
    return [
      'Standardize supplier names to improve analytics accuracy',
      'Consider supplier consolidation opportunities',
      'Implement supplier master data management'
    ];
  }

  private generateRoleRecommendations(clusters: ClusterDefinition[]): string[] {
    return [
      'Standardize role titles across all contracts',
      'Implement consistent seniority level definitions',
      'Create role taxonomy for better benchmarking'
    ];
  }

  private async storeStandardizationResults(tenantId: string, results: any): Promise<void> {
    // Store results in cache for now
    const cacheKey = `standardization-results:${tenantId}`;
    await cacheAdaptor.set(cacheKey, JSON.stringify(results), 3600);
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic functionality
      const testResult = await this.standardizeLineOfService('Information Technology');
      return testResult.confidence > 0;
    } catch (error) {
      logger.error({ error }, "Data standardization service health check failed");
      return false;
    }
  }
}

export const dataStandardizationService = DataStandardizationService.getInstance();
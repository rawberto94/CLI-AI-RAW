/**
 * Rate Card Intelligence Service
 * 
 * Provides comprehensive intelligence and analytics for rate card data
 * across the entire contract portfolio.
 */

import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import { analyticalEventPublisher } from "../events/analytical-event-publisher";
import { analyticalDatabaseService } from "./analytical-database.service";
import { 
  EnhancedRateCardFilters, 
  EnhancedRateFilters,
  EnhancedRateCard,
  EnhancedRate 
} from "../types/enhanced-rate-card.types";
import { enhancedRateAnalyticsService } from "./enhanced-rate-analytics.service";
import pino from "pino";

const logger = pino({ name: "rate-card-intelligence-service" });

// Legacy types for backward compatibility
export interface RateCardFilters extends EnhancedRateCardFilters {
  category?: string; // Maps to lineOfService
}

export interface RateFilters extends EnhancedRateFilters {
  level?: string; // Maps to seniorityLevel
}

export interface RateAnalytics {
  totalRateCards: number;
  totalRates: number;
  averageRate: number;
  rateVariance: number;
  marketPosition: string;
  trendDirection: string;
  confidenceScore: number;
  topSuppliers: Array<{
    supplierId: string;
    supplierName?: string;
    averageRate: number;
    rateCount: number;
    marketPosition: number;
  }>;
  roleDistribution: Array<{
    role: string;
    count: number;
    averageRate: number;
    marketVariance: number;
  }>;
  // Enhanced analytics
  lineOfServiceBreakdown?: Array<{
    service: string;
    averageRate: number;
    rateCount: number;
    marketPosition: number;
  }>;
  seniorityProgression?: Array<{
    level: string;
    averageRate: number;
    rateCount: number;
  }>;
}

export interface TrendAnalysis {
  overallTrend: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number;
  periodOverPeriodChange: number;
  roleSpecificTrends: Array<{
    role: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercentage: number;
    confidence: number;
  }>;
  seasonalPatterns: number[];
  forecast: Array<{
    period: string;
    predictedRate: number;
    confidence: number;
  }>;
}

export interface SupplierComparison {
  suppliers: Array<{
    supplierId: string;
    supplierName: string;
    averageRate: number;
    rateCount: number;
    marketPosition: number;
    strengths: string[];
    weaknesses: string[];
    recommendedAction: string;
  }>;
  marketLeader: string;
  costLeader: string;
  recommendations: string[];
}

export interface QueryResult {
  query: string;
  results: any[];
  summary: string;
  confidence: number;
  suggestions: string[];
  visualizationType?: 'table' | 'chart' | 'comparison' | 'trend';
}

export class RateCardIntelligenceService {
  private static instance: RateCardIntelligenceService;

  private constructor() {}

  static getInstance(): RateCardIntelligenceService {
    if (!RateCardIntelligenceService.instance) {
      RateCardIntelligenceService.instance = new RateCardIntelligenceService();
    }
    return RateCardIntelligenceService.instance;
  }

  // ============================================================================
  // REPOSITORY QUERIES
  // ============================================================================

  /**
   * Get all rate cards with enhanced filtering
   */
  async getAllRateCards(filters: RateCardFilters = {}): Promise<any[]> {
    try {
      logger.info({ filters }, "Getting all rate cards with enhanced filtering");

      const whereConditions = [];
      const params: any[] = [];

      if (filters.tenantId) {
        whereConditions.push("rc.tenant_id = ?");
        params.push(filters.tenantId);
      }

      if (filters.supplierId) {
        whereConditions.push("rc.supplier_id = ?");
        params.push(filters.supplierId);
      }

      if (filters.region) {
        whereConditions.push("rc.region = ?");
        params.push(filters.region);
      }

      if (filters.deliveryModel) {
        whereConditions.push("rc.delivery_model = ?");
        params.push(filters.deliveryModel);
      }

      // Enhanced filters
      if (filters.lineOfService || filters.category) {
        whereConditions.push("rc.line_of_service = ?");
        params.push(filters.lineOfService || filters.category);
      }

      if (filters.country) {
        whereConditions.push("rc.country = ?");
        params.push(filters.country);
      }

      if (filters.stateProvince) {
        whereConditions.push("rc.state_province = ?");
        params.push(filters.stateProvince);
      }

      if (filters.city) {
        whereConditions.push("rc.city = ?");
        params.push(filters.city);
      }

      if (filters.engagementModel) {
        whereConditions.push("rc.engagement_model = ?");
        params.push(filters.engagementModel);
      }

      if (filters.businessUnit) {
        whereConditions.push("rc.business_unit = ?");
        params.push(filters.businessUnit);
      }

      if (filters.approvalStatus) {
        whereConditions.push("rc.approval_status = ?");
        params.push(filters.approvalStatus);
      }

      if (filters.effectiveDateFrom || filters.dateFrom) {
        whereConditions.push("rc.effective_date >= ?");
        params.push((filters.effectiveDateFrom || filters.dateFrom)!.toISOString());
      }

      if (filters.effectiveDateTo || filters.dateTo) {
        whereConditions.push("rc.effective_date <= ?");
        params.push((filters.effectiveDateTo || filters.dateTo)!.toISOString());
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

      const query = `
        SELECT 
          rc.*,
          los.service_category,
          los.subcategory as service_subcategory,
          ga.cost_of_living_index as location_cost_index,
          COUNT(r.id) as rate_count,
          AVG(r.hourly_rate) as average_rate,
          MIN(r.hourly_rate) as min_rate,
          MAX(r.hourly_rate) as max_rate,
          c.contract_title,
          c.supplier_name
        FROM rate_cards rc
        LEFT JOIN rates r ON rc.id = r.rate_card_id
        LEFT JOIN contracts c ON rc.contract_id = c.id
        LEFT JOIN line_of_service_taxonomy los ON rc.line_of_service = los.service_name AND rc.tenant_id = los.tenant_id
        LEFT JOIN geographic_adjustments ga ON rc.country = ga.country 
          AND (rc.state_province = ga.state_province OR ga.state_province IS NULL)
          AND (rc.city = ga.city OR ga.city IS NULL)
        ${whereClause}
        GROUP BY rc.id
        ORDER BY rc.effective_date DESC
      `;

      const rateCards = await dbAdaptor.prisma.$queryRawUnsafe(query, ...params);

      logger.info({ count: rateCards.length }, "Retrieved enhanced rate cards");
      return rateCards as any[];

    } catch (error) {
      logger.error({ error, filters }, "Failed to get enhanced rate cards");
      throw error;
    }
  }

  /**
   * Get rates by role with enhanced filtering
   */
  async getRatesByRole(role: string, filters: RateFilters = {}): Promise<any[]> {
    try {
      logger.info({ role, filters }, "Getting rates by role with enhanced filtering");

      const whereConditions = ["r.role = ?"];
      const params: any[] = [role];

      if (filters.tenantId) {
        whereConditions.push("rc.tenant_id = ?");
        params.push(filters.tenantId);
      }

      // Enhanced seniority filtering
      if (filters.seniorityLevel || filters.level) {
        whereConditions.push("r.seniority_level = ?");
        params.push(filters.seniorityLevel || filters.level);
      }

      if (filters.region) {
        whereConditions.push("rc.region = ?");
        params.push(filters.region);
      }

      if (filters.country) {
        whereConditions.push("rc.country = ?");
        params.push(filters.country);
      }

      if (filters.lineOfService) {
        whereConditions.push("rc.line_of_service = ?");
        params.push(filters.lineOfService);
      }

      if (filters.engagementModel) {
        whereConditions.push("rc.engagement_model = ?");
        params.push(filters.engagementModel);
      }

      if (filters.rateType) {
        whereConditions.push("r.rate_type = ?");
        params.push(filters.rateType);
      }

      if (filters.minExperience) {
        whereConditions.push("r.minimum_experience_years >= ?");
        params.push(filters.minExperience);
      }

      if (filters.maxExperience) {
        whereConditions.push("r.minimum_experience_years <= ?");
        params.push(filters.maxExperience);
      }

      if (filters.remoteWorkAllowed !== undefined) {
        whereConditions.push("r.remote_work_allowed = ?");
        params.push(filters.remoteWorkAllowed);
      }

      if (filters.securityClearanceRequired !== undefined) {
        whereConditions.push("r.security_clearance_required = ?");
        params.push(filters.securityClearanceRequired);
      }

      if (filters.maxTravelPercentage !== undefined) {
        whereConditions.push("r.travel_percentage <= ?");
        params.push(filters.maxTravelPercentage);
      }

      if (filters.minRate) {
        whereConditions.push("r.hourly_rate >= ?");
        params.push(filters.minRate);
      }

      if (filters.maxRate) {
        whereConditions.push("r.hourly_rate <= ?");
        params.push(filters.maxRate);
      }

      const query = `
        SELECT 
          r.*,
          rc.supplier_id,
          rc.region,
          rc.delivery_model,
          rc.currency,
          rc.effective_date,
          rc.line_of_service,
          rc.country,
          rc.state_province,
          rc.city,
          rc.engagement_model,
          rc.business_unit,
          sd.level_order as seniority_order,
          c.supplier_name,
          c.contract_title
        FROM rates r
        JOIN rate_cards rc ON r.rate_card_id = rc.id
        JOIN contracts c ON rc.contract_id = c.id
        LEFT JOIN seniority_definitions sd ON r.seniority_level = sd.level_name AND rc.tenant_id = sd.tenant_id
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY r.hourly_rate DESC
      `;

      const rates = await dbAdaptor.prisma.$queryRawUnsafe(query, ...params);

      logger.info({ role, count: rates.length }, "Retrieved enhanced rates by role");
      return rates as any[];

    } catch (error) {
      logger.error({ error, role, filters }, "Failed to get enhanced rates by role");
      throw error;
    }
  }

  /**
   * Get rates by supplier
   */
  async getRatesBySupplier(supplierId: string, tenantId: string = 'default'): Promise<any[]> {
    try {
      logger.info({ supplierId, tenantId }, "Getting rates by supplier");

      const query = `
        SELECT 
          r.*,
          rc.region,
          rc.delivery_model,
          rc.currency,
          rc.effective_date,
          c.contract_title
        FROM rates r
        JOIN rate_cards rc ON r.rate_card_id = rc.id
        JOIN contracts c ON rc.contract_id = c.id
        WHERE rc.supplier_id = ? AND rc.tenant_id = ?
        ORDER BY rc.effective_date DESC, r.role, r.level
      `;

      const rates = await dbAdaptor.prisma.$queryRawUnsafe(query, supplierId, tenantId);

      logger.info({ supplierId, count: rates.length }, "Retrieved rates by supplier");
      return rates as any[];

    } catch (error) {
      logger.error({ error, supplierId }, "Failed to get rates by supplier");
      throw error;
    }
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  /**
   * Generate comprehensive rate analytics
   */
  async generateRateAnalytics(tenantId: string = 'default', period: string = '12M'): Promise<RateAnalytics> {
    try {
      logger.info({ tenantId, period }, "Generating rate analytics");

      // Get basic statistics
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT rc.id) as total_rate_cards,
          COUNT(r.id) as total_rates,
          AVG(r.hourly_rate) as average_rate,
          STDEV(r.hourly_rate) as rate_variance
        FROM rate_cards rc
        LEFT JOIN rates r ON rc.id = r.rate_card_id
        WHERE rc.tenant_id = ?
      `;

      const [stats] = await dbAdaptor.prisma.$queryRawUnsafe(statsQuery, tenantId) as any[];

      // Get top suppliers
      const suppliersQuery = `
        SELECT 
          rc.supplier_id,
          c.supplier_name,
          COUNT(r.id) as rate_count,
          AVG(r.hourly_rate) as average_rate
        FROM rate_cards rc
        JOIN contracts c ON rc.contract_id = c.id
        LEFT JOIN rates r ON rc.id = r.rate_card_id
        WHERE rc.tenant_id = ?
        GROUP BY rc.supplier_id, c.supplier_name
        ORDER BY average_rate DESC
        LIMIT 10
      `;

      const topSuppliers = await dbAdaptor.prisma.$queryRawUnsafe(suppliersQuery, tenantId) as any[];

      // Get role distribution
      const rolesQuery = `
        SELECT 
          r.role,
          COUNT(r.id) as count,
          AVG(r.hourly_rate) as average_rate
        FROM rates r
        JOIN rate_cards rc ON r.rate_card_id = rc.id
        WHERE rc.tenant_id = ?
        GROUP BY r.role
        ORDER BY average_rate DESC
      `;

      const roleDistribution = await dbAdaptor.prisma.$queryRawUnsafe(rolesQuery, tenantId) as any[];

      // Calculate market position (mock for now)
      const marketPosition = this.calculateMarketPosition(stats.average_rate);
      const trendDirection = await this.calculateTrendDirection(tenantId);

      // Get enhanced analytics from the new service
      const lineOfServiceAnalytics = await enhancedRateAnalyticsService.analyzeByLineOfService(tenantId);
      const seniorityAnalytics = await enhancedRateAnalyticsService.analyzeBySeniority(tenantId);

      const analytics: RateAnalytics = {
        totalRateCards: stats.total_rate_cards || 0,
        totalRates: stats.total_rates || 0,
        averageRate: stats.average_rate || 0,
        rateVariance: stats.rate_variance || 0,
        marketPosition,
        trendDirection,
        confidenceScore: this.calculateConfidenceScore(stats.total_rates || 0),
        topSuppliers: topSuppliers.map((supplier: any) => ({
          supplierId: supplier.supplier_id,
          supplierName: supplier.supplier_name,
          averageRate: supplier.average_rate || 0,
          rateCount: supplier.rate_count || 0,
          marketPosition: this.calculateSupplierMarketPosition(supplier.average_rate || 0)
        })),
        roleDistribution: roleDistribution.map((role: any) => ({
          role: role.role,
          count: role.count || 0,
          averageRate: role.average_rate || 0,
          marketVariance: this.calculateMarketVariance(role.average_rate || 0)
        })),
        // Enhanced analytics
        lineOfServiceBreakdown: lineOfServiceAnalytics.serviceBreakdown,
        seniorityProgression: seniorityAnalytics.seniorityProgression
      };

      // Cache analytics
      const cacheKey = `rate-analytics:${tenantId}:${period}`;
      await cacheAdaptor.set(cacheKey, JSON.stringify(analytics), 1800); // 30 minutes

      logger.info({ tenantId, analytics }, "Generated rate analytics");
      return analytics;

    } catch (error) {
      logger.error({ error, tenantId, period }, "Failed to generate rate analytics");
      throw error;
    }
  }

  /**
   * Analyze rate trends over time
   */
  async analyzeTrends(tenantId: string = 'default', timeframe: string = '24M'): Promise<TrendAnalysis> {
    try {
      logger.info({ tenantId, timeframe }, "Analyzing rate trends");

      // Get historical rate data
      const trendsQuery = `
        SELECT 
          r.role,
          r.hourly_rate,
          rc.effective_date,
          strftime('%Y-%m', rc.effective_date) as period
        FROM rates r
        JOIN rate_cards rc ON r.rate_card_id = rc.id
        WHERE rc.tenant_id = ?
        AND rc.effective_date >= date('now', '-24 months')
        ORDER BY rc.effective_date
      `;

      const historicalRates = await dbAdaptor.prisma.$queryRawUnsafe(trendsQuery, tenantId) as any[];

      // Calculate overall trend
      const overallTrend = this.calculateOverallTrend(historicalRates);
      const trendStrength = this.calculateTrendStrength(historicalRates);
      const periodOverPeriodChange = this.calculatePeriodOverPeriodChange(historicalRates);

      // Calculate role-specific trends
      const roleSpecificTrends = this.calculateRoleSpecificTrends(historicalRates);

      // Generate forecast
      const forecast = this.generateRateForecast(historicalRates, 6); // 6 months ahead

      const trendAnalysis: TrendAnalysis = {
        overallTrend,
        trendStrength,
        periodOverPeriodChange,
        roleSpecificTrends,
        seasonalPatterns: this.identifySeasonalPatterns(historicalRates),
        forecast
      };

      logger.info({ tenantId, trendAnalysis }, "Analyzed rate trends");
      return trendAnalysis;

    } catch (error) {
      logger.error({ error, tenantId, timeframe }, "Failed to analyze trends");
      throw error;
    }
  }

  /**
   * Compare suppliers across multiple dimensions
   */
  async compareSuppliers(supplierIds: string[], tenantId: string = 'default'): Promise<SupplierComparison> {
    try {
      logger.info({ supplierIds, tenantId }, "Comparing suppliers");

      const suppliers = [];

      for (const supplierId of supplierIds) {
        const rates = await this.getRatesBySupplier(supplierId, tenantId);
        
        if (rates.length > 0) {
          const averageRate = rates.reduce((sum, rate) => sum + (rate.hourly_rate || 0), 0) / rates.length;
          const marketPosition = this.calculateSupplierMarketPosition(averageRate);
          
          suppliers.push({
            supplierId,
            supplierName: rates[0]?.supplier_name || supplierId,
            averageRate,
            rateCount: rates.length,
            marketPosition,
            strengths: this.identifySupplierStrengths(rates),
            weaknesses: this.identifySupplierWeaknesses(rates),
            recommendedAction: this.generateSupplierRecommendation(averageRate, marketPosition)
          });
        }
      }

      // Identify leaders
      const marketLeader = suppliers.reduce((leader, supplier) => 
        supplier.marketPosition > leader.marketPosition ? supplier : leader
      ).supplierId;

      const costLeader = suppliers.reduce((leader, supplier) => 
        supplier.averageRate < leader.averageRate ? supplier : leader
      ).supplierId;

      const comparison: SupplierComparison = {
        suppliers,
        marketLeader,
        costLeader,
        recommendations: this.generateComparisonRecommendations(suppliers)
      };

      logger.info({ supplierIds, comparison }, "Completed supplier comparison");
      return comparison;

    } catch (error) {
      logger.error({ error, supplierIds }, "Failed to compare suppliers");
      throw error;
    }
  }

  // ============================================================================
  // NATURAL LANGUAGE QUERIES
  // ============================================================================

  /**
   * Process natural language queries about rate data
   */
  async queryRateData(query: string, tenantId: string = 'default'): Promise<QueryResult> {
    try {
      logger.info({ query, tenantId }, "Processing natural language query");

      // Parse query intent
      const intent = this.parseQueryIntent(query);
      let results: any[] = [];
      let summary = "";
      let visualizationType: 'table' | 'chart' | 'comparison' | 'trend' = 'table';

      switch (intent.type) {
        case 'rate_lookup':
          results = await this.handleRateLookupQuery(intent, tenantId);
          summary = `Found ${results.length} rates matching your criteria`;
          visualizationType = 'table';
          break;

        case 'supplier_comparison':
          const comparison = await this.handleSupplierComparisonQuery(intent, tenantId);
          results = comparison.suppliers;
          summary = `Compared ${results.length} suppliers`;
          visualizationType = 'comparison';
          break;

        case 'trend_analysis':
          const trends = await this.handleTrendAnalysisQuery(intent, tenantId);
          results = trends.roleSpecificTrends;
          summary = `Analyzed trends showing ${trends.overallTrend} pattern`;
          visualizationType = 'trend';
          break;

        case 'market_position':
          results = await this.handleMarketPositionQuery(intent, tenantId);
          summary = `Analyzed market position for ${results.length} items`;
          visualizationType = 'chart';
          break;

        default:
          // Fallback to general search
          results = await this.handleGeneralQuery(query, tenantId);
          summary = `Found ${results.length} results for your query`;
      }

      const queryResult: QueryResult = {
        query,
        results,
        summary,
        confidence: this.calculateQueryConfidence(intent, results),
        suggestions: this.generateQuerySuggestions(query, intent),
        visualizationType
      };

      // Store query history
      await analyticalDatabaseService.createQueryHistory({
        sessionId: `session_${Date.now()}`,
        tenantId,
        query,
        response: queryResult,
        confidence: queryResult.confidence,
        responseTime: Date.now()
      });

      logger.info({ query, resultCount: results.length }, "Processed natural language query");
      return queryResult;

    } catch (error) {
      logger.error({ error, query }, "Failed to process natural language query");
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private calculateMarketPosition(averageRate: number): string {
    // Mock market position calculation
    if (averageRate > 180) return 'Above P90';
    if (averageRate > 160) return 'Above P75';
    if (averageRate > 140) return 'Above P50';
    if (averageRate > 120) return 'Above P25';
    return 'Below P25';
  }

  private async calculateTrendDirection(tenantId: string): Promise<string> {
    // Mock trend calculation
    return Math.random() > 0.5 ? 'increasing' : 'stable';
  }

  private calculateConfidenceScore(sampleSize: number): number {
    if (sampleSize >= 100) return 0.95;
    if (sampleSize >= 50) return 0.85;
    if (sampleSize >= 20) return 0.75;
    return 0.65;
  }

  private calculateSupplierMarketPosition(averageRate: number): number {
    // Return percentile (0-100)
    return Math.min(100, Math.max(0, (averageRate - 80) / 2));
  }

  private calculateMarketVariance(averageRate: number): number {
    // Mock market variance calculation
    const marketAverage = 150; // Mock market average
    return ((averageRate - marketAverage) / marketAverage) * 100;
  }

  private calculateOverallTrend(historicalRates: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (historicalRates.length < 2) return 'stable';
    
    const firstHalf = historicalRates.slice(0, Math.floor(historicalRates.length / 2));
    const secondHalf = historicalRates.slice(Math.floor(historicalRates.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, r) => sum + (r.hourly_rate || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, r) => sum + (r.hourly_rate || 0), 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  private calculateTrendStrength(historicalRates: any[]): number {
    // Mock trend strength calculation (0-1)
    return Math.random() * 0.5 + 0.5;
  }

  private calculatePeriodOverPeriodChange(historicalRates: any[]): number {
    // Mock period over period change
    return (Math.random() - 0.5) * 20; // -10% to +10%
  }

  private calculateRoleSpecificTrends(historicalRates: any[]): Array<{
    role: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercentage: number;
    confidence: number;
  }> {
    const roleGroups = historicalRates.reduce((groups, rate) => {
      if (!groups[rate.role]) groups[rate.role] = [];
      groups[rate.role].push(rate);
      return groups;
    }, {} as Record<string, any[]>);

    return Object.entries(roleGroups).map(([role, rates]) => ({
      role,
      trend: this.calculateOverallTrend(rates),
      changePercentage: (Math.random() - 0.5) * 20,
      confidence: Math.random() * 0.3 + 0.7
    }));
  }

  private identifySeasonalPatterns(historicalRates: any[]): number[] {
    // Mock seasonal patterns (12 months)
    return Array.from({ length: 12 }, () => Math.random() * 0.2 + 0.9);
  }

  private generateRateForecast(historicalRates: any[], months: number): Array<{
    period: string;
    predictedRate: number;
    confidence: number;
  }> {
    const baseRate = historicalRates.length > 0 
      ? historicalRates.reduce((sum, r) => sum + (r.hourly_rate || 0), 0) / historicalRates.length
      : 150;

    return Array.from({ length: months }, (_, i) => ({
      period: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
      predictedRate: baseRate * (1 + (Math.random() - 0.5) * 0.1),
      confidence: Math.random() * 0.3 + 0.7
    }));
  }

  private identifySupplierStrengths(rates: any[]): string[] {
    const strengths = [];
    const avgRate = rates.reduce((sum, r) => sum + (r.hourly_rate || 0), 0) / rates.length;
    
    if (avgRate < 140) strengths.push('Competitive Pricing');
    if (rates.length > 10) strengths.push('Comprehensive Rate Card');
    if (rates.some(r => r.role.includes('Senior'))) strengths.push('Senior Talent');
    
    return strengths;
  }

  private identifySupplierWeaknesses(rates: any[]): string[] {
    const weaknesses = [];
    const avgRate = rates.reduce((sum, r) => sum + (r.hourly_rate || 0), 0) / rates.length;
    
    if (avgRate > 180) weaknesses.push('Above Market Pricing');
    if (rates.length < 5) weaknesses.push('Limited Role Coverage');
    
    return weaknesses;
  }

  private generateSupplierRecommendation(averageRate: number, marketPosition: number): string {
    if (averageRate > 180) return 'Negotiate rate reduction';
    if (marketPosition < 25) return 'Consider for cost-sensitive projects';
    if (marketPosition > 75) return 'Premium supplier - use for critical projects';
    return 'Maintain current relationship';
  }

  private generateComparisonRecommendations(suppliers: any[]): string[] {
    const recommendations = [];
    
    if (suppliers.length > 1) {
      const avgRate = suppliers.reduce((sum, s) => sum + s.averageRate, 0) / suppliers.length;
      const highestRate = Math.max(...suppliers.map(s => s.averageRate));
      
      if (highestRate > avgRate * 1.2) {
        recommendations.push('Consider consolidating with lower-cost suppliers');
      }
      
      recommendations.push('Negotiate volume discounts with preferred suppliers');
      recommendations.push('Establish rate benchmarking process');
    }
    
    return recommendations;
  }

  private parseQueryIntent(query: string): { type: string; parameters: any } {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('compare') || lowerQuery.includes('vs')) {
      return { type: 'supplier_comparison', parameters: {} };
    }
    
    if (lowerQuery.includes('trend') || lowerQuery.includes('over time')) {
      return { type: 'trend_analysis', parameters: {} };
    }
    
    if (lowerQuery.includes('market') || lowerQuery.includes('position')) {
      return { type: 'market_position', parameters: {} };
    }
    
    if (lowerQuery.includes('rate') || lowerQuery.includes('price')) {
      return { type: 'rate_lookup', parameters: {} };
    }
    
    return { type: 'general', parameters: {} };
  }

  private async handleRateLookupQuery(intent: any, tenantId: string): Promise<any[]> {
    // Mock rate lookup
    return await this.getAllRateCards({ tenantId });
  }

  private async handleSupplierComparisonQuery(intent: any, tenantId: string): Promise<any> {
    // Get top suppliers for comparison
    const rateCards = await this.getAllRateCards({ tenantId });
    const supplierIds = [...new Set(rateCards.map(rc => rc.supplier_id))].slice(0, 3);
    return await this.compareSuppliers(supplierIds, tenantId);
  }

  private async handleTrendAnalysisQuery(intent: any, tenantId: string): Promise<any> {
    return await this.analyzeTrends(tenantId);
  }

  private async handleMarketPositionQuery(intent: any, tenantId: string): Promise<any[]> {
    const analytics = await this.generateRateAnalytics(tenantId);
    return analytics.roleDistribution;
  }

  private async handleGeneralQuery(query: string, tenantId: string): Promise<any[]> {
    // Fallback to general rate card search
    return await this.getAllRateCards({ tenantId });
  }

  private calculateQueryConfidence(intent: any, results: any[]): number {
    if (results.length === 0) return 0.3;
    if (results.length > 10) return 0.9;
    return 0.7;
  }

  private generateQuerySuggestions(query: string, intent: any): string[] {
    return [
      "Show me rates above $150/hour",
      "Compare supplier rates for developers",
      "What's the trend for consultant rates?",
      "Which suppliers have the best rates?"
    ];
  }

  // ============================================================================
  // ENHANCED ANALYTICS METHODS
  // ============================================================================

  /**
   * Analyze rates by line of service
   */
  async analyzeByLineOfService(tenantId: string = 'default', filters?: RateCardFilters) {
    try {
      logger.info({ tenantId, filters }, "Analyzing rates by line of service");
      return await enhancedRateAnalyticsService.analyzeByLineOfService(tenantId, filters);
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to analyze by line of service");
      throw error;
    }
  }

  /**
   * Analyze rates by seniority level
   */
  async analyzeBySeniority(tenantId: string = 'default', filters?: RateFilters) {
    try {
      logger.info({ tenantId, filters }, "Analyzing rates by seniority");
      return await enhancedRateAnalyticsService.analyzeBySeniority(tenantId, filters);
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to analyze by seniority");
      throw error;
    }
  }

  /**
   * Analyze rates by geography
   */
  async analyzeByGeography(tenantId: string = 'default', filters?: RateFilters) {
    try {
      logger.info({ tenantId, filters }, "Analyzing rates by geography");
      return await enhancedRateAnalyticsService.analyzeByGeography(tenantId, filters);
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to analyze by geography");
      throw error;
    }
  }

  /**
   * Analyze skill and certification premiums
   */
  async analyzeSkillPremiums(tenantId: string = 'default', filters?: RateFilters) {
    try {
      logger.info({ tenantId, filters }, "Analyzing skill premiums");
      return await enhancedRateAnalyticsService.analyzeSkillPremiums(tenantId, filters);
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to analyze skill premiums");
      throw error;
    }
  }

  /**
   * Generate market benchmarks for specific criteria
   */
  async generateMarketBenchmarks(
    role: string, 
    seniority: string, 
    country: string,
    tenantId: string = 'default'
  ) {
    try {
      logger.info({ role, seniority, country, tenantId }, "Generating market benchmarks");
      
      const location = { country };
      return await enhancedRateAnalyticsService.generateMarketBenchmarks(
        role, 
        seniority as any, 
        location, 
        tenantId
      );
    } catch (error) {
      logger.error({ error, role, seniority, country }, "Failed to generate market benchmarks");
      throw error;
    }
  }

  /**
   * Get comprehensive enhanced analytics
   */
  async getEnhancedAnalytics(tenantId: string = 'default', filters?: RateFilters) {
    try {
      logger.info({ tenantId, filters }, "Getting comprehensive enhanced analytics");

      const [
        lineOfServiceAnalytics,
        seniorityAnalytics,
        geographicAnalytics,
        skillPremiumAnalytics
      ] = await Promise.all([
        this.analyzeByLineOfService(tenantId, filters),
        this.analyzeBySeniority(tenantId, filters),
        this.analyzeByGeography(tenantId, filters),
        this.analyzeSkillPremiums(tenantId, filters)
      ]);

      return {
        lineOfServiceAnalytics,
        seniorityAnalytics,
        geographicAnalytics,
        skillPremiumAnalytics,
        summary: {
          totalServices: lineOfServiceAnalytics.totalServices,
          totalSeniorityLevels: seniorityAnalytics.totalLevels,
          totalLocations: geographicAnalytics.totalLocations,
          avgRateAcrossServices: lineOfServiceAnalytics.avgRateAcrossServices,
          avgProgressionIncrease: seniorityAnalytics.avgProgressionIncrease,
          avgCostOfLiving: geographicAnalytics.avgCostOfLiving
        }
      };

    } catch (error) {
      logger.error({ error, tenantId }, "Failed to get enhanced analytics");
      throw error;
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const dbHealth = await analyticalDatabaseService.healthCheck();
      const enhancedHealth = await enhancedRateAnalyticsService.healthCheck();
      return dbHealth.success && enhancedHealth;
    } catch (error) {
      logger.error({ error }, "Rate card intelligence service health check failed");
      return false;
    }
  }
}

export const rateCardIntelligenceService = RateCardIntelligenceService.getInstance();
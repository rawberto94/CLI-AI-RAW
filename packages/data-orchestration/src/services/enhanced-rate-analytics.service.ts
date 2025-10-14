/**
 * Enhanced Rate Analytics Service
 * 
 * Provides comprehensive analytics for the enhanced rate card system including:
 * - Line of service analysis and comparisons
 * - Seniority progression and gap analysis
 * - Geographic rate variations and arbitrage opportunities
 * - Skill and certification premium analysis
 * - Market benchmarking and positioning
 */

import {
  EnhancedRateCardFilters,
  EnhancedRateFilters,
  LineOfServiceAnalytics,
  SeniorityAnalytics,
  GeographicAnalytics,
  SkillPremiumAnalytics,
  MarketBenchmark,
  CostAnalysis,
  ServiceComparison,
  CareerPath,
  SeniorityGap,
  GeoHeatMapPoint,
  ArbitrageOpportunity,
  Location,
  TrendDirection,
  ServiceCategory,
  SeniorityLevel,
  SkillCategory,
  MarketDemand
} from "../types/enhanced-rate-card.types";
import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import { rateCalculationEngine } from "./rate-calculation.engine";
import pino from "pino";

const logger = pino({ name: "enhanced-rate-analytics-service" });

export class EnhancedRateAnalyticsService {
  private static instance: EnhancedRateAnalyticsService;

  private constructor() {}

  static getInstance(): EnhancedRateAnalyticsService {
    if (!EnhancedRateAnalyticsService.instance) {
      EnhancedRateAnalyticsService.instance = new EnhancedRateAnalyticsService();
    }
    return EnhancedRateAnalyticsService.instance;
  }

  // ============================================================================
  // LINE OF SERVICE ANALYTICS
  // ============================================================================

  /**
   * Analyze rates by line of service
   */
  async analyzeByLineOfService(tenantId: string, filters?: EnhancedRateCardFilters): Promise<LineOfServiceAnalytics> {
    try {
      logger.info({ tenantId, filters }, "Analyzing rates by line of service");

      const cacheKey = `los-analytics:${tenantId}:${JSON.stringify(filters)}`;
      const cached = await cacheAdaptor.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build WHERE conditions
      const whereConditions = ["rc.tenant_id = ?"];
      const params: any[] = [tenantId];

      if (filters?.country) {
        whereConditions.push("rc.country = ?");
        params.push(filters.country);
      }

      if (filters?.engagementModel) {
        whereConditions.push("rc.engagement_model = ?");
        params.push(filters.engagementModel);
      }

      if (filters?.approvalStatus) {
        whereConditions.push("rc.approval_status = ?");
        params.push(filters.approvalStatus);
      }

      const whereClause = whereConditions.join(" AND ");

      // Get service breakdown
      const serviceQuery = `
        SELECT 
          rc.line_of_service,
          los.service_category,
          COUNT(r.id) as rate_count,
          AVG(r.hourly_rate) as average_rate,
          MIN(r.hourly_rate) as min_rate,
          MAX(r.hourly_rate) as max_rate,
          STDEV(r.hourly_rate) as rate_variance,
          GROUP_CONCAT(DISTINCT r.role) as top_roles
        FROM rate_cards rc
        JOIN rates r ON rc.id = r.rate_card_id
        LEFT JOIN line_of_service_taxonomy los ON rc.line_of_service = los.service_name AND rc.tenant_id = los.tenant_id
        WHERE ${whereClause}
        AND rc.line_of_service IS NOT NULL
        GROUP BY rc.line_of_service, los.service_category
        ORDER BY average_rate DESC
      `;

      const serviceBreakdown = await dbAdaptor.prisma.$queryRawUnsafe(serviceQuery, ...params) as any[];

      // Calculate market positions and trends
      const enhancedBreakdown = serviceBreakdown.map((service: any) => ({
        service: service.line_of_service,
        serviceCategory: service.service_category as ServiceCategory,
        averageRate: service.average_rate || 0,
        rateCount: service.rate_count || 0,
        marketPosition: this.calculateMarketPosition(service.average_rate || 0, serviceBreakdown),
        trendDirection: this.calculateTrendDirection(service.average_rate || 0, service.rate_variance || 0) as TrendDirection,
        topRoles: service.top_roles ? service.top_roles.split(',').slice(0, 5) : []
      }));

      // Generate cross-service comparisons
      const crossServiceComparison = this.generateServiceComparisons(enhancedBreakdown);

      // Generate recommendations
      const recommendations = this.generateLineOfServiceRecommendations(enhancedBreakdown);

      const analytics: LineOfServiceAnalytics = {
        serviceBreakdown: enhancedBreakdown,
        crossServiceComparison,
        recommendations,
        totalServices: enhancedBreakdown.length,
        avgRateAcrossServices: enhancedBreakdown.reduce((sum, s) => sum + s.averageRate, 0) / enhancedBreakdown.length
      };

      // Cache results
      await cacheAdaptor.set(cacheKey, JSON.stringify(analytics), 1800); // 30 minutes

      logger.info({ 
        tenantId, 
        totalServices: analytics.totalServices,
        avgRate: analytics.avgRateAcrossServices 
      }, "Completed line of service analysis");

      return analytics;

    } catch (error) {
      logger.error({ error, tenantId, filters }, "Failed to analyze by line of service");
      throw error;
    }
  }

  // ============================================================================
  // SENIORITY ANALYTICS
  // ============================================================================

  /**
   * Analyze rates by seniority level
   */
  async analyzeBySeniority(tenantId: string, filters?: EnhancedRateFilters): Promise<SeniorityAnalytics> {
    try {
      logger.info({ tenantId, filters }, "Analyzing rates by seniority");

      const cacheKey = `seniority-analytics:${tenantId}:${JSON.stringify(filters)}`;
      const cached = await cacheAdaptor.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build WHERE conditions
      const whereConditions = ["rc.tenant_id = ?"];
      const params: any[] = [tenantId];

      if (filters?.role) {
        whereConditions.push("r.role = ?");
        params.push(filters.role);
      }

      if (filters?.lineOfService) {
        whereConditions.push("rc.line_of_service = ?");
        params.push(filters.lineOfService);
      }

      const whereClause = whereConditions.join(" AND ");

      // Get seniority progression data
      const seniorityQuery = `
        SELECT 
          r.seniority_level,
          sd.level_order,
          sd.min_experience_years,
          sd.max_experience_years,
          COUNT(r.id) as role_count,
          AVG(r.hourly_rate) as average_rate,
          MIN(r.hourly_rate) as min_rate,
          MAX(r.hourly_rate) as max_rate,
          STDEV(r.hourly_rate) as rate_variance
        FROM rates r
        JOIN rate_cards rc ON r.rate_card_id = rc.id
        LEFT JOIN seniority_definitions sd ON r.seniority_level = sd.level_name AND rc.tenant_id = sd.tenant_id
        WHERE ${whereClause}
        AND r.seniority_level IS NOT NULL
        GROUP BY r.seniority_level, sd.level_order, sd.min_experience_years, sd.max_experience_years
        ORDER BY sd.level_order
      `;

      const seniorityData = await dbAdaptor.prisma.$queryRawUnsafe(seniorityQuery, ...params) as any[];

      // Calculate progression gaps and market benchmarks
      const seniorityProgression = seniorityData.map((level: any, index: number) => {
        const nextLevel = seniorityData[index + 1];
        const progressionGap = nextLevel ? nextLevel.average_rate - level.average_rate : undefined;

        return {
          level: level.seniority_level as SeniorityLevel,
          levelOrder: level.level_order || 0,
          averageRate: level.average_rate || 0,
          rateRange: { 
            min: level.min_rate || 0, 
            max: level.max_rate || 0 
          },
          marketBenchmark: await this.getMarketBenchmark(level.seniority_level, tenantId),
          progressionGap,
          roleCount: level.role_count || 0
        };
      });

      // Generate career path analysis
      const careerPathAnalysis = this.generateCareerPathAnalysis(seniorityProgression);

      // Generate gap analysis
      const gapAnalysis = this.generateSeniorityGapAnalysis(seniorityProgression);

      const analytics: SeniorityAnalytics = {
        seniorityProgression,
        careerPathAnalysis,
        gapAnalysis,
        totalLevels: seniorityProgression.length,
        avgProgressionIncrease: this.calculateAverageProgressionIncrease(seniorityProgression)
      };

      // Cache results
      await cacheAdaptor.set(cacheKey, JSON.stringify(analytics), 1800);

      logger.info({ 
        tenantId, 
        totalLevels: analytics.totalLevels,
        avgIncrease: analytics.avgProgressionIncrease 
      }, "Completed seniority analysis");

      return analytics;

    } catch (error) {
      logger.error({ error, tenantId, filters }, "Failed to analyze by seniority");
      throw error;
    }
  }

  // ============================================================================
  // GEOGRAPHIC ANALYTICS
  // ============================================================================

  /**
   * Analyze rates by geography
   */
  async analyzeByGeography(tenantId: string, filters?: EnhancedRateFilters): Promise<GeographicAnalytics> {
    try {
      logger.info({ tenantId, filters }, "Analyzing rates by geography");

      const cacheKey = `geo-analytics:${tenantId}:${JSON.stringify(filters)}`;
      const cached = await cacheAdaptor.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build WHERE conditions
      const whereConditions = ["rc.tenant_id = ?"];
      const params: any[] = [tenantId];

      if (filters?.role) {
        whereConditions.push("r.role = ?");
        params.push(filters.role);
      }

      if (filters?.seniorityLevel) {
        whereConditions.push("r.seniority_level = ?");
        params.push(filters.seniorityLevel);
      }

      const whereClause = whereConditions.join(" AND ");

      // Get geographic breakdown
      const geoQuery = `
        SELECT 
          rc.country,
          rc.state_province,
          rc.city,
          ga.cost_of_living_index,
          ga.currency_code,
          COUNT(r.id) as rate_count,
          AVG(r.hourly_rate) as average_rate,
          MIN(r.hourly_rate) as min_rate,
          MAX(r.hourly_rate) as max_rate
        FROM rate_cards rc
        JOIN rates r ON rc.id = r.rate_card_id
        LEFT JOIN geographic_adjustments ga ON rc.country = ga.country 
          AND rc.state_province = ga.state_province 
          AND rc.city = ga.city
        WHERE ${whereClause}
        AND rc.country IS NOT NULL
        GROUP BY rc.country, rc.state_province, rc.city, ga.cost_of_living_index, ga.currency_code
        ORDER BY average_rate DESC
      `;

      const geoData = await dbAdaptor.prisma.$queryRawUnsafe(geoQuery, ...params) as any[];

      // Calculate adjusted rates and competitiveness
      const locationBreakdown = await Promise.all(geoData.map(async (geo: any) => {
        const location: Location = {
          country: geo.country,
          stateProvince: geo.state_province,
          city: geo.city,
          costOfLivingIndex: geo.cost_of_living_index
        };

        const adjustedRate = await rateCalculationEngine.applyGeographicAdjustment(geo.average_rate, location);
        const marketCompetitiveness = this.calculateMarketCompetitiveness(geo.average_rate, geoData);
        const costAdvantage = this.calculateCostAdvantage(geo.average_rate, geo.cost_of_living_index || 100);

        return {
          location,
          averageRate: geo.average_rate || 0,
          adjustedRate,
          marketCompetitiveness,
          costAdvantage,
          rateCount: geo.rate_count || 0
        };
      }));

      // Generate heat map data
      const heatMapData = this.generateHeatMapData(locationBreakdown);

      // Identify arbitrage opportunities
      const arbitrageOpportunities = this.identifyArbitrageOpportunities(locationBreakdown);

      const analytics: GeographicAnalytics = {
        locationBreakdown,
        heatMapData,
        arbitrageOpportunities,
        totalLocations: locationBreakdown.length,
        avgCostOfLiving: locationBreakdown.reduce((sum, loc) => sum + (loc.location.costOfLivingIndex || 100), 0) / locationBreakdown.length
      };

      // Cache results
      await cacheAdaptor.set(cacheKey, JSON.stringify(analytics), 1800);

      logger.info({ 
        tenantId, 
        totalLocations: analytics.totalLocations,
        avgCostOfLiving: analytics.avgCostOfLiving 
      }, "Completed geographic analysis");

      return analytics;

    } catch (error) {
      logger.error({ error, tenantId, filters }, "Failed to analyze by geography");
      throw error;
    }
  }

  // ============================================================================
  // SKILL PREMIUM ANALYTICS
  // ============================================================================

  /**
   * Analyze skill and certification premiums
   */
  async analyzeSkillPremiums(tenantId: string, filters?: EnhancedRateFilters): Promise<SkillPremiumAnalytics> {
    try {
      logger.info({ tenantId, filters }, "Analyzing skill premiums");

      const cacheKey = `skill-analytics:${tenantId}:${JSON.stringify(filters)}`;
      const cached = await cacheAdaptor.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get skill breakdown from rates with required skills
      const skillQuery = `
        SELECT 
          r.required_skills,
          r.required_certifications,
          r.role,
          r.hourly_rate,
          r.seniority_level
        FROM rates r
        JOIN rate_cards rc ON r.rate_card_id = rc.id
        WHERE rc.tenant_id = ?
        AND (r.required_skills IS NOT NULL OR r.required_certifications IS NOT NULL)
      `;

      const skillData = await dbAdaptor.prisma.$queryRawUnsafe(skillQuery, tenantId) as any[];

      // Process skill premiums
      const skillBreakdown = await this.processSkillBreakdown(skillData);
      const certificationValue = await this.processCertificationBreakdown(skillData);

      // Generate recommendations
      const recommendations = this.generateSkillRecommendations(skillBreakdown, certificationValue);

      const analytics: SkillPremiumAnalytics = {
        skillBreakdown,
        certificationValue,
        recommendations
      };

      // Cache results
      await cacheAdaptor.set(cacheKey, JSON.stringify(analytics), 1800);

      logger.info({ 
        tenantId, 
        skillCount: skillBreakdown.length,
        certCount: certificationValue.length 
      }, "Completed skill premium analysis");

      return analytics;

    } catch (error) {
      logger.error({ error, tenantId, filters }, "Failed to analyze skill premiums");
      throw error;
    }
  }

  // ============================================================================
  // MARKET BENCHMARKING
  // ============================================================================

  /**
   * Generate market benchmarks for specific role/seniority/location combination
   */
  async generateMarketBenchmarks(
    role: string, 
    seniority: SeniorityLevel, 
    location: Location,
    tenantId: string = 'default'
  ): Promise<MarketBenchmark> {
    try {
      logger.info({ role, seniority, location, tenantId }, "Generating market benchmarks");

      const query = `
        SELECT 
          r.hourly_rate
        FROM rates r
        JOIN rate_cards rc ON r.rate_card_id = rc.id
        WHERE rc.tenant_id = ?
        AND r.role = ?
        AND r.seniority_level = ?
        AND rc.country = ?
        AND (rc.state_province = ? OR ? IS NULL)
        AND (rc.city = ? OR ? IS NULL)
        AND r.hourly_rate IS NOT NULL
        ORDER BY r.hourly_rate
      `;

      const rates = await dbAdaptor.prisma.$queryRawUnsafe(
        query, 
        tenantId, 
        role, 
        seniority, 
        location.country,
        location.stateProvince, location.stateProvince,
        location.city, location.city
      ) as any[];

      if (rates.length === 0) {
        throw new Error(`No benchmark data available for ${role} ${seniority} in ${location.country}`);
      }

      const rateValues = rates.map((r: any) => r.hourly_rate).sort((a: number, b: number) => a - b);
      const percentiles = this.calculatePercentiles(rateValues);
      const benchmarkRate = percentiles.p50; // Median as benchmark

      const benchmark: MarketBenchmark = {
        role,
        seniority,
        location,
        benchmarkRate,
        percentiles,
        sampleSize: rates.length,
        confidence: this.calculateConfidence(rates.length),
        lastUpdated: new Date()
      };

      logger.info({ benchmark }, "Generated market benchmark");
      return benchmark;

    } catch (error) {
      logger.error({ error, role, seniority, location }, "Failed to generate market benchmarks");
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private calculateMarketPosition(rate: number, allRates: any[]): number {
    const sortedRates = allRates.map(r => r.average_rate || 0).sort((a, b) => a - b);
    const position = sortedRates.findIndex(r => r >= rate);
    return position >= 0 ? (position / sortedRates.length) * 100 : 100;
  }

  private calculateTrendDirection(rate: number, variance: number): TrendDirection {
    // Simple heuristic based on variance
    if (variance > rate * 0.3) return 'volatile';
    if (rate > 150) return 'up'; // Above average market rate
    if (rate < 100) return 'down'; // Below average market rate
    return 'stable';
  }

  private generateServiceComparisons(services: any[]): ServiceComparison[] {
    const comparisons: ServiceComparison[] = [];
    
    for (let i = 0; i < services.length - 1; i++) {
      for (let j = i + 1; j < services.length; j++) {
        const serviceA = services[i];
        const serviceB = services[j];
        const rateDifference = serviceA.averageRate - serviceB.averageRate;
        const percentageDifference = (rateDifference / serviceB.averageRate) * 100;

        comparisons.push({
          serviceA: serviceA.service,
          serviceB: serviceB.service,
          rateDifference,
          percentageDifference,
          recommendation: this.generateComparisonRecommendation(rateDifference, percentageDifference)
        });
      }
    }

    return comparisons.slice(0, 10); // Top 10 comparisons
  }

  private generateLineOfServiceRecommendations(services: any[]): string[] {
    const recommendations: string[] = [];
    
    if (services.length === 0) {
      recommendations.push("No line of service data available. Consider categorizing rate cards by service type.");
      return recommendations;
    }

    const highestRate = Math.max(...services.map(s => s.averageRate));
    const lowestRate = Math.min(...services.map(s => s.averageRate));
    const variance = highestRate - lowestRate;

    if (variance > 100) {
      recommendations.push("Significant rate variance across services. Consider standardizing rates within service categories.");
    }

    const lowVolumeServices = services.filter(s => s.rateCount < 5);
    if (lowVolumeServices.length > 0) {
      recommendations.push(`${lowVolumeServices.length} services have limited rate data. Consider consolidating or expanding rate coverage.`);
    }

    return recommendations;
  }

  private generateCareerPathAnalysis(progression: any[]): CareerPath[] {
    const paths: CareerPath[] = [];
    
    for (let i = 0; i < progression.length - 1; i++) {
      const current = progression[i];
      const next = progression[i + 1];
      
      if (current.averageRate && next.averageRate) {
        const rateIncrease = next.averageRate - current.averageRate;
        const percentageIncrease = (rateIncrease / current.averageRate) * 100;
        
        paths.push({
          fromLevel: current.level,
          toLevel: next.level,
          averageRateIncrease: rateIncrease,
          percentageIncrease,
          typicalTimeframe: this.estimateProgressionTimeframe(current.level, next.level)
        });
      }
    }
    
    return paths;
  }

  private generateSeniorityGapAnalysis(progression: any[]): SeniorityGap[] {
    const gaps: SeniorityGap[] = [];
    const industryBenchmarks = this.getIndustryBenchmarks(); // Mock data
    
    progression.forEach(level => {
      const expectedRate = industryBenchmarks[level.level] || level.averageRate;
      const gap = level.averageRate - expectedRate;
      
      if (Math.abs(gap) > 10) { // Significant gap
        gaps.push({
          level: level.level,
          expectedRate,
          actualRate: level.averageRate,
          gap,
          recommendation: gap > 0 ? 
            "Rates above market - consider optimization" : 
            "Rates below market - consider adjustment"
        });
      }
    });
    
    return gaps;
  }

  private calculateAverageProgressionIncrease(progression: any[]): number {
    const increases = [];
    for (let i = 0; i < progression.length - 1; i++) {
      if (progression[i].averageRate && progression[i + 1].averageRate) {
        increases.push(progression[i + 1].averageRate - progression[i].averageRate);
      }
    }
    return increases.length > 0 ? increases.reduce((sum, inc) => sum + inc, 0) / increases.length : 0;
  }

  private async getMarketBenchmark(seniorityLevel: string, tenantId: string): Promise<number> {
    // Simplified benchmark calculation
    const query = `
      SELECT AVG(r.hourly_rate) as benchmark
      FROM rates r
      JOIN rate_cards rc ON r.rate_card_id = rc.id
      WHERE rc.tenant_id = ? AND r.seniority_level = ?
    `;
    
    const [result] = await dbAdaptor.prisma.$queryRawUnsafe(query, tenantId, seniorityLevel) as any[];
    return result?.benchmark || 0;
  }

  private calculateMarketCompetitiveness(rate: number, allRates: any[]): number {
    const avgRate = allRates.reduce((sum, r) => sum + (r.average_rate || 0), 0) / allRates.length;
    return ((rate - avgRate) / avgRate) * 100;
  }

  private calculateCostAdvantage(rate: number, costOfLiving: number): number {
    const adjustedRate = rate / (costOfLiving / 100);
    return ((adjustedRate - rate) / rate) * 100;
  }

  private generateHeatMapData(locationBreakdown: any[]): GeoHeatMapPoint[] {
    return locationBreakdown.map(loc => ({
      location: loc.location,
      value: loc.averageRate,
      rateCount: loc.rateCount,
      competitiveness: loc.marketCompetitiveness
    }));
  }

  private identifyArbitrageOpportunities(locationBreakdown: any[]): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const sortedByRate = [...locationBreakdown].sort((a, b) => b.averageRate - a.averageRate);
    
    for (let i = 0; i < Math.min(3, sortedByRate.length); i++) {
      for (let j = sortedByRate.length - 3; j < sortedByRate.length; j++) {
        if (i < j) {
          const high = sortedByRate[i];
          const low = sortedByRate[j];
          const savings = high.averageRate - low.averageRate;
          const percentageSavings = (savings / high.averageRate) * 100;
          
          if (percentageSavings > 20) { // Significant arbitrage opportunity
            opportunities.push({
              highCostLocation: high.location,
              lowCostLocation: low.location,
              costSavings: savings,
              percentageSavings,
              feasibilityScore: this.calculateFeasibilityScore(high.location, low.location)
            });
          }
        }
      }
    }
    
    return opportunities.slice(0, 5); // Top 5 opportunities
  }

  private async processSkillBreakdown(skillData: any[]): Promise<any[]> {
    const skillMap = new Map();
    
    skillData.forEach(rate => {
      if (rate.required_skills) {
        try {
          const skills = JSON.parse(rate.required_skills);
          skills.forEach((skill: any) => {
            const key = `${skill.name}-${skill.category}`;
            if (!skillMap.has(key)) {
              skillMap.set(key, {
                skill: skill.name,
                category: skill.category as SkillCategory,
                rates: [],
                roles: new Set()
              });
            }
            skillMap.get(key).rates.push(rate.hourly_rate);
            skillMap.get(key).roles.add(rate.role);
          });
        } catch (error) {
          logger.warn({ error, rateId: rate.id }, "Failed to parse required skills");
        }
      }
    });
    
    return Array.from(skillMap.values()).map(skill => ({
      skill: skill.skill,
      category: skill.category,
      averagePremium: this.calculateSkillPremium(skill.rates),
      marketDemand: this.assessMarketDemand(skill.rates.length) as MarketDemand,
      rateCount: skill.rates.length,
      topRoles: Array.from(skill.roles).slice(0, 5)
    }));
  }

  private async processCertificationBreakdown(skillData: any[]): Promise<any[]> {
    const certMap = new Map();
    
    skillData.forEach(rate => {
      if (rate.required_certifications) {
        try {
          const certs = JSON.parse(rate.required_certifications);
          certs.forEach((cert: any) => {
            const key = `${cert.name}-${cert.issuingOrganization}`;
            if (!certMap.has(key)) {
              certMap.set(key, {
                certification: cert.name,
                rates: []
              });
            }
            certMap.get(key).rates.push(rate.hourly_rate);
          });
        } catch (error) {
          logger.warn({ error, rateId: rate.id }, "Failed to parse required certifications");
        }
      }
    });
    
    return Array.from(certMap.values()).map(cert => ({
      certification: cert.certification,
      averagePremium: this.calculateSkillPremium(cert.rates),
      marketValue: this.assessMarketValue(cert.rates.length),
      rateCount: cert.rates.length
    }));
  }

  private generateSkillRecommendations(skills: any[], certifications: any[]): string[] {
    const recommendations: string[] = [];
    
    const highValueSkills = skills.filter(s => s.averagePremium > 20).slice(0, 3);
    if (highValueSkills.length > 0) {
      recommendations.push(`High-value skills identified: ${highValueSkills.map(s => s.skill).join(', ')}`);
    }
    
    const criticalSkills = skills.filter(s => s.marketDemand === 'Critical');
    if (criticalSkills.length > 0) {
      recommendations.push(`Critical skills in high demand: ${criticalSkills.map(s => s.skill).join(', ')}`);
    }
    
    return recommendations;
  }

  private calculatePercentiles(values: number[]): { p25: number; p50: number; p75: number; p90: number } {
    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;
    
    return {
      p25: sorted[Math.floor(len * 0.25)],
      p50: sorted[Math.floor(len * 0.5)],
      p75: sorted[Math.floor(len * 0.75)],
      p90: sorted[Math.floor(len * 0.9)]
    };
  }

  private calculateConfidence(sampleSize: number): number {
    if (sampleSize >= 100) return 0.95;
    if (sampleSize >= 50) return 0.85;
    if (sampleSize >= 20) return 0.75;
    if (sampleSize >= 10) return 0.65;
    return 0.5;
  }

  private generateComparisonRecommendation(rateDiff: number, percentDiff: number): string {
    if (Math.abs(percentDiff) < 10) return "Rates are comparable";
    if (percentDiff > 20) return "Consider rate optimization for higher service";
    if (percentDiff < -20) return "Potential opportunity for rate increase";
    return "Monitor rate trends";
  }

  private estimateProgressionTimeframe(fromLevel: SeniorityLevel, toLevel: SeniorityLevel): string {
    const timeframes: Record<string, string> = {
      'Junior-Mid-Level': '2-3 years',
      'Mid-Level-Senior': '3-5 years',
      'Senior-Lead': '4-6 years',
      'Lead-Principal': '5-8 years',
      'Principal-Director': '6-10 years'
    };
    
    return timeframes[`${fromLevel}-${toLevel}`] || '3-5 years';
  }

  private getIndustryBenchmarks(): Record<SeniorityLevel, number> {
    // Mock industry benchmarks - in real implementation, this would come from external data
    return {
      'Junior': 80,
      'Mid-Level': 120,
      'Senior': 160,
      'Lead': 200,
      'Principal': 250,
      'Director': 300
    };
  }

  private calculateFeasibilityScore(highLoc: Location, lowLoc: Location): number {
    // Simplified feasibility calculation based on geographic proximity and infrastructure
    // In real implementation, this would consider timezone, language, infrastructure, etc.
    return Math.random() * 100; // Mock score
  }

  private calculateSkillPremium(rates: number[]): number {
    if (rates.length === 0) return 0;
    const avgRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    const marketAvg = 150; // Mock market average
    return ((avgRate - marketAvg) / marketAvg) * 100;
  }

  private assessMarketDemand(rateCount: number): MarketDemand {
    if (rateCount >= 50) return 'Critical';
    if (rateCount >= 20) return 'High';
    if (rateCount >= 10) return 'Medium';
    return 'Low';
  }

  private assessMarketValue(rateCount: number): string {
    if (rateCount >= 30) return 'Premium';
    if (rateCount >= 15) return 'High';
    if (rateCount >= 5) return 'Medium';
    return 'Low';
  }

  /**
   * Health check for the analytics service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic database connectivity
      const testQuery = "SELECT 1 as test";
      await dbAdaptor.prisma.$queryRawUnsafe(testQuery);
      return true;
    } catch (error) {
      logger.error({ error }, "Enhanced rate analytics service health check failed");
      return false;
    }
  }
}

export const enhancedRateAnalyticsService = EnhancedRateAnalyticsService.getInstance();
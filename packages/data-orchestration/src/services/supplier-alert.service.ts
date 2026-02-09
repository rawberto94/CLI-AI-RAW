
/**
 * Supplier Alert Service
 * 
 * Detects suppliers with above-market rate increases and generates alerts
 * for deteriorating performance. Tracks alert resolution and provides
 * actionable recommendations.
 * 
 * Requirements: 4.2
 */

import { prisma } from '../lib/prisma';
import { supplierTrendAnalyzerService, getSupplierTrendAnalyzerService } from './supplier-trend-analyzer.service';
import { supplierIntelligenceService } from './supplier-intelligence.service';

const trendAnalyzer = getSupplierTrendAnalyzerService(prisma);

export interface SupplierAlert {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName: string;
  
  // Alert Details
  alertType: SupplierAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  
  // Metrics
  currentMetric: number;
  thresholdMetric: number;
  deviation: number;
  
  // Context
  affectedRateCards: number;
  estimatedAnnualImpact: number;
  
  // Recommendations
  recommendations: string[];
  actionItems: string[];
  
  // Status
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  
  // Timestamps
  detectedAt: Date;
  updatedAt: Date;
}

export type SupplierAlertType = 
  | 'ABOVE_MARKET_RATE_INCREASE'
  | 'DETERIORATING_COMPETITIVENESS'
  | 'ACCELERATING_RATE_INCREASES'
  | 'MARKET_POSITION_DECLINE'
  | 'QUALITY_SCORE_DROP'
  | 'COVERAGE_REDUCTION';

export interface AlertConfiguration {
  tenantId: string;
  
  // Thresholds
  rateIncreaseThreshold: number; // % above market average
  competitivenessDropThreshold: number; // Points drop in score
  qualityScoreThreshold: number; // Minimum acceptable score
  
  // Alert Settings
  enabledAlertTypes: SupplierAlertType[];
  notificationChannels: ('email' | 'in_app' | 'webhook')[];
  
  // Frequency
  checkFrequency: 'daily' | 'weekly' | 'monthly';
  digestEnabled: boolean;
}

export interface AlertResolution {
  alertId: string;
  resolvedBy: string;
  resolvedAt: Date;
  resolution: string;
  actionTaken: string;
  notes?: string;
}

export class SupplierAlertService {
  /**
   * Detect all supplier alerts for a tenant
   */
  async detectSupplierAlerts(tenantId: string): Promise<SupplierAlert[]> {
    const alerts: SupplierAlert[] = [];

    // Get all suppliers for this tenant
    const suppliers = await prisma.rateCardSupplier.findMany({
      where: { tenantId }
    });

    for (const supplier of suppliers) {
      try {
        // Check for above-market rate increases
        const rateIncreaseAlert = await this.detectAboveMarketRateIncrease(
          supplier.id,
          tenantId
        );
        if (rateIncreaseAlert) alerts.push(rateIncreaseAlert);

        // Check for deteriorating competitiveness
        const competitivenessAlert = await this.detectDeterioratingCompetitiveness(
          supplier.id,
          tenantId
        );
        if (competitivenessAlert) alerts.push(competitivenessAlert);

        // Check for accelerating rate increases
        const acceleratingAlert = await this.detectAcceleratingRateIncreases(
          supplier.id,
          tenantId
        );
        if (acceleratingAlert) alerts.push(acceleratingAlert);

        // Check for market position decline
        const positionAlert = await this.detectMarketPositionDecline(
          supplier.id,
          tenantId
        );
        if (positionAlert) alerts.push(positionAlert);

      } catch {
        // Error detecting alerts for supplier - continue with next supplier
      }
    }

    // Store alerts in database
    for (const alert of alerts) {
      await this.storeAlert(alert);
    }

    return alerts;
  }

  /**
   * Detect suppliers with above-market rate increases
   */
  private async detectAboveMarketRateIncrease(
    supplierId: string,
    tenantId: string
  ): Promise<SupplierAlert | null> {
    // Use trend analyzer to detect above-market increases
    const analysis = await trendAnalyzer.detectAboveMarketIncreases(
      supplierId,
      tenantId,
      6 // Last 6 months
    );

    if (!analysis.hasAboveMarketIncreases) {
      return null;
    }

    // Get supplier details
    const supplier = await prisma.rateCardSupplier.findUnique({
      where: { id: supplierId },
      include: {
        rateCards: {
          where: { tenantId }
        }
      }
    });

    if (!supplier) return null;

    // Calculate estimated annual impact
    const avgRateCard = supplier.rateCards.reduce(
      (sum, rc) => sum + Number(rc.dailyRateUSD),
      0
    ) / supplier.rateCards.length;

    const estimatedAnnualImpact = 
      avgRateCard * 
      (analysis.difference / 100) * 
      supplier.rateCards.length * 
      220; // Assuming 220 working days

    // Generate recommendations
    const recommendations = this.generateRateIncreaseRecommendations(
      analysis.difference,
      analysis.severity
    );

    return {
      id: `alert_${supplierId}_rate_increase_${Date.now()}`,
      tenantId,
      supplierId,
      supplierName: supplier.name,
      alertType: 'ABOVE_MARKET_RATE_INCREASE',
      severity: analysis.severity,
      title: `${supplier.name} has above-market rate increases`,
      description: `Supplier's average rate increase (${analysis.supplierAvgIncrease.toFixed(1)}%) is ${analysis.difference.toFixed(1)}% higher than market average (${analysis.marketAvgIncrease.toFixed(1)}%)`,
      currentMetric: analysis.supplierAvgIncrease,
      thresholdMetric: analysis.marketAvgIncrease,
      deviation: analysis.difference,
      affectedRateCards: supplier.rateCards.length,
      estimatedAnnualImpact,
      recommendations,
      actionItems: [
        'Schedule negotiation meeting with supplier',
        'Review alternative suppliers',
        'Analyze contract terms for rate adjustment clauses',
        'Benchmark against top 3 competitors'
      ],
      status: 'active',
      detectedAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Detect deteriorating supplier competitiveness
   */
  private async detectDeterioratingCompetitiveness(
    supplierId: string,
    tenantId: string
  ): Promise<SupplierAlert | null> {
    try {
      // Get current competitiveness score
      const currentScore = await supplierIntelligenceService.calculateCompetitivenessScore(
        supplierId,
        tenantId
      );

      // Get historical scores (last 3 months)
      const historicalScores = await this.getHistoricalCompetitivenessScores(
        supplierId,
        tenantId,
        3
      );

      if (historicalScores.length === 0) {
        return null; // Not enough historical data
      }

      // Calculate average historical score
      const avgHistoricalScore = historicalScores.reduce(
        (sum, score) => sum + score,
        0
      ) / historicalScores.length;

      // Check if score has dropped significantly
      const scoreDrop = avgHistoricalScore - currentScore.overallScore;
      const dropPercentage = (scoreDrop / avgHistoricalScore) * 100;

      // Alert if score dropped by more than 10 points or 15%
      if (scoreDrop < 10 && dropPercentage < 15) {
        return null;
      }

      const severity = this.calculateSeverity(dropPercentage, [15, 25, 35]);

      const supplier = await prisma.rateCardSupplier.findUnique({
        where: { id: supplierId },
        include: {
          rateCards: {
            where: { tenantId }
          }
        }
      });

      if (!supplier) return null;

      return {
        id: `alert_${supplierId}_competitiveness_${Date.now()}`,
        tenantId,
        supplierId,
        supplierName: supplier.name,
        alertType: 'DETERIORATING_COMPETITIVENESS',
        severity,
        title: `${supplier.name} competitiveness score declining`,
        description: `Competitiveness score dropped from ${avgHistoricalScore.toFixed(1)} to ${currentScore.overallScore.toFixed(1)} (${scoreDrop.toFixed(1)} points, ${dropPercentage.toFixed(1)}%)`,
        currentMetric: currentScore.overallScore,
        thresholdMetric: avgHistoricalScore,
        deviation: scoreDrop,
        affectedRateCards: supplier.rateCards.length,
        estimatedAnnualImpact: 0, // Would need more context to calculate
        recommendations: [
          'Review supplier performance metrics',
          'Analyze specific dimension declines',
          'Consider alternative suppliers',
          'Initiate performance improvement discussion'
        ],
        actionItems: [
          'Schedule supplier review meeting',
          'Analyze dimension-specific declines',
          'Benchmark against top performers',
          'Develop improvement plan'
        ],
        status: 'active',
        detectedAt: new Date(),
        updatedAt: new Date()
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect accelerating rate increases
   */
  private async detectAcceleratingRateIncreases(
    supplierId: string,
    tenantId: string
  ): Promise<SupplierAlert | null> {
    try {
      // Get supplier trends
      const trends = await trendAnalyzer.analyzeSupplierTrends(
        supplierId,
        tenantId,
        12
      );

      // Check for accelerating increases pattern
      const acceleratingPattern = trends.patterns.find(
        p => p.type === 'accelerating_increases'
      );

      if (!acceleratingPattern) {
        return null;
      }

      const supplier = await prisma.rateCardSupplier.findUnique({
        where: { id: supplierId },
        include: {
          rateCards: {
            where: { tenantId }
          }
        }
      });

      if (!supplier) return null;

      const severity = acceleratingPattern.confidence > 80 ? 'high' : 'medium';

      return {
        id: `alert_${supplierId}_accelerating_${Date.now()}`,
        tenantId,
        supplierId,
        supplierName: supplier.name,
        alertType: 'ACCELERATING_RATE_INCREASES',
        severity,
        title: `${supplier.name} shows accelerating rate increases`,
        description: acceleratingPattern.description,
        currentMetric: trends.rateChangeVelocity,
        thresholdMetric: 0,
        deviation: trends.rateChangeVelocity,
        affectedRateCards: supplier.rateCards.length,
        estimatedAnnualImpact: 0,
        recommendations: [
          'Immediate negotiation required',
          'Lock in rates with long-term contract',
          'Explore alternative suppliers urgently',
          'Consider rate caps in contract'
        ],
        actionItems: [
          'Schedule urgent negotiation',
          'Prepare competitive alternatives',
          'Review contract terms',
          'Develop contingency plan'
        ],
        status: 'active',
        detectedAt: new Date(),
        updatedAt: new Date()
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect market position decline
   */
  private async detectMarketPositionDecline(
    supplierId: string,
    tenantId: string
  ): Promise<SupplierAlert | null> {
    try {
      const trends = await trendAnalyzer.analyzeSupplierTrends(
        supplierId,
        tenantId,
        12
      );

      // Check if competitiveness is declining
      if (trends.competitivenessChange >= -5) {
        return null; // Not significant enough
      }

      const supplier = await prisma.rateCardSupplier.findUnique({
        where: { id: supplierId },
        include: {
          rateCards: {
            where: { tenantId }
          }
        }
      });

      if (!supplier) return null;

      const severity = this.calculateSeverity(
        Math.abs(trends.competitivenessChange),
        [5, 10, 15]
      );

      return {
        id: `alert_${supplierId}_position_decline_${Date.now()}`,
        tenantId,
        supplierId,
        supplierName: supplier.name,
        alertType: 'MARKET_POSITION_DECLINE',
        severity,
        title: `${supplier.name} market position declining`,
        description: `Supplier's market position has declined by ${Math.abs(trends.competitivenessChange).toFixed(1)} points over the analysis period`,
        currentMetric: 0, // Would need current position
        thresholdMetric: 0,
        deviation: trends.competitivenessChange,
        affectedRateCards: supplier.rateCards.length,
        estimatedAnnualImpact: 0,
        recommendations: [
          'Review supplier performance',
          'Analyze competitive landscape',
          'Consider supplier diversification',
          'Renegotiate terms'
        ],
        actionItems: [
          'Conduct supplier review',
          'Benchmark against competitors',
          'Evaluate alternatives',
          'Initiate renegotiation'
        ],
        status: 'active',
        detectedAt: new Date(),
        updatedAt: new Date()
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all active alerts for a tenant
   */
  async getActiveAlerts(tenantId: string): Promise<SupplierAlert[]> {
    const alerts = await prisma.$queryRaw<any[]>`
      SELECT * FROM "SupplierAlert"
      WHERE "tenantId" = ${tenantId}
      AND status = 'active'
      ORDER BY severity DESC, "detectedAt" DESC
    `;

    return alerts.map(this.mapDatabaseAlertToSupplierAlert);
  }

  /**
   * Get alerts for a specific supplier
   */
  async getSupplierAlerts(
    supplierId: string,
    tenantId: string
  ): Promise<SupplierAlert[]> {
    const alerts = await prisma.$queryRaw<any[]>`
      SELECT * FROM "SupplierAlert"
      WHERE "tenantId" = ${tenantId}
      AND "supplierId" = ${supplierId}
      ORDER BY "detectedAt" DESC
    `;

    return alerts.map(this.mapDatabaseAlertToSupplierAlert);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    userId: string
  ): Promise<SupplierAlert> {
    await prisma.$executeRaw`
      UPDATE "SupplierAlert"
      SET 
        status = 'acknowledged',
        "acknowledgedBy" = ${userId},
        "acknowledgedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = ${alertId}
    `;

    const alert = await prisma.$queryRaw<any[]>`
      SELECT * FROM "SupplierAlert"
      WHERE id = ${alertId}
    `;

    return this.mapDatabaseAlertToSupplierAlert(alert[0]);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(resolution: AlertResolution): Promise<SupplierAlert> {
    await prisma.$executeRaw`
      UPDATE "SupplierAlert"
      SET 
        status = 'resolved',
        "resolvedBy" = ${resolution.resolvedBy},
        "resolvedAt" = ${resolution.resolvedAt},
        resolution = ${resolution.resolution},
        "updatedAt" = NOW()
      WHERE id = ${resolution.alertId}
    `;

    const alert = await prisma.$queryRaw<any[]>`
      SELECT * FROM "SupplierAlert"
      WHERE id = ${resolution.alertId}
    `;

    return this.mapDatabaseAlertToSupplierAlert(alert[0]);
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(alertId: string, userId: string): Promise<SupplierAlert> {
    await prisma.$executeRaw`
      UPDATE "SupplierAlert"
      SET 
        status = 'dismissed',
        "resolvedBy" = ${userId},
        "resolvedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = ${alertId}
    `;

    const alert = await prisma.$queryRaw<any[]>`
      SELECT * FROM "SupplierAlert"
      WHERE id = ${alertId}
    `;

    return this.mapDatabaseAlertToSupplierAlert(alert[0]);
  }

  /**
   * Get alert statistics for a tenant
   */
  async getAlertStatistics(tenantId: string): Promise<{
    total: number;
    active: number;
    acknowledged: number;
    resolved: number;
    dismissed: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const alerts = await prisma.$queryRaw<any[]>`
      SELECT 
        status,
        severity,
        "alertType"
      FROM "SupplierAlert"
      WHERE "tenantId" = ${tenantId}
    `;

    const stats = {
      total: alerts.length,
      active: 0,
      acknowledged: 0,
      resolved: 0,
      dismissed: 0,
      bySeverity: {} as Record<string, number>,
      byType: {} as Record<string, number>
    };

    alerts.forEach(alert => {
      // Count by status
      if (alert.status === 'active') stats.active++;
      else if (alert.status === 'acknowledged') stats.acknowledged++;
      else if (alert.status === 'resolved') stats.resolved++;
      else if (alert.status === 'dismissed') stats.dismissed++;

      // Count by severity
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;

      // Count by type
      stats.byType[alert.alertType] = (stats.byType[alert.alertType] || 0) + 1;
    });

    return stats;
  }

  /**
   * Store alert in database
   */
  private async storeAlert(alert: SupplierAlert): Promise<void> {
    // Check if similar alert already exists
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM "SupplierAlert"
      WHERE "tenantId" = ${alert.tenantId}
      AND "supplierId" = ${alert.supplierId}
      AND "alertType" = ${alert.alertType}
      AND status IN ('active', 'acknowledged')
    `;

    if (existing.length > 0) {
      // Update existing alert
      await prisma.$executeRaw`
        UPDATE "SupplierAlert"
        SET 
          severity = ${alert.severity},
          description = ${alert.description},
          "currentMetric" = ${alert.currentMetric},
          "thresholdMetric" = ${alert.thresholdMetric},
          deviation = ${alert.deviation},
          "affectedRateCards" = ${alert.affectedRateCards},
          "estimatedAnnualImpact" = ${alert.estimatedAnnualImpact},
          recommendations = ${JSON.stringify(alert.recommendations)},
          "actionItems" = ${JSON.stringify(alert.actionItems)},
          "updatedAt" = NOW()
        WHERE id = ${existing[0].id}
      `;
    } else {
      // Create new alert
      await prisma.$executeRaw`
        INSERT INTO "SupplierAlert" (
          id, "tenantId", "supplierId", "supplierName",
          "alertType", severity, title, description,
          "currentMetric", "thresholdMetric", deviation,
          "affectedRateCards", "estimatedAnnualImpact",
          recommendations, "actionItems", status,
          "detectedAt", "updatedAt"
        ) VALUES (
          ${alert.id},
          ${alert.tenantId},
          ${alert.supplierId},
          ${alert.supplierName},
          ${alert.alertType},
          ${alert.severity},
          ${alert.title},
          ${alert.description},
          ${alert.currentMetric},
          ${alert.thresholdMetric},
          ${alert.deviation},
          ${alert.affectedRateCards},
          ${alert.estimatedAnnualImpact},
          ${JSON.stringify(alert.recommendations)},
          ${JSON.stringify(alert.actionItems)},
          ${alert.status},
          ${alert.detectedAt},
          ${alert.updatedAt}
        )
      `;
    }
  }

  /**
   * Get historical competitiveness scores
   */
  private async getHistoricalCompetitivenessScores(
    supplierId: string,
    tenantId: string,
    monthsBack: number
  ): Promise<number[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const scores = await prisma.$queryRaw<any[]>`
      SELECT "overallScore"
      FROM "SupplierScore"
      WHERE "supplierId" = ${supplierId}
      AND "tenantId" = ${tenantId}
      AND "calculatedAt" >= ${startDate}
      ORDER BY "calculatedAt" ASC
    `;

    return scores.map(s => Number(s.overallScore));
  }

  /**
   * Generate recommendations for rate increase alerts
   */
  private generateRateIncreaseRecommendations(
    difference: number,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): string[] {
    const recommendations: string[] = [];

    if (severity === 'critical' || severity === 'high') {
      recommendations.push('Immediate action required - schedule urgent negotiation');
      recommendations.push('Prepare competitive alternatives for leverage');
      recommendations.push('Consider contract termination clauses');
    }

    if (difference > 5) {
      recommendations.push('Request detailed justification for rate increases');
      recommendations.push('Benchmark against top 3 competitors');
    }

    recommendations.push('Review contract terms for rate adjustment clauses');
    recommendations.push('Analyze historical rate trends');
    recommendations.push('Consider volume consolidation for better rates');

    if (severity === 'low' || severity === 'medium') {
      recommendations.push('Monitor closely for further increases');
    }

    return recommendations;
  }

  /**
   * Calculate severity based on thresholds
   */
  private calculateSeverity(
    value: number,
    thresholds: [number, number, number] // [low, medium, high]
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (value < thresholds[0]) return 'low';
    if (value < thresholds[1]) return 'medium';
    if (value < thresholds[2]) return 'high';
    return 'critical';
  }

  /**
   * Map database alert to SupplierAlert interface
   */
  private mapDatabaseAlertToSupplierAlert(dbAlert: any): SupplierAlert {
    return {
      id: dbAlert.id,
      tenantId: dbAlert.tenantId,
      supplierId: dbAlert.supplierId,
      supplierName: dbAlert.supplierName,
      alertType: dbAlert.alertType,
      severity: dbAlert.severity,
      title: dbAlert.title,
      description: dbAlert.description,
      currentMetric: Number(dbAlert.currentMetric),
      thresholdMetric: Number(dbAlert.thresholdMetric),
      deviation: Number(dbAlert.deviation),
      affectedRateCards: dbAlert.affectedRateCards,
      estimatedAnnualImpact: Number(dbAlert.estimatedAnnualImpact),
      recommendations: JSON.parse(dbAlert.recommendations || '[]'),
      actionItems: JSON.parse(dbAlert.actionItems || '[]'),
      status: dbAlert.status,
      acknowledgedBy: dbAlert.acknowledgedBy,
      acknowledgedAt: dbAlert.acknowledgedAt,
      resolvedBy: dbAlert.resolvedBy,
      resolvedAt: dbAlert.resolvedAt,
      resolution: dbAlert.resolution,
      detectedAt: dbAlert.detectedAt,
      updatedAt: dbAlert.updatedAt
    };
  }
}

export const supplierAlertService = new SupplierAlertService();

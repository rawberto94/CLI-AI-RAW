
import { prisma } from '../lib/prisma';
import { RateCardBenchmarkingEngine } from './rate-card-benchmarking.service';
import { SavingsOpportunityService } from './savings-opportunity.service';
import { SupplierBenchmarkService } from './supplier-benchmark.service';
import { notificationService } from './notification.service';

const rateCardBenchmarkingService = new RateCardBenchmarkingEngine(prisma);
const savingsOpportunityService = new SavingsOpportunityService(prisma);
const supplierBenchmarkService = new SupplierBenchmarkService(prisma);

export interface ReportSchedule {
  name: string;
  type: 'executive' | 'detailed' | 'opportunities' | 'suppliers';
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  filters?: any;
}

export interface ExecutiveSummary {
  period: string;
  totalRateCards: number;
  avgCompetitiveness: number;
  totalOpportunities: number;
  potentialSavings: number;
  keyInsights: string[];
  topOpportunities: any[];
  marketTrends: any[];
}

export class AutomatedReportingService {
  /**
   * Generate executive summary report
   */
  async generateExecutiveSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ExecutiveSummary> {
    // Get rate card statistics
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    // Get opportunities
    const opportunities = await savingsOpportunityService.detectOpportunities(
      tenantId,
      {}
    );

    // Calculate total potential savings
    const potentialSavings = opportunities.reduce(
      (sum, opp) => sum + (opp.potentialSavings || 0),
      0
    );

    // Get top opportunities
    const topOpportunities = opportunities
      .sort((a, b) => (b.potentialSavings || 0) - (a.potentialSavings || 0))
      .slice(0, 5);

    // Generate key insights
    const keyInsights = await this.generateKeyInsights(
      tenantId,
      rateCards,
      opportunities
    );

    // Get market trends
    const marketTrends = await this.getMarketTrends(tenantId, startDate, endDate);

    // Calculate average competitiveness from percentile ranks
    const cardsWithRank = rateCards.filter(rc => rc.percentileRank !== null && rc.percentileRank !== undefined);
    const avgCompetitiveness = cardsWithRank.length > 0
      ? cardsWithRank.reduce((sum, rc) => sum + (100 - (rc.percentileRank || 50)), 0) / cardsWithRank.length
      : 50; // Default to neutral if no benchmark data

    return {
      period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      totalRateCards: rateCards.length,
      avgCompetitiveness: Math.round(avgCompetitiveness * 10) / 10,
      totalOpportunities: opportunities.length,
      potentialSavings,
      keyInsights,
      topOpportunities,
      marketTrends,
    };
  }

  /**
   * Generate detailed rate card report
   */
  async generateDetailedReport(
    tenantId: string,
    filters?: any
  ): Promise<any> {
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        ...filters,
      },
      include: {
        supplier: true,
      },
    });

    const reportData = await Promise.all(
      rateCards.map(async (rc) => {
        // Use pre-computed benchmark fields from the rate card entry
        const benchmark = rc.lastBenchmarkedAt ? {
          percentile: rc.percentileRank,
          median: rc.marketRateMedian ? Number(rc.marketRateMedian) : null,
          variance: rc.marketRateMedian && rc.dailyRateUSD ? 
            Number(rc.dailyRateUSD) - Number(rc.marketRateMedian) : null,
        } : null;

        return {
          id: rc.id,
          role: rc.roleStandardized,
          geography: rc.supplierRegion,
          seniority: rc.seniority,
          rate: rc.dailyRateUSD ? Number(rc.dailyRateUSD) : null,
          supplier: rc.supplier?.name,
          benchmark,
        };
      })
    );

    return {
      generatedAt: new Date(),
      totalRecords: reportData.length,
      filters,
      data: reportData,
    };
  }

  /**
   * Generate opportunities report
   */
  async generateOpportunitiesReport(tenantId: string): Promise<any> {
    const opportunities = (await savingsOpportunityService.detectOpportunities(
      tenantId,
      {}
    )) as any[];

    const groupedByType = opportunities.reduce((acc: Record<string, any[]>, opp: any) => {
      if (!acc[opp.type]) {
        acc[opp.type] = [];
      }
      acc[opp.type].push(opp);
      return acc;
    }, {} as Record<string, any[]>);

    const summary = Object.entries(groupedByType).map(([type, opps]: [string, any[]]) => ({
      type,
      count: opps.length,
      totalSavings: opps.reduce((sum: number, o: any) => sum + (o.potentialSavings || 0), 0),
      avgSavings:
        opps.reduce((sum: number, o: any) => sum + (o.potentialSavings || 0), 0) /
        opps.length,
    }));

    return {
      generatedAt: new Date(),
      totalOpportunities: opportunities.length,
      totalPotentialSavings: opportunities.reduce(
        (sum: number, o: any) => sum + (o.potentialSavings || 0),
        0
      ),
      byType: summary,
      topOpportunities: opportunities
        .sort((a: any, b: any) => (b.potentialSavings || 0) - (a.potentialSavings || 0))
        .slice(0, 10),
    };
  }

  /**
   * Generate supplier performance report
   */
  async generateSupplierReport(tenantId: string): Promise<any> {
    const suppliers = await prisma.rateCardSupplier.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { rateCards: true },
        },
      },
    });

    const supplierData = await Promise.all(
      suppliers.map(async (supplier) => {
        let scorecard: any = null;
        try {
          scorecard = await supplierBenchmarkService.calculateSupplierBenchmark({
            supplierId: supplier.id,
            tenantId
          });
        } catch {
          // Supplier may not have rate data
        }

        return {
          id: supplier.id,
          name: supplier.name,
          rateCardCount: (supplier as any)._count?.rateCards ?? 0,
          scorecard,
        };
      })
    );

    return {
      generatedAt: new Date(),
      totalSuppliers: suppliers.length,
      suppliers: supplierData.sort(
        (a, b) =>
          (b.scorecard?.overallScore || 0) - (a.scorecard?.overallScore || 0)
      ),
    };
  }

  /**
   * Schedule report generation
   */
  async scheduleReport(
    tenantId: string,
    userId: string,
    schedule: ReportSchedule
  ): Promise<any> {
    const nextRun = this.calculateNextRun(schedule.frequency);

    const scheduledReport = await prisma.scheduledReport.create({
      data: {
        tenantId,
        userId,
        name: schedule.name,
        type: schedule.type,
        frequency: schedule.frequency,
        recipients: schedule.recipients,
        filters: schedule.filters || {},
        nextRun,
        enabled: true,
      },
    });

    return scheduledReport;
  }

  /**
   * Execute scheduled reports
   */
  async executeScheduledReports(): Promise<void> {
    const now = new Date();

    const dueReports = await prisma.scheduledReport.findMany({
      where: {
        enabled: true,
        nextRun: { lte: now },
      },
    });

    for (const report of dueReports) {
      try {
        await this.executeReport(report);

        // Update next run time
        const nextRun = this.calculateNextRun(
          report.frequency as 'daily' | 'weekly' | 'monthly'
        );
        await prisma.scheduledReport.update({
          where: { id: report.id },
          data: {
            lastRun: now,
            nextRun,
          },
        });
      } catch {
        // Report execution failed
      }
    }
  }

  /**
   * Execute a single report
   */
  private async executeReport(report: any): Promise<void> {
    let reportData: any;

    switch (report.type) {
      case 'executive':
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        reportData = await this.generateExecutiveSummary(
          report.tenantId,
          startDate,
          endDate
        );
        break;

      case 'detailed':
        reportData = await this.generateDetailedReport(
          report.tenantId,
          report.filters
        );
        break;

      case 'opportunities':
        reportData = await this.generateOpportunitiesReport(report.tenantId);
        break;

      case 'suppliers':
        reportData = await this.generateSupplierReport(report.tenantId);
        break;

      default:
        throw new Error(`Unknown report type: ${report.type}`);
    }

    // Format and send report
    const formattedReport = this.formatReport(report.name, reportData);

    // Send to recipients
    for (const recipient of report.recipients) {
      await notificationService.sendNotification(
        `Scheduled Report: ${report.name}`,
        formattedReport,
        {
          tenantId: report.tenantId,
          type: 'email',
          priority: 'low',
        }
      );
    }
  }

  /**
   * Calculate next run time based on frequency
   */
  private calculateNextRun(
    frequency: 'daily' | 'weekly' | 'monthly'
  ): Date {
    const now = new Date();

    switch (frequency) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        now.setHours(8, 0, 0, 0); // 8 AM
        break;

      case 'weekly':
        now.setDate(now.getDate() + 7);
        now.setHours(8, 0, 0, 0);
        break;

      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        now.setDate(1);
        now.setHours(8, 0, 0, 0);
        break;
    }

    return now;
  }

  /**
   * Generate key insights from data
   */
  private async generateKeyInsights(
    tenantId: string,
    rateCards: any[],
    opportunities: any[]
  ): Promise<string[]> {
    const insights: string[] = [];

    // Rate card growth
    if (rateCards.length > 0) {
      insights.push(
        `Added ${rateCards.length} new rate cards in this period`
      );
    }

    // Top opportunity type
    if (opportunities.length > 0) {
      const typeCount = (opportunities as any[]).reduce((acc: Record<string, number>, opp: any) => {
        acc[opp.type] = (acc[opp.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topType = Object.entries(typeCount).sort(
        ([, a], [, b]) => (b as number) - (a as number)
      )[0];
      insights.push(
        `${topType[1]} ${topType[0]} opportunities identified`
      );
    }

    // Average savings per opportunity
    if (opportunities.length > 0) {
      const avgSavings =
        (opportunities as any[]).reduce((sum: number, o: any) => sum + (o.potentialSavings || 0), 0) /
        opportunities.length;
      insights.push(
        `Average savings per opportunity: $${avgSavings.toLocaleString()}`
      );
    }

    return insights;
  }

  /**
   * Get market trends
   */
  private async getMarketTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Get rate changes over period
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        updatedAt: { gte: startDate, lte: endDate },
      },
      select: {
        roleStandardized: true,
        supplierRegion: true,
        dailyRateUSD: true,
        updatedAt: true,
      },
    });

    // Group by role and calculate trends
    const roleGroups = rateCards.reduce((acc: Record<string, any[]>, rc) => {
      const role = rc.roleStandardized || 'Unknown';
      if (!acc[role]) {
        acc[role] = [];
      }
      acc[role].push(rc);
      return acc;
    }, {});

    const trends = Object.entries(roleGroups).map(([role, cards]) => {
      const avgRate =
        cards.reduce((sum: number, c: any) => sum + Number(c.dailyRateUSD || 0), 0) / cards.length;

      // Calculate trend by comparing older vs newer entries
      const sortedByDate = cards.sort((a: any, b: any) => 
        new Date(a.effectiveDate || a.createdAt).getTime() - new Date(b.effectiveDate || b.createdAt).getTime()
      );
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (sortedByDate.length >= 2) {
        const midpoint = Math.floor(sortedByDate.length / 2);
        const olderAvg = sortedByDate.slice(0, midpoint).reduce((sum: number, c: any) => 
          sum + Number(c.dailyRateUSD || 0), 0) / midpoint;
        const newerAvg = sortedByDate.slice(midpoint).reduce((sum: number, c: any) => 
          sum + Number(c.dailyRateUSD || 0), 0) / (sortedByDate.length - midpoint);
        
        const pctChange = olderAvg > 0 ? ((newerAvg - olderAvg) / olderAvg) * 100 : 0;
        if (pctChange > 5) trend = 'increasing';
        else if (pctChange < -5) trend = 'decreasing';
      }

      return {
        role,
        avgRate,
        count: cards.length,
        trend,
      };
    });

    return trends;
  }

  /**
   * Format report for email
   */
  private formatReport(name: string, data: any): string {
    let formatted = `Report: ${name}\n`;
    formatted += `Generated: ${new Date().toLocaleString()}\n\n`;
    formatted += JSON.stringify(data, null, 2);

    return formatted;
  }

  /**
   * Get scheduled reports for tenant
   */
  async getScheduledReports(tenantId: string): Promise<any[]> {
    return prisma.scheduledReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update scheduled report
   */
  async updateScheduledReport(
    reportId: string,
    updates: Partial<ReportSchedule>
  ): Promise<any> {
    return prisma.scheduledReport.update({
      where: { id: reportId },
      data: updates,
    });
  }

  /**
   * Delete scheduled report
   */
  async deleteScheduledReport(reportId: string): Promise<void> {
    await prisma.scheduledReport.delete({
      where: { id: reportId },
    });
  }
}

export const automatedReportingService = new AutomatedReportingService();

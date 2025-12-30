/**
 * AI-Powered Report Generator Service
 * Generates comprehensive reports with AI-generated insights and narratives
 */

import { analyticsService, PortfolioMetrics, SpendAnalysis, RiskAnalysis, SavingsOpportunities, ReportData, ChartData } from './analytics.service';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================
// REPORT GENERATION SERVICE
// ============================================

class ReportGeneratorService {
  private static instance: ReportGeneratorService;

  private constructor() {}

  public static getInstance(): ReportGeneratorService {
    if (!ReportGeneratorService.instance) {
      ReportGeneratorService.instance = new ReportGeneratorService();
    }
    return ReportGeneratorService.instance;
  }

  // ============================================
  // EXECUTIVE REPORT
  // ============================================

  async generateExecutiveReport(tenantId: string): Promise<ReportData> {
    const [metrics, spend, risks, savings] = await Promise.all([
      analyticsService.getPortfolioMetrics(tenantId),
      analyticsService.getSpendAnalysis(tenantId),
      analyticsService.getRiskAnalysis(tenantId),
      analyticsService.getSavingsOpportunities(tenantId),
    ]);

    // Generate AI insights
    const insights = await this.generateExecutiveInsights(metrics, spend, risks, savings);
    const recommendations = await this.generateRecommendations(metrics, spend, risks, savings);
    const summary = await this.generateExecutiveSummary(metrics, spend, risks, savings);

    // Generate charts
    const charts = this.generateExecutiveCharts(metrics, spend, risks);

    return {
      id: `exec-${Date.now()}`,
      type: 'executive',
      title: 'Executive Portfolio Report',
      generatedAt: new Date(),
      tenantId,
      metrics,
      spend,
      risks,
      savings,
      insights,
      recommendations,
      charts,
      summary,
    };
  }

  private async generateExecutiveInsights(
    metrics: PortfolioMetrics,
    spend: SpendAnalysis,
    risks: RiskAnalysis,
    savings: SavingsOpportunities
  ): Promise<string[]> {
    const insights: string[] = [];

    // Portfolio health
    if (metrics.complianceScore >= 90) {
      insights.push(`✅ **Strong Portfolio Health**: Your compliance score of ${metrics.complianceScore}% indicates excellent contract management practices.`);
    } else if (metrics.complianceScore >= 70) {
      insights.push(`⚠️ **Moderate Portfolio Health**: Compliance score of ${metrics.complianceScore}% suggests room for improvement.`);
    } else {
      insights.push(`🔴 **Portfolio Health Alert**: Compliance score of ${metrics.complianceScore}% requires immediate attention.`);
    }

    // Spend concentration
    if (spend.bySupplier.length > 0 && spend.bySupplier[0].percentage > 40) {
      insights.push(`💰 **High Spend Concentration**: ${spend.bySupplier[0].percentage.toFixed(1)}% of spend with ${spend.bySupplier[0].supplier} creates supplier risk.`);
    }

    // Expiration risk
    if (metrics.expiringIn30Days > 0) {
      insights.push(`⏰ **Immediate Action Required**: ${metrics.expiringIn30Days} contracts expire within 30 days, representing $${risks.highValueAtRisk.toLocaleString()} at risk.`);
    }

    // Savings potential
    if (savings.totalPotential > 0) {
      insights.push(`💡 **Savings Opportunity**: ${savings.opportunities.length} opportunities identified with potential savings of $${savings.totalPotential.toLocaleString()}.`);
    }

    // Auto-renewals
    if (metrics.autoRenewalCount > 0) {
      const autoRenewalPct = (metrics.autoRenewalCount / metrics.activeContracts) * 100;
      insights.push(`🔄 **Auto-Renewal Alert**: ${metrics.autoRenewalCount} contracts (${autoRenewalPct.toFixed(1)}%) have auto-renewal enabled - review to avoid unwanted renewals.`);
    }

    return insights;
  }

  private async generateRecommendations(
    metrics: PortfolioMetrics,
    spend: SpendAnalysis,
    risks: RiskAnalysis,
    savings: SavingsOpportunities
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Immediate actions
    if (metrics.expiringIn30Days > 0) {
      recommendations.push(`🎯 **Priority 1**: Review ${metrics.expiringIn30Days} contracts expiring in the next 30 days and initiate renewal negotiations immediately.`);
    }

    // Risk mitigation
    if (risks.overallRiskScore > 50) {
      recommendations.push(`🛡️ **Priority 2**: Address ${risks.riskDistribution.high + risks.riskDistribution.critical} high-risk contracts to reduce overall portfolio risk from ${risks.overallRiskScore}%.`);
    }

    // Cost optimization
    if (savings.totalPotential > 100000) {
      const topSaving = savings.opportunities[0];
      recommendations.push(`💰 **Priority 3**: Pursue ${topSaving.type} opportunities starting with "${topSaving.description}" for $${topSaving.potentialSavings.toLocaleString()} in savings.`);
    }

    // Supplier diversification
    if (spend.bySupplier[0]?.percentage > 40) {
      recommendations.push(`🔄 **Strategic**: Diversify supplier base - ${spend.bySupplier[0].supplier} represents ${spend.bySupplier[0].percentage.toFixed(1)}% of spend, creating concentration risk.`);
    }

    // Data quality
    if (risks.missingData.length > 5) {
      recommendations.push(`📊 **Process Improvement**: Complete missing data for ${risks.missingData.length} contracts to improve portfolio visibility and decision-making.`);
    }

    return recommendations;
  }

  private async generateExecutiveSummary(
    metrics: PortfolioMetrics,
    spend: SpendAnalysis,
    risks: RiskAnalysis,
    savings: SavingsOpportunities
  ): Promise<string> {
    const prompt = `Generate a concise 3-4 sentence executive summary for a contract portfolio with these metrics:

Portfolio: ${metrics.totalContracts} total contracts, ${metrics.activeContracts} active
Value: $${spend.totalSpend.toLocaleString()} total spend, $${spend.annualizedSpend.toLocaleString()} annualized
Risk: ${risks.overallRiskScore}% risk score, ${metrics.expiringIn30Days} expiring in 30 days
Savings: $${savings.totalPotential.toLocaleString()} potential savings identified

Focus on business impact and key metrics. Be professional and data-driven.`;

    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0];
      return content.type === 'text' ? content.text : '';
    } catch (error) {
      console.error('Error generating AI summary:', error);
      return `Portfolio Overview: Managing ${metrics.totalContracts} contracts worth $${spend.totalSpend.toLocaleString()}. ${metrics.expiringIn30Days} contracts require immediate attention. Portfolio risk score of ${risks.overallRiskScore}% with $${savings.totalPotential.toLocaleString()} in identified savings opportunities.`;
    }
  }

  private generateExecutiveCharts(
    metrics: PortfolioMetrics,
    spend: SpendAnalysis,
    risks: RiskAnalysis
  ): ChartData[] {
    return [
      {
        type: 'pie',
        title: 'Spend by Top Suppliers',
        data: spend.bySupplier.slice(0, 5).map((s) => ({
          label: s.supplier,
          value: s.value,
        })),
      },
      {
        type: 'bar',
        title: 'Spend by Category',
        data: spend.byCategory.slice(0, 10).map((c) => ({
          label: c.category,
          value: c.value,
        })),
      },
      {
        type: 'donut',
        title: 'Risk Distribution',
        data: [
          { label: 'Low Risk', value: risks.riskDistribution.low },
          { label: 'Medium Risk', value: risks.riskDistribution.medium },
          { label: 'High Risk', value: risks.riskDistribution.high },
          { label: 'Critical Risk', value: risks.riskDistribution.critical },
        ],
      },
      {
        type: 'line',
        title: 'Spend Trend (12 Months)',
        datasets: [
          {
            label: 'Monthly Spend',
            data: spend.spendTrend.map((t) => t.value),
            color: '#3b82f6',
          },
        ],
        labels: spend.spendTrend.map((t) => t.period),
      },
    ];
  }

  // ============================================
  // FINANCIAL REPORT
  // ============================================

  async generateFinancialReport(tenantId: string, startDate?: Date, endDate?: Date): Promise<ReportData> {
    const [metrics, spend, savings] = await Promise.all([
      analyticsService.getPortfolioMetrics(tenantId),
      analyticsService.getSpendAnalysis(tenantId, startDate, endDate),
      analyticsService.getSavingsOpportunities(tenantId),
    ]);

    const insights = await this.generateFinancialInsights(spend, savings);
    const recommendations = await this.generateFinancialRecommendations(spend, savings);
    const summary = await this.generateFinancialSummary(spend, savings);
    const charts = this.generateFinancialCharts(spend, savings);

    // Empty risks for financial report
    const risks: RiskAnalysis = {
      overallRiskScore: 0,
      riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      expiringContracts: [],
      autoRenewals: [],
      highValueAtRisk: 0,
      missingData: [],
      complianceIssues: [],
    };

    return {
      id: `fin-${Date.now()}`,
      type: 'financial',
      title: 'Financial Analysis Report',
      generatedAt: new Date(),
      tenantId,
      metrics,
      spend,
      risks,
      savings,
      insights,
      recommendations,
      charts,
      summary,
    };
  }

  private async generateFinancialInsights(spend: SpendAnalysis, savings: SavingsOpportunities): Promise<string[]> {
    const insights: string[] = [];

    insights.push(`💰 **Total Spend**: $${spend.totalSpend.toLocaleString()} across ${spend.bySupplier.length} suppliers`);
    insights.push(`📊 **Annualized Spend**: $${spend.annualizedSpend.toLocaleString()} in active contract commitments`);

    // Top supplier
    if (spend.topSuppliers.length > 0) {
      insights.push(`🏆 **Top Supplier**: ${spend.topSuppliers[0].supplier} - $${spend.topSuppliers[0].value.toLocaleString()} (${spend.topSuppliers[0].contracts} contracts)`);
    }

    // Category breakdown
    if (spend.byCategory.length > 0) {
      insights.push(`📂 **Top Category**: ${spend.byCategory[0].category} - ${spend.byCategory[0].percentage.toFixed(1)}% of total spend`);
    }

    // Savings potential
    insights.push(`💡 **Savings Potential**: $${savings.totalPotential.toLocaleString()} identified across ${savings.opportunities.length} opportunities`);

    return insights;
  }

  private async generateFinancialRecommendations(
    spend: SpendAnalysis,
    savings: SavingsOpportunities
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Top savings opportunities
    savings.opportunities.slice(0, 3).forEach((opp, idx) => {
      recommendations.push(`${idx + 1}. **${opp.type}**: ${opp.description} - Potential: $${opp.potentialSavings.toLocaleString()} (${opp.priority} priority, ${opp.effort} effort)`);
    });

    return recommendations;
  }

  private async generateFinancialSummary(spend: SpendAnalysis, savings: SavingsOpportunities): Promise<string> {
    return `Financial analysis reveals total contract spend of $${spend.totalSpend.toLocaleString()} with $${spend.annualizedSpend.toLocaleString()} in annual commitments. Analysis identified $${savings.totalPotential.toLocaleString()} in potential savings across ${savings.opportunities.length} optimization opportunities. Top spending categories include ${spend.byCategory.slice(0, 3).map((c) => c.category).join(', ')}.`;
  }

  private generateFinancialCharts(spend: SpendAnalysis, savings: SavingsOpportunities): ChartData[] {
    return [
      {
        type: 'bar',
        title: 'Top 10 Suppliers by Spend',
        data: spend.topSuppliers.map((s) => ({
          label: s.supplier,
          value: s.value,
        })),
      },
      {
        type: 'pie',
        title: 'Spend by Category',
        data: spend.byCategory.slice(0, 8).map((c) => ({
          label: c.category,
          value: c.value,
        })),
      },
      {
        type: 'bar',
        title: 'Savings Opportunities',
        data: savings.opportunities.slice(0, 5).map((o) => ({
          label: o.type,
          value: o.potentialSavings,
        })),
      },
      {
        type: 'line',
        title: 'Spend Trend',
        datasets: [
          {
            label: 'Total Spend',
            data: spend.spendTrend.map((t) => t.value),
            color: '#10b981',
          },
        ],
        labels: spend.spendTrend.map((t) => t.period),
      },
    ];
  }

  // ============================================
  // RISK REPORT
  // ============================================

  async generateRiskReport(tenantId: string): Promise<ReportData> {
    const [metrics, risks, spend] = await Promise.all([
      analyticsService.getPortfolioMetrics(tenantId),
      analyticsService.getRiskAnalysis(tenantId),
      analyticsService.getSpendAnalysis(tenantId),
    ]);

    const insights = await this.generateRiskInsights(risks, metrics);
    const recommendations = await this.generateRiskRecommendations(risks);
    const summary = await this.generateRiskSummary(risks, metrics);
    const charts = this.generateRiskCharts(risks, metrics);

    const savings: SavingsOpportunities = {
      totalPotential: 0,
      opportunities: [],
      consolidationOpportunities: [],
      rateOptimization: [],
    };

    return {
      id: `risk-${Date.now()}`,
      type: 'risk',
      title: 'Risk Assessment Report',
      generatedAt: new Date(),
      tenantId,
      metrics,
      spend,
      risks,
      savings,
      insights,
      recommendations,
      charts,
      summary,
    };
  }

  private async generateRiskInsights(risks: RiskAnalysis, metrics: PortfolioMetrics): Promise<string[]> {
    const insights: string[] = [];

    insights.push(`⚠️ **Overall Risk Score**: ${risks.overallRiskScore}/100 - ${risks.overallRiskScore > 70 ? 'High Risk' : risks.overallRiskScore > 40 ? 'Moderate Risk' : 'Low Risk'}`);
    insights.push(`📊 **Risk Distribution**: ${risks.riskDistribution.critical} Critical, ${risks.riskDistribution.high} High, ${risks.riskDistribution.medium} Medium, ${risks.riskDistribution.low} Low`);

    if (risks.expiringContracts.length > 0) {
      insights.push(`⏰ **Expiring Contracts**: ${risks.expiringContracts.length} contracts expiring soon, $${risks.highValueAtRisk.toLocaleString()} at risk`);
    }

    if (risks.autoRenewals.length > 0) {
      const autoRenewalValue = risks.autoRenewals.reduce((sum, a) => sum + a.value, 0);
      insights.push(`🔄 **Auto-Renewals**: ${risks.autoRenewals.length} contracts will auto-renew ($${autoRenewalValue.toLocaleString()} value)`);
    }

    if (risks.missingData.length > 0) {
      insights.push(`📝 **Data Gaps**: ${risks.missingData.length} contracts missing critical information`);
    }

    return insights;
  }

  private async generateRiskRecommendations(risks: RiskAnalysis): Promise<string[]> {
    const recommendations: string[] = [];

    // Critical expiring
    const critical = risks.expiringContracts.filter((c) => c.daysUntil <= 7);
    if (critical.length > 0) {
      recommendations.push(`🔴 **Urgent**: ${critical.length} contracts expire within 7 days - immediate action required`);
    }

    // High risk
    if (risks.riskDistribution.high + risks.riskDistribution.critical > 5) {
      recommendations.push(`⚠️ **High Priority**: Review and mitigate ${risks.riskDistribution.high + risks.riskDistribution.critical} high-risk contracts`);
    }

    // Auto-renewals
    if (risks.autoRenewals.length > 0) {
      recommendations.push(`🔄 **Review Required**: Evaluate ${risks.autoRenewals.length} auto-renewing contracts before renewal dates`);
    }

    // Missing data
    if (risks.missingData.length > 0) {
      recommendations.push(`📊 **Data Quality**: Complete missing fields for ${risks.missingData.length} contracts to improve risk assessment`);
    }

    return recommendations;
  }

  private async generateRiskSummary(risks: RiskAnalysis, metrics: PortfolioMetrics): Promise<string> {
    return `Risk analysis shows overall portfolio risk score of ${risks.overallRiskScore}/100. ${risks.expiringContracts.length} contracts require attention within 90 days, with $${risks.highValueAtRisk.toLocaleString()} in contract value at risk. ${risks.riskDistribution.high + risks.riskDistribution.critical} contracts classified as high or critical risk requiring immediate mitigation.`;
  }

  private generateRiskCharts(risks: RiskAnalysis, metrics: PortfolioMetrics): ChartData[] {
    return [
      {
        type: 'donut',
        title: 'Risk Distribution',
        data: [
          { label: 'Low', value: risks.riskDistribution.low },
          { label: 'Medium', value: risks.riskDistribution.medium },
          { label: 'High', value: risks.riskDistribution.high },
          { label: 'Critical', value: risks.riskDistribution.critical },
        ],
      },
      {
        type: 'bar',
        title: 'Top 10 Expiring Contracts by Value',
        data: risks.expiringContracts.slice(0, 10).map((c) => ({
          label: c.title,
          value: c.value,
        })),
      },
      {
        type: 'line',
        title: 'Expiration Timeline',
        datasets: [
          {
            label: 'Days Until Expiration',
            data: risks.expiringContracts.slice(0, 15).map((c) => c.daysUntil),
            color: '#ef4444',
          },
        ],
        labels: risks.expiringContracts.slice(0, 15).map((c) => c.title.substring(0, 20)),
      },
    ];
  }

  // ============================================
  // COMPLIANCE REPORT
  // ============================================

  async generateComplianceReport(tenantId: string): Promise<ReportData> {
    const [metrics, risks, spend] = await Promise.all([
      analyticsService.getPortfolioMetrics(tenantId),
      analyticsService.getRiskAnalysis(tenantId),
      analyticsService.getSpendAnalysis(tenantId),
    ]);

    const insights = await this.generateComplianceInsights(metrics, risks);
    const recommendations = await this.generateComplianceRecommendations(risks);
    const summary = await this.generateComplianceSummary(metrics, risks);
    const charts = this.generateComplianceCharts(metrics, risks);

    const savings: SavingsOpportunities = {
      totalPotential: 0,
      opportunities: [],
      consolidationOpportunities: [],
      rateOptimization: [],
    };

    return {
      id: `comp-${Date.now()}`,
      type: 'compliance',
      title: 'Compliance Status Report',
      generatedAt: new Date(),
      tenantId,
      metrics,
      spend,
      risks,
      savings,
      insights,
      recommendations,
      charts,
      summary,
    };
  }

  private async generateComplianceInsights(metrics: PortfolioMetrics, risks: RiskAnalysis): Promise<string[]> {
    const insights: string[] = [];

    const complianceLevel =
      metrics.complianceScore >= 90 ? 'Excellent' : metrics.complianceScore >= 75 ? 'Good' : metrics.complianceScore >= 60 ? 'Fair' : 'Poor';

    insights.push(`📊 **Compliance Score**: ${metrics.complianceScore}/100 - ${complianceLevel} compliance level`);
    insights.push(`📝 **Data Quality**: ${risks.missingData.length} contracts with incomplete data`);

    if (risks.complianceIssues.length > 0) {
      insights.push(`⚠️ **Active Issues**: ${risks.complianceIssues.length} compliance issues requiring resolution`);
    }

    const compliantContracts = metrics.totalContracts - risks.missingData.length;
    const complianceRate = metrics.totalContracts > 0 ? (compliantContracts / metrics.totalContracts) * 100 : 100;
    insights.push(`✅ **Compliant Contracts**: ${compliantContracts} of ${metrics.totalContracts} (${complianceRate.toFixed(1)}%)`);

    return insights;
  }

  private async generateComplianceRecommendations(risks: RiskAnalysis): Promise<string[]> {
    const recommendations: string[] = [];

    if (risks.missingData.length > 0) {
      recommendations.push(`📝 **Data Completion**: Update ${risks.missingData.length} contracts with missing critical fields`);
    }

    if (risks.complianceIssues.length > 0) {
      recommendations.push(`⚠️ **Issue Resolution**: Address ${risks.complianceIssues.length} identified compliance issues`);
    }

    recommendations.push(`✅ **Regular Audits**: Schedule quarterly compliance reviews to maintain high standards`);
    recommendations.push(`📚 **Documentation**: Ensure all contract modifications are properly documented and approved`);

    return recommendations;
  }

  private async generateComplianceSummary(metrics: PortfolioMetrics, risks: RiskAnalysis): Promise<string> {
    return `Compliance assessment reveals a score of ${metrics.complianceScore}/100 across ${metrics.totalContracts} contracts. ${risks.missingData.length} contracts require data completion, and ${risks.complianceIssues.length} compliance issues need resolution. Overall portfolio compliance is ${metrics.complianceScore >= 75 ? 'satisfactory' : 'requires improvement'}.`;
  }

  private generateComplianceCharts(metrics: PortfolioMetrics, risks: RiskAnalysis): ChartData[] {
    const compliantCount = metrics.totalContracts - risks.missingData.length;

    return [
      {
        type: 'pie',
        title: 'Compliance Status',
        data: [
          { label: 'Compliant', value: compliantCount },
          { label: 'Non-Compliant', value: risks.missingData.length },
        ],
      },
      {
        type: 'bar',
        title: 'Missing Data by Field',
        data: this.aggregateMissingFields(risks.missingData),
      },
    ];
  }

  private aggregateMissingFields(missingData: Array<{ missingFields: string[] }>): Array<{ label: string; value: number }> {
    const fieldCounts = new Map<string, number>();

    missingData.forEach((item) => {
      item.missingFields.forEach((field) => {
        fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
      });
    });

    return Array.from(fieldCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  // ============================================
  // SUPPLIER PERFORMANCE REPORT
  // ============================================

  async generateSupplierReport(tenantId: string, supplierName: string): Promise<ReportData> {
    const [metrics, supplierPerf, spend] = await Promise.all([
      analyticsService.getPortfolioMetrics(tenantId),
      analyticsService.getSupplierPerformance(tenantId, supplierName),
      analyticsService.getSpendAnalysis(tenantId),
    ]);

    if (!supplierPerf) {
      throw new Error(`Supplier "${supplierName}" not found`);
    }

    const insights = await this.generateSupplierInsights(supplierPerf);
    const recommendations = await this.generateSupplierRecommendations(supplierPerf);
    const summary = await this.generateSupplierSummary(supplierPerf);
    const charts = this.generateSupplierCharts(supplierPerf);

    const risks: RiskAnalysis = {
      overallRiskScore: supplierPerf.riskScore,
      riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      expiringContracts: [],
      autoRenewals: [],
      highValueAtRisk: 0,
      missingData: [],
      complianceIssues: [],
    };

    const savings: SavingsOpportunities = {
      totalPotential: 0,
      opportunities: [],
      consolidationOpportunities: [],
      rateOptimization: [],
    };

    return {
      id: `supp-${Date.now()}`,
      type: 'supplier',
      title: `Supplier Performance Report: ${supplierName}`,
      generatedAt: new Date(),
      tenantId,
      metrics,
      spend,
      risks,
      savings,
      insights,
      recommendations,
      charts,
      summary,
    };
  }

  private async generateSupplierInsights(perf: NonNullable<Awaited<ReturnType<typeof analyticsService.getSupplierPerformance>>>): Promise<string[]> {
    const insights: string[] = [];

    insights.push(`📊 **Portfolio**: ${perf.totalContracts} contracts (${perf.activeContracts} active) worth $${perf.totalValue.toLocaleString()}`);
    insights.push(`💰 **Average Value**: $${perf.avgContractValue.toLocaleString()} per contract`);
    insights.push(`📅 **Relationship**: ${perf.relationshipDuration} months partnership`);
    insights.push(`✅ **Performance**: ${perf.complianceScore}% compliance, ${perf.onTimeRenewalRate}% on-time renewals`);

    if (perf.riskScore > 30) {
      insights.push(`⚠️ **Risk Alert**: ${perf.riskScore.toFixed(0)}% risk score - review upcoming expirations`);
    }

    return insights;
  }

  private async generateSupplierRecommendations(perf: NonNullable<Awaited<ReturnType<typeof analyticsService.getSupplierPerformance>>>): Promise<string[]> {
    const recommendations: string[] = [];

    if (perf.activeContracts > 3) {
      recommendations.push(`🔄 **Consolidation**: Consider consolidating ${perf.activeContracts} active contracts for better management`);
    }

    if (perf.relationshipDuration > 24) {
      recommendations.push(`💎 **Long-term Value**: Leverage ${perf.relationshipDuration}-month relationship for volume discounts`);
    }

    if (perf.riskScore > 30) {
      recommendations.push(`⚠️ **Risk Management**: Address high risk score by proactively managing upcoming renewals`);
    }

    return recommendations;
  }

  private async generateSupplierSummary(perf: NonNullable<Awaited<ReturnType<typeof analyticsService.getSupplierPerformance>>>): Promise<string> {
    return `${perf.supplier} partnership includes ${perf.totalContracts} contracts valued at $${perf.totalValue.toLocaleString()}. Relationship spans ${perf.relationshipDuration} months with ${perf.complianceScore}% compliance and ${perf.onTimeRenewalRate}% on-time renewal rate. Current risk assessment: ${perf.riskScore.toFixed(0)}%.`;
  }

  private generateSupplierCharts(perf: NonNullable<Awaited<ReturnType<typeof analyticsService.getSupplierPerformance>>>): ChartData[] {
    return [
      {
        type: 'pie',
        title: 'Contract Status',
        data: [
          { label: 'Active', value: perf.activeContracts },
          { label: 'Inactive', value: perf.totalContracts - perf.activeContracts },
        ],
      },
      {
        type: 'bar',
        title: 'Contract Types',
        data: perf.contractTypes.map((type) => ({
          label: type,
          value: 1,
        })),
      },
    ];
  }
}

export const reportGeneratorService = ReportGeneratorService.getInstance();

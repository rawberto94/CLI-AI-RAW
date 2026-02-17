/**
 * Predictive Analytics Engine
 * 
 * AI-powered predictions for contracts:
 * - Renewal probability prediction
 * - Risk trend forecasting
 * - Cost projections
 * - Value optimization recommendations
 * - Anomaly prediction
 * 
 * @version 1.0.0
 */

import { randomUUID } from 'crypto';
import { prisma as prismaSingleton } from '../lib/prisma';

// Types
export type PredictionType = 
  | 'renewal'
  | 'churn'
  | 'cost'
  | 'risk'
  | 'value'
  | 'compliance'
  | 'negotiation_outcome';

export type TimeHorizon = '30d' | '60d' | '90d' | '6m' | '1y' | '2y';

export interface Prediction {
  id: string;
  tenantId: string;
  contractId: string;
  type: PredictionType;
  
  // Prediction details
  predictedValue: number;
  confidence: number;
  probability?: number; // For binary predictions
  
  // Time context
  horizon: TimeHorizon;
  predictedAt: Date;
  validUntil: Date;
  
  // Factors
  factors: PredictionFactor[];
  
  // Recommendations
  recommendations: Recommendation[];
  
  // Model info
  modelVersion: string;
  featureImportance: Record<string, number>;
}

export interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  value: unknown;
  description: string;
}

export interface Recommendation {
  id: string;
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  priority: number;
  potentialValue?: number;
}

export interface ContractFeatures {
  // Contract attributes
  contractType: string;
  contractValue: number;
  currency: string;
  termMonths: number;
  remainingMonths: number;
  
  // Relationship attributes
  vendorTenure: number; // months
  renewalCount: number;
  amendmentCount: number;
  
  // Performance indicators
  utilizationRate?: number;
  satisfactionScore?: number;
  issueCount?: number;
  slaViolations?: number;
  
  // Financial indicators
  paymentHistory?: 'excellent' | 'good' | 'fair' | 'poor';
  priceChangePercent?: number;
  marketComparison?: number; // vs market rate
  
  // Engagement indicators
  lastInteractionDays?: number;
  communicationFrequency?: number;
  escalationCount?: number;
  
  // Risk indicators
  riskScore?: number;
  complianceStatus?: 'compliant' | 'at_risk' | 'non_compliant';
}

export interface TrendPoint {
  date: Date;
  value: number;
  predicted: boolean;
}

export interface ForecastResult {
  contractId: string;
  metric: string;
  currentValue: number;
  forecast: TrendPoint[];
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  confidence: number;
}

export interface RiskForecast {
  contractId: string;
  currentRiskScore: number;
  predictedRiskScore: number;
  riskTrajectory: 'improving' | 'stable' | 'worsening';
  riskFactors: {
    factor: string;
    currentImpact: number;
    predictedImpact: number;
    mitigation?: string;
  }[];
  alertLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

export interface ValueOptimization {
  contractId: string;
  currentValue: number;
  optimizedValue: number;
  potentialSavings: number;
  optimizations: {
    type: 'pricing' | 'terms' | 'scope' | 'timing' | 'consolidation';
    description: string;
    potentialImpact: number;
    implementationEffort: 'low' | 'medium' | 'high';
    probability: number;
  }[];
}

export interface PortfolioPrediction {
  tenantId: string;
  horizon: TimeHorizon;
  
  // Renewal predictions
  renewalPredictions: {
    likelyToRenew: number;
    atRisk: number;
    likelyToChurn: number;
    unknownOutcome: number;
  };
  
  // Value projections
  projectedValue: {
    current: number;
    projected: number;
    change: number;
    changePercent: number;
  };
  
  // Risk outlook
  riskOutlook: {
    improving: number;
    stable: number;
    worsening: number;
    averageRiskScore: number;
    projectedRiskScore: number;
  };
  
  // Top opportunities
  opportunities: {
    contractId: string;
    contractName: string;
    type: string;
    potentialValue: number;
    action: string;
  }[];
  
  // Top risks
  risks: {
    contractId: string;
    contractName: string;
    riskType: string;
    probability: number;
    impact: number;
    mitigation: string;
  }[];
}

class PredictiveAnalyticsEngine {
  private predictions: Map<string, Prediction> = new Map(); // In-memory cache only
  private modelVersion = '1.0.0';

  /**
   * Persist a prediction to the database (alongside in-memory cache)
   */
  private async persistPrediction(prediction: Prediction): Promise<void> {
    this.predictions.set(prediction.id, prediction);
    try {
      await prismaSingleton.aiPrediction.create({
        data: {
          id: prediction.id,
          tenantId: prediction.tenantId,
          contractId: prediction.contractId,
          type: prediction.type,
          predictedValue: prediction.predictedValue,
          confidence: prediction.confidence,
          probability: prediction.probability,
          horizon: prediction.horizon,
          validUntil: prediction.validUntil,
          factors: prediction.factors as any,
          recommendations: prediction.recommendations as any,
          modelVersion: prediction.modelVersion,
          featureImportance: prediction.featureImportance as any,
        },
      });
    } catch (e) {
      // DB persistence is best-effort; in-memory always works
      console.warn('Failed to persist prediction to DB:', e);
    }
  }

  /**
   * Predict renewal probability
   */
  async predictRenewal(
    tenantId: string,
    contractId: string,
    features: ContractFeatures,
    horizon: TimeHorizon = '90d'
  ): Promise<Prediction> {
    const factors: PredictionFactor[] = [];
    let renewalScore = 0.5; // Base probability

    // Tenure factor
    if (features.vendorTenure > 24) {
      renewalScore += 0.15;
      factors.push({
        name: 'Vendor Tenure',
        impact: 'positive',
        weight: 0.15,
        value: features.vendorTenure,
        description: `Long-standing relationship of ${features.vendorTenure} months`,
      });
    } else if (features.vendorTenure < 12) {
      renewalScore -= 0.1;
      factors.push({
        name: 'Vendor Tenure',
        impact: 'negative',
        weight: -0.1,
        value: features.vendorTenure,
        description: 'Relatively new relationship',
      });
    }

    // Renewal history
    if (features.renewalCount > 0) {
      const renewalBonus = Math.min(features.renewalCount * 0.1, 0.2);
      renewalScore += renewalBonus;
      factors.push({
        name: 'Renewal History',
        impact: 'positive',
        weight: renewalBonus,
        value: features.renewalCount,
        description: `Previously renewed ${features.renewalCount} times`,
      });
    }

    // Satisfaction
    if (features.satisfactionScore !== undefined) {
      const satImpact = (features.satisfactionScore - 3) * 0.1;
      renewalScore += satImpact;
      factors.push({
        name: 'Satisfaction Score',
        impact: satImpact > 0 ? 'positive' : satImpact < 0 ? 'negative' : 'neutral',
        weight: satImpact,
        value: features.satisfactionScore,
        description: `Current satisfaction score: ${features.satisfactionScore}/5`,
      });
    }

    // Issues and escalations
    if (features.issueCount && features.issueCount > 5) {
      const issueImpact = -Math.min(features.issueCount * 0.02, 0.15);
      renewalScore += issueImpact;
      factors.push({
        name: 'Issue Count',
        impact: 'negative',
        weight: issueImpact,
        value: features.issueCount,
        description: `${features.issueCount} issues reported`,
      });
    }

    // SLA violations
    if (features.slaViolations && features.slaViolations > 0) {
      const slaImpact = -Math.min(features.slaViolations * 0.05, 0.2);
      renewalScore += slaImpact;
      factors.push({
        name: 'SLA Violations',
        impact: 'negative',
        weight: slaImpact,
        value: features.slaViolations,
        description: `${features.slaViolations} SLA violations recorded`,
      });
    }

    // Price comparison
    if (features.marketComparison !== undefined) {
      if (features.marketComparison > 1.2) {
        renewalScore -= 0.15;
        factors.push({
          name: 'Market Comparison',
          impact: 'negative',
          weight: -0.15,
          value: features.marketComparison,
          description: 'Pricing significantly above market rate',
        });
      } else if (features.marketComparison < 0.9) {
        renewalScore += 0.1;
        factors.push({
          name: 'Market Comparison',
          impact: 'positive',
          weight: 0.1,
          value: features.marketComparison,
          description: 'Competitive pricing below market rate',
        });
      }
    }

    // Clamp probability
    const probability = Math.max(0.05, Math.min(0.95, renewalScore));

    // Generate recommendations
    const recommendations = this.generateRenewalRecommendations(
      probability, 
      factors, 
      features
    );

    // Calculate confidence based on data completeness
    const dataCompleteness = this.calculateDataCompleteness(features);
    const confidence = 0.5 + dataCompleteness * 0.4;

    const prediction: Prediction = {
      id: randomUUID(),
      tenantId,
      contractId,
      type: 'renewal',
      predictedValue: probability,
      confidence,
      probability,
      horizon,
      predictedAt: new Date(),
      validUntil: this.calculateValidUntil(horizon),
      factors,
      recommendations,
      modelVersion: this.modelVersion,
      featureImportance: this.calculateFeatureImportance(factors),
    };

    this.persistPrediction(prediction);
    return prediction;
  }

  /**
   * Forecast risk trend
   */
  async forecastRisk(
    tenantId: string,
    contractId: string,
    features: ContractFeatures,
    historicalRiskScores?: { date: Date; score: number }[]
  ): Promise<RiskForecast> {
    // Calculate current risk score
    let currentRiskScore = 30; // Base score

    const riskFactors: RiskForecast['riskFactors'] = [];

    // Compliance risk
    if (features.complianceStatus === 'non_compliant') {
      currentRiskScore += 30;
      riskFactors.push({
        factor: 'Compliance',
        currentImpact: 30,
        predictedImpact: features.complianceStatus === 'non_compliant' ? 35 : 20,
        mitigation: 'Address compliance gaps immediately',
      });
    } else if (features.complianceStatus === 'at_risk') {
      currentRiskScore += 15;
      riskFactors.push({
        factor: 'Compliance',
        currentImpact: 15,
        predictedImpact: 20,
        mitigation: 'Review and remediate compliance concerns',
      });
    }

    // SLA risk
    if (features.slaViolations && features.slaViolations > 0) {
      const slaRisk = Math.min(features.slaViolations * 5, 25);
      currentRiskScore += slaRisk;
      riskFactors.push({
        factor: 'SLA Performance',
        currentImpact: slaRisk,
        predictedImpact: slaRisk * 1.1, // Slight increase if trend continues
        mitigation: 'Escalate SLA violations with vendor',
      });
    }

    // Term risk (approaching expiration)
    if (features.remainingMonths < 3) {
      currentRiskScore += 20;
      riskFactors.push({
        factor: 'Expiration Risk',
        currentImpact: 20,
        predictedImpact: 25,
        mitigation: 'Initiate renewal discussions immediately',
      });
    } else if (features.remainingMonths < 6) {
      currentRiskScore += 10;
      riskFactors.push({
        factor: 'Expiration Risk',
        currentImpact: 10,
        predictedImpact: 15,
        mitigation: 'Plan for renewal process',
      });
    }

    // Price risk
    if (features.marketComparison && features.marketComparison > 1.3) {
      currentRiskScore += 15;
      riskFactors.push({
        factor: 'Price Competitiveness',
        currentImpact: 15,
        predictedImpact: 15,
        mitigation: 'Negotiate pricing or evaluate alternatives',
      });
    }

    // Calculate predicted risk score (simplified trend)
    let predictedRiskScore = currentRiskScore;
    let riskTrajectory: RiskForecast['riskTrajectory'] = 'stable';

    // If we have historical data, calculate trend
    if (historicalRiskScores && historicalRiskScores.length >= 3) {
      const recentScores = historicalRiskScores.slice(-3);
      const avgChange = (recentScores[2].score - recentScores[0].score) / 2;
      
      if (avgChange > 5) {
        riskTrajectory = 'worsening';
        predictedRiskScore = Math.min(100, currentRiskScore + avgChange * 2);
      } else if (avgChange < -5) {
        riskTrajectory = 'improving';
        predictedRiskScore = Math.max(0, currentRiskScore + avgChange * 2);
      }
    }

    // Determine alert level
    let alertLevel: RiskForecast['alertLevel'] = 'none';
    if (predictedRiskScore >= 80) alertLevel = 'critical';
    else if (predictedRiskScore >= 60) alertLevel = 'high';
    else if (predictedRiskScore >= 40) alertLevel = 'medium';
    else if (predictedRiskScore >= 20) alertLevel = 'low';

    return {
      contractId,
      currentRiskScore,
      predictedRiskScore,
      riskTrajectory,
      riskFactors,
      alertLevel,
    };
  }

  /**
   * Generate value optimization recommendations
   */
  async optimizeValue(
    tenantId: string,
    contractId: string,
    features: ContractFeatures,
    marketData?: { averagePrice?: number; bestPrice?: number }
  ): Promise<ValueOptimization> {
    const optimizations: ValueOptimization['optimizations'] = [];
    let potentialSavings = 0;

    // Pricing optimization
    if (marketData?.averagePrice && features.contractValue > marketData.averagePrice * 1.1) {
      const pricingGap = features.contractValue - marketData.averagePrice;
      const savingsOpportunity = pricingGap * 0.7; // Assume 70% capture
      potentialSavings += savingsOpportunity;
      
      optimizations.push({
        type: 'pricing',
        description: 'Renegotiate pricing to market rate',
        potentialImpact: savingsOpportunity,
        implementationEffort: 'medium',
        probability: 0.6,
      });
    }

    // Term optimization
    if (features.termMonths < 24 && features.renewalCount > 0) {
      const termSavings = features.contractValue * 0.08; // 8% discount for longer term
      potentialSavings += termSavings;
      
      optimizations.push({
        type: 'terms',
        description: 'Negotiate longer term for volume discount',
        potentialImpact: termSavings,
        implementationEffort: 'low',
        probability: 0.7,
      });
    }

    // Utilization optimization
    if (features.utilizationRate !== undefined && features.utilizationRate < 0.7) {
      const underutilization = (1 - features.utilizationRate) * features.contractValue;
      const scopeOptimization = underutilization * 0.5;
      potentialSavings += scopeOptimization;
      
      optimizations.push({
        type: 'scope',
        description: 'Right-size contract to match actual utilization',
        potentialImpact: scopeOptimization,
        implementationEffort: 'medium',
        probability: 0.65,
      });
    }

    // Timing optimization
    if (features.remainingMonths > 9 && features.remainingMonths < 15) {
      optimizations.push({
        type: 'timing',
        description: 'Early renewal for additional discount',
        potentialImpact: features.contractValue * 0.05,
        implementationEffort: 'low',
        probability: 0.5,
      });
      potentialSavings += features.contractValue * 0.05;
    }

    // Sort by potential impact
    optimizations.sort((a, b) => b.potentialImpact - a.potentialImpact);

    return {
      contractId,
      currentValue: features.contractValue,
      optimizedValue: features.contractValue - potentialSavings,
      potentialSavings,
      optimizations,
    };
  }

  /**
   * Generate portfolio-level predictions
   */
  async predictPortfolio(
    tenantId: string,
    contracts: { contractId: string; features: ContractFeatures; name: string }[],
    horizon: TimeHorizon = '90d'
  ): Promise<PortfolioPrediction> {
    const renewalPredictions = {
      likelyToRenew: 0,
      atRisk: 0,
      likelyToChurn: 0,
      unknownOutcome: 0,
    };

    let currentValue = 0;
    let projectedValue = 0;
    
    const riskOutlook = {
      improving: 0,
      stable: 0,
      worsening: 0,
      totalRisk: 0,
      projectedTotalRisk: 0,
    };

    const opportunities: PortfolioPrediction['opportunities'] = [];
    const risks: PortfolioPrediction['risks'] = [];

    for (const contract of contracts) {
      const { features, name } = contract;
      currentValue += features.contractValue;

      // Predict renewal
      const renewalPred = await this.predictRenewal(
        tenantId, 
        contract.contractId, 
        features, 
        horizon
      );

      if (renewalPred.probability! >= 0.7) {
        renewalPredictions.likelyToRenew++;
        projectedValue += features.contractValue;
      } else if (renewalPred.probability! >= 0.4) {
        renewalPredictions.atRisk++;
        projectedValue += features.contractValue * 0.5;
      } else {
        renewalPredictions.likelyToChurn++;
      }

      // Forecast risk
      const riskForecast = await this.forecastRisk(
        tenantId, 
        contract.contractId, 
        features
      );

      riskOutlook.totalRisk += riskForecast.currentRiskScore;
      riskOutlook.projectedTotalRisk += riskForecast.predictedRiskScore;

      if (riskForecast.riskTrajectory === 'improving') {
        riskOutlook.improving++;
      } else if (riskForecast.riskTrajectory === 'worsening') {
        riskOutlook.worsening++;
        
        // Add to risks list
        if (risks.length < 5) {
          risks.push({
            contractId: contract.contractId,
            contractName: name,
            riskType: riskForecast.riskFactors[0]?.factor || 'General',
            probability: riskForecast.predictedRiskScore / 100,
            impact: features.contractValue * 0.2,
            mitigation: riskForecast.riskFactors[0]?.mitigation || 'Review contract',
          });
        }
      } else {
        riskOutlook.stable++;
      }

      // Check for opportunities
      const optimization = await this.optimizeValue(
        tenantId, 
        contract.contractId, 
        features
      );

      if (optimization.potentialSavings > 0 && opportunities.length < 5) {
        opportunities.push({
          contractId: contract.contractId,
          contractName: name,
          type: optimization.optimizations[0]?.type || 'general',
          potentialValue: optimization.potentialSavings,
          action: optimization.optimizations[0]?.description || 'Optimize contract',
        });
      }
    }

    // Sort opportunities and risks
    opportunities.sort((a, b) => b.potentialValue - a.potentialValue);
    risks.sort((a, b) => (b.probability * b.impact) - (a.probability * a.impact));

    const contractCount = contracts.length || 1;

    return {
      tenantId,
      horizon,
      renewalPredictions,
      projectedValue: {
        current: currentValue,
        projected: projectedValue,
        change: projectedValue - currentValue,
        changePercent: ((projectedValue - currentValue) / currentValue) * 100,
      },
      riskOutlook: {
        improving: riskOutlook.improving,
        stable: riskOutlook.stable,
        worsening: riskOutlook.worsening,
        averageRiskScore: riskOutlook.totalRisk / contractCount,
        projectedRiskScore: riskOutlook.projectedTotalRisk / contractCount,
      },
      opportunities: opportunities.slice(0, 5),
      risks: risks.slice(0, 5),
    };
  }

  /**
   * Get prediction by ID
   */
  getPrediction(predictionId: string): Prediction | null {
    return this.predictions.get(predictionId) || null;
  }

  /**
   * Get predictions for contract
   */
  getContractPredictions(
    tenantId: string, 
    contractId: string
  ): Prediction[] {
    return Array.from(this.predictions.values())
      .filter(p => p.tenantId === tenantId && p.contractId === contractId)
      .sort((a, b) => b.predictedAt.getTime() - a.predictedAt.getTime());
  }

  // Private helper methods

  private generateRenewalRecommendations(
    probability: number,
    factors: PredictionFactor[],
    features: ContractFeatures
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    let priority = 1;

    if (probability < 0.5) {
      recommendations.push({
        id: randomUUID(),
        action: 'Schedule strategic review meeting with vendor',
        impact: 'Address relationship concerns before renewal',
        effort: 'low',
        priority: priority++,
      });
    }

    const negativeFactors = factors.filter(f => f.impact === 'negative');
    for (const factor of negativeFactors.slice(0, 2)) {
      recommendations.push({
        id: randomUUID(),
        action: `Address ${factor.name.toLowerCase()} concerns`,
        impact: `Could improve renewal probability by ${Math.abs(factor.weight * 100).toFixed(0)}%`,
        effort: 'medium',
        priority: priority++,
      });
    }

    if (features.marketComparison && features.marketComparison > 1.1) {
      recommendations.push({
        id: randomUUID(),
        action: 'Prepare competitive analysis for negotiation',
        impact: 'Leverage market data for better pricing',
        effort: 'medium',
        priority: priority++,
        potentialValue: features.contractValue * (features.marketComparison - 1),
      });
    }

    if (features.remainingMonths < 6) {
      recommendations.push({
        id: randomUUID(),
        action: 'Initiate renewal discussions',
        impact: 'Avoid last-minute negotiations',
        effort: 'low',
        priority: 1, // High priority
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  private calculateDataCompleteness(features: ContractFeatures): number {
    const totalFields = 15;
    let filledFields = 5; // Base required fields

    if (features.utilizationRate !== undefined) filledFields++;
    if (features.satisfactionScore !== undefined) filledFields++;
    if (features.issueCount !== undefined) filledFields++;
    if (features.slaViolations !== undefined) filledFields++;
    if (features.paymentHistory !== undefined) filledFields++;
    if (features.priceChangePercent !== undefined) filledFields++;
    if (features.marketComparison !== undefined) filledFields++;
    if (features.lastInteractionDays !== undefined) filledFields++;
    if (features.communicationFrequency !== undefined) filledFields++;
    if (features.escalationCount !== undefined) filledFields++;

    return filledFields / totalFields;
  }

  private calculateFeatureImportance(
    factors: PredictionFactor[]
  ): Record<string, number> {
    const importance: Record<string, number> = {};
    const totalWeight = factors.reduce((sum, f) => sum + Math.abs(f.weight), 0) || 1;

    for (const factor of factors) {
      importance[factor.name] = Math.abs(factor.weight) / totalWeight;
    }

    return importance;
  }

  private calculateValidUntil(horizon: TimeHorizon): Date {
    const now = new Date();
    const days: Record<TimeHorizon, number> = {
      '30d': 7,
      '60d': 14,
      '90d': 21,
      '6m': 30,
      '1y': 60,
      '2y': 90,
    };

    return new Date(now.getTime() + days[horizon] * 24 * 60 * 60 * 1000);
  }
}

// Export singleton
export const predictiveAnalyticsEngine = new PredictiveAnalyticsEngine();
export { PredictiveAnalyticsEngine };

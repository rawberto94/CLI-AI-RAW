/**
 * Unit Tests for Predictive Analytics Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    aiPrediction: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { PredictiveAnalyticsEngine, type ContractFeatures } from '../../src/services/predictive-analytics-engine.service';

function makeFeatures(overrides: Partial<ContractFeatures> = {}): ContractFeatures {
  return {
    contractType: 'service_agreement',
    contractValue: 100000,
    currency: 'USD',
    termMonths: 24,
    remainingMonths: 12,
    vendorTenure: 30,
    renewalCount: 2,
    amendmentCount: 1,
    ...overrides,
  };
}

describe('PredictiveAnalyticsEngine', () => {
  let engine: PredictiveAnalyticsEngine;

  beforeEach(() => {
    engine = new PredictiveAnalyticsEngine();
  });

  describe('predictRenewal', () => {
    it('should return a prediction with correct structure', async () => {
      const prediction = await engine.predictRenewal('t1', 'c1', makeFeatures(), '90d');

      expect(prediction.id).toBeDefined();
      expect(prediction.tenantId).toBe('t1');
      expect(prediction.contractId).toBe('c1');
      expect(prediction.type).toBe('renewal');
      expect(prediction.horizon).toBe('90d');
      expect(prediction.predictedValue).toBeGreaterThan(0);
      expect(prediction.predictedValue).toBeLessThanOrEqual(1);
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.factors.length).toBeGreaterThan(0);
      expect(prediction.validUntil).toBeInstanceOf(Date);
      expect(prediction.modelVersion).toBeDefined();
    });

    it('should give high renewal probability for strong features', async () => {
      const features = makeFeatures({
        vendorTenure: 48,
        renewalCount: 5,
        satisfactionScore: 5,
        issueCount: 0,
        slaViolations: 0,
        marketComparison: 0.8,
      });

      const prediction = await engine.predictRenewal('t1', 'c1', features);
      expect(prediction.probability).toBeGreaterThanOrEqual(0.7);
    });

    it('should give low renewal probability for weak features', async () => {
      const features = makeFeatures({
        vendorTenure: 3,
        renewalCount: 0,
        satisfactionScore: 1,
        issueCount: 20,
        slaViolations: 10,
        marketComparison: 1.5,
      });

      const prediction = await engine.predictRenewal('t1', 'c1', features);
      expect(prediction.probability).toBeLessThanOrEqual(0.3);
    });

    it('should clamp probability between 0.05 and 0.95', async () => {
      const veryBad = makeFeatures({
        vendorTenure: 1,
        renewalCount: 0,
        satisfactionScore: 0,
        issueCount: 100,
        slaViolations: 50,
        marketComparison: 2.0,
      });

      const prediction = await engine.predictRenewal('t1', 'c1', veryBad);
      expect(prediction.probability).toBeGreaterThanOrEqual(0.05);
      expect(prediction.probability).toBeLessThanOrEqual(0.95);
    });

    it('should include factor for vendor tenure', async () => {
      const prediction = await engine.predictRenewal('t1', 'c1', makeFeatures({ vendorTenure: 30 }));

      const tenureFactor = prediction.factors.find(f => f.name === 'Vendor Tenure');
      expect(tenureFactor).toBeDefined();
      expect(tenureFactor!.impact).toBe('positive');
    });

    it('should generate recommendations when probability is low', async () => {
      const features = makeFeatures({
        vendorTenure: 3,
        renewalCount: 0,
        satisfactionScore: 1,
        issueCount: 20,
        slaViolations: 5,
        remainingMonths: 3,
      });

      const prediction = await engine.predictRenewal('t1', 'c1', features);
      expect(prediction.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate feature importance', async () => {
      const prediction = await engine.predictRenewal('t1', 'c1', makeFeatures({ satisfactionScore: 4 }));

      expect(Object.keys(prediction.featureImportance).length).toBeGreaterThan(0);
      const total = Object.values(prediction.featureImportance).reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(1, 1);
    });

    it('should calculate higher confidence with more data', async () => {
      const sparse = makeFeatures();
      const rich = makeFeatures({
        utilizationRate: 0.8,
        satisfactionScore: 4,
        issueCount: 2,
        slaViolations: 0,
        paymentHistory: 'excellent',
        priceChangePercent: 5,
        marketComparison: 1.0,
        lastInteractionDays: 7,
        communicationFrequency: 10,
        escalationCount: 0,
      });

      const sparsePred = await engine.predictRenewal('t1', 'c1', sparse);
      const richPred = await engine.predictRenewal('t1', 'c2', rich);

      expect(richPred.confidence).toBeGreaterThan(sparsePred.confidence);
    });
  });

  describe('forecastRisk', () => {
    it('should return risk forecast with correct structure', async () => {
      const risk = await engine.forecastRisk('t1', 'c1', makeFeatures());

      expect(risk.contractId).toBe('c1');
      expect(typeof risk.currentRiskScore).toBe('number');
      expect(typeof risk.predictedRiskScore).toBe('number');
      expect(['improving', 'stable', 'worsening']).toContain(risk.riskTrajectory);
      expect(['critical', 'high', 'medium', 'low', 'none']).toContain(risk.alertLevel);
    });

    it('should return higher risk for non-compliant contracts', async () => {
      const compliant = await engine.forecastRisk('t1', 'c1', makeFeatures({ complianceStatus: 'compliant' }));
      const nonCompliant = await engine.forecastRisk('t1', 'c2', makeFeatures({ complianceStatus: 'non_compliant' }));

      expect(nonCompliant.currentRiskScore).toBeGreaterThan(compliant.currentRiskScore);
    });

    it('should flag high risk for expiring contracts', async () => {
      const risk = await engine.forecastRisk('t1', 'c1', makeFeatures({ remainingMonths: 2 }));

      const expirationFactor = risk.riskFactors.find(f => f.factor === 'Expiration Risk');
      expect(expirationFactor).toBeDefined();
      expect(expirationFactor!.currentImpact).toBe(20);
    });

    it('should detect worsening trajectory from historical data', async () => {
      const historicalScores = [
        { date: new Date('2025-01-01'), score: 30 },
        { date: new Date('2025-02-01'), score: 45 },
        { date: new Date('2025-03-01'), score: 60 },
      ];

      const risk = await engine.forecastRisk('t1', 'c1', makeFeatures(), historicalScores);
      expect(risk.riskTrajectory).toBe('worsening');
    });

    it('should detect improving trajectory', async () => {
      const historicalScores = [
        { date: new Date('2025-01-01'), score: 70 },
        { date: new Date('2025-02-01'), score: 55 },
        { date: new Date('2025-03-01'), score: 40 },
      ];

      const risk = await engine.forecastRisk('t1', 'c1', makeFeatures(), historicalScores);
      expect(risk.riskTrajectory).toBe('improving');
    });

    it('should assign alert levels correctly', async () => {
      // High risk contract
      const risk = await engine.forecastRisk('t1', 'c1', makeFeatures({
        complianceStatus: 'non_compliant',
        slaViolations: 10,
        remainingMonths: 1,
        marketComparison: 1.5,
      }));

      expect(['critical', 'high']).toContain(risk.alertLevel);
    });
  });

  describe('optimizeValue', () => {
    it('should return optimization structure', async () => {
      const result = await engine.optimizeValue('t1', 'c1', makeFeatures());

      expect(result.contractId).toBe('c1');
      expect(typeof result.currentValue).toBe('number');
      expect(typeof result.optimizedValue).toBe('number');
      expect(typeof result.potentialSavings).toBe('number');
      expect(Array.isArray(result.optimizations)).toBe(true);
    });

    it('should suggest pricing optimization when above market', async () => {
      const result = await engine.optimizeValue(
        't1', 'c1',
        makeFeatures({ contractValue: 100000 }),
        { averagePrice: 70000 }
      );

      const pricingOpt = result.optimizations.find(o => o.type === 'pricing');
      expect(pricingOpt).toBeDefined();
      expect(result.potentialSavings).toBeGreaterThan(0);
    });

    it('should suggest term optimization for short-term renewed contracts', async () => {
      const result = await engine.optimizeValue('t1', 'c1', makeFeatures({
        termMonths: 12,
        renewalCount: 2,
      }));

      const termOpt = result.optimizations.find(o => o.type === 'terms');
      expect(termOpt).toBeDefined();
    });

    it('should suggest scope optimization for underutilized contracts', async () => {
      const result = await engine.optimizeValue('t1', 'c1', makeFeatures({
        utilizationRate: 0.4,
      }));

      const scopeOpt = result.optimizations.find(o => o.type === 'scope');
      expect(scopeOpt).toBeDefined();
      expect(scopeOpt!.potentialImpact).toBeGreaterThan(0);
    });

    it('should suggest timing optimization for mid-term contracts', async () => {
      const result = await engine.optimizeValue('t1', 'c1', makeFeatures({
        remainingMonths: 11,
      }));

      const timingOpt = result.optimizations.find(o => o.type === 'timing');
      expect(timingOpt).toBeDefined();
    });

    it('should sort optimizations by potential impact', async () => {
      const result = await engine.optimizeValue(
        't1', 'c1',
        makeFeatures({ utilizationRate: 0.3, termMonths: 12, renewalCount: 1, remainingMonths: 10 }),
        { averagePrice: 60000 }
      );

      if (result.optimizations.length >= 2) {
        expect(result.optimizations[0]!.potentialImpact).toBeGreaterThanOrEqual(
          result.optimizations[1]!.potentialImpact
        );
      }
    });
  });

  describe('getPrediction / getContractPredictions', () => {
    it('should return prediction by id after predictRenewal', async () => {
      const prediction = await engine.predictRenewal('t1', 'c1', makeFeatures());

      const found = engine.getPrediction(prediction.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(prediction.id);
    });

    it('should return null for missing prediction', () => {
      expect(engine.getPrediction('does-not-exist')).toBeNull();
    });

    it('should return all predictions for a contract', async () => {
      await engine.predictRenewal('t1', 'c1', makeFeatures());
      await engine.predictRenewal('t1', 'c1', makeFeatures());
      await engine.predictRenewal('t1', 'c2', makeFeatures());

      const c1Predictions = engine.getContractPredictions('t1', 'c1');
      expect(c1Predictions.length).toBe(2);
    });

    it('should sort contract predictions newest first', async () => {
      await engine.predictRenewal('t1', 'c1', makeFeatures());
      await new Promise(r => setTimeout(r, 10));
      await engine.predictRenewal('t1', 'c1', makeFeatures());

      const preds = engine.getContractPredictions('t1', 'c1');
      expect(preds[0]!.predictedAt.getTime()).toBeGreaterThanOrEqual(preds[1]!.predictedAt.getTime());
    });
  });

  describe('predictPortfolio', () => {
    it('should aggregate predictions across contracts', async () => {
      const contracts = [
        { contractId: 'c1', name: 'Contract 1', features: makeFeatures({ vendorTenure: 48, renewalCount: 5, satisfactionScore: 5 }) },
        { contractId: 'c2', name: 'Contract 2', features: makeFeatures({ vendorTenure: 3, renewalCount: 0, satisfactionScore: 1, issueCount: 20 }) },
      ];

      const portfolio = await engine.predictPortfolio('t1', contracts, '90d');

      expect(portfolio.tenantId).toBe('t1');
      expect(portfolio.horizon).toBe('90d');
      expect(portfolio.renewalPredictions.likelyToRenew + portfolio.renewalPredictions.atRisk + portfolio.renewalPredictions.likelyToChurn + portfolio.renewalPredictions.unknownOutcome).toBe(2);
      expect(portfolio.projectedValue.current).toBeGreaterThan(0);
    });
  });
});

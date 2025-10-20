/**
 * Cost Savings Analyzer Service Tests
 */

import { costSavingsAnalyzerService } from '../services/cost-savings-analyzer.service';

describe('CostSavingsAnalyzerService', () => {
  describe('Rate Optimization', () => {
    test('identifies above-market rates', async () => {
      const artifacts = {
        rates: {
          rateCards: [
            { role: 'Senior Developer', rate: 200, unit: 'hour', currency: 'USD' },
            { role: 'Junior Developer', rate: 150, unit: 'hour', currency: 'USD' }
          ]
        },
        financial: {
          totalValue: 500000,
          currency: 'USD'
        }
      };

      const analysis = await costSavingsAnalyzerService.analyzeCostSavings(artifacts);

      expect(analysis.opportunities.length).toBeGreaterThan(0);
      expect(analysis.opportunities.some(o => o.category === 'rate_optimization')).toBe(true);
    });

    test('identifies location-based optimization', async () => {
      const artifacts = {
        rates: {
          rateCards: [
            { role: 'Developer', rate: 175, unit: 'hour', currency: 'USD', location: 'US' }
          ],
          locations: ['US'] // No offshore
        },
        financial: {
          totalValue: 500000,
          currency: 'USD'
        }
      };

      const analysis = await costSavingsAnalyzerService.analyzeCostSavings(artifacts);

      const locationOpp = analysis.opportunities.find(o => 
        o.title.toLowerCase().includes('location')
      );

      expect(locationOpp).toBeDefined();
      expect(locationOpp?.confidence).toBe('high');
      expect(locationOpp?.potentialSavings.percentage).toBeGreaterThan(20);
    });
  });

  describe('Payment Terms', () => {
    test('identifies early payment discount opportunity', async () => {
      const artifacts = {
        financial: {
          totalValue: 500000,
          currency: 'USD',
          paymentTerms: ['Net 30'] // No discount mentioned
        }
      };

      const analysis = await costSavingsAnalyzerService.analyzeCostSavings(artifacts);

      const paymentOpp = analysis.opportunities.find(o => 
        o.category === 'payment_terms'
      );

      expect(paymentOpp).toBeDefined();
      expect(paymentOpp?.confidence).toBe('high');
      expect(paymentOpp?.effort).toBe('low');
    });
  });

  describe('Volume Discounts', () => {
    test('identifies volume discount opportunity for large contracts', async () => {
      const artifacts = {
        financial: {
          totalValue: 500000,
          currency: 'USD',
          discounts: [] // No volume discounts
        }
      };

      const analysis = await costSavingsAnalyzerService.analyzeCostSavings(artifacts);

      const volumeOpp = analysis.opportunities.find(o => 
        o.category === 'volume_discount'
      );

      expect(volumeOpp).toBeDefined();
      expect(volumeOpp?.potentialSavings.percentage).toBeGreaterThan(3);
    });
  });

  describe('Categorization', () => {
    test('categorizes quick wins correctly', async () => {
      const artifacts = {
        financial: {
          totalValue: 100000,
          currency: 'USD',
          paymentTerms: ['Net 30']
        }
      };

      const analysis = await costSavingsAnalyzerService.analyzeCostSavings(artifacts);

      expect(analysis.quickWins.length).toBeGreaterThan(0);
      expect(analysis.quickWins.every(o => 
        o.confidence === 'high' && o.effort === 'low'
      )).toBe(true);
    });

    test('categorizes strategic initiatives correctly', async () => {
      const artifacts = {
        rates: {
          rateCards: [
            { role: 'Developer', rate: 175, unit: 'hour', currency: 'USD' }
          ],
          locations: ['US']
        },
        financial: {
          totalValue: 500000,
          currency: 'USD'
        }
      };

      const analysis = await costSavingsAnalyzerService.analyzeCostSavings(artifacts);

      expect(analysis.strategicInitiatives.length).toBeGreaterThan(0);
      expect(analysis.strategicInitiatives.some(o => 
        o.potentialSavings.amount > 50000 || o.effort === 'high'
      )).toBe(true);
    });
  });

  describe('Summary Generation', () => {
    test('generates accurate summary', async () => {
      const artifacts = {
        financial: {
          totalValue: 500000,
          currency: 'USD',
          paymentTerms: ['Net 30']
        },
        rates: {
          rateCards: [
            { role: 'Developer', rate: 175, unit: 'hour', currency: 'USD' }
          ]
        }
      };

      const analysis = await costSavingsAnalyzerService.analyzeCostSavings(artifacts);
      const summary = costSavingsAnalyzerService.generateSavingsSummary(analysis);

      expect(summary).toContain('Total Potential Savings');
      expect(summary).toContain('Quick Wins');
      expect(summary).toContain('Top 3 Opportunities');
    });
  });
});

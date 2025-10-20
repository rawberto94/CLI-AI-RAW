/**
 * Artifact Validation Service Tests
 */

import { artifactValidationService } from '../services/artifact-validation.service';

describe('ArtifactValidationService', () => {
  describe('OVERVIEW Validation', () => {
    test('validates complete OVERVIEW artifact', () => {
      const artifact = {
        summary: 'Professional services agreement for software development',
        contractType: 'Professional Services Agreement',
        parties: [
          { name: 'Acme Corp', role: 'client', type: 'corporation' },
          { name: 'Tech Solutions LLC', role: 'vendor', type: 'llc' }
        ],
        effectiveDate: '2024-01-01',
        expirationDate: '2025-01-01',
        term: '12 months'
      };

      const result = artifactValidationService.validateArtifact('OVERVIEW', artifact);

      expect(result.valid).toBe(true);
      expect(result.completeness).toBeGreaterThan(80);
      expect(result.criticalIssues).toBe(0);
    });

    test('detects missing required fields', () => {
      const artifact = {
        summary: 'Test',
        parties: []
      };

      const result = artifactValidationService.validateArtifact('OVERVIEW', artifact);

      expect(result.valid).toBe(false);
      expect(result.criticalIssues).toBeGreaterThan(0);
      expect(result.issues.some(i => i.field === 'contractType')).toBe(true);
      expect(result.issues.some(i => i.field === 'parties')).toBe(true);
    });

    test('auto-fixes date formats', () => {
      const artifact = {
        summary: 'Test contract',
        contractType: 'Service Agreement',
        parties: [
          { name: 'Company A', role: 'client' },
          { name: 'Company B', role: 'vendor' }
        ],
        effectiveDate: '01/15/2024' // Wrong format
      };

      const validation = artifactValidationService.validateArtifact('OVERVIEW', artifact);
      const fixResult = artifactValidationService.autoFix(artifact, validation.issues);

      expect(fixResult.fixed).toBe(true);
      expect(fixResult.artifact.effectiveDate).toBe('2024-01-15');
    });
  });

  describe('FINANCIAL Validation', () => {
    test('validates complete FINANCIAL artifact', () => {
      const artifact = {
        totalValue: 500000,
        currency: 'USD',
        paymentTerms: ['Net 30', 'Monthly invoicing'],
        costBreakdown: [
          { category: 'Development', amount: 400000 },
          { category: 'Support', amount: 100000 }
        ]
      };

      const result = artifactValidationService.validateArtifact('FINANCIAL', artifact);

      expect(result.valid).toBe(true);
      expect(result.completeness).toBeGreaterThan(70);
    });

    test('detects invalid amounts', () => {
      const artifact = {
        totalValue: -1000, // Invalid
        currency: 'USD'
      };

      const result = artifactValidationService.validateArtifact('FINANCIAL', artifact);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.field === 'totalValue')).toBe(true);
    });
  });

  describe('Consistency Validation', () => {
    test('validates currency consistency', () => {
      const artifacts = new Map();
      
      artifacts.set('FINANCIAL', {
        currency: 'USD',
        totalValue: 500000
      });

      artifacts.set('RATES', {
        rateCards: [
          { role: 'Developer', rate: 150, currency: 'EUR' } // Different currency
        ]
      });

      const result = artifactValidationService.validateConsistency(artifacts);

      expect(result.consistent).toBe(false);
      expect(result.issues.some(i => i.field === 'currency')).toBe(true);
    });

    test('validates date consistency', () => {
      const artifacts = new Map();
      
      artifacts.set('OVERVIEW', {
        effectiveDate: '2024-12-01',
        expirationDate: '2024-01-01' // Before effective date
      });

      const result = artifactValidationService.validateConsistency(artifacts);

      expect(result.consistent).toBe(false);
      expect(result.issues.some(i => i.severity === 'critical')).toBe(true);
    });
  });

  describe('Completeness Scoring', () => {
    test('calculates completeness correctly', () => {
      const completeArtifact = {
        summary: 'Complete contract',
        contractType: 'Service Agreement',
        parties: [{ name: 'A' }, { name: 'B' }],
        effectiveDate: '2024-01-01',
        expirationDate: '2025-01-01',
        term: '12 months',
        jurisdiction: 'California',
        keyTerms: ['Term 1', 'Term 2']
      };

      const result = artifactValidationService.validateArtifact('OVERVIEW', completeArtifact);

      expect(result.completeness).toBeGreaterThan(90);
    });

    test('penalizes missing optional fields', () => {
      const minimalArtifact = {
        summary: 'Minimal contract',
        contractType: 'Service Agreement',
        parties: [{ name: 'A' }, { name: 'B' }]
      };

      const result = artifactValidationService.validateArtifact('OVERVIEW', minimalArtifact);

      expect(result.completeness).toBeLessThan(80);
    });
  });
});

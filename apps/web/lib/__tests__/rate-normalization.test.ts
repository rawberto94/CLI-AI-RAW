// Unit tests for Rate Normalization Service

import { 
  RateNormalizationService, 
  rateNormalizer, 
  normalizeRateCard, 
  convertRate,
  standardizeRoleName,
  type RateInput 
} from '../rate-normalization';

describe('RateNormalizationService', () => {
  let service: RateNormalizationService;

  beforeEach(() => {
    service = new RateNormalizationService();
  });

  describe('normalizeRate', () => {
    it('should normalize hourly rate correctly', () => {
      const input: RateInput = {
        role: 'Senior Developer',
        level: 'Senior',
        rate: 150,
        unit: 'hourly',
        currency: 'USD'
      };

      const result = service.normalizeRate(input);

      expect(result.hourlyRate).toBe(150);
      expect(result.dailyRate).toBe(1200); // 150 * 8 hours
      expect(result.monthlyRate).toBe(26400); // 1200 * 22 days
      expect(result.annualRate).toBe(316800); // 26400 * 12 months
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should normalize daily rate correctly', () => {
      const input: RateInput = {
        role: 'Project Manager',
        level: 'Senior',
        rate: 1200,
        unit: 'daily',
        currency: 'USD'
      };

      const result = service.normalizeRate(input);

      expect(result.hourlyRate).toBe(150); // 1200 / 8 hours
      expect(result.dailyRate).toBe(1200);
      expect(result.monthlyRate).toBe(26400);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should normalize monthly rate correctly', () => {
      const input: RateInput = {
        role: 'Business Analyst',
        level: 'Mid',
        rate: 22000,
        unit: 'monthly',
        currency: 'USD'
      };

      const result = service.normalizeRate(input);

      expect(result.hourlyRate).toBe(125); // 22000 / (8 * 22)
      expect(result.dailyRate).toBe(1000);
      expect(result.monthlyRate).toBe(22000);
      expect(result.annualRate).toBe(264000);
    });

    it('should handle currency conversion', () => {
      const input: RateInput = {
        role: 'Developer',
        level: 'Mid',
        rate: 100, // EUR
        unit: 'hourly',
        currency: 'EUR'
      };

      const result = service.normalizeRate(input);

      expect(result.hourlyRate).toBe(108); // 100 * 1.08 EUR to USD rate
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBeLessThan(1.0); // Reduced for currency conversion
    });

    it('should standardize role names', () => {
      const input: RateInput = {
        role: 'sr developer',
        level: 'Senior',
        rate: 140,
        unit: 'hourly',
        currency: 'USD'
      };

      const result = service.normalizeRate(input);

      expect(result.standardizedRole).toBe('Senior Developer');
    });

    it('should handle custom hours per day', () => {
      const input: RateInput = {
        role: 'Consultant',
        level: 'Senior',
        rate: 1000,
        unit: 'daily',
        currency: 'USD',
        hoursPerDay: 10
      };

      const result = service.normalizeRate(input);

      expect(result.hourlyRate).toBe(100); // 1000 / 10 hours
      expect(result.dailyRate).toBe(1000); // Uses original daily rate
    });
  });

  describe('normalizeRates', () => {
    it('should normalize multiple rates', () => {
      const inputs: RateInput[] = [
        {
          role: 'Senior Developer',
          level: 'Senior',
          rate: 150,
          unit: 'hourly',
          currency: 'USD'
        },
        {
          role: 'Project Manager',
          level: 'Senior',
          rate: 1200,
          unit: 'daily',
          currency: 'USD'
        }
      ];

      const results = service.normalizeRates(inputs);

      expect(results).toHaveLength(2);
      expect(results[0].hourlyRate).toBe(150);
      expect(results[1].hourlyRate).toBe(150);
    });
  });

  describe('validateRateInput', () => {
    it('should validate correct input', () => {
      const input: RateInput = {
        role: 'Developer',
        level: 'Mid',
        rate: 100,
        unit: 'hourly',
        currency: 'USD'
      };

      const result = service.validateRateInput(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing role', () => {
      const input: RateInput = {
        role: '',
        level: 'Mid',
        rate: 100,
        unit: 'hourly',
        currency: 'USD'
      };

      const result = service.validateRateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Role is required');
    });

    it('should detect invalid rate', () => {
      const input: RateInput = {
        role: 'Developer',
        level: 'Mid',
        rate: -100,
        unit: 'hourly',
        currency: 'USD'
      };

      const result = service.validateRateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rate must be a positive number');
    });

    it('should detect invalid currency', () => {
      const input: RateInput = {
        role: 'Developer',
        level: 'Mid',
        rate: 100,
        unit: 'hourly',
        currency: 'INVALID'
      };

      const result = service.validateRateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Currency must be a 3-letter code (e.g., USD, EUR)');
    });
  });

  describe('role standardization', () => {
    it('should standardize common role variations', () => {
      const testCases = [
        { input: 'sr developer', expected: 'Senior Developer' },
        { input: 'Sr. Consultant', expected: 'Senior Consultant' },
        { input: 'PM', expected: 'Project Manager' },
        { input: 'BA', expected: 'Business Analyst' },
        { input: 'DevOps', expected: 'DevOps Engineer' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = standardizeRoleName(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('utility functions', () => {
    it('should normalize rate card', () => {
      const rates: RateInput[] = [
        {
          role: 'Developer',
          level: 'Mid',
          rate: 100,
          unit: 'hourly',
          currency: 'USD'
        }
      ];

      const results = normalizeRateCard(rates);

      expect(results).toHaveLength(1);
      expect(results[0].hourlyRate).toBe(100);
    });

    it('should convert between rate units', () => {
      const hourlyToDaily = convertRate(100, 'hourly', 'daily');
      expect(hourlyToDaily).toBe(800); // 100 * 8 hours

      const dailyToMonthly = convertRate(800, 'daily', 'monthly');
      expect(dailyToMonthly).toBe(17600); // 800 * 22 days
    });
  });

  describe('edge cases', () => {
    it('should handle fixed price rates', () => {
      const input: RateInput = {
        role: 'Consultant',
        level: 'Senior',
        rate: 100000,
        unit: 'fixed_price',
        currency: 'USD'
      };

      const result = service.normalizeRate(input);

      expect(result.hourlyRate).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(0.7); // Low confidence for fixed price
    });

    it('should handle unsupported currency gracefully', () => {
      const input: RateInput = {
        role: 'Developer',
        level: 'Mid',
        rate: 100,
        unit: 'hourly',
        currency: 'XYZ'
      };

      const result = service.normalizeRate(input);

      expect(result.hourlyRate).toBe(100); // Should assume USD
      expect(result.currency).toBe('USD');
    });

    it('should handle very high and very low rates', () => {
      const highRateInput: RateInput = {
        role: 'Executive Consultant',
        level: 'Executive',
        rate: 1000,
        unit: 'hourly',
        currency: 'USD'
      };

      const lowRateInput: RateInput = {
        role: 'Junior Developer',
        level: 'Junior',
        rate: 25,
        unit: 'hourly',
        currency: 'USD'
      };

      const highResult = service.normalizeRate(highRateInput);
      const lowResult = service.normalizeRate(lowRateInput);

      expect(highResult.hourlyRate).toBe(1000);
      expect(lowResult.hourlyRate).toBe(25);
      expect(highResult.annualRate).toBeGreaterThan(lowResult.annualRate);
    });
  });
});
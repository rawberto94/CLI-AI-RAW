/**
 * Unit Tests for Input Validation Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { inputValidationService } from '../../src/services/input-validation.service';
import { z } from 'zod';

describe('InputValidationService', () => {
  const service = inputValidationService;

  describe('validate', () => {
    it('should validate valid data against schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const data = { name: 'John', age: 30 };

      const result = service.validate(schema, data);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.errors).toBeUndefined();
    });

    it('should return errors for invalid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const data = { name: 'John', age: 'thirty' };

      const result = service.validate(schema, data);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should validate nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      });

      const validData = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      };

      const result = service.validate(schema, validData);

      expect(result.success).toBe(true);
    });

    it('should validate arrays', () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });

      const data = { tags: ['tag1', 'tag2', 'tag3'] };

      const result = service.validate(schema, data);

      expect(result.success).toBe(true);
      expect(result.data?.tags).toHaveLength(3);
    });
  });

  describe('validateTenantId', () => {
    it('should validate valid tenant ID', () => {
      const result = service.validateTenantId('123e4567-e89b-12d3-a456-426614174000');
      expect(result.success).toBe(true);
      expect(result.data).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should reject invalid tenant ID', () => {
      const result = service.validateTenantId('invalid-id');
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject null tenant ID', () => {
      const result = service.validateTenantId(null);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validatePartial', () => {
    it('should validate partial data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
      });

      const partialData = {
        name: 'John',
      };

      const result = service.validatePartial(schema, partialData);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('John');
    });
  });

  describe('validateBatch', () => {
    it('should validate multiple items', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const items = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Invalid', age: 'not-a-number' },
      ];

      const result = service.validateBatch(schema, items);
      
      expect(result.validItems.length).toBe(2);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].index).toBe(2);
    });
  });

  describe('formatErrorResponse', () => {
    it('should format validation errors for API response', () => {
      const errors = [
        { field: 'email', message: 'Invalid email', code: 'invalid_string' },
      ];

      const response = service.formatErrorResponse(errors);

      expect(response.error).toBe('VALIDATION_ERROR');
      expect(response.message).toBe('Request validation failed');
      expect(response.details).toEqual(errors);
    });
  });
});

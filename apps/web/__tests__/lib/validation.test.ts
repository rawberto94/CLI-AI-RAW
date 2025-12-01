/**
 * Tests for validation utilities
 * @see /lib/validation.ts
 */
import { describe, it, expect } from 'vitest';
import {
  validate,
  createSchema,
  validateField,
  required,
  optional,
  string,
  minLength,
  maxLength,
  email,
  pattern,
  url,
  uuid,
  trim,
  number,
  integer,
  min,
  max,
  range,
  positive,
  boolean,
  date,
  pastDate,
  futureDate,
  array,
  arrayLength,
  arrayOf,
  oneOf,
  custom,
  transform,
  schemas,
} from '../../lib/validation';

describe('Validation Utilities', () => {
  describe('Core Validators', () => {
    describe('required', () => {
      it('should pass for non-empty values', () => {
        expect(required()('hello', 'field').isValid).toBe(true);
        expect(required()(0, 'field').isValid).toBe(true);
        expect(required()(false, 'field').isValid).toBe(true);
      });

      it('should fail for empty values', () => {
        expect(required()('', 'field').isValid).toBe(false);
        expect(required()(null, 'field').isValid).toBe(false);
        expect(required()(undefined, 'field').isValid).toBe(false);
      });

      it('should use custom message', () => {
        const result = required('Name is required')('', 'name');
        expect(result.error).toBe('Name is required');
      });
    });

    describe('optional', () => {
      it('should pass for empty values', () => {
        expect(optional()('', 'field').isValid).toBe(true);
        expect(optional()(null, 'field').isValid).toBe(true);
        expect(optional()(undefined, 'field').isValid).toBe(true);
      });

      it('should return undefined for empty values', () => {
        expect(optional()('', 'field').value).toBeUndefined();
      });
    });
  });

  describe('String Validators', () => {
    describe('string', () => {
      it('should pass for strings', () => {
        expect(string()('hello', 'field').isValid).toBe(true);
      });

      it('should fail for non-strings', () => {
        expect(string()(123, 'field').isValid).toBe(false);
      });
    });

    describe('minLength', () => {
      it('should pass for strings meeting minimum length', () => {
        expect(minLength(3)('hello', 'field').isValid).toBe(true);
        expect(minLength(3)('abc', 'field').isValid).toBe(true);
      });

      it('should fail for strings below minimum length', () => {
        expect(minLength(3)('ab', 'field').isValid).toBe(false);
      });
    });

    describe('maxLength', () => {
      it('should pass for strings within maximum length', () => {
        expect(maxLength(3)('ab', 'field').isValid).toBe(true);
        expect(maxLength(3)('abc', 'field').isValid).toBe(true);
      });

      it('should fail for strings exceeding maximum length', () => {
        expect(maxLength(3)('abcd', 'field').isValid).toBe(false);
      });
    });

    describe('email', () => {
      it('should pass for valid emails', () => {
        expect(email()('test@example.com', 'email').isValid).toBe(true);
        expect(email()('user.name@domain.co.uk', 'email').isValid).toBe(true);
      });

      it('should fail for invalid emails', () => {
        expect(email()('invalid', 'email').isValid).toBe(false);
        expect(email()('@nodomain.com', 'email').isValid).toBe(false);
      });
    });

    describe('pattern', () => {
      it('should pass for matching patterns', () => {
        expect(pattern(/^[a-z0-9]+$/)('abc123', 'field').isValid).toBe(true);
      });

      it('should fail for non-matching patterns', () => {
        expect(pattern(/^[a-z]+$/)('ABC', 'field').isValid).toBe(false);
      });
    });

    describe('url', () => {
      it('should pass for valid URLs', () => {
        expect(url()('https://example.com', 'field').isValid).toBe(true);
        expect(url()('http://localhost:3000', 'field').isValid).toBe(true);
      });

      it('should fail for invalid URLs', () => {
        expect(url()('not-a-url', 'field').isValid).toBe(false);
      });
    });

    describe('uuid', () => {
      it('should pass for valid UUIDs', () => {
        expect(uuid()('550e8400-e29b-41d4-a716-446655440000', 'field').isValid).toBe(true);
      });

      it('should fail for invalid UUIDs', () => {
        expect(uuid()('not-a-uuid', 'field').isValid).toBe(false);
      });
    });

    describe('trim', () => {
      it('should trim whitespace', () => {
        expect(trim()('  hello  ', 'field').value).toBe('hello');
      });
    });
  });

  describe('Number Validators', () => {
    describe('number', () => {
      it('should pass for numbers', () => {
        expect(number()(42, 'field').isValid).toBe(true);
        expect(number()('42', 'field').isValid).toBe(true);
      });

      it('should fail for non-numbers', () => {
        expect(number()('not-a-number', 'field').isValid).toBe(false);
      });
    });

    describe('integer', () => {
      it('should pass for integers', () => {
        expect(integer()(42, 'field').isValid).toBe(true);
      });

      it('should fail for non-integers', () => {
        expect(integer()(3.14, 'field').isValid).toBe(false);
      });
    });

    describe('min', () => {
      it('should pass for numbers >= minimum', () => {
        expect(min(5)(5, 'field').isValid).toBe(true);
        expect(min(5)(10, 'field').isValid).toBe(true);
      });

      it('should fail for numbers < minimum', () => {
        expect(min(5)(4, 'field').isValid).toBe(false);
      });
    });

    describe('max', () => {
      it('should pass for numbers <= maximum', () => {
        expect(max(5)(5, 'field').isValid).toBe(true);
        expect(max(5)(3, 'field').isValid).toBe(true);
      });

      it('should fail for numbers > maximum', () => {
        expect(max(5)(6, 'field').isValid).toBe(false);
      });
    });

    describe('range', () => {
      it('should pass for numbers in range', () => {
        expect(range(1, 10)(5, 'field').isValid).toBe(true);
      });

      it('should fail for numbers outside range', () => {
        expect(range(1, 10)(0, 'field').isValid).toBe(false);
        expect(range(1, 10)(11, 'field').isValid).toBe(false);
      });
    });

    describe('positive', () => {
      it('should pass for positive numbers', () => {
        expect(positive()(1, 'field').isValid).toBe(true);
        expect(positive()(0, 'field').isValid).toBe(true);
      });

      it('should fail for negative numbers', () => {
        expect(positive()(-1, 'field').isValid).toBe(false);
      });
    });
  });

  describe('Boolean Validators', () => {
    describe('boolean', () => {
      it('should pass for booleans', () => {
        expect(boolean()(true, 'field').isValid).toBe(true);
        expect(boolean()(false, 'field').isValid).toBe(true);
      });

      it('should coerce string values', () => {
        expect(boolean()('true', 'field').value).toBe(true);
        expect(boolean()('false', 'field').value).toBe(false);
      });
    });
  });

  describe('Date Validators', () => {
    describe('date', () => {
      it('should pass for valid dates', () => {
        expect(date()(new Date(), 'field').isValid).toBe(true);
        expect(date()('2024-01-15', 'field').isValid).toBe(true);
      });

      it('should fail for invalid dates', () => {
        expect(date()('not-a-date', 'field').isValid).toBe(false);
      });
    });
  });

  describe('Array Validators', () => {
    describe('array', () => {
      it('should pass for arrays', () => {
        expect(array()([1, 2, 3], 'field').isValid).toBe(true);
      });

      it('should fail for non-arrays', () => {
        expect(array()('not-an-array', 'field').isValid).toBe(false);
      });
    });

    describe('arrayLength', () => {
      it('should validate minimum length', () => {
        expect(arrayLength(2)([1, 2, 3], 'field').isValid).toBe(true);
        expect(arrayLength(2)([1], 'field').isValid).toBe(false);
      });

      it('should validate maximum length', () => {
        expect(arrayLength(1, 3)([1, 2], 'field').isValid).toBe(true);
        expect(arrayLength(1, 3)([1, 2, 3, 4], 'field').isValid).toBe(false);
      });
    });

    describe('arrayOf', () => {
      it('should validate each item', () => {
        const result = arrayOf([number()])([1, 2, 3], 'field');
        expect(result.isValid).toBe(true);
      });

      it('should fail if any item is invalid', () => {
        const result = arrayOf([number()])([1, 'two', 3], 'field');
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Enum Validators', () => {
    describe('oneOf', () => {
      it('should pass for values in the list', () => {
        expect(oneOf(['a', 'b', 'c'])('a', 'field').isValid).toBe(true);
      });

      it('should fail for values not in the list', () => {
        expect(oneOf(['a', 'b', 'c'])('d', 'field').isValid).toBe(false);
      });
    });
  });

  describe('Custom Validators', () => {
    describe('custom', () => {
      it('should use custom validation function', () => {
        const isEven = custom<number>(v => (v as number) % 2 === 0, 'Must be even');

        expect(isEven(4, 'field').isValid).toBe(true);
        expect(isEven(5, 'field').isValid).toBe(false);
      });
    });

    describe('transform', () => {
      it('should transform value', () => {
        const toUpperCase = transform<string, string>(v => v.toUpperCase());
        expect(toUpperCase('hello', 'field').value).toBe('HELLO');
      });
    });
  });

  describe('validateField', () => {
    it('should run validators in sequence', () => {
      const result = validateField(
        [required(), minLength(3)],
        'hi',
        'name'
      );
      expect(result.isValid).toBe(false);
    });

    it('should stop on first error', () => {
      const result = validateField(
        [required(), minLength(3)],
        '',
        'name'
      );
      expect(result.error).toBe('This field is required');
    });
  });

  describe('validate (schema)', () => {
    it('should validate object against schema', () => {
      const schema = createSchema({
        name: [required(), minLength(2)],
        email: [required(), email()],
        age: [number(), min(0)],
      });

      const validData = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const result = validate(schema, validData);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should collect errors for invalid fields', () => {
      const schema = createSchema({
        name: [required()],
        email: [email()],
      });

      const invalidData = {
        name: '',
        email: 'invalid',
      };

      const result = validate(schema, invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.email).toBeDefined();
    });
  });

  describe('Preset Schemas', () => {
    it('should have email schema', () => {
      expect(schemas.email).toBeDefined();
      expect(Array.isArray(schemas.email)).toBe(true);
    });

    it('should have password schema', () => {
      expect(schemas.password).toBeDefined();
    });

    it('should have name schema', () => {
      expect(schemas.name).toBeDefined();
    });
  });
});

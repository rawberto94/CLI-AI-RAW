/**
 * Tests for Result pattern utilities
 * @see /lib/result.ts
 */
import { describe, it, expect, vi } from 'vitest';
import {
  Result,
  Success,
  Failure,
  AppError,
  resultify,
  assert,
  validate,
} from '../../lib/result';

describe('Result Pattern', () => {
  describe('Result.ok', () => {
    it('should create a Success result', () => {
      const result = Result.ok(42);
      
      expect(result._tag).toBe('Success');
      expect(result.isOk()).toBe(true);
      expect(result.isFail()).toBe(false);
      expect(result.value).toBe(42);
    });

    it('should work with any type', () => {
      const stringResult = Result.ok('hello');
      const objectResult = Result.ok({ name: 'John' });
      const arrayResult = Result.ok([1, 2, 3]);
      
      expect(stringResult.value).toBe('hello');
      expect(objectResult.value).toEqual({ name: 'John' });
      expect(arrayResult.value).toEqual([1, 2, 3]);
    });
  });

  describe('Result.fail', () => {
    it('should create a Failure result', () => {
      const result = Result.fail('Something went wrong');
      
      expect(result._tag).toBe('Failure');
      expect(result.isOk()).toBe(false);
      expect(result.isFail()).toBe(true);
      expect(result.error).toBe('Something went wrong');
    });

    it('should work with Error objects', () => {
      const error = new Error('Test error');
      const result = Result.fail(error);
      
      expect(result.error).toBe(error);
    });
  });

  describe('Success', () => {
    it('should have correct properties', () => {
      const success = new Success(42);
      
      expect(success._tag).toBe('Success');
      expect(success.value).toBe(42);
      expect(success.error).toBeUndefined();
      expect(success.isOk()).toBe(true);
      expect(success.isFail()).toBe(false);
    });
  });

  describe('Failure', () => {
    it('should have correct properties', () => {
      const failure = new Failure('error');
      
      expect(failure._tag).toBe('Failure');
      expect(failure.error).toBe('error');
      expect(failure.value).toBeUndefined();
      expect(failure.isOk()).toBe(false);
      expect(failure.isFail()).toBe(true);
    });
  });

  describe('map', () => {
    it('should transform Success value', () => {
      const result = Result.ok(2).map(x => x * 2);
      
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(4);
    });

    it('should pass through Failure unchanged', () => {
      const result = Result.fail<number, string>('error').map(x => x * 2);
      
      expect(result.isFail()).toBe(true);
      expect(result.error).toBe('error');
    });
  });

  describe('mapError', () => {
    it('should transform Failure value', () => {
      const result = Result.fail('error').mapError(e => `Mapped: ${e}`);
      
      expect(result.isFail()).toBe(true);
      expect(result.error).toBe('Mapped: error');
    });

    it('should pass through Success unchanged', () => {
      const result = Result.ok(42).mapError(e => `Mapped: ${e}`);
      
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(42);
    });
  });

  describe('flatMap', () => {
    it('should chain successful operations', () => {
      const divide = (a: number, b: number) =>
        b === 0 ? Result.fail('Division by zero') : Result.ok(a / b);
      
      const result = Result.ok(10).flatMap(x => divide(x, 2));
      
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should short-circuit on error', () => {
      const divide = (a: number, b: number) =>
        b === 0 ? Result.fail('Division by zero') : Result.ok(a / b);
      
      const result = Result.ok(10).flatMap(x => divide(x, 0));
      
      expect(result.isFail()).toBe(true);
      expect(result.error).toBe('Division by zero');
    });

    it('should not call function on Failure input', () => {
      const fn = vi.fn().mockReturnValue(Result.ok(42));
      
      Result.fail('error').flatMap(fn);
      
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('unwrap', () => {
    it('should return value from Success', () => {
      expect(Result.ok(42).unwrap()).toBe(42);
    });

    it('should throw on Failure', () => {
      expect(() => Result.fail('error').unwrap()).toThrow();
    });
  });

  describe('unwrapOr', () => {
    it('should return value from Success', () => {
      expect(Result.ok(42).unwrapOr(0)).toBe(42);
    });

    it('should return default on Failure', () => {
      expect(Result.fail<number, string>('error').unwrapOr(0)).toBe(0);
    });
  });

  describe('unwrapOrElse', () => {
    it('should return value from Success', () => {
      expect(Result.ok(42).unwrapOrElse(() => 0)).toBe(42);
    });

    it('should call function on Failure', () => {
      const result = Result.fail<number, string>('error').unwrapOrElse(e => e.length);
      expect(result).toBe(5);
    });
  });

  describe('match', () => {
    it('should call ok handler for Success', () => {
      const result = Result.ok(42).match({
        ok: v => `Value: ${v}`,
        fail: e => `Error: ${e}`,
      });
      
      expect(result).toBe('Value: 42');
    });

    it('should call fail handler for Failure', () => {
      const result = Result.fail<number, string>('error').match({
        ok: v => `Value: ${v}`,
        fail: e => `Error: ${e}`,
      });
      
      expect(result).toBe('Error: error');
    });
  });

  describe('toPromise', () => {
    it('should resolve for Success', async () => {
      const promise = Result.ok(42).toPromise();
      await expect(promise).resolves.toBe(42);
    });

    it('should reject for Failure', async () => {
      const promise = Result.fail('error').toPromise();
      await expect(promise).rejects.toBe('error');
    });
  });

  describe('Result.fromNullable', () => {
    it('should convert non-null to Success', () => {
      const result = Result.fromNullable(42, 'No value');
      
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should convert null to Failure', () => {
      const result = Result.fromNullable(null, 'No value');
      
      expect(result.isFail()).toBe(true);
      expect(result.error).toBe('No value');
    });

    it('should convert undefined to Failure', () => {
      const result = Result.fromNullable(undefined, 'No value');
      
      expect(result.isFail()).toBe(true);
      expect(result.error).toBe('No value');
    });
  });

  describe('Result.fromPromise', () => {
    it('should convert resolved promise to Success', async () => {
      const result = await Result.fromPromise(Promise.resolve(42));
      
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should convert rejected promise to Failure', async () => {
      const result = await Result.fromPromise(Promise.reject(new Error('Failed')));
      
      expect(result.isFail()).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('Result.tryCatch', () => {
    it('should return Success for non-throwing function', () => {
      const result = Result.tryCatch(() => 42);
      
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should return Failure for throwing function', () => {
      const result = Result.tryCatch(() => {
        throw new Error('Test error');
      });
      
      expect(result.isFail()).toBe(true);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('Result.all', () => {
    it('should combine all Success results', () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)];
      const combined = Result.all(results);
      
      expect(combined.isOk()).toBe(true);
      expect(combined.value).toEqual([1, 2, 3]);
    });

    it('should return first Failure if any', () => {
      const results = [Result.ok(1), Result.fail('error'), Result.ok(3)];
      const combined = Result.all(results);
      
      expect(combined.isFail()).toBe(true);
      expect(combined.error).toBe('error');
    });
  });

  describe('Result.any', () => {
    it('should return first Success', () => {
      const results = [Result.fail('e1'), Result.ok(2), Result.fail('e3')];
      const combined = Result.any(results);
      
      expect(combined.isOk()).toBe(true);
      expect(combined.value).toBe(2);
    });

    it('should return all errors if no Success', () => {
      const results = [Result.fail('e1'), Result.fail('e2'), Result.fail('e3')];
      const combined = Result.any(results);
      
      expect(combined.isFail()).toBe(true);
      expect(combined.error).toEqual(['e1', 'e2', 'e3']);
    });
  });
});

describe('AppError', () => {
  describe('create', () => {
    it('should create an error with code and message', () => {
      const error = AppError.create('TEST_ERROR', 'Test message');
      
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
    });

    it('should include optional fields', () => {
      const error = AppError.create('TEST', 'Test', {
        userMessage: 'User friendly',
        details: { field: 'value' },
      });
      
      expect(error.userMessage).toBe('User friendly');
      expect(error.details).toEqual({ field: 'value' });
    });
  });

  describe('notFound', () => {
    it('should create not found error', () => {
      const error = AppError.notFound('User', '123');
      
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toContain('User');
      expect(error.message).toContain('123');
    });
  });

  describe('unauthorized', () => {
    it('should create unauthorized error', () => {
      const error = AppError.unauthorized('view this resource');
      
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('forbidden', () => {
    it('should create forbidden error', () => {
      const error = AppError.forbidden('delete');
      
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('validation', () => {
    it('should create validation error', () => {
      const error = AppError.validation('email', 'Invalid format');
      
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details?.field).toBe('email');
    });
  });

  describe('fromError', () => {
    it('should convert Error to AppError', () => {
      const error = new Error('Test');
      const appError = AppError.fromError(error);
      
      expect(appError.code).toBe('UNKNOWN_ERROR');
      expect(appError.message).toBe('Test');
      expect(appError.cause).toBe(error);
    });

    it('should convert string to AppError', () => {
      const appError = AppError.fromError('String error');
      
      expect(appError.message).toBe('String error');
    });
  });
});

describe('Utility Functions', () => {
  describe('resultify', () => {
    it('should wrap async function returning Result', async () => {
      const asyncFn = async (x: number) => x * 2;
      const wrapped = resultify(asyncFn);
      
      const result = await wrapped(21);
      
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should catch thrown errors', async () => {
      const asyncFn = async () => {
        throw new Error('Test');
      };
      const wrapped = resultify(asyncFn);
      
      const result = await wrapped();
      
      expect(result.isFail()).toBe(true);
    });
  });

  describe('assert', () => {
    it('should return Success for truthy value', () => {
      const result = assert(42, AppError.notFound('Value'));
      
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should return Failure for null', () => {
      const result = assert(null, AppError.notFound('Value'));
      
      expect(result.isFail()).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return Success if all validators pass', () => {
      const result = validate('test@example.com', [
        v => v.includes('@') ? null : AppError.validation('email', 'Invalid'),
      ]);
      
      expect(result.isOk()).toBe(true);
    });

    it('should return first validation error', () => {
      const result = validate('invalid', [
        v => v.includes('@') ? null : AppError.validation('email', 'Invalid'),
      ]);
      
      expect(result.isFail()).toBe(true);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });
});

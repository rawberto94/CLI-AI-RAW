/**
 * Result Pattern
 * Type-safe error handling without exceptions
 * 
 * @example
 * // Creating results
 * const success = Result.ok({ id: 1, name: 'Test' });
 * const failure = Result.fail('Not found');
 * 
 * // Using results
 * const result = await userService.getUser(id);
 * if (result.isOk()) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error);
 * }
 * 
 * // Chaining operations
 * const final = result
 *   .map(user => user.name)
 *   .mapError(err => `User error: ${err}`)
 *   .unwrapOr('Unknown');
 */

// ============================================================================
// Core Result Type
// ============================================================================

export type Result<T, E = string> = Success<T, E> | Failure<T, E>;

export class Success<T, E = string> {
  readonly _tag = 'Success' as const;
  readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  isOk(): this is Success<T, E> {
    return true;
  }

  isFail(): this is Failure<T, E> {
    return false;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Success(fn(this.value));
  }

  mapError<F>(_fn: (error: E) => F): Result<T, F> {
    return new Success(this.value);
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  unwrapOrElse(_fn: (error: E) => T): T {
    return this.value;
  }

  match<U>(handlers: { ok: (value: T) => U; fail: (error: E) => U }): U {
    return handlers.ok(this.value);
  }

  toPromise(): Promise<T> {
    return Promise.resolve(this.value);
  }

  get error(): undefined {
    return undefined;
  }
}

export class Failure<T, E = string> {
  readonly _tag = 'Failure' as const;
  readonly error: E;

  constructor(error: E) {
    this.error = error;
  }

  isOk(): this is Success<T, E> {
    return false;
  }

  isFail(): this is Failure<T, E> {
    return true;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Failure(this.error);
  }

  mapError<F>(fn: (error: E) => F): Result<T, F> {
    return new Failure(fn(this.error));
  }

  flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return new Failure(this.error);
  }

  unwrap(): never {
    throw new Error(`Tried to unwrap a Failure: ${this.error}`);
  }

  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  unwrapOrElse(fn: (error: E) => T): T {
    return fn(this.error);
  }

  match<U>(handlers: { ok: (value: T) => U; fail: (error: E) => U }): U {
    return handlers.fail(this.error);
  }

  toPromise(): Promise<T> {
    return Promise.reject(this.error);
  }

  get value(): undefined {
    return undefined;
  }
}

// ============================================================================
// Result Factory
// ============================================================================

export const Result = {
  ok<T, E = string>(value: T): Result<T, E> {
    return new Success(value);
  },

  fail<T = never, E = string>(error: E): Result<T, E> {
    return new Failure(error);
  },

  fromNullable<T>(value: T | null | undefined, error: string = 'Value is null or undefined'): Result<T, string> {
    return value != null ? Result.ok(value) : Result.fail(error);
  },

  fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
    return promise
      .then(value => Result.ok<T, Error>(value))
      .catch(error => Result.fail<T, Error>(error instanceof Error ? error : new Error(String(error))));
  },

  tryCatch<T>(fn: () => T): Result<T, Error> {
    try {
      return Result.ok(fn());
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  },

  async tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      return Result.ok(await fn());
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  },

  all<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (result.isFail()) return result as unknown as Result<T[], E>;
      values.push(result.value);
    }
    return Result.ok(values);
  },

  any<T, E>(results: Result<T, E>[]): Result<T, E[]> {
    const errors: E[] = [];
    for (const result of results) {
      if (result.isOk()) return result as unknown as Result<T, E[]>;
      errors.push(result.error);
    }
    return Result.fail(errors);
  },
};

// ============================================================================
// AppError Type
// ============================================================================

export interface AppError {
  code: string;
  message: string;
  userMessage?: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

export const AppError = {
  create(code: string, message: string, options?: Partial<Omit<AppError, 'code' | 'message'>>): AppError {
    return { code, message, ...options };
  },

  // Common errors
  notFound: (resource: string, id?: string): AppError => ({
    code: 'NOT_FOUND',
    message: id ? `${resource} with id ${id} not found` : `${resource} not found`,
    userMessage: `The ${resource.toLowerCase()} you're looking for doesn't exist.`,
  }),

  unauthorized: (action?: string): AppError => ({
    code: 'UNAUTHORIZED',
    message: action ? `Unauthorized to ${action}` : 'Unauthorized',
    userMessage: 'Please log in to continue.',
  }),

  forbidden: (action?: string): AppError => ({
    code: 'FORBIDDEN',
    message: action ? `Forbidden to ${action}` : 'Forbidden',
    userMessage: "You don't have permission to perform this action.",
  }),

  validation: (field: string, message: string): AppError => ({
    code: 'VALIDATION_ERROR',
    message: `Validation failed: ${field} - ${message}`,
    userMessage: message,
    details: { field },
  }),

  network: (operation?: string): AppError => ({
    code: 'NETWORK_ERROR',
    message: operation ? `Network error during ${operation}` : 'Network error',
    userMessage: 'Network error. Please check your connection and try again.',
  }),

  timeout: (operation?: string, timeoutMs?: number): AppError => ({
    code: 'TIMEOUT',
    message: operation ? `${operation} timed out after ${timeoutMs}ms` : 'Operation timed out',
    userMessage: 'The operation took too long. Please try again.',
    details: { timeoutMs },
  }),

  server: (message?: string): AppError => ({
    code: 'SERVER_ERROR',
    message: message || 'Internal server error',
    userMessage: 'Something went wrong on our end. Please try again later.',
  }),

  fromError(error: unknown): AppError {
    if (error instanceof Error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        cause: error,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
    };
  },
};

// ============================================================================
// Type Aliases
// ============================================================================

export type AppResult<T> = Result<T, AppError>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap an async function to return Result
 */
export function resultify<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>
): (...args: A) => Promise<AppResult<T>> {
  return async (...args) => {
    try {
      const value = await fn(...args);
      return Result.ok(value);
    } catch (error) {
      return Result.fail(AppError.fromError(error));
    }
  };
}

/**
 * Assert a condition, returning a Result
 */
export function assert<T>(
  condition: T | null | undefined,
  error: AppError
): AppResult<T> {
  return condition != null ? Result.ok(condition) : Result.fail(error);
}

/**
 * Validate multiple conditions
 */
export function validate<T>(
  value: T,
  validators: Array<(value: T) => AppError | null>
): AppResult<T> {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return Result.fail(error);
  }
  return Result.ok(value);
}

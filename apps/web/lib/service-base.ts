/**
 * Base Service Class
 * Provides common patterns for service layer architecture
 */

import { Result, AppResult, AppError } from './result';
import { API, CACHE } from './constants';
import { getCircuitBreaker, type CircuitBreaker } from './scalability/circuit-breaker';
import { deduplicateRequest, generateRequestKey } from './scalability/request-optimization';

// ============================================================================
// Types
// ============================================================================

export interface ServiceConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  /** Enable circuit breaker for this service */
  circuitBreakerEnabled?: boolean;
  /** Enable request deduplication */
  deduplicationEnabled?: boolean;
}

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  skipCache?: boolean;
}

// ============================================================================
// Memory Cache (simple in-memory cache for client-side)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > entry.ttl * 1000) {
    memoryCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  memoryCache.set(key, { data, timestamp: Date.now(), ttl });
}

function clearCache(pattern?: string): void {
  if (!pattern) {
    memoryCache.clear();
    return;
  }
  
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
}

// ============================================================================
// Base Service
// ============================================================================

export abstract class BaseService {
  protected config: Required<ServiceConfig>;
  protected serviceName: string;
  protected circuitBreaker: CircuitBreaker | null = null;

  constructor(serviceName: string, config: ServiceConfig = {}) {
    this.serviceName = serviceName;
    this.config = {
      baseUrl: config.baseUrl || '',
      timeout: config.timeout || API.TIMEOUT.DEFAULT,
      retries: config.retries || API.RETRY.MAX_ATTEMPTS,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL || CACHE.TTL.MEDIUM,
      circuitBreakerEnabled: config.circuitBreakerEnabled ?? true,
      deduplicationEnabled: config.deduplicationEnabled ?? true,
    };

    // Initialize circuit breaker if enabled
    if (this.config.circuitBreakerEnabled) {
      this.circuitBreaker = getCircuitBreaker(serviceName, {
        failureThreshold: 5,
        successThreshold: 2,
        resetTimeout: 30000,
        failureWindow: 60000,
        onStateChange: (from, to) => {
          this.log('info', `Circuit state changed: ${from} -> ${to}`);
        },
      });
    }
  }

  // ============================================================================
  // Fetch with error handling, retries, and circuit breaker
  // ============================================================================

  protected async fetch<T>(
    url: string,
    options: FetchOptions = {}
  ): Promise<AppResult<T>> {
    const {
      timeout = this.config.timeout,
      retries = this.config.retries,
      skipCache = false,
      ...fetchOptions
    } = options;

    // Check cache for GET requests
    const cacheKey = this.getCacheKey(url, fetchOptions);
    if (
      this.config.cacheEnabled &&
      !skipCache &&
      fetchOptions.method?.toUpperCase() !== 'POST' &&
      fetchOptions.method?.toUpperCase() !== 'PUT' &&
      fetchOptions.method?.toUpperCase() !== 'DELETE'
    ) {
      const cached = getCached<T>(cacheKey);
      if (cached !== null) {
        return Result.ok(cached);
      }
    }

    // Check circuit breaker before proceeding
    if (this.circuitBreaker && !this.circuitBreaker.canRequest()) {
      return Result.fail(AppError.create(
        'CIRCUIT_OPEN',
        `Service ${this.serviceName} is temporarily unavailable`,
        { userMessage: 'Please try again in a moment' }
      ));
    }

    // Generate request key for deduplication
    const requestKey = this.config.deduplicationEnabled 
      ? generateRequestKey(fetchOptions.method || 'GET', url, fetchOptions.body)
      : null;

    // Core fetch execution with retries
    const executeRequest = async (): Promise<AppResult<T>> => {
      let lastError: AppError | null = null;
      
      for (let attempt = 0; attempt < retries; attempt++) {
        const result = await this.executeFetch<T>(url, fetchOptions, timeout);
        
        if (result.isOk()) {
          // Record success for circuit breaker
          this.circuitBreaker?.recordSuccess();
          
          // Cache successful GET responses
          if (
            this.config.cacheEnabled &&
            !skipCache &&
            (!fetchOptions.method || fetchOptions.method.toUpperCase() === 'GET')
          ) {
            setCache(cacheKey, result.value, this.config.cacheTTL);
          }
          return result;
        }

        lastError = result.error;
        
        // Don't retry on certain errors
        if (!this.isRetryable(lastError)) {
          // Record failure for circuit breaker
          this.circuitBreaker?.recordFailure();
          return result;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries - 1) {
          const delay = Math.min(
            API.RETRY.BASE_DELAY * Math.pow(API.RETRY.BACKOFF_MULTIPLIER, attempt),
            API.RETRY.MAX_DELAY
          );
          await this.sleep(delay);
        }
      }

      // Record failure after all retries exhausted
      this.circuitBreaker?.recordFailure();
      return Result.fail(lastError!);
    };

    // Use deduplication if enabled
    if (requestKey && this.config.deduplicationEnabled) {
      return deduplicateRequest(requestKey, executeRequest);
    }

    return executeRequest();
  }

  private async executeFetch<T>(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<AppResult<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const fullUrl = this.config.baseUrl + url;
      const response = await fetch(fullUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return Result.fail(await this.parseErrorResponse(response));
      }

      // Handle empty responses
      if (response.status === 204) {
        return Result.ok(undefined as T);
      }

      const data = await response.json();
      
      // Handle standardized API responses
      if ('success' in data) {
        if (data.success) {
          return Result.ok(data.data as T);
        } else {
          return Result.fail(AppError.create(
            data.error?.code || 'API_ERROR',
            data.error?.message || 'Request failed'
          ));
        }
      }

      return Result.ok(data as T);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return Result.fail(AppError.timeout('API request', timeout));
        }
        return Result.fail(AppError.network(url));
      }

      return Result.fail(AppError.fromError(error));
    }
  }

  private async parseErrorResponse(response: Response): Promise<AppError> {
    try {
      const data = await response.json();
      return AppError.create(
        data.error?.code || `HTTP_${response.status}`,
        data.error?.message || response.statusText,
        {
          userMessage: data.error?.message,
          details: data.error?.details,
        }
      );
    } catch {
      return AppError.create(
        `HTTP_${response.status}`,
        response.statusText || 'Request failed'
      );
    }
  }

  private isRetryable(error: AppError): boolean {
    // Don't retry client errors (4xx) except rate limiting
    if (error.code.startsWith('HTTP_4') && error.code !== 'HTTP_429') {
      return false;
    }
    
    // Retry on network errors, timeouts, and server errors
    return (
      error.code === 'NETWORK_ERROR' ||
      error.code === 'TIMEOUT' ||
      error.code.startsWith('HTTP_5') ||
      error.code === 'HTTP_429'
    );
  }

  // ============================================================================
  // Convenience methods
  // ============================================================================

  protected async get<T>(url: string, options?: FetchOptions): Promise<AppResult<T>> {
    return this.fetch<T>(url, { ...options, method: 'GET' });
  }

  protected async post<T>(url: string, body?: unknown, options?: FetchOptions): Promise<AppResult<T>> {
    return this.fetch<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected async put<T>(url: string, body?: unknown, options?: FetchOptions): Promise<AppResult<T>> {
    return this.fetch<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected async patch<T>(url: string, body?: unknown, options?: FetchOptions): Promise<AppResult<T>> {
    return this.fetch<T>(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected async delete<T>(url: string, options?: FetchOptions): Promise<AppResult<T>> {
    return this.fetch<T>(url, { ...options, method: 'DELETE' });
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  protected getCacheKey(url: string, options: RequestInit): string {
    return `${this.serviceName}:${options.method || 'GET'}:${url}`;
  }

  protected clearServiceCache(pattern?: string): void {
    clearCache(pattern ? `${this.serviceName}:${pattern}` : this.serviceName);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const prefix = `[${this.serviceName}]`;
    if (process.env.NODE_ENV === 'development') {
      console[level](prefix, message, data || '');
    }
  }
}

// ============================================================================
// Singleton Pattern Helper
// ============================================================================

export function createSingleton<T extends new (...args: unknown[]) => InstanceType<T>>(
  ServiceClass: T
): () => InstanceType<T> {
  let instance: InstanceType<T> | null = null;

  return (): InstanceType<T> => {
    if (!instance) {
      instance = new ServiceClass() as InstanceType<T>;
    }
    return instance;
  };
}

// ============================================================================
// Service Registry (for dependency injection)
// ============================================================================

const serviceRegistry = new Map<string, unknown>();

export function registerService<T>(name: string, service: T): void {
  serviceRegistry.set(name, service);
}

export function getService<T>(name: string): T | undefined {
  return serviceRegistry.get(name) as T | undefined;
}

export function hasService(name: string): boolean {
  return serviceRegistry.has(name);
}

"use strict";
/**
 * Retry Utility with Exponential Backoff
 * Handles transient failures with intelligent retry strategies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultIsRetryable = defaultIsRetryable;
exports.calculateBackoffDelay = calculateBackoffDelay;
exports.sleep = sleep;
exports.retry = retry;
exports.retryWithResult = retryWithResult;
exports.withRetry = withRetry;
exports.makeRetryable = makeRetryable;
exports.retryOpenAI = retryOpenAI;
exports.retryDatabase = retryDatabase;
exports.retryStorage = retryStorage;
exports.batchRetry = batchRetry;
/**
 * Default retry predicate - retries on common transient errors
 */
function defaultIsRetryable(error) {
    const message = error.message.toLowerCase();
    // Network errors
    if (message.includes('econnreset'))
        return true;
    if (message.includes('econnrefused'))
        return true;
    if (message.includes('etimedout'))
        return true;
    if (message.includes('epipe'))
        return true;
    if (message.includes('network'))
        return true;
    if (message.includes('socket hang up'))
        return true;
    // Timeout errors
    if (message.includes('timeout'))
        return true;
    if (message.includes('timed out'))
        return true;
    // Rate limiting
    if (message.includes('rate limit'))
        return true;
    if (message.includes('too many requests'))
        return true;
    if (message.includes('429'))
        return true;
    // Service unavailable
    if (message.includes('503'))
        return true;
    if (message.includes('502'))
        return true;
    if (message.includes('504'))
        return true;
    if (message.includes('service unavailable'))
        return true;
    if (message.includes('temporarily unavailable'))
        return true;
    // Database transient errors
    if (message.includes('deadlock'))
        return true;
    if (message.includes('lock wait timeout'))
        return true;
    if (message.includes('connection pool'))
        return true;
    // AWS/Cloud transient errors
    if (message.includes('throttl'))
        return true;
    if (message.includes('capacity'))
        return true;
    return false;
}
/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateBackoffDelay(attempt, initialDelay, maxDelay, backoffMultiplier = 2, jitter = true) {
    // Exponential backoff: initialDelay * multiplier^attempt
    let delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
    // Cap at max delay
    delay = Math.min(delay, maxDelay);
    // Add jitter (0-30% random variation)
    if (jitter) {
        const jitterFactor = 1 + (Math.random() * 0.3);
        delay = Math.floor(delay * jitterFactor);
    }
    return delay;
}
/**
 * Sleep for a specified duration
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry a function with exponential backoff
 */
async function retry(fn, options = {}) {
    const config = {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true,
        isRetryable: defaultIsRetryable,
        ...options,
    };
    let lastError = new Error('No attempts made');
    const startTime = Date.now();
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Check if we should retry
            const isRetryable = config.isRetryable(lastError, attempt);
            const hasMoreAttempts = attempt < config.maxAttempts;
            if (!isRetryable || !hasMoreAttempts) {
                if (!hasMoreAttempts) {
                    config.onExhausted?.(lastError, attempt);
                }
                throw lastError;
            }
            // Calculate delay
            const delay = calculateBackoffDelay(attempt, config.initialDelay, config.maxDelay, config.backoffMultiplier, config.jitter);
            config.onRetry?.(lastError, attempt, delay);
            // Wait before retry
            await sleep(delay);
        }
    }
    throw lastError;
}
/**
 * Retry with detailed result (doesn't throw)
 */
async function retryWithResult(fn, options = {}) {
    const startTime = Date.now();
    let attempts = 0;
    try {
        const result = await retry(fn, {
            ...options,
            onRetry: (error, attempt, delay) => {
                attempts = attempt;
                options.onRetry?.(error, attempt, delay);
            },
        });
        return {
            success: true,
            result,
            attempts: attempts + 1,
            totalTime: Date.now() - startTime,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            attempts: attempts + 1,
            totalTime: Date.now() - startTime,
        };
    }
}
/**
 * Retry decorator for class methods
 */
function withRetry(options = {}) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            return retry(() => originalMethod.apply(this, args), options);
        };
        return descriptor;
    };
}
/**
 * Create a retryable version of any async function
 */
function makeRetryable(fn, options = {}) {
    return (async (...args) => {
        return retry(() => fn(...args), options);
    });
}
/**
 * Retry with specific strategy for OpenAI API
 */
async function retryOpenAI(fn) {
    return retry(fn, {
        maxAttempts: 4,
        initialDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 2.5,
        isRetryable: (error) => {
            const message = error.message.toLowerCase();
            // Retry rate limits and overloaded
            if (message.includes('rate limit'))
                return true;
            if (message.includes('overloaded'))
                return true;
            if (message.includes('capacity'))
                return true;
            // Retry server errors
            if (message.includes('500'))
                return true;
            if (message.includes('502'))
                return true;
            if (message.includes('503'))
                return true;
            // Retry network errors
            if (message.includes('network'))
                return true;
            if (message.includes('timeout'))
                return true;
            return defaultIsRetryable(error);
        },
        onRetry: (error, attempt, delay) => {
            console.warn(`[OpenAI] Retry ${attempt} after ${delay}ms:`, error.message);
        },
    });
}
/**
 * Retry with specific strategy for database operations
 */
async function retryDatabase(fn) {
    return retry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2,
        isRetryable: (error) => {
            const message = error.message.toLowerCase();
            // Retry connection issues
            if (message.includes('connection'))
                return true;
            if (message.includes('pool'))
                return true;
            // Retry transient errors
            if (message.includes('deadlock'))
                return true;
            if (message.includes('lock wait'))
                return true;
            if (message.includes('too many connections'))
                return true;
            return false;
        },
        onRetry: (error, attempt, delay) => {
            console.warn(`[Database] Retry ${attempt} after ${delay}ms:`, error.message);
        },
    });
}
/**
 * Retry with specific strategy for storage operations
 */
async function retryStorage(fn) {
    return retry(fn, {
        maxAttempts: 3,
        initialDelay: 500,
        maxDelay: 10000,
        isRetryable: (error) => {
            const message = error.message.toLowerCase();
            // Retry network issues
            if (message.includes('network'))
                return true;
            if (message.includes('timeout'))
                return true;
            if (message.includes('econnreset'))
                return true;
            // Retry server errors
            if (message.includes('500'))
                return true;
            if (message.includes('503'))
                return true;
            return false;
        },
        onRetry: (error, attempt, delay) => {
            console.warn(`[Storage] Retry ${attempt} after ${delay}ms:`, error.message);
        },
    });
}
/**
 * Batch retry - retry a batch of operations with partial success handling
 */
async function batchRetry(items, fn, options = {}) {
    const concurrency = options.concurrency || 5;
    const stopOnFailure = options.stopOnFailure || false;
    const successful = [];
    const failed = [];
    // Process in batches
    for (let i = 0; i < items.length; i += concurrency) {
        if (stopOnFailure && failed.length > 0)
            break;
        const batch = items.slice(i, i + concurrency);
        const results = await Promise.allSettled(batch.map(async (item) => {
            const result = await retryWithResult(() => fn(item), options);
            return { item, result };
        }));
        for (const result of results) {
            if (result.status === 'fulfilled') {
                if (result.value.result.success) {
                    successful.push({
                        item: result.value.item,
                        result: result.value.result.result,
                    });
                }
                else {
                    failed.push({
                        item: result.value.item,
                        error: result.value.result.error,
                    });
                }
            }
        }
    }
    return { successful, failed };
}

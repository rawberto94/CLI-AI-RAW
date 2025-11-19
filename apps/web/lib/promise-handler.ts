/**
 * Promise handler utilities to prevent memory leaks from unhandled rejections
 */

// Track unhandled promise rejections
let unhandledRejections = 0;

if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason, promise) => {
    unhandledRejections++;
    console.error('Unhandled Promise Rejection:', {
      count: unhandledRejections,
      reason,
      promise
    });
  });

  process.on('rejectionHandled', (promise) => {
    console.log('Promise rejection was handled late:', promise);
  });
}

/**
 * Safe promise wrapper that catches and logs errors
 */
export async function safePromise<T>(
  promise: Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    console.error(`Promise error in ${context}:`, error);
    return null;
  }
}

/**
 * Promise.all with error handling for each promise
 */
export async function safePromiseAll<T>(
  promises: Promise<T>[],
  context: string
): Promise<(T | null)[]> {
  return Promise.all(
    promises.map((p, i) => safePromise(p, `${context}[${i}]`))
  );
}

/**
 * Promise with timeout
 */
export function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms in ${context}`)), timeoutMs)
    )
  ]);
}

export function getUnhandledRejectionCount(): number {
  return unhandledRejections;
}

export class RetryableError extends Error {
  public readonly retryAfterMs?: number;

  constructor(message: string, options?: { retryAfterMs?: number; cause?: unknown }) {
    super(message);
    this.name = 'RetryableError';
    this.retryAfterMs = options?.retryAfterMs;
    // Preserve cause when supported
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).cause = options?.cause;
  }
}

export function isRetryableError(error: unknown): error is RetryableError {
  return error instanceof Error && error.name === 'RetryableError';
}

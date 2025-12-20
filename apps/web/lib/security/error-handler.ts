/**
 * Secure Error Handler
 * 
 * Provides safe error responses that don't leak sensitive information
 * in production while still providing useful errors in development.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

// Error messages that are safe to show to users
const SAFE_ERROR_MESSAGES = new Set([
  'Unauthorized',
  'Forbidden',
  'Not found',
  'Bad request',
  'Rate limit exceeded',
  'Invalid input',
  'Validation failed',
  'Session expired',
  'Tenant ID required',
  'Contract not found',
  'Rate card not found',
  'User not found',
  'Resource not found',
  'Permission denied',
  'File too large',
  'Invalid file type',
  'Invalid format',
]);

/**
 * Get a safe error message for the response
 * In development, returns the full error message
 * In production, returns a generic message unless it's a known safe message
 */
export function getSafeErrorMessage(error: unknown, fallback: string = 'An error occurred'): string {
  const message = error instanceof Error ? error.message : String(error);
  
  // In development, always show the full error
  if (isDevelopment) {
    return message;
  }
  
  // Check if the message is safe to display
  if (SAFE_ERROR_MESSAGES.has(message)) {
    return message;
  }
  
  // Check for partial matches of safe patterns
  const safePatterns = [
    /not found$/i,
    /is required$/i,
    /already exists$/i,
    /invalid .+ format$/i,
    /must be .+$/i,
  ];
  
  for (const pattern of safePatterns) {
    if (pattern.test(message)) {
      return message;
    }
  }
  
  // In production, return the generic fallback
  return fallback;
}

/**
 * Log error details server-side (always safe as it never reaches the client)
 */
export function logError(context: string, error: unknown, additionalInfo?: Record<string, unknown>): void {
  const errorDetails = {
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    ...additionalInfo,
  };
  
  // In production, you might want to send this to an error tracking service
  console.error('[ERROR]', JSON.stringify(errorDetails, null, 2));
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  context: string,
  statusCode: number = 500,
  fallbackMessage?: string
): { error: string; status: number } {
  // Always log the full error server-side
  logError(context, error);
  
  return {
    error: getSafeErrorMessage(error, fallbackMessage || `Failed to ${context.toLowerCase()}`),
    status: statusCode,
  };
}

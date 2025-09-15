/**
 * Custom application error class for consistent error handling
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly context: Record<string, any> | undefined;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    context?: Record<string, any>
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.context = context;
    
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack
    };
  }
}

// Predefined error types for common scenarios
export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(400, message, true, { field });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, `${resource} not found${id ? ` with id: ${id}` : ''}`, true, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(401, message, true);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access') {
    super(403, message, true);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, resource?: string) {
    super(409, message, true, { resource });
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', context?: Record<string, any>) {
    super(500, message, false, context);
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, message?: string) {
    super(503, message || `${service} service is currently unavailable`, true, { service });
    this.name = 'ServiceUnavailableError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(429, 'Too many requests', true, { retryAfter });
    this.name = 'RateLimitError';
  }
}
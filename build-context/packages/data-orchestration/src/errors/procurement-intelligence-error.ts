/**
 * Error classes for procurement intelligence features
 */

export class ProcurementIntelligenceError extends Error {
  constructor(
    message: string,
    public code: string,
    public feature: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'ProcurementIntelligenceError';
    Object.setPrototypeOf(this, ProcurementIntelligenceError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      feature: this.feature,
      recoverable: this.recoverable
    };
  }
}

export class DataUnavailableError extends ProcurementIntelligenceError {
  constructor(feature: string) {
    super(
      `Real data unavailable for ${feature}, falling back to mock data`,
      'DATA_UNAVAILABLE',
      feature,
      true
    );
    this.name = 'DataUnavailableError';
    Object.setPrototypeOf(this, DataUnavailableError.prototype);
  }
}

export class InvalidModeError extends ProcurementIntelligenceError {
  constructor(mode: string) {
    super(
      `Invalid data mode: ${mode}. Must be 'real', 'mock', or 'auto'`,
      'INVALID_MODE',
      'system',
      false
    );
    this.name = 'InvalidModeError';
    Object.setPrototypeOf(this, InvalidModeError.prototype);
  }
}

export class DataProviderError extends ProcurementIntelligenceError {
  constructor(feature: string, originalError: Error) {
    super(
      `Data provider error for ${feature}: ${originalError.message}`,
      'PROVIDER_ERROR',
      feature,
      true
    );
    this.name = 'DataProviderError';
    Object.setPrototypeOf(this, DataProviderError.prototype);
  }
}

export class InsufficientDataError extends ProcurementIntelligenceError {
  constructor(feature: string, required: number, actual: number) {
    super(
      `Insufficient data for ${feature}: required ${required}, got ${actual}`,
      'INSUFFICIENT_DATA',
      feature,
      true
    );
    this.name = 'InsufficientDataError';
    Object.setPrototypeOf(this, InsufficientDataError.prototype);
  }
}

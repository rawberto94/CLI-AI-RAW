/**
 * Financial Data Validation Service
 * 
 * Specialized validation for financial data:
 * - Currency code validation (ISO 4217)
 * - Amount range validation
 * - Currency format normalization
 * - Exchange rate validation
 * - Financial calculations validation
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('financial-validation-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  minorUnit: number;
}

export interface MoneyAmount {
  amount: number;
  currency: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  date: Date;
}

export interface FinancialValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: any;
}

// =========================================================================
// CURRENCY DATA (ISO 4217)
// =========================================================================

const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, minorUnit: 100 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, minorUnit: 100 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2, minorUnit: 100 },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimalPlaces: 2, minorUnit: 100 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0, minorUnit: 1 },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimalPlaces: 2, minorUnit: 100 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimalPlaces: 2, minorUnit: 100 },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimalPlaces: 2, minorUnit: 100 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2, minorUnit: 100 },
};

// =========================================================================
// FINANCIAL VALIDATION SERVICE
// =========================================================================

export class FinancialValidationService {
  private static instance: FinancialValidationService;

  private constructor() {
    logger.info('Financial Validation Service initialized');
  }

  static getInstance(): FinancialValidationService {
    if (!FinancialValidationService.instance) {
      FinancialValidationService.instance = new FinancialValidationService();
    }
    return FinancialValidationService.instance;
  }

  // =========================================================================
  // CURRENCY VALIDATION
  // =========================================================================

  /**
   * Validate currency code against ISO 4217
   */
  validateCurrencyCode(code: string): FinancialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!code) {
      errors.push('Currency code is required');
      return { valid: false, errors, warnings };
    }

    const upperCode = code.toUpperCase();
    
    if (!CURRENCIES[upperCode]) {
      errors.push(`Invalid currency code: ${code}. Must be a valid ISO 4217 code.`);
      return { valid: false, errors, warnings };
    }

    return {
      valid: true,
      errors,
      warnings,
      normalized: upperCode,
    };
  }

  /**
   * Get currency information
   */
  getCurrencyInfo(code: string): CurrencyInfo | null {
    return CURRENCIES[code.toUpperCase()] || null;
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): CurrencyInfo[] {
    return Object.values(CURRENCIES);
  }

  // =========================================================================
  // AMOUNT VALIDATION
  // =========================================================================

  /**
   * Validate money amount
   */
  validateAmount(amount: number, currency: string): FinancialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate amount is a number
    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.push('Amount must be a valid number');
      return { valid: false, errors, warnings };
    }

    // Validate amount is not negative
    if (amount < 0) {
      errors.push('Amount cannot be negative');
      return { valid: false, errors, warnings };
    }

    // Validate currency
    const currencyValidation = this.validateCurrencyCode(currency);
    if (!currencyValidation.valid) {
      errors.push(...currencyValidation.errors);
      return { valid: false, errors, warnings };
    }

    // Get currency info
    const currencyInfo = this.getCurrencyInfo(currency);
    if (!currencyInfo) {
      errors.push(`Unknown currency: ${currency}`);
      return { valid: false, errors, warnings };
    }

    // Validate decimal places
    const decimalPlaces = this.getDecimalPlaces(amount);
    if (decimalPlaces > currencyInfo.decimalPlaces) {
      warnings.push(
        `Amount has ${decimalPlaces} decimal places, but ${currency} typically uses ${currencyInfo.decimalPlaces}`
      );
    }

    // Validate reasonable range
    if (amount > 1000000000000) { // 1 trillion
      warnings.push('Amount is unusually large (> 1 trillion)');
    }

    if (amount > 0 && amount < 0.01) {
      warnings.push('Amount is unusually small (< 0.01)');
    }

    // Normalize amount to correct decimal places
    const normalized = this.normalizeAmount(amount, currencyInfo.decimalPlaces);

    return {
      valid: true,
      errors,
      warnings,
      normalized: {
        amount: normalized,
        currency: currencyInfo.code,
      },
    };
  }

  /**
   * Validate money amount object
   */
  validateMoneyAmount(money: MoneyAmount): FinancialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!money || typeof money !== 'object') {
      errors.push('Money amount must be an object');
      return { valid: false, errors, warnings };
    }

    if (!('amount' in money)) {
      errors.push('Money amount must have an "amount" property');
      return { valid: false, errors, warnings };
    }

    if (!('currency' in money)) {
      errors.push('Money amount must have a "currency" property');
      return { valid: false, errors, warnings };
    }

    return this.validateAmount(money.amount, money.currency);
  }

  /**
   * Validate amount range
   */
  validateAmountRange(
    amount: number,
    min: number,
    max: number,
    currency: string
  ): FinancialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // First validate the amount itself
    const amountValidation = this.validateAmount(amount, currency);
    if (!amountValidation.valid) {
      return amountValidation;
    }

    // Check range
    if (amount < min) {
      errors.push(`Amount ${amount} is below minimum ${min}`);
    }

    if (amount > max) {
      errors.push(`Amount ${amount} exceeds maximum ${max}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalized: amountValidation.normalized,
    };
  }

  // =========================================================================
  // CURRENCY FORMAT NORMALIZATION
  // =========================================================================

  /**
   * Normalize amount to correct decimal places
   */
  normalizeAmount(amount: number, decimalPlaces: number): number {
    return Math.round(amount * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: number, currency: string): string {
    const currencyInfo = this.getCurrencyInfo(currency);
    if (!currencyInfo) {
      return `${amount} ${currency}`;
    }

    const normalized = this.normalizeAmount(amount, currencyInfo.decimalPlaces);
    const formatted = normalized.toLocaleString('en-US', {
      minimumFractionDigits: currencyInfo.decimalPlaces,
      maximumFractionDigits: currencyInfo.decimalPlaces,
    });

    return `${currencyInfo.symbol}${formatted}`;
  }

  /**
   * Parse amount from string
   */
  parseAmount(amountString: string): number | null {
    // Remove currency symbols and commas
    const cleaned = amountString.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Get decimal places in a number
   */
  private getDecimalPlaces(amount: number): number {
    const str = amount.toString();
    const decimalIndex = str.indexOf('.');
    
    if (decimalIndex === -1) {
      return 0;
    }
    
    return str.length - decimalIndex - 1;
  }

  // =========================================================================
  // EXCHANGE RATE VALIDATION
  // =========================================================================

  /**
   * Validate exchange rate
   */
  validateExchangeRate(rate: ExchangeRate): FinancialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate currencies
    const fromValidation = this.validateCurrencyCode(rate.from);
    if (!fromValidation.valid) {
      errors.push(`Invalid source currency: ${rate.from}`);
    }

    const toValidation = this.validateCurrencyCode(rate.to);
    if (!toValidation.valid) {
      errors.push(`Invalid target currency: ${rate.to}`);
    }

    // Validate rate value
    if (typeof rate.rate !== 'number' || isNaN(rate.rate)) {
      errors.push('Exchange rate must be a valid number');
    } else if (rate.rate <= 0) {
      errors.push('Exchange rate must be positive');
    } else if (rate.rate > 1000) {
      warnings.push('Exchange rate is unusually high (> 1000)');
    }

    // Validate date
    if (!(rate.date instanceof Date) || isNaN(rate.date.getTime())) {
      errors.push('Exchange rate date must be a valid date');
    } else {
      const now = new Date();
      const daysDiff = (now.getTime() - rate.date.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 30) {
        warnings.push(`Exchange rate is ${Math.floor(daysDiff)} days old`);
      }
      
      if (rate.date > now) {
        errors.push('Exchange rate date cannot be in the future');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Convert amount between currencies
   */
  convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    exchangeRate: number
  ): FinancialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate source amount
    const amountValidation = this.validateAmount(amount, fromCurrency);
    if (!amountValidation.valid) {
      return amountValidation;
    }

    // Validate target currency
    const currencyValidation = this.validateCurrencyCode(toCurrency);
    if (!currencyValidation.valid) {
      return currencyValidation;
    }

    // Validate exchange rate
    if (exchangeRate <= 0) {
      errors.push('Exchange rate must be positive');
      return { valid: false, errors, warnings };
    }

    // Perform conversion
    const convertedAmount = amount * exchangeRate;
    
    // Normalize to target currency decimal places
    const targetCurrency = this.getCurrencyInfo(toCurrency);
    const normalized = targetCurrency 
      ? this.normalizeAmount(convertedAmount, targetCurrency.decimalPlaces)
      : convertedAmount;

    return {
      valid: true,
      errors,
      warnings,
      normalized: {
        amount: normalized,
        currency: toCurrency,
        originalAmount: amount,
        originalCurrency: fromCurrency,
        exchangeRate,
      },
    };
  }

  // =========================================================================
  // FINANCIAL CALCULATIONS VALIDATION
  // =========================================================================

  /**
   * Validate sum of amounts
   */
  validateSum(
    amounts: MoneyAmount[],
    expectedTotal: MoneyAmount,
    tolerance: number = 0.01
  ): FinancialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate all amounts are in same currency
    const currencies = new Set(amounts.map(a => a.currency));
    if (currencies.size > 1) {
      errors.push('All amounts must be in the same currency for sum validation');
      return { valid: false, errors, warnings };
    }

    // Validate expected total currency matches
    if (amounts.length > 0 && amounts[0].currency !== expectedTotal.currency) {
      errors.push('Expected total currency does not match amounts currency');
      return { valid: false, errors, warnings };
    }

    // Calculate sum
    const sum = amounts.reduce((total, amount) => total + amount.amount, 0);
    
    // Get currency info for normalization
    const currencyInfo = this.getCurrencyInfo(expectedTotal.currency);
    const normalizedSum = currencyInfo 
      ? this.normalizeAmount(sum, currencyInfo.decimalPlaces)
      : sum;
    
    const normalizedExpected = currencyInfo
      ? this.normalizeAmount(expectedTotal.amount, currencyInfo.decimalPlaces)
      : expectedTotal.amount;

    // Check if sum matches expected (within tolerance)
    const difference = Math.abs(normalizedSum - normalizedExpected);
    const percentDifference = normalizedExpected !== 0 
      ? (difference / normalizedExpected) * 100 
      : 0;

    if (difference > tolerance) {
      errors.push(
        `Sum ${normalizedSum} does not match expected ${normalizedExpected} (difference: ${difference.toFixed(2)})`
      );
    }

    if (percentDifference > 1 && percentDifference <= 5) {
      warnings.push(`Sum differs from expected by ${percentDifference.toFixed(2)}%`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalized: {
        sum: normalizedSum,
        expected: normalizedExpected,
        difference,
        percentDifference,
      },
    };
  }

  /**
   * Validate percentage
   */
  validatePercentage(percentage: number): FinancialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof percentage !== 'number' || isNaN(percentage)) {
      errors.push('Percentage must be a valid number');
      return { valid: false, errors, warnings };
    }

    if (percentage < 0) {
      errors.push('Percentage cannot be negative');
    }

    if (percentage > 100) {
      errors.push('Percentage cannot exceed 100%');
    }

    if (percentage > 50) {
      warnings.push('Percentage is unusually high (> 50%)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalized: percentage,
    };
  }

  /**
   * Validate discount
   */
  validateDiscount(
    originalAmount: MoneyAmount,
    discountedAmount: MoneyAmount
  ): FinancialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate currencies match
    if (originalAmount.currency !== discountedAmount.currency) {
      errors.push('Original and discounted amounts must be in the same currency');
      return { valid: false, errors, warnings };
    }

    // Validate amounts
    const originalValidation = this.validateMoneyAmount(originalAmount);
    if (!originalValidation.valid) {
      return originalValidation;
    }

    const discountedValidation = this.validateMoneyAmount(discountedAmount);
    if (!discountedValidation.valid) {
      return discountedValidation;
    }

    // Validate discount is positive
    if (discountedAmount.amount > originalAmount.amount) {
      errors.push('Discounted amount cannot be greater than original amount');
    }

    // Calculate discount percentage
    const discountAmount = originalAmount.amount - discountedAmount.amount;
    const discountPercentage = (discountAmount / originalAmount.amount) * 100;

    if (discountPercentage > 90) {
      warnings.push(`Discount is unusually high (${discountPercentage.toFixed(1)}%)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalized: {
        discountAmount,
        discountPercentage,
        originalAmount: originalAmount.amount,
        discountedAmount: discountedAmount.amount,
        currency: originalAmount.currency,
      },
    };
  }
}

export const financialValidationService = FinancialValidationService.getInstance();

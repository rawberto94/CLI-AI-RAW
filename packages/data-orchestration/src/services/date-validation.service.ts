/**
 * Date Validation and Normalization Service
 * 
 * Provides comprehensive date handling:
 * - Date format validation and parsing
 * - UTC normalization
 * - Date range validation
 * - Business day calculations
 * - Timezone handling
 */

import pino from 'pino';

const logger = pino({ name: 'date-validation-service' });

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface DateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: Date;
  iso8601?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface BusinessDayOptions {
  excludeWeekends?: boolean;
  excludeHolidays?: Date[];
  countryCode?: string;
}

// =========================================================================
// DATE VALIDATION SERVICE
// =========================================================================

export class DateValidationService {
  private static instance: DateValidationService;

  // Common date formats
  private readonly dateFormats = [
    /^\d{4}-\d{2}-\d{2}$/,                    // YYYY-MM-DD
    /^\d{4}\/\d{2}\/\d{2}$/,                  // YYYY/MM/DD
    /^\d{2}-\d{2}-\d{4}$/,                    // DD-MM-YYYY
    /^\d{2}\/\d{2}\/\d{4}$/,                  // DD/MM/YYYY or MM/DD/YYYY
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,  // ISO 8601
  ];

  private constructor() {
    logger.info('Date Validation Service initialized');
  }

  static getInstance(): DateValidationService {
    if (!DateValidationService.instance) {
      DateValidationService.instance = new DateValidationService();
    }
    return DateValidationService.instance;
  }

  // =========================================================================
  // DATE VALIDATION
  // =========================================================================

  /**
   * Validate and parse date string
   */
  validateDate(dateString: string | Date): DateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Handle Date object
    if (dateString instanceof Date) {
      if (isNaN(dateString.getTime())) {
        errors.push('Invalid Date object');
        return { valid: false, errors, warnings };
      }

      return {
        valid: true,
        errors,
        warnings,
        normalized: dateString,
        iso8601: dateString.toISOString(),
      };
    }

    // Handle string
    if (typeof dateString !== 'string') {
      errors.push('Date must be a string or Date object');
      return { valid: false, errors, warnings };
    }

    // Trim whitespace
    const trimmed = dateString.trim();

    if (trimmed.length === 0) {
      errors.push('Date string cannot be empty');
      return { valid: false, errors, warnings };
    }

    // Try to parse the date
    const parsed = this.parseDate(trimmed);

    if (!parsed) {
      errors.push(`Unable to parse date: ${trimmed}`);
      return { valid: false, errors, warnings };
    }

    // Validate parsed date is valid
    if (isNaN(parsed.getTime())) {
      errors.push(`Invalid date: ${trimmed}`);
      return { valid: false, errors, warnings };
    }

    // Check for reasonable date range
    const year = parsed.getFullYear();
    if (year < 1900) {
      warnings.push(`Date year ${year} is before 1900`);
    }

    if (year > 2100) {
      warnings.push(`Date year ${year} is after 2100`);
    }

    // Normalize to UTC
    const normalized = this.normalizeToUTC(parsed);

    return {
      valid: true,
      errors,
      warnings,
      normalized,
      iso8601: normalized.toISOString(),
    };
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateString: string): Date | null {
    // Try ISO 8601 first (most reliable)
    const isoDate = new Date(dateString);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try common formats
    // YYYY-MM-DD
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    if (iso) {
      return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/.exec(dateString);
    if (dmy) {
      return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    }

    // MM/DD/YYYY (US format)
    const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateString);
    if (mdy) {
      return new Date(parseInt(mdy[3]), parseInt(mdy[1]) - 1, parseInt(mdy[2]));
    }

    return null;
  }

  /**
   * Validate date range
   */
  validateDateRange(
    startDate: string | Date,
    endDate: string | Date
  ): DateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate start date
    const startValidation = this.validateDate(startDate);
    if (!startValidation.valid) {
      errors.push(`Invalid start date: ${startValidation.errors.join(', ')}`);
      return { valid: false, errors, warnings };
    }

    // Validate end date
    const endValidation = this.validateDate(endDate);
    if (!endValidation.valid) {
      errors.push(`Invalid end date: ${endValidation.errors.join(', ')}`);
      return { valid: false, errors, warnings };
    }

    // Check start is before end
    if (startValidation.normalized! > endValidation.normalized!) {
      errors.push('Start date must be before end date');
      return { valid: false, errors, warnings };
    }

    // Check for very long ranges
    const daysDiff = this.daysBetween(startValidation.normalized!, endValidation.normalized!);
    if (daysDiff > 3650) { // 10 years
      warnings.push(`Date range is very long (${daysDiff} days)`);
    }

    return {
      valid: true,
      errors,
      warnings,
      normalized: startValidation.normalized,
    };
  }

  // =========================================================================
  // DATE NORMALIZATION
  // =========================================================================

  /**
   * Normalize date to UTC
   */
  normalizeToUTC(date: Date): Date {
    return new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0
    ));
  }

  /**
   * Convert date to ISO 8601 string
   */
  toISO8601(date: Date): string {
    return date.toISOString();
  }

  /**
   * Convert date to YYYY-MM-DD format
   */
  toYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Convert date to DD/MM/YYYY format
   */
  toDDMMYYYY(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  /**
   * Convert date to MM/DD/YYYY format (US)
   */
  toMMDDYYYY(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}/${year}`;
  }

  // =========================================================================
  // DATE CALCULATIONS
  // =========================================================================

  /**
   * Calculate days between two dates
   */
  daysBetween(start: Date, end: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const startMs = start.getTime();
    const endMs = end.getTime();
    return Math.floor((endMs - startMs) / msPerDay);
  }

  /**
   * Add days to a date
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add months to a date
   */
  addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  /**
   * Add years to a date
   */
  addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }

  /**
   * Get start of day (00:00:00)
   */
  startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of day (23:59:59)
   */
  endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Get start of month
   */
  startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /**
   * Get end of month
   */
  endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  // =========================================================================
  // BUSINESS DAY CALCULATIONS
  // =========================================================================

  /**
   * Check if date is a weekend
   */
  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Check if date is a business day
   */
  isBusinessDay(date: Date, options: BusinessDayOptions = {}): boolean {
    // Check weekend
    if (options.excludeWeekends !== false && this.isWeekend(date)) {
      return false;
    }

    // Check holidays
    if (options.excludeHolidays) {
      const dateStr = this.toYYYYMMDD(date);
      for (const holiday of options.excludeHolidays) {
        if (this.toYYYYMMDD(holiday) === dateStr) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculate business days between two dates
   */
  businessDaysBetween(
    start: Date,
    end: Date,
    options: BusinessDayOptions = {}
  ): number {
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      if (this.isBusinessDay(current, options)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Add business days to a date
   */
  addBusinessDays(
    date: Date,
    days: number,
    options: BusinessDayOptions = {}
  ): Date {
    const result = new Date(date);
    let remaining = days;

    while (remaining > 0) {
      result.setDate(result.getDate() + 1);
      if (this.isBusinessDay(result, options)) {
        remaining--;
      }
    }

    return result;
  }

  /**
   * Get next business day
   */
  nextBusinessDay(date: Date, options: BusinessDayOptions = {}): Date {
    return this.addBusinessDays(date, 1, options);
  }

  /**
   * Get previous business day
   */
  previousBusinessDay(date: Date, options: BusinessDayOptions = {}): Date {
    const result = new Date(date);
    
    do {
      result.setDate(result.getDate() - 1);
    } while (!this.isBusinessDay(result, options));

    return result;
  }

  // =========================================================================
  // DATE COMPARISON
  // =========================================================================

  /**
   * Check if date is in the past
   */
  isPast(date: Date): boolean {
    return date < new Date();
  }

  /**
   * Check if date is in the future
   */
  isFuture(date: Date): boolean {
    return date > new Date();
  }

  /**
   * Check if date is today
   */
  isToday(date: Date): boolean {
    const today = new Date();
    return this.toYYYYMMDD(date) === this.toYYYYMMDD(today);
  }

  /**
   * Check if two dates are the same day
   */
  isSameDay(date1: Date, date2: Date): boolean {
    return this.toYYYYMMDD(date1) === this.toYYYYMMDD(date2);
  }

  /**
   * Check if date is within range
   */
  isWithinRange(date: Date, start: Date, end: Date): boolean {
    return date >= start && date <= end;
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get current date (UTC)
   */
  now(): Date {
    return new Date();
  }

  /**
   * Get current date normalized to UTC
   */
  today(): Date {
    return this.normalizeToUTC(new Date());
  }

  /**
   * Parse multiple date formats
   */
  parseFlexible(dateString: string): Date | null {
    const validation = this.validateDate(dateString);
    return validation.valid ? validation.normalized! : null;
  }

  /**
   * Format date for display
   */
  formatForDisplay(date: Date, format: 'short' | 'long' | 'iso' = 'short'): string {
    switch (format) {
      case 'short':
        return this.toYYYYMMDD(date);
      case 'long':
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'iso':
        return this.toISO8601(date);
      default:
        return this.toYYYYMMDD(date);
    }
  }

  /**
   * Get age in years
   */
  getAgeInYears(birthDate: Date, referenceDate: Date = new Date()): number {
    let age = referenceDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Get quarter of year (1-4)
   */
  getQuarter(date: Date): number {
    return Math.floor(date.getMonth() / 3) + 1;
  }

  /**
   * Get week number of year
   */
  getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Check if year is leap year
   */
  isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * Get days in month
   */
  getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }
}

export const dateValidationService = DateValidationService.getInstance();

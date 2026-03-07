/**
 * Contract ID Validation Utilities
 * Validates and fixes common contract ID format issues
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  suggestedFix?: string;
}

export class ContractIdValidator {
  // CUID pattern - 25 characters, alphanumeric
  private static readonly CUID_PATTERN = /^c[a-z0-9]{24}$/i;
  
  // UUID pattern
  private static readonly UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // Generic ID pattern (alphanumeric with dashes/underscores)
  private static readonly GENERIC_ID_PATTERN = /^[a-z0-9_-]+$/i;

  /**
   * Validate a contract ID
   */
  static validateId(id: string | null | undefined): ValidationResult {
    if (!id) {
      return {
        isValid: false,
        error: 'Contract ID is required',
      };
    }

    const trimmedId = id.trim();

    if (trimmedId.length === 0) {
      return {
        isValid: false,
        error: 'Contract ID cannot be empty',
      };
    }

    // Check for common invalid patterns
    if (trimmedId === 'undefined' || trimmedId === 'null') {
      return {
        isValid: false,
        error: 'Contract ID is invalid (undefined/null string)',
      };
    }

    // Check for CUID format
    if (this.CUID_PATTERN.test(trimmedId)) {
      return { isValid: true };
    }

    // Check for UUID format
    if (this.UUID_PATTERN.test(trimmedId)) {
      return { isValid: true };
    }

    // Check for generic ID format
    if (this.GENERIC_ID_PATTERN.test(trimmedId) && trimmedId.length >= 8) {
      return { isValid: true };
    }

    // ID is too short
    if (trimmedId.length < 8) {
      return {
        isValid: false,
        error: 'Contract ID is too short',
        suggestedFix: trimmedId,
      };
    }

    // ID contains invalid characters
    if (!/^[a-z0-9_-]+$/i.test(trimmedId)) {
      const cleaned = trimmedId.replace(/[^a-z0-9_-]/gi, '');
      return {
        isValid: false,
        error: 'Contract ID contains invalid characters',
        suggestedFix: cleaned,
      };
    }

    return { isValid: true };
  }

  /**
   * Fix common contract ID issues
   */
  static fixCommonIssues(id: string): string {
    if (!id) return '';

    let fixed = id.trim();

    // Remove URL encoding
    try {
      fixed = decodeURIComponent(fixed);
    } catch {
      // Ignore decoding errors
    }

    // Remove common prefixes/suffixes that might be accidentally added
    fixed = fixed.replace(/^(contract[-_]?|id[-_]?)/i, '');
    fixed = fixed.replace(/([-_]?contract|[-_]?id)$/i, '');

    // Remove any whitespace
    fixed = fixed.replace(/\s+/g, '');

    // Remove invalid characters
    fixed = fixed.replace(/[^a-z0-9_-]/gi, '');

    return fixed || id;
  }

  /**
   * Check if an ID looks like a CUID
   */
  static isCuid(id: string): boolean {
    return this.CUID_PATTERN.test(id);
  }

  /**
   * Check if an ID looks like a UUID
   */
  static isUuid(id: string): boolean {
    return this.UUID_PATTERN.test(id);
  }

  /**
   * Get the ID type
   */
  static getIdType(id: string): 'cuid' | 'uuid' | 'generic' | 'invalid' {
    if (!id) return 'invalid';
    if (this.isCuid(id)) return 'cuid';
    if (this.isUuid(id)) return 'uuid';
    if (this.GENERIC_ID_PATTERN.test(id) && id.length >= 8) return 'generic';
    return 'invalid';
  }
}

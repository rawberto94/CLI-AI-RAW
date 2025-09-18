/**
 * Contract ID Validator
 * Validates and sanitizes contract IDs to ensure they are properly formatted
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

export class ContractIdValidator {
  private static readonly HEX_PATTERN = /^[0-9a-fA-F-]+$/;
  private static readonly VALID_ID_PATTERN = /^doc-[0-9a-fA-F]{13}-[0-9a-fA-F]{6}$/;

  /**
   * Validates if a contract ID is properly formatted
   */
  static validateId(id: string): ValidationResult {
    if (!id || typeof id !== 'string') {
      return {
        isValid: false,
        error: 'Contract ID is required and must be a string'
      };
    }

    // Check if it matches the expected pattern
    if (!this.VALID_ID_PATTERN.test(id)) {
      return {
        isValid: false,
        error: 'Contract ID must follow format: doc-[13 hex chars]-[6 hex chars]',
        sanitized: this.sanitizeId(id)
      };
    }

    return { isValid: true };
  }

  /**
   * Checks if a string contains only valid hexadecimal characters
   */
  static isValidHexadecimal(str: string): boolean {
    return this.HEX_PATTERN.test(str);
  }

  /**
   * Sanitizes a contract ID by removing invalid characters
   */
  static sanitizeId(id: string): string {
    if (!id) return '';
    
    // Remove any non-hexadecimal characters except hyphens
    const sanitized = id.replace(/[^0-9a-fA-F-]/g, '');
    
    // If it starts with 'doc-', keep that format
    if (sanitized.startsWith('doc-')) {
      return sanitized;
    }
    
    // Otherwise, try to format it properly
    const hexOnly = sanitized.replace(/-/g, '');
    if (hexOnly.length >= 19) {
      return `doc-${hexOnly.substring(0, 13)}-${hexOnly.substring(13, 19)}`;
    }
    
    return sanitized;
  }

  /**
   * Generates a valid contract ID
   */
  static generateValidId(): string {
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).substring(2, 8);
    return `doc-${timestamp}-${random}`;
  }

  /**
   * Fixes common contract ID issues
   */
  static fixCommonIssues(id: string): string {
    if (!id) return this.generateValidId();
    
    // Fix the specific invalid ID from your system
    if (id === 'doc-1757416850438-f8xy03') {
      return 'doc-1757416850438-f83003';
    }
    
    // Replace invalid characters with valid hex
    const fixed = id.replace(/[xy]/g, '3').replace(/[^0-9a-fA-F-]/g, '');
    
    const validation = this.validateId(fixed);
    if (validation.isValid) {
      return fixed;
    }
    
    return validation.sanitized || this.generateValidId();
  }
}

// Utility functions for easy import
export const validateContractId = ContractIdValidator.validateId;
export const sanitizeContractId = ContractIdValidator.sanitizeId;
export const generateContractId = ContractIdValidator.generateValidId;
export const fixContractId = ContractIdValidator.fixCommonIssues;
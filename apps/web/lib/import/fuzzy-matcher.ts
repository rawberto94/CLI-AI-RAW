// @ts-nocheck
/**
 * Fuzzy matching service for column name mapping
 */

export interface MatchResult {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  method: 'exact' | 'fuzzy' | 'synonym' | 'pattern';
  alternatives?: Array<{ field: string; confidence: number }>;
}

export interface FieldDefinition {
  name: string;
  aliases: string[];
  patterns?: RegExp[];
  required: boolean;
}

export class FuzzyMatcher {
  private static readonly STANDARD_FIELDS: FieldDefinition[] = [
    {
      name: 'role',
      aliases: ['role', 'position', 'title', 'job title', 'job', 'designation'],
      patterns: [/role/i, /position/i, /title/i],
      required: true,
    },
    {
      name: 'seniority',
      aliases: ['seniority', 'level', 'grade', 'rank'],
      patterns: [/senior/i, /junior/i, /level/i],
      required: false,
    },
    {
      name: 'rate',
      aliases: ['rate', 'price', 'cost', 'fee', 'charge', 'amount'],
      patterns: [/rate/i, /price/i, /cost/i, /\$|€|£/],
      required: true,
    },
    {
      name: 'currency',
      aliases: ['currency', 'curr', 'ccy'],
      patterns: [/currency/i, /curr/i, /usd|eur|gbp|chf/i],
      required: false,
    },
    {
      name: 'period',
      aliases: ['period', 'unit', 'per', 'frequency'],
      patterns: [/hour|day|month|year|annual/i, /per\s/i],
      required: false,
    },
    {
      name: 'location',
      aliases: ['location', 'country', 'region', 'city', 'geography', 'geo'],
      patterns: [/location/i, /country/i, /region/i, /city/i],
      required: false,
    },
    {
      name: 'serviceLine',
      aliases: ['service line', 'service', 'practice', 'department', 'division'],
      patterns: [/service/i, /practice/i, /department/i],
      required: false,
    },
    {
      name: 'skills',
      aliases: ['skills', 'skill', 'expertise', 'competencies', 'capabilities'],
      patterns: [/skill/i, /expertise/i],
      required: false,
    },
    {
      name: 'experience',
      aliases: ['experience', 'exp', 'years', 'yoe'],
      patterns: [/experience/i, /years/i, /yoe/i],
      required: false,
    },
  ];

  /**
   * Match source columns to target fields
   */
  static matchColumns(sourceColumns: string[]): MatchResult[] {
    const results: MatchResult[] = [];
    const usedColumns = new Set<string>();

    // First pass: exact matches
    for (const column of sourceColumns) {
      const exactMatch = this.findExactMatch(column);
      if (exactMatch) {
        results.push({
          sourceColumn: column,
          targetField: exactMatch.name,
          confidence: 1.0,
          method: 'exact',
        });
        usedColumns.add(column);
      }
    }

    // Second pass: fuzzy matches for remaining columns
    for (const column of sourceColumns) {
      if (usedColumns.has(column)) continue;

      const fuzzyMatch = this.findFuzzyMatch(column, results.map(r => r.targetField));
      if (fuzzyMatch && fuzzyMatch.confidence > 0.6) {
        results.push(fuzzyMatch);
        usedColumns.add(column);
      }
    }

    return results;
  }

  /**
   * Find exact match for a column
   */
  private static findExactMatch(column: string): FieldDefinition | null {
    const normalized = this.normalizeString(column);

    for (const field of this.STANDARD_FIELDS) {
      // Check field name
      if (this.normalizeString(field.name) === normalized) {
        return field;
      }

      // Check aliases
      for (const alias of field.aliases) {
        if (this.normalizeString(alias) === normalized) {
          return field;
        }
      }
    }

    return null;
  }

  /**
   * Find fuzzy match for a column
   */
  private static findFuzzyMatch(column: string, usedFields: string[]): MatchResult | null {
    const normalized = this.normalizeString(column);
    let bestMatch: { field: FieldDefinition; confidence: number } | null = null;
    const alternatives: Array<{ field: string; confidence: number }> = [];

    for (const field of this.STANDARD_FIELDS) {
      if (usedFields.includes(field.name)) continue;

      // Calculate confidence scores
      const scores: number[] = [];

      // Check against field name
      scores.push(this.calculateSimilarity(normalized, this.normalizeString(field.name)));

      // Check against aliases
      for (const alias of field.aliases) {
        scores.push(this.calculateSimilarity(normalized, this.normalizeString(alias)));
      }

      // Check against patterns
      if (field.patterns) {
        for (const pattern of field.patterns) {
          if (pattern.test(column)) {
            scores.push(0.8);
          }
        }
      }

      const confidence = Math.max(...scores);

      if (confidence > 0.5) {
        alternatives.push({ field: field.name, confidence });
      }

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { field, confidence };
      }
    }

    if (bestMatch && bestMatch.confidence > 0.6) {
      // Sort alternatives by confidence
      alternatives.sort((a, b) => b.confidence - a.confidence);

      return {
        sourceColumn: column,
        targetField: bestMatch.field.name,
        confidence: bestMatch.confidence,
        method: 'fuzzy',
        alternatives: alternatives.slice(0, 3),
      };
    }

    return null;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate similarity score (0-1) between two strings
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
  }

  /**
   * Normalize string for comparison
   */
  private static normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Get required fields that are missing
   */
  static getMissingRequiredFields(matches: MatchResult[]): string[] {
    const matchedFields = new Set(matches.map(m => m.targetField));
    return this.STANDARD_FIELDS
      .filter(f => f.required && !matchedFields.has(f.name))
      .map(f => f.name);
  }

  /**
   * Validate mapping completeness
   */
  static validateMapping(matches: MatchResult[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required fields
    const missingRequired = this.getMissingRequiredFields(matches);
    if (missingRequired.length > 0) {
      errors.push(`Missing required fields: ${missingRequired.join(', ')}`);
    }

    // Check for low confidence matches
    const lowConfidence = matches.filter(m => m.confidence < 0.7);
    if (lowConfidence.length > 0) {
      warnings.push(
        `Low confidence matches: ${lowConfidence.map(m => m.sourceColumn).join(', ')}`
      );
    }

    // Check for duplicate mappings
    const targetFields = matches.map(m => m.targetField);
    const duplicates = targetFields.filter((f, i) => targetFields.indexOf(f) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate field mappings: ${[...new Set(duplicates)].join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Suggest improvements for mapping
   */
  static suggestImprovements(matches: MatchResult[]): string[] {
    const suggestions: string[] = [];

    // Check for unmapped columns that might be important
    const lowConfidence = matches.filter(m => m.confidence < 0.8);
    for (const match of lowConfidence) {
      if (match.alternatives && match.alternatives.length > 0) {
        suggestions.push(
          `Consider mapping "${match.sourceColumn}" to "${match.alternatives[0].field}" instead of "${match.targetField}"`
        );
      }
    }

    return suggestions;
  }

  /**
   * Get field definition by name
   */
  static getFieldDefinition(fieldName: string): FieldDefinition | undefined {
    return this.STANDARD_FIELDS.find(f => f.name === fieldName);
  }

  /**
   * Get all standard fields
   */
  static getStandardFields(): FieldDefinition[] {
    return this.STANDARD_FIELDS;
  }
}

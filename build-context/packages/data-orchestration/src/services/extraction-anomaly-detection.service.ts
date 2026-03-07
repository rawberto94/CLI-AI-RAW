/**
 * Extraction Anomaly Detection Service
 * 
 * Detects suspicious or unusual extractions:
 * - Statistical outliers in extracted values
 * - Format anomalies
 * - Cross-field inconsistencies
 * - Historical pattern deviations
 * 
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('anomaly-detection');

// =============================================================================
// TYPES
// =============================================================================

export type AnomalyType =
  | 'statistical_outlier'
  | 'format_violation'
  | 'cross_field_inconsistency'
  | 'historical_deviation'
  | 'missing_expected_field'
  | 'duplicate_value'
  | 'suspicious_pattern'
  | 'impossible_value';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DetectedAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  field: string;
  artifactType: string;
  contractId: string;
  description: string;
  extractedValue: unknown;
  expectedRange?: { min?: unknown; max?: unknown };
  suggestedAction: string;
  confidence: number;
  detectedAt: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
}

export interface AnomalyRule {
  id: string;
  name: string;
  description: string;
  field: string;
  artifactType: string;
  ruleType: 'range' | 'pattern' | 'cross_field' | 'statistical' | 'custom';
  config: AnomalyRuleConfig;
  severity: AnomalySeverity;
  enabled: boolean;
}

export interface AnomalyRuleConfig {
  // Range rules
  minValue?: number;
  maxValue?: number;
  
  // Pattern rules
  pattern?: string;
  patternDescription?: string;
  
  // Cross-field rules
  relatedField?: string;
  relationship?: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'before' | 'after';
  
  // Statistical rules
  stdDeviations?: number;
  percentileThreshold?: number;
  
  // Custom function (serialized)
  customCheck?: string;
}

export interface FieldStatistics {
  field: string;
  artifactType: string;
  tenantId: string;
  numericStats?: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    percentile25: number;
    percentile75: number;
    sampleSize: number;
  };
  stringStats?: {
    avgLength: number;
    minLength: number;
    maxLength: number;
    commonPatterns: string[];
    sampleSize: number;
  };
  dateStats?: {
    earliest: Date;
    latest: Date;
    avgDaysFromNow: number;
    sampleSize: number;
  };
  lastUpdated: Date;
}

export interface AnomalyDetectionResult {
  contractId: string;
  artifactType: string;
  scannedFields: number;
  anomaliesDetected: DetectedAnomaly[];
  overallRiskScore: number;
  scanDuration: number;
}

// =============================================================================
// EXTRACTION ANOMALY DETECTION SERVICE
// =============================================================================

export class ExtractionAnomalyDetectionService {
  private static instance: ExtractionAnomalyDetectionService;
  private fieldStatistics: Map<string, FieldStatistics> = new Map();
  private rules: Map<string, AnomalyRule> = new Map();
  private anomalies: Map<string, DetectedAnomaly[]> = new Map();
  private historicalValues: Map<string, unknown[]> = new Map();

  private constructor() {
    this.initializeDefaultRules();
  }

  static getInstance(): ExtractionAnomalyDetectionService {
    if (!ExtractionAnomalyDetectionService.instance) {
      ExtractionAnomalyDetectionService.instance = new ExtractionAnomalyDetectionService();
    }
    return ExtractionAnomalyDetectionService.instance;
  }

  // ===========================================================================
  // RULE MANAGEMENT
  // ===========================================================================

  private initializeDefaultRules(): void {
    const defaultRules: AnomalyRule[] = [
      // Date rules
      {
        id: 'date_future_limit',
        name: 'Date Too Far in Future',
        description: 'Contract dates should not be more than 10 years in the future',
        field: '*Date',
        artifactType: 'KeyDatesArtifact',
        ruleType: 'range',
        config: {
          maxValue: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
        },
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'date_past_limit',
        name: 'Date Too Far in Past',
        description: 'Contract dates should not be more than 50 years in the past',
        field: '*Date',
        artifactType: 'KeyDatesArtifact',
        ruleType: 'range',
        config: {
          minValue: Date.now() - 50 * 365 * 24 * 60 * 60 * 1000,
        },
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'expiration_after_effective',
        name: 'Expiration Before Effective Date',
        description: 'Expiration date must be after effective date',
        field: 'expirationDate',
        artifactType: 'KeyDatesArtifact',
        ruleType: 'cross_field',
        config: {
          relatedField: 'effectiveDate',
          relationship: 'after',
        },
        severity: 'high',
        enabled: true,
      },
      // Financial rules
      {
        id: 'negative_value',
        name: 'Negative Contract Value',
        description: 'Contract values should not be negative',
        field: 'totalValue',
        artifactType: 'FinancialTermsArtifact',
        ruleType: 'range',
        config: {
          minValue: 0,
        },
        severity: 'high',
        enabled: true,
      },
      {
        id: 'extreme_value',
        name: 'Extremely High Contract Value',
        description: 'Contract value is unusually high',
        field: 'totalValue',
        artifactType: 'FinancialTermsArtifact',
        ruleType: 'statistical',
        config: {
          stdDeviations: 3,
        },
        severity: 'medium',
        enabled: true,
      },
      // Pattern rules
      {
        id: 'invalid_currency',
        name: 'Invalid Currency Code',
        description: 'Currency should be a valid ISO 4217 code',
        field: 'currency',
        artifactType: 'FinancialTermsArtifact',
        ruleType: 'pattern',
        config: {
          pattern: '^[A-Z]{3}$',
          patternDescription: 'Three-letter ISO currency code',
        },
        severity: 'low',
        enabled: true,
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  addRule(rule: Omit<AnomalyRule, 'id'>): AnomalyRule {
    const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newRule = { ...rule, id };
    this.rules.set(id, newRule);
    return newRule;
  }

  updateRule(ruleId: string, updates: Partial<AnomalyRule>): AnomalyRule | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    Object.assign(rule, updates);
    this.rules.set(ruleId, rule);
    return rule;
  }

  deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  listRules(artifactType?: string): AnomalyRule[] {
    const rules = Array.from(this.rules.values());
    if (artifactType) {
      return rules.filter(r => r.artifactType === artifactType || r.artifactType === '*');
    }
    return rules;
  }

  // ===========================================================================
  // ANOMALY DETECTION
  // ===========================================================================

  async detectAnomalies(
    contractId: string,
    artifactType: string,
    extractedData: Record<string, unknown>,
    tenantId: string = 'default'
  ): Promise<AnomalyDetectionResult> {
    const startTime = Date.now();
    const anomalies: DetectedAnomaly[] = [];
    const fields = Object.keys(extractedData);

    for (const field of fields) {
      const value = extractedData[field];
      
      // Get applicable rules
      const applicableRules = this.getApplicableRules(field, artifactType);

      for (const rule of applicableRules) {
        const anomaly = this.checkRule(rule, field, value, extractedData, contractId, artifactType, tenantId);
        if (anomaly) {
          anomalies.push(anomaly);
        }
      }

      // Check for statistical outliers
      const statisticalAnomaly = this.checkStatisticalAnomaly(field, value, artifactType, tenantId, contractId);
      if (statisticalAnomaly) {
        anomalies.push(statisticalAnomaly);
      }

      // Update historical values
      this.recordValue(field, artifactType, tenantId, value);
    }

    // Check for missing expected fields
    const missingFieldAnomalies = this.checkMissingFields(artifactType, extractedData, contractId);
    anomalies.push(...missingFieldAnomalies);

    // Store anomalies
    const key = `${tenantId}:${contractId}`;
    this.anomalies.set(key, anomalies);

    const overallRiskScore = this.calculateRiskScore(anomalies);

    return {
      contractId,
      artifactType,
      scannedFields: fields.length,
      anomaliesDetected: anomalies,
      overallRiskScore,
      scanDuration: Date.now() - startTime,
    };
  }

  private getApplicableRules(field: string, artifactType: string): AnomalyRule[] {
    return Array.from(this.rules.values()).filter(rule => {
      if (!rule.enabled) return false;
      if (rule.artifactType !== '*' && rule.artifactType !== artifactType) return false;
      
      // Check field matching (supports wildcards like *Date)
      if (rule.field === '*') return true;
      if (rule.field === field) return true;
      if (rule.field.startsWith('*') && field.endsWith(rule.field.slice(1))) return true;
      if (rule.field.endsWith('*') && field.startsWith(rule.field.slice(0, -1))) return true;
      
      return false;
    });
  }

  private checkRule(
    rule: AnomalyRule,
    field: string,
    value: unknown,
    allData: Record<string, unknown>,
    contractId: string,
    artifactType: string,
    _tenantId: string
  ): DetectedAnomaly | null {
    switch (rule.ruleType) {
      case 'range':
        return this.checkRangeRule(rule, field, value, contractId, artifactType);
      case 'pattern':
        return this.checkPatternRule(rule, field, value, contractId, artifactType);
      case 'cross_field':
        return this.checkCrossFieldRule(rule, field, value, allData, contractId, artifactType);
      default:
        return null;
    }
  }

  private checkRangeRule(
    rule: AnomalyRule,
    field: string,
    value: unknown,
    contractId: string,
    artifactType: string
  ): DetectedAnomaly | null {
    const numValue = this.toNumber(value);
    if (numValue === null) return null;

    const { minValue, maxValue } = rule.config;

    if (minValue !== undefined && numValue < minValue) {
      return this.createAnomaly(
        'statistical_outlier',
        rule.severity,
        field,
        artifactType,
        contractId,
        `${field} value (${numValue}) is below minimum (${minValue})`,
        value,
        { min: minValue, max: maxValue }
      );
    }

    if (maxValue !== undefined && numValue > maxValue) {
      return this.createAnomaly(
        'statistical_outlier',
        rule.severity,
        field,
        artifactType,
        contractId,
        `${field} value (${numValue}) exceeds maximum (${maxValue})`,
        value,
        { min: minValue, max: maxValue }
      );
    }

    return null;
  }

  private checkPatternRule(
    rule: AnomalyRule,
    field: string,
    value: unknown,
    contractId: string,
    artifactType: string
  ): DetectedAnomaly | null {
    if (typeof value !== 'string' || !rule.config.pattern) return null;

    const regex = new RegExp(rule.config.pattern);
    if (!regex.test(value)) {
      return this.createAnomaly(
        'format_violation',
        rule.severity,
        field,
        artifactType,
        contractId,
        `${field} value "${value}" does not match expected format: ${rule.config.patternDescription || rule.config.pattern}`,
        value
      );
    }

    return null;
  }

  private checkCrossFieldRule(
    rule: AnomalyRule,
    field: string,
    value: unknown,
    allData: Record<string, unknown>,
    contractId: string,
    artifactType: string
  ): DetectedAnomaly | null {
    const { relatedField, relationship } = rule.config;
    if (!relatedField || !relationship) return null;

    const relatedValue = allData[relatedField];
    if (relatedValue === undefined) return null;

    let isViolation = false;
    let description = '';

    switch (relationship) {
      case 'after': {
        const date1 = this.toDate(value);
        const date2 = this.toDate(relatedValue);
        if (date1 && date2 && date1 <= date2) {
          isViolation = true;
          description = `${field} should be after ${relatedField}`;
        }
        break;
      }
      case 'before': {
        const date1 = this.toDate(value);
        const date2 = this.toDate(relatedValue);
        if (date1 && date2 && date1 >= date2) {
          isViolation = true;
          description = `${field} should be before ${relatedField}`;
        }
        break;
      }
      case 'greater_than': {
        const num1 = this.toNumber(value);
        const num2 = this.toNumber(relatedValue);
        if (num1 !== null && num2 !== null && num1 <= num2) {
          isViolation = true;
          description = `${field} should be greater than ${relatedField}`;
        }
        break;
      }
      case 'less_than': {
        const num1 = this.toNumber(value);
        const num2 = this.toNumber(relatedValue);
        if (num1 !== null && num2 !== null && num1 >= num2) {
          isViolation = true;
          description = `${field} should be less than ${relatedField}`;
        }
        break;
      }
    }

    if (isViolation) {
      return this.createAnomaly(
        'cross_field_inconsistency',
        rule.severity,
        field,
        artifactType,
        contractId,
        description,
        value
      );
    }

    return null;
  }

  private checkStatisticalAnomaly(
    field: string,
    value: unknown,
    artifactType: string,
    tenantId: string,
    contractId: string
  ): DetectedAnomaly | null {
    const statsKey = `${tenantId}:${artifactType}:${field}`;
    const stats = this.fieldStatistics.get(statsKey);
    
    if (!stats?.numericStats || stats.numericStats.sampleSize < 30) {
      return null; // Not enough data for statistical analysis
    }

    const numValue = this.toNumber(value);
    if (numValue === null) return null;

    const { mean, stdDev } = stats.numericStats;
    const zScore = Math.abs((numValue - mean) / stdDev);

    if (zScore > 3) {
      return this.createAnomaly(
        'statistical_outlier',
        zScore > 4 ? 'high' : 'medium',
        field,
        artifactType,
        contractId,
        `${field} value (${numValue}) is a statistical outlier (${zScore.toFixed(1)} standard deviations from mean)`,
        value,
        { min: mean - 2 * stdDev, max: mean + 2 * stdDev }
      );
    }

    return null;
  }

  private checkMissingFields(
    artifactType: string,
    extractedData: Record<string, unknown>,
    contractId: string
  ): DetectedAnomaly[] {
    const expectedFields: Record<string, string[]> = {
      KeyDatesArtifact: ['effectiveDate', 'expirationDate'],
      FinancialTermsArtifact: ['totalValue'],
      PartiesArtifact: ['parties'],
    };

    const expected = expectedFields[artifactType] || [];
    const anomalies: DetectedAnomaly[] = [];

    for (const field of expected) {
      if (extractedData[field] === undefined || extractedData[field] === null) {
        anomalies.push(this.createAnomaly(
          'missing_expected_field',
          'low',
          field,
          artifactType,
          contractId,
          `Expected field "${field}" was not extracted`,
          null
        ));
      }
    }

    return anomalies;
  }

  // ===========================================================================
  // STATISTICS MANAGEMENT
  // ===========================================================================

  private recordValue(
    field: string,
    artifactType: string,
    tenantId: string,
    value: unknown
  ): void {
    const key = `${tenantId}:${artifactType}:${field}`;
    
    // Store historical values
    const history = this.historicalValues.get(key) || [];
    history.push(value);
    if (history.length > 10000) {
      history.shift();
    }
    this.historicalValues.set(key, history);

    // Update statistics periodically
    if (history.length % 100 === 0) {
      this.updateFieldStatistics(field, artifactType, tenantId, history);
    }
  }

  private updateFieldStatistics(
    field: string,
    artifactType: string,
    tenantId: string,
    values: unknown[]
  ): void {
    const key = `${tenantId}:${artifactType}:${field}`;
    
    // Numeric statistics
    const numericValues = values.map(v => this.toNumber(v)).filter((v): v is number => v !== null);
    
    if (numericValues.length >= 10) {
      numericValues.sort((a, b) => a - b);
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const mean = sum / numericValues.length;
      const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length;
      
      this.fieldStatistics.set(key, {
        field,
        artifactType,
        tenantId,
        numericStats: {
          mean,
          median: numericValues[Math.floor(numericValues.length / 2)],
          stdDev: Math.sqrt(variance),
          min: numericValues[0],
          max: numericValues[numericValues.length - 1],
          percentile25: numericValues[Math.floor(numericValues.length * 0.25)],
          percentile75: numericValues[Math.floor(numericValues.length * 0.75)],
          sampleSize: numericValues.length,
        },
        lastUpdated: new Date(),
      });
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private createAnomaly(
    type: AnomalyType,
    severity: AnomalySeverity,
    field: string,
    artifactType: string,
    contractId: string,
    description: string,
    extractedValue: unknown,
    expectedRange?: { min?: unknown; max?: unknown }
  ): DetectedAnomaly {
    return {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      severity,
      field,
      artifactType,
      contractId,
      description,
      extractedValue,
      expectedRange,
      suggestedAction: this.getSuggestedAction(type, severity),
      confidence: 0.85,
      detectedAt: new Date(),
      resolved: false,
    };
  }

  private getSuggestedAction(type: AnomalyType, severity: AnomalySeverity): string {
    if (severity === 'critical') {
      return 'Manual review required before proceeding';
    }

    switch (type) {
      case 'statistical_outlier':
        return 'Verify the extracted value against the source document';
      case 'format_violation':
        return 'Check if the format is correct or update extraction pattern';
      case 'cross_field_inconsistency':
        return 'Review related fields for consistency';
      case 'missing_expected_field':
        return 'Check if field exists in document or mark as intentionally empty';
      case 'duplicate_value':
        return 'Verify if duplication is intentional';
      case 'impossible_value':
        return 'Value appears invalid - manual correction required';
      default:
        return 'Review and correct if necessary';
    }
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[,$]/g, ''));
      return isNaN(parsed) ? null : parsed;
    }
    if (value instanceof Date) return value.getTime();
    return null;
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'number') return new Date(value);
    return null;
  }

  private calculateRiskScore(anomalies: DetectedAnomaly[]): number {
    if (anomalies.length === 0) return 0;

    const severityWeights: Record<AnomalySeverity, number> = {
      low: 10,
      medium: 25,
      high: 50,
      critical: 100,
    };

    const totalWeight = anomalies.reduce((sum, a) => sum + severityWeights[a.severity], 0);
    return Math.min(100, totalWeight);
  }

  // ===========================================================================
  // ANOMALY MANAGEMENT
  // ===========================================================================

  getAnomalies(tenantId: string, contractId?: string): DetectedAnomaly[] {
    if (contractId) {
      return this.anomalies.get(`${tenantId}:${contractId}`) || [];
    }

    const allAnomalies: DetectedAnomaly[] = [];
    for (const [key, anomalies] of this.anomalies) {
      if (key.startsWith(`${tenantId}:`)) {
        allAnomalies.push(...anomalies);
      }
    }
    return allAnomalies;
  }

  resolveAnomaly(
    tenantId: string,
    contractId: string,
    anomalyId: string,
    resolution: string,
    resolvedBy: string
  ): boolean {
    const key = `${tenantId}:${contractId}`;
    const anomalies = this.anomalies.get(key);
    if (!anomalies) return false;

    const anomaly = anomalies.find(a => a.id === anomalyId);
    if (!anomaly) return false;

    anomaly.resolved = true;
    anomaly.resolution = resolution;
    anomaly.resolvedBy = resolvedBy;
    anomaly.resolvedAt = new Date();

    return true;
  }

  getStatistics(tenantId: string, artifactType?: string): FieldStatistics[] {
    const stats: FieldStatistics[] = [];
    for (const [key, stat] of this.fieldStatistics) {
      if (key.startsWith(`${tenantId}:`)) {
        if (!artifactType || stat.artifactType === artifactType) {
          stats.push(stat);
        }
      }
    }
    return stats;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const extractionAnomalyDetectionService = ExtractionAnomalyDetectionService.getInstance();

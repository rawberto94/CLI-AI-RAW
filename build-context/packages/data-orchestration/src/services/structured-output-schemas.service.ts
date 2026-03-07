/**
 * Structured Output JSON Schemas for AI Artifact Generation
 * 
 * Uses OpenAI's structured output feature with strict JSON schemas
 * to eliminate parsing errors and ensure consistent output format.
 * 
 * @version 1.0.0
 */

import type { JSONSchema } from 'openai/lib/jsonschema';

// =============================================================================
// BASE SCHEMA COMPONENTS
// =============================================================================

const CONFIDENCE_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    value: { type: 'number', description: 'Confidence score from 0 to 1' },
    source: { type: 'string', description: 'Source location in document (section/page/paragraph)' },
    reasoning: { type: 'string', description: 'Brief explanation of extraction confidence' },
  },
  required: ['value'],
  additionalProperties: false,
};

const VALUE_WITH_CONFIDENCE_SCHEMA = (valueType: 'string' | 'number' | 'boolean'): JSONSchema => ({
  type: 'object',
  properties: {
    value: { type: valueType },
    confidence: { type: 'number', description: '0-1 confidence score' },
    source: { type: 'string', description: 'Source location in document' },
  },
  required: ['value'],
  additionalProperties: false,
});

const PARTY_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Legal entity name exactly as stated in contract' },
    role: { type: 'string', enum: ['CLIENT', 'VENDOR', 'PARTNER', 'CONTRACTOR', 'EMPLOYER', 'EMPLOYEE', 'LICENSOR', 'LICENSEE', 'OTHER'] },
    address: { type: 'string' },
    state: { type: 'string', description: 'State/jurisdiction of incorporation' },
  },
  required: ['name', 'role'],
  additionalProperties: false,
};

const MONEY_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    value: { type: 'number', description: 'Numeric amount' },
    currency: { type: 'string', default: 'USD' },
    confidence: { type: 'number' },
    source: { type: 'string' },
  },
  required: ['value'],
  additionalProperties: false,
};

// =============================================================================
// ARTIFACT-SPECIFIC SCHEMAS
// =============================================================================

export const OVERVIEW_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    contractName: {
      type: 'object',
      properties: {
        value: { type: 'string', description: 'Full contract title/name' },
        confidence: { type: 'number' },
      },
      required: ['value'],
      additionalProperties: false,
    },
    contractType: {
      type: 'object',
      properties: {
        value: { 
          type: 'string', 
          enum: ['MSA', 'SOW', 'NDA', 'SLA', 'LICENSE', 'EMPLOYMENT', 'LEASE', 'PURCHASE', 'PARTNERSHIP', 'OTHER'],
        },
        subType: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['value'],
      additionalProperties: false,
    },
    parties: {
      type: 'array',
      items: PARTY_SCHEMA,
      minItems: 2,
      description: 'All parties to the contract',
    },
    effectiveDate: VALUE_WITH_CONFIDENCE_SCHEMA('string'),
    expirationDate: VALUE_WITH_CONFIDENCE_SCHEMA('string'),
    totalValue: MONEY_SCHEMA,
    executiveSummary: {
      type: 'object',
      properties: {
        value: { type: 'string', description: '2-3 sentence summary of contract purpose and key terms' },
        confidence: { type: 'number' },
      },
      required: ['value'],
      additionalProperties: false,
    },
    governingLaw: VALUE_WITH_CONFIDENCE_SCHEMA('string'),
    status: {
      type: 'string',
      enum: ['ACTIVE', 'EXPIRED', 'PENDING', 'TERMINATED', 'DRAFT'],
    },
    extractionMetadata: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        extractionTime: { type: 'string' },
        documentQuality: { type: 'string', enum: ['high', 'medium', 'low'] },
        warningsOrGaps: { 
          type: 'array', 
          items: { type: 'string' } 
        },
      },
      required: ['model', 'extractionTime'],
      additionalProperties: false,
    },
  },
  required: ['contractName', 'parties', 'effectiveDate', 'executiveSummary'],
  additionalProperties: false,
};

export const FINANCIAL_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    totalValue: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        currency: { type: 'string', default: 'USD' },
        isEstimated: { type: 'boolean' },
        confidence: { type: 'number' },
        source: { type: 'string' },
      },
      required: ['value'],
      additionalProperties: false,
    },
    paymentTerms: {
      type: 'object',
      properties: {
        netDays: { type: 'number', description: 'Payment due in N days (e.g., Net 30)' },
        paymentMethod: { type: 'string' },
        invoicingSchedule: { type: 'string' },
        currency: { type: 'string' },
      },
      required: ['netDays'],
      additionalProperties: false,
    },
    paymentSchedule: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'ISO date or description' },
          amount: { type: 'number' },
          description: { type: 'string' },
          milestone: { type: 'string' },
          isPaid: { type: 'boolean' },
        },
        required: ['amount'],
        additionalProperties: false,
      },
    },
    fees: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number' },
          frequency: { type: 'string', enum: ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'PER_UNIT', 'VARIABLE'] },
          description: { type: 'string' },
        },
        required: ['name', 'amount'],
        additionalProperties: false,
      },
    },
    penalties: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          condition: { type: 'string' },
          amount: { type: 'number' },
          percentage: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['condition'],
        additionalProperties: false,
      },
    },
    creditTerms: {
      type: 'object',
      properties: {
        creditLimit: { type: 'number' },
        interestRate: { type: 'number' },
        gracePeriod: { type: 'number' },
      },
      additionalProperties: false,
    },
    revenueRecognition: {
      type: 'object',
      properties: {
        method: { type: 'string' },
        timing: { type: 'string' },
        notes: { type: 'string' },
      },
      additionalProperties: false,
    },
    extractionMetadata: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        extractionTime: { type: 'string' },
        warningsOrGaps: { 
          type: 'array', 
          items: { type: 'string' } 
        },
      },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['totalValue', 'paymentTerms'],
  additionalProperties: false,
};

export const RISK_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    overallRiskScore: {
      type: 'object',
      properties: {
        value: { type: 'number', minimum: 1, maximum: 10 },
        category: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        confidence: { type: 'number' },
      },
      required: ['value', 'category'],
      additionalProperties: false,
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: {
            type: 'string',
            enum: [
              'FINANCIAL', 'LEGAL', 'OPERATIONAL', 'COMPLIANCE', 'REPUTATIONAL',
              'TERMINATION', 'LIABILITY', 'IP', 'DATA_SECURITY', 'PERFORMANCE',
            ],
          },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          likelihood: { type: 'string', enum: ['UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN'] },
          title: { type: 'string' },
          description: { type: 'string' },
          relatedClause: { type: 'string', description: 'Reference to specific contract section' },
          potentialImpact: { type: 'string' },
          mitigationSuggestion: { type: 'string' },
          sourceQuote: { type: 'string', description: 'Direct quote from contract' },
        },
        required: ['category', 'severity', 'title', 'description'],
        additionalProperties: false,
      },
    },
    missingProtections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          protection: { type: 'string' },
          importance: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          recommendation: { type: 'string' },
        },
        required: ['protection', 'importance'],
        additionalProperties: false,
      },
      description: 'Standard protections that are missing from contract',
    },
    negotiationPoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          clause: { type: 'string' },
          currentLanguage: { type: 'string' },
          concern: { type: 'string' },
          suggestedChange: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
        },
        required: ['clause', 'concern'],
        additionalProperties: false,
      },
    },
    extractionMetadata: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        extractionTime: { type: 'string' },
        analysisApproach: { type: 'string' },
      },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['overallRiskScore', 'risks'],
  additionalProperties: false,
};

export const CLAUSES_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    totalClausesIdentified: { type: 'number' },
    clauses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'TERMINATION', 'LIABILITY', 'INDEMNIFICATION', 'CONFIDENTIALITY',
              'IP', 'WARRANTY', 'PAYMENT', 'DISPUTE_RESOLUTION', 'GOVERNING_LAW',
              'FORCE_MAJEURE', 'ASSIGNMENT', 'NOTICE', 'AMENDMENT', 'SURVIVAL',
              'ENTIRE_AGREEMENT', 'SEVERABILITY', 'WAIVER', 'INSURANCE', 'AUDIT',
              'NON_COMPETE', 'NON_SOLICITATION', 'DATA_PROTECTION', 'OTHER',
            ],
          },
          section: { type: 'string', description: 'Section number or reference' },
          summary: { type: 'string', description: '1-2 sentence summary' },
          fullText: { type: 'string', description: 'Verbatim clause text' },
          keyTerms: {
            type: 'array',
            items: { type: 'string' },
          },
          isStandard: { type: 'boolean', description: 'Is this a standard market clause?' },
          unusualAspects: { type: 'string', description: 'Any unusual or notable aspects' },
          relatedRisks: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title', 'type', 'summary'],
        additionalProperties: false,
      },
    },
    missingStandardClauses: {
      type: 'array',
      items: { type: 'string' },
      description: 'Standard clauses that are expected but missing',
    },
    extractionMetadata: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        extractionTime: { type: 'string' },
      },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['clauses'],
  additionalProperties: false,
};

export const OBLIGATIONS_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    obligations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          party: { type: 'string', description: 'Name of responsible party' },
          obligation: { type: 'string', description: 'Description of obligation' },
          type: {
            type: 'string',
            enum: ['DELIVERY', 'PAYMENT', 'REPORTING', 'COMPLIANCE', 'PERFORMANCE', 'NOTIFICATION', 'OTHER'],
          },
          dueDate: { type: 'string' },
          frequency: { type: 'string', enum: ['ONE_TIME', 'RECURRING', 'ONGOING', 'CONDITIONAL'] },
          recurrencePattern: { type: 'string' },
          condition: { type: 'string', description: 'Trigger condition if conditional' },
          sourceClause: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'NOT_APPLICABLE'] },
        },
        required: ['party', 'obligation', 'type'],
        additionalProperties: false,
      },
    },
    upcomingDeadlines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          obligation: { type: 'string' },
          party: { type: 'string' },
        },
        required: ['date', 'obligation'],
        additionalProperties: false,
      },
    },
    extractionMetadata: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        extractionTime: { type: 'string' },
      },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['obligations'],
  additionalProperties: false,
};

export const RATES_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    rateSchedule: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          role: { type: 'string' },
          rate: { type: 'number' },
          unit: { type: 'string', enum: ['HOURLY', 'DAILY', 'MONTHLY', 'ANNUAL', 'PER_UNIT', 'FIXED'] },
          currency: { type: 'string' },
          effectiveDate: { type: 'string' },
          expirationDate: { type: 'string' },
          tier: { type: 'string' },
        },
        required: ['description', 'rate', 'unit'],
        additionalProperties: false,
      },
    },
    volumeDiscounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          threshold: { type: 'number' },
          thresholdUnit: { type: 'string' },
          discountPercent: { type: 'number' },
          discountAmount: { type: 'number' },
        },
        required: ['threshold'],
        additionalProperties: false,
      },
    },
    escalationTerms: {
      type: 'object',
      properties: {
        hasEscalation: { type: 'boolean' },
        escalationType: { type: 'string', enum: ['CPI', 'FIXED_PERCENT', 'NEGOTIATED', 'NONE'] },
        escalationRate: { type: 'number' },
        escalationFrequency: { type: 'string' },
        cap: { type: 'number' },
      },
      additionalProperties: false,
    },
    extractionMetadata: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        extractionTime: { type: 'string' },
      },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['rateSchedule'],
  additionalProperties: false,
};

export const RENEWAL_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    renewalType: {
      type: 'string',
      enum: ['AUTO_RENEW', 'MANUAL', 'EVERGREEN', 'FIXED_TERM', 'NONE'],
    },
    currentTermEnd: { type: 'string' },
    renewalTermLength: { type: 'string' },
    noticeRequired: {
      type: 'object',
      properties: {
        days: { type: 'number' },
        type: { type: 'string', enum: ['BEFORE_EXPIRATION', 'AFTER_RENEWAL'] },
        method: { type: 'string' },
      },
      additionalProperties: false,
    },
    terminationRights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          party: { type: 'string' },
          condition: { type: 'string' },
          noticePeriod: { type: 'number' },
          penalty: { type: 'string' },
        },
        required: ['party', 'condition'],
        additionalProperties: false,
      },
    },
    renewalPricing: {
      type: 'object',
      properties: {
        adjustment: { type: 'string' },
        cap: { type: 'number' },
        renegotiationRequired: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    keyDates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          event: { type: 'string' },
          actionRequired: { type: 'string' },
        },
        required: ['date', 'event'],
        additionalProperties: false,
      },
    },
    extractionMetadata: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        extractionTime: { type: 'string' },
      },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['renewalType'],
  additionalProperties: false,
};

export const COMPLIANCE_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    complianceRequirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          regulation: { type: 'string' },
          category: {
            type: 'string',
            enum: ['DATA_PRIVACY', 'SECURITY', 'FINANCIAL', 'ENVIRONMENTAL', 'LABOR', 'INDUSTRY_SPECIFIC', 'OTHER'],
          },
          requirement: { type: 'string' },
          applicableTo: { type: 'string' },
          verificationMethod: { type: 'string' },
          frequency: { type: 'string' },
          deadline: { type: 'string' },
        },
        required: ['regulation', 'requirement'],
        additionalProperties: false,
      },
    },
    certifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          party: { type: 'string' },
          required: { type: 'boolean' },
          validUntil: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
    auditRights: {
      type: 'object',
      properties: {
        hasAuditRights: { type: 'boolean' },
        auditingParty: { type: 'string' },
        frequency: { type: 'string' },
        noticePeriod: { type: 'number' },
        scope: { type: 'string' },
      },
      additionalProperties: false,
    },
    dataProtection: {
      type: 'object',
      properties: {
        hasDataProtection: { type: 'boolean' },
        regulations: { type: 'array', items: { type: 'string' } },
        dataProcessingAgreement: { type: 'boolean' },
        dataTransferMechanism: { type: 'string' },
      },
      additionalProperties: false,
    },
    extractionMetadata: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        extractionTime: { type: 'string' },
      },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['complianceRequirements'],
  additionalProperties: false,
};

// =============================================================================
// SCHEMA REGISTRY
// =============================================================================

export const ARTIFACT_SCHEMAS: Record<string, JSONSchema> = {
  OVERVIEW: OVERVIEW_ARTIFACT_SCHEMA,
  FINANCIAL: FINANCIAL_ARTIFACT_SCHEMA,
  RISK: RISK_ARTIFACT_SCHEMA,
  CLAUSES: CLAUSES_ARTIFACT_SCHEMA,
  OBLIGATIONS: OBLIGATIONS_ARTIFACT_SCHEMA,
  RATES: RATES_ARTIFACT_SCHEMA,
  RENEWAL: RENEWAL_ARTIFACT_SCHEMA,
  COMPLIANCE: COMPLIANCE_ARTIFACT_SCHEMA,
};

/**
 * Get schema for artifact type with optional tenant customizations
 */
export function getSchemaForArtifact(
  artifactType: string,
  tenantCustomFields?: Record<string, JSONSchema>
): JSONSchema | null {
  const baseSchema = ARTIFACT_SCHEMAS[artifactType];
  if (!baseSchema) return null;

  if (!tenantCustomFields || Object.keys(tenantCustomFields).length === 0) {
    return baseSchema;
  }

  // Merge tenant custom fields into schema
  return {
    ...baseSchema,
    properties: {
      ...(baseSchema as any).properties,
      customFields: {
        type: 'object',
        properties: tenantCustomFields,
        additionalProperties: false,
      },
    },
  };
}

/**
 * Create OpenAI structured output format
 */
export function createStructuredOutputFormat(
  artifactType: string,
  tenantCustomFields?: Record<string, JSONSchema>
): { type: 'json_schema'; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } } | undefined {
  const schema = getSchemaForArtifact(artifactType, tenantCustomFields);
  if (!schema) return undefined;

  return {
    type: 'json_schema',
    json_schema: {
      name: `${artifactType.toLowerCase()}_artifact`,
      strict: true,
      schema: schema as Record<string, unknown>,
    },
  };
}

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

// ---------- 7 new artifact schemas (NEGOTIATION_POINTS through EXECUTIVE_SUMMARY) ----------

export const NEGOTIATION_POINTS_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    leveragePoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          strength: { type: 'string', enum: ['strong', 'moderate', 'weak'] },
          suggestedAction: { type: 'string' },
          sourceClause: { type: 'string' },
        },
        required: ['title', 'description', 'strength'],
        additionalProperties: false,
      },
    },
    weakClauses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          clauseReference: { type: 'string' },
          issue: { type: 'string' },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
          suggestedRevision: { type: 'string' },
          benchmarkComparison: { type: 'string' },
        },
        required: ['clauseReference', 'issue', 'impact'],
        additionalProperties: false,
      },
    },
    benchmarkGaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          currentTerm: { type: 'string' },
          marketStandard: { type: 'string' },
          gap: { type: 'string' },
          recommendation: { type: 'string' },
        },
        required: ['area', 'currentTerm', 'marketStandard'],
        additionalProperties: false,
      },
    },
    negotiationScript: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          openingPosition: { type: 'string' },
          fallbackPosition: { type: 'string' },
          walkAwayPoint: { type: 'string' },
          supportingEvidence: { type: 'array', items: { type: 'string' } },
        },
        required: ['topic', 'openingPosition'],
        additionalProperties: false,
      },
    },
    overallLeverage: { type: 'string', enum: ['strong', 'balanced', 'weak'] },
    extractionMetadata: {
      type: 'object',
      properties: { model: { type: 'string' }, extractionTime: { type: 'string' } },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['leveragePoints'],
  additionalProperties: false,
};

export const AMENDMENTS_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    amendments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          amendmentNumber: { type: 'number' },
          effectiveDate: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          changedClauses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                clauseId: { type: 'string' },
                originalText: { type: 'string' },
                newText: { type: 'string' },
                changeType: { type: 'string', enum: ['added', 'modified', 'deleted'] },
              },
              required: ['clauseId', 'newText', 'changeType'],
              additionalProperties: false,
            },
          },
          signedBy: { type: 'array', items: { type: 'string' } },
          sourceDocument: { type: 'string' },
        },
        required: ['title', 'description'],
        additionalProperties: false,
      },
    },
    supersededClauses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          originalClause: { type: 'string' },
          supersededBy: { type: 'string' },
          effectiveDate: { type: 'string' },
        },
        required: ['originalClause', 'supersededBy'],
        additionalProperties: false,
      },
    },
    changeLog: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          type: { type: 'string' },
          description: { type: 'string' },
          reference: { type: 'string' },
        },
        required: ['date', 'description'],
        additionalProperties: false,
      },
    },
    extractionMetadata: {
      type: 'object',
      properties: { model: { type: 'string' }, extractionTime: { type: 'string' } },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['amendments'],
  additionalProperties: false,
};

export const CONTACTS_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    primaryContacts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string' },
          party: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' },
          isPrimary: { type: 'boolean' },
        },
        required: ['name', 'role', 'party'],
        additionalProperties: false,
      },
    },
    escalationPath: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          level: { type: 'number' },
          role: { type: 'string' },
          name: { type: 'string' },
          contactInfo: { type: 'string' },
          escalationTrigger: { type: 'string' },
        },
        required: ['level', 'role'],
        additionalProperties: false,
      },
    },
    notificationAddresses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          purpose: { type: 'string' },
          party: { type: 'string' },
          address: { type: 'string' },
          format: { type: 'string' },
        },
        required: ['purpose', 'address'],
        additionalProperties: false,
      },
    },
    extractionMetadata: {
      type: 'object',
      properties: { model: { type: 'string' }, extractionTime: { type: 'string' } },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['primaryContacts'],
  additionalProperties: false,
};

export const PARTIES_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    parties: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          type: { type: 'string' },
          address: { type: 'string' },
          jurisdiction: { type: 'string' },
          signatoryName: { type: 'string' },
          signatoryTitle: { type: 'string' },
        },
        required: ['name', 'role'],
        additionalProperties: false,
      },
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          partyA: { type: 'string' },
          partyB: { type: 'string' },
          relationship: { type: 'string' },
        },
        required: ['partyA', 'partyB', 'relationship'],
        additionalProperties: false,
      },
    },
    thirdParties: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
        },
        required: ['name', 'role'],
        additionalProperties: false,
      },
    },
    extractionMetadata: {
      type: 'object',
      properties: { model: { type: 'string' }, extractionTime: { type: 'string' } },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['parties'],
  additionalProperties: false,
};

export const TIMELINE_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    contractTimeline: {
      type: 'object',
      properties: {
        executionDate: { type: 'string' },
        effectiveDate: { type: 'string' },
        expirationDate: { type: 'string' },
        totalDuration: { type: 'string' },
      },
      additionalProperties: false,
    },
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          date: { type: 'string' },
          type: { type: 'string' },
          owner: { type: 'string' },
          consequences: { type: 'string' },
        },
        required: ['name', 'date'],
        additionalProperties: false,
      },
    },
    deadlines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          date: { type: 'string' },
          type: { type: 'string' },
          consequences: { type: 'string' },
        },
        required: ['description', 'date'],
        additionalProperties: false,
      },
    },
    paymentSchedule: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          amount: { type: 'string' },
          dueDate: { type: 'string' },
          frequency: { type: 'string' },
        },
        required: ['description', 'dueDate'],
        additionalProperties: false,
      },
    },
    noticePeriods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          period: { type: 'string' },
          method: { type: 'string' },
        },
        required: ['type', 'period'],
        additionalProperties: false,
      },
    },
    criticalPath: { type: 'array', items: { type: 'string' } },
    extractionMetadata: {
      type: 'object',
      properties: { model: { type: 'string' }, extractionTime: { type: 'string' } },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['contractTimeline', 'milestones'],
  additionalProperties: false,
};

export const DELIVERABLES_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    deliverables: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string' },
          owner: { type: 'string' },
          recipient: { type: 'string' },
          dueDate: { type: 'string' },
          acceptanceCriteria: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        },
        required: ['name', 'description'],
        additionalProperties: false,
      },
    },
    serviceLevels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          metric: { type: 'string' },
          target: { type: 'string' },
          measurement: { type: 'string' },
          penalty: { type: 'string' },
        },
        required: ['metric', 'target'],
        additionalProperties: false,
      },
    },
    acceptanceProcess: {
      type: 'object',
      properties: {
        reviewPeriod: { type: 'string' },
        approvalAuthority: { type: 'string' },
        rejectionProcess: { type: 'string' },
      },
      additionalProperties: false,
    },
    workBreakdown: { type: 'array', items: { type: 'string' } },
    exclusions: { type: 'array', items: { type: 'string' } },
    extractionMetadata: {
      type: 'object',
      properties: { model: { type: 'string' }, extractionTime: { type: 'string' } },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['deliverables'],
  additionalProperties: false,
};

export const EXECUTIVE_SUMMARY_ARTIFACT_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    strategicSummary: { type: 'string' },
    keyMetrics: {
      type: 'object',
      properties: {
        totalContractValue: { type: 'string' },
        contractDuration: { type: 'string' },
        keyDeadlines: { type: 'array', items: { type: 'string' } },
        numberOfParties: { type: 'number' },
        numberOfDeliverables: { type: 'number' },
      },
      additionalProperties: false,
    },
    businessImpact: {
      type: 'object',
      properties: {
        revenueImpact: { type: 'string' },
        operationalImpact: { type: 'string' },
        resourceRequirements: { type: 'string' },
      },
      additionalProperties: false,
    },
    riskProfile: {
      type: 'object',
      properties: {
        overallRisk: { type: 'string' },
        topRisks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              risk: { type: 'string' },
              severity: { type: 'string' },
              mitigation: { type: 'string' },
            },
            required: ['risk', 'severity'],
            additionalProperties: false,
          },
        },
        missingProtections: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    recommendedActions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          priority: { type: 'string', enum: ['immediate', 'short-term', 'long-term'] },
          rationale: { type: 'string' },
        },
        required: ['action', 'priority'],
        additionalProperties: false,
      },
    },
    extractionMetadata: {
      type: 'object',
      properties: { model: { type: 'string' }, extractionTime: { type: 'string' } },
      required: ['model'],
      additionalProperties: false,
    },
  },
  required: ['strategicSummary', 'keyMetrics'],
  additionalProperties: false,
};

export const ARTIFACT_SCHEMAS: Record<string, JSONSchema> = {
  OVERVIEW: OVERVIEW_ARTIFACT_SCHEMA,
  FINANCIAL: FINANCIAL_ARTIFACT_SCHEMA,
  RISK: RISK_ARTIFACT_SCHEMA,
  CLAUSES: CLAUSES_ARTIFACT_SCHEMA,
  OBLIGATIONS: OBLIGATIONS_ARTIFACT_SCHEMA,
  RATES: RATES_ARTIFACT_SCHEMA,
  RENEWAL: RENEWAL_ARTIFACT_SCHEMA,
  COMPLIANCE: COMPLIANCE_ARTIFACT_SCHEMA,
  NEGOTIATION_POINTS: NEGOTIATION_POINTS_ARTIFACT_SCHEMA,
  AMENDMENTS: AMENDMENTS_ARTIFACT_SCHEMA,
  CONTACTS: CONTACTS_ARTIFACT_SCHEMA,
  PARTIES: PARTIES_ARTIFACT_SCHEMA,
  TIMELINE: TIMELINE_ARTIFACT_SCHEMA,
  DELIVERABLES: DELIVERABLES_ARTIFACT_SCHEMA,
  EXECUTIVE_SUMMARY: EXECUTIVE_SUMMARY_ARTIFACT_SCHEMA,
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

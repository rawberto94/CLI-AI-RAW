
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// TODO: Refine with actual properties from data analysis
const BaseMetadataSchema = z.object({
  docId: z.string(),
  fileType: z.enum(['pdf', 'docx', 'txt']),
  totalPages: z.number().int().positive(),
  ocrRate: z.number().min(0).max(1),
  provenance: z.array(z.object({
    worker: z.string(),
    timestamp: z.string().datetime(),
    durationMs: z.number(),
  })),
});

export const IngestionArtifactV1Schema = z.object({
  metadata: BaseMetadataSchema,
  content: z.string(),
});

export const ClausesArtifactV1Schema = z.object({
  metadata: BaseMetadataSchema,
  clauses: z.array(z.object({
    clauseId: z.string(),
    text: z.string(),
    page: z.number().int(),
    confidence: z.number().min(0).max(1),
  })),
});

export const OverviewArtifactV1Schema = z.object({
    metadata: BaseMetadataSchema,
    summary: z.string(),
    parties: z.array(z.string()),
    effectiveDate: z.string().datetime().optional(),
    terminationDate: z.string().datetime().optional(),
  // Extended summary fields for contract repository
  scope: z.string().optional(),
  fees: z.string().optional(),
  paymentTerms: z.string().optional(),
});

// Backward-compatible rates: support legacy { rateName, value, currency } and new normalized fields
const LegacyRateSchema = z.object({
  rateName: z.string(),
  value: z.number(),
  currency: z.string().length(3),
});

const NormalizedRateSchema = z.object({
  // Original role/title as it appears in the PDF or source document
  pdfRole: z.string().optional(),
  role: z.string().optional(),
  seniority: z.string().optional(),
  mappingConfidence: z.number().min(0).max(1).optional(),
  sourceLine: z.string().optional(),
  currency: z.string().length(3).optional(),
  uom: z.enum(['Hour','Day','Month','Year']).optional(),
  amount: z.number().optional(),
  dailyUsd: z.number().optional(),
  country: z.string().optional(),
  lineOfService: z.string().optional(),
});

export const RatesArtifactV1Schema = z.object({
  metadata: BaseMetadataSchema,
  rates: z.array(z.union([LegacyRateSchema, NormalizedRateSchema])),
});

export const RiskArtifactV1Schema = z.object({
    metadata: BaseMetadataSchema,
    risks: z.array(z.object({
        riskType: z.string(),
        description: z.string(),
        severity: z.enum(['low', 'medium', 'high']),
    })),
});

export const ComplianceArtifactV1Schema = z.object({
    metadata: BaseMetadataSchema,
    compliance: z.array(z.object({
        policyId: z.string(),
        status: z.enum(['compliant', 'non-compliant', 'unknown']),
        details: z.string(),
    })),
});

export const BenchmarkArtifactV1Schema = z.object({
    metadata: BaseMetadataSchema,
    benchmarks: z.array(z.object({
        role: z.string(),
        rate: z.number(),
        percentile: z.number().min(0).max(100),
    })),
});

export const ReportArtifactV1Schema = z.object({
    metadata: BaseMetadataSchema,
    overview: OverviewArtifactV1Schema,
    clauses: ClausesArtifactV1Schema,
    rates: RatesArtifactV1Schema,
    risks: RiskArtifactV1Schema,
    compliance: ComplianceArtifactV1Schema,
    benchmark: BenchmarkArtifactV1Schema,
});

// --- Professional Services focused schemas ---
export const DocumentTypeEnum = z.enum(['MSA', 'SOW', 'Secondment', 'LOI', 'LOE', 'Addendum', 'Unknown']);

export const KeyClauseMatrixV1Schema = z.object({
  clauses: z.array(z.object({
    name: z.string(),
    present: z.boolean(),
    snippet: z.string().optional(),
    page: z.number().int().optional(),
    confidence: z.number().min(0).max(1).optional(),
  })),
});

export const ProfessionalServicesOverviewV1Schema = z.object({
  docType: DocumentTypeEnum.default('Unknown'),
  summary: z.string(),
  parties: z.array(z.string()).default([]),
  effectiveDate: z.string().optional(),
  terminationDate: z.string().optional(),
  scope: z.string().optional(),
  deliverables: z.array(z.string()).optional(),
  acceptanceCriteria: z.string().optional(),
  paymentTerms: z.string().optional(),
  changeControl: z.string().optional(),
  serviceLevels: z.string().optional(),
  rolesMentioned: z.array(z.string()).optional(),
});

export const InsightSeverityEnum = z.enum(['low', 'medium', 'high']);
export const InsightTypeEnum = z.enum(['risk', 'opportunity', 'deviation', 'info']);

export const InteractiveInsightV1Schema = z.object({
  id: z.string(),
  type: InsightTypeEnum,
  severity: InsightSeverityEnum.default('low'),
  title: z.string(),
  description: z.string(),
  snippet: z.string().optional(),
  clause: z.string().optional(),
  page: z.number().int().optional(),
  suggestions: z.array(z.string()).optional(),
});

export const InteractiveAnalysisV1Schema = z.object({
  summary: z.string().optional(),
  insights: z.array(InteractiveInsightV1Schema).default([]),
  actions: z.array(z.object({ id: z.string(), label: z.string(), kind: z.enum(['compare', 'search', 'explain', 'draft']) })).optional(),
});

export const IntelligenceBundleV1Schema = z.object({
  metadata: BaseMetadataSchema.optional(),
  psOverview: ProfessionalServicesOverviewV1Schema,
  clauseMatrix: KeyClauseMatrixV1Schema,
  normalizedRates: z.array(NormalizedRateSchema).default([]),
  interactive: InteractiveAnalysisV1Schema.optional(),
});


export const schemas = {
  IngestionArtifactV1Schema,
  ClausesArtifactV1Schema,
  OverviewArtifactV1Schema,
  RatesArtifactV1Schema,
  RiskArtifactV1Schema,
  ComplianceArtifactV1Schema,
  BenchmarkArtifactV1Schema,
  ReportArtifactV1Schema,
  DocumentTypeEnum,
  KeyClauseMatrixV1Schema,
  ProfessionalServicesOverviewV1Schema,
  InteractiveInsightV1Schema,
  InteractiveAnalysisV1Schema,
  IntelligenceBundleV1Schema,
};

export const jsonSchemas = {
  IngestionArtifactV1Schema: zodToJsonSchema(IngestionArtifactV1Schema, "IngestionArtifactV1Schema"),
  ClausesArtifactV1Schema: zodToJsonSchema(ClausesArtifactV1Schema, "ClausesArtifactV1Schema"),
  OverviewArtifactV1Schema: zodToJsonSchema(OverviewArtifactV1Schema, "OverviewArtifactV1Schema"),
  RatesArtifactV1Schema: zodToJsonSchema(RatesArtifactV1Schema, "RatesArtifactV1Schema"),
  RiskArtifactV1Schema: zodToJsonSchema(RiskArtifactV1Schema, "RiskArtifactV1Schema"),
  ComplianceArtifactV1Schema: zodToJsonSchema(ComplianceArtifactV1Schema, "ComplianceArtifactV1Schema"),
  BenchmarkArtifactV1Schema: zodToJsonSchema(BenchmarkArtifactV1Schema, "BenchmarkArtifactV1Schema"),
  ReportArtifactV1Schema: zodToJsonSchema(ReportArtifactV1Schema, "ReportArtifactV1Schema"),
  DocumentTypeEnum: zodToJsonSchema(DocumentTypeEnum, "DocumentTypeEnum"),
  KeyClauseMatrixV1Schema: zodToJsonSchema(KeyClauseMatrixV1Schema, "KeyClauseMatrixV1Schema"),
  ProfessionalServicesOverviewV1Schema: zodToJsonSchema(ProfessionalServicesOverviewV1Schema, "ProfessionalServicesOverviewV1Schema"),
  InteractiveInsightV1Schema: zodToJsonSchema(InteractiveInsightV1Schema, "InteractiveInsightV1Schema"),
  InteractiveAnalysisV1Schema: zodToJsonSchema(InteractiveAnalysisV1Schema, "InteractiveAnalysisV1Schema"),
  IntelligenceBundleV1Schema: zodToJsonSchema(IntelligenceBundleV1Schema, "IntelligenceBundleV1Schema"),
};


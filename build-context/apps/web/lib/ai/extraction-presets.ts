/**
 * Extraction Presets
 * 
 * Pre-configured extraction settings for common use cases:
 * - Quick scan (speed over accuracy)
 * - Thorough (accuracy over speed)
 * - Legal review (focus on risks)
 * - Financial (focus on monetary values)
 * - Compliance (focus on dates and obligations)
 */

import type { MetadataFieldDefinition as MetadataSchemaField } from "@/lib/services/metadata-schema.service";

// ============================================================================
// TYPES
// ============================================================================

export type PresetId = 
  | "quick-scan"
  | "thorough"
  | "legal-review"
  | "financial"
  | "compliance"
  | "custom";

export interface ExtractionPreset {
  id: PresetId;
  name: string;
  description: string;
  icon: string;
  settings: PresetSettings;
  priorityFields: string[];
  skipFields?: string[];
  postProcessing?: PostProcessingOptions;
}

export interface PresetSettings {
  /** Model to use (faster vs more accurate) */
  model: "gpt-4o-mini" | "gpt-4o";
  /** Temperature for extraction (lower = more consistent) */
  temperature: number;
  /** Number of extraction passes */
  passes: 1 | 2;
  /** Minimum confidence to auto-apply */
  autoApplyThreshold: number;
  /** Minimum confidence for review */
  reviewThreshold: number;
  /** Whether to use type-specific extractors */
  useFieldExtractors: boolean;
  /** Whether to detect contract type */
  detectContractType: boolean;
  /** Whether to validate cross-field consistency */
  validateCrossField: boolean;
  /** Maximum tokens for context */
  maxContextTokens: number;
}

export interface PostProcessingOptions {
  /** Normalize dates to ISO format */
  normalizeDates: boolean;
  /** Normalize currency values */
  normalizeCurrency: boolean;
  /** Clean up extracted text */
  cleanText: boolean;
  /** Validate email formats */
  validateEmails: boolean;
  /** Validate phone formats */
  validatePhones: boolean;
}

// ============================================================================
// PRESET DEFINITIONS
// ============================================================================

export const EXTRACTION_PRESETS: Record<PresetId, ExtractionPreset> = {
  "quick-scan": {
    id: "quick-scan",
    name: "Quick Scan",
    description: "Fast extraction for initial review. Best for high-volume processing.",
    icon: "⚡",
    settings: {
      model: "gpt-4o-mini",
      temperature: 0.2,
      passes: 1,
      autoApplyThreshold: 0.9,
      reviewThreshold: 0.7,
      useFieldExtractors: false,
      detectContractType: true,
      validateCrossField: false,
      maxContextTokens: 8000,
    },
    priorityFields: [
      "contract_title",
      "contract_type",
      "effective_date",
      "expiration_date",
      "party_a_name",
      "party_b_name",
      "total_value",
    ],
    skipFields: [
      "notes",
      "internal_reference",
      "tags",
    ],
    postProcessing: {
      normalizeDates: true,
      normalizeCurrency: true,
      cleanText: true,
      validateEmails: false,
      validatePhones: false,
    },
  },

  "thorough": {
    id: "thorough",
    name: "Thorough Analysis",
    description: "Complete extraction with high accuracy. Best for important contracts.",
    icon: "🔍",
    settings: {
      model: "gpt-4o",
      temperature: 0.1,
      passes: 2,
      autoApplyThreshold: 0.85,
      reviewThreshold: 0.6,
      useFieldExtractors: true,
      detectContractType: true,
      validateCrossField: true,
      maxContextTokens: 16000,
    },
    priorityFields: [], // Extract all fields
    postProcessing: {
      normalizeDates: true,
      normalizeCurrency: true,
      cleanText: true,
      validateEmails: true,
      validatePhones: true,
    },
  },

  "legal-review": {
    id: "legal-review",
    name: "Legal Review",
    description: "Focus on legal terms, obligations, and risk factors.",
    icon: "⚖️",
    settings: {
      model: "gpt-4o",
      temperature: 0.1,
      passes: 2,
      autoApplyThreshold: 0.9, // Higher threshold for legal
      reviewThreshold: 0.7,
      useFieldExtractors: true,
      detectContractType: true,
      validateCrossField: true,
      maxContextTokens: 20000,
    },
    priorityFields: [
      "governing_law",
      "jurisdiction",
      "dispute_resolution",
      "liability_cap",
      "indemnification",
      "termination_clause",
      "notice_period",
      "warranty_period",
      "limitation_of_liability",
      "force_majeure",
      "confidentiality_term",
      "non_compete",
      "intellectual_property",
    ],
    postProcessing: {
      normalizeDates: true,
      normalizeCurrency: true,
      cleanText: true,
      validateEmails: true,
      validatePhones: true,
    },
  },

  "financial": {
    id: "financial",
    name: "Financial Focus",
    description: "Prioritize monetary values, payment terms, and financial obligations.",
    icon: "💰",
    settings: {
      model: "gpt-4o",
      temperature: 0.1,
      passes: 2,
      autoApplyThreshold: 0.85,
      reviewThreshold: 0.65,
      useFieldExtractors: true,
      detectContractType: true,
      validateCrossField: true,
      maxContextTokens: 12000,
    },
    priorityFields: [
      "total_value",
      "contract_value",
      "annual_value",
      "monthly_value",
      "payment_terms",
      "payment_schedule",
      "currency",
      "billing_frequency",
      "late_payment_penalty",
      "price_adjustment",
      "renewal_price",
      "termination_fee",
      "deposit_amount",
    ],
    postProcessing: {
      normalizeDates: true,
      normalizeCurrency: true,
      cleanText: true,
      validateEmails: false,
      validatePhones: false,
    },
  },

  "compliance": {
    id: "compliance",
    name: "Compliance Check",
    description: "Focus on dates, deadlines, obligations, and regulatory requirements.",
    icon: "📋",
    settings: {
      model: "gpt-4o",
      temperature: 0.1,
      passes: 2,
      autoApplyThreshold: 0.9,
      reviewThreshold: 0.7,
      useFieldExtractors: true,
      detectContractType: true,
      validateCrossField: true,
      maxContextTokens: 16000,
    },
    priorityFields: [
      "effective_date",
      "expiration_date",
      "renewal_date",
      "notice_deadline",
      "termination_notice_period",
      "compliance_requirements",
      "audit_rights",
      "reporting_requirements",
      "data_protection",
      "gdpr_compliance",
      "regulatory_approvals",
      "insurance_requirements",
      "certification_requirements",
    ],
    postProcessing: {
      normalizeDates: true,
      normalizeCurrency: true,
      cleanText: true,
      validateEmails: true,
      validatePhones: true,
    },
  },

  "custom": {
    id: "custom",
    name: "Custom Settings",
    description: "Configure your own extraction parameters.",
    icon: "⚙️",
    settings: {
      model: "gpt-4o-mini",
      temperature: 0.2,
      passes: 1,
      autoApplyThreshold: 0.85,
      reviewThreshold: 0.6,
      useFieldExtractors: true,
      detectContractType: true,
      validateCrossField: true,
      maxContextTokens: 12000,
    },
    priorityFields: [],
    postProcessing: {
      normalizeDates: true,
      normalizeCurrency: true,
      cleanText: true,
      validateEmails: true,
      validatePhones: true,
    },
  },
};

// ============================================================================
// PRESET UTILITIES
// ============================================================================

/**
 * Get a preset by ID
 */
export function getPreset(id: PresetId): ExtractionPreset {
  return EXTRACTION_PRESETS[id];
}

/**
 * Get all available presets
 */
export function getAllPresets(): ExtractionPreset[] {
  return Object.values(EXTRACTION_PRESETS);
}

/**
 * Get presets suitable for a contract type
 */
export function getPresetsForContractType(contractType: string): ExtractionPreset[] {
  const presets = getAllPresets();
  
  // Recommend specific presets based on contract type
  const recommendations: Record<string, PresetId[]> = {
    msa: ["thorough", "legal-review"],
    nda: ["legal-review", "compliance"],
    sow: ["thorough", "financial"],
    saas: ["compliance", "financial", "legal-review"],
    employment: ["legal-review", "compliance"],
    partnership: ["thorough", "legal-review"],
    vendor: ["financial", "compliance"],
    license: ["legal-review", "compliance"],
  };

  const recommended = recommendations[contractType.toLowerCase()] || ["thorough"];
  
  // Sort presets with recommended ones first
  return presets.sort((a, b) => {
    const aIndex = recommended.indexOf(a.id);
    const bIndex = recommended.indexOf(b.id);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

/**
 * Apply preset settings to extraction options
 */
export function applyPreset(
  preset: ExtractionPreset,
  schemaFields: MetadataSchemaField[]
): {
  fieldsToExtract: MetadataSchemaField[];
  settings: PresetSettings;
  postProcessing: PostProcessingOptions;
} {
  // Filter fields based on preset
  let fieldsToExtract = schemaFields;

  // If priority fields specified, reorder
  if (preset.priorityFields.length > 0) {
    const prioritySet = new Set(preset.priorityFields);
    const priorityFields = schemaFields.filter(f => prioritySet.has(f.id));
    const otherFields = schemaFields.filter(f => !prioritySet.has(f.id));
    fieldsToExtract = [...priorityFields, ...otherFields];
  }

  // If skip fields specified, filter out
  if (preset.skipFields && preset.skipFields.length > 0) {
    const skipSet = new Set(preset.skipFields);
    fieldsToExtract = fieldsToExtract.filter(f => !skipSet.has(f.id));
  }

  return {
    fieldsToExtract,
    settings: preset.settings,
    postProcessing: preset.postProcessing || {
      normalizeDates: true,
      normalizeCurrency: true,
      cleanText: true,
      validateEmails: true,
      validatePhones: true,
    },
  };
}

/**
 * Estimate extraction time for a preset
 */
export function estimateExtractionTime(
  preset: ExtractionPreset,
  documentLength: number,
  fieldCount: number
): {
  minSeconds: number;
  maxSeconds: number;
  description: string;
} {
  // Base time varies by model
  const baseTime: Record<string, number> = {
    "gpt-4o-mini": 5,
    "gpt-4o": 10,
  };

  const base = baseTime[preset.settings.model] || 10;

  // Factor in document length (per 10k chars)
  const docFactor = Math.ceil(documentLength / 10000);

  // Factor in field count (per 10 fields)
  const fieldFactor = Math.ceil(fieldCount / 10);

  // Factor in passes
  const passFactor = preset.settings.passes;

  const minSeconds = base * docFactor * passFactor;
  const maxSeconds = minSeconds * 1.5 + fieldFactor * 2;

  let description: string;
  if (maxSeconds < 30) {
    description = "Very fast (~${maxSeconds}s)";
  } else if (maxSeconds < 60) {
    description = "Fast (~1 minute)";
  } else if (maxSeconds < 180) {
    description = "Moderate (~2-3 minutes)";
  } else {
    description = "Thorough (~5+ minutes)";
  }

  return {
    minSeconds: Math.round(minSeconds),
    maxSeconds: Math.round(maxSeconds),
    description,
  };
}

/**
 * Create a custom preset from settings
 */
export function createCustomPreset(
  name: string,
  description: string,
  settings: Partial<PresetSettings>,
  priorityFields?: string[]
): ExtractionPreset {
  const defaultSettings = EXTRACTION_PRESETS.custom.settings;
  
  return {
    id: "custom",
    name,
    description,
    icon: "⚙️",
    settings: {
      ...defaultSettings,
      ...settings,
    },
    priorityFields: priorityFields || [],
    postProcessing: {
      normalizeDates: true,
      normalizeCurrency: true,
      cleanText: true,
      validateEmails: true,
      validatePhones: true,
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// All exports are already defined at their declaration above

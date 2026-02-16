/**
 * AI Contract Classifier (Taxonomy-based)
 * 
 * Classifies contracts using the comprehensive taxonomy system.
 * Uses OpenAI GPT-4 with structured outputs to ensure consistent classification.
 */

import { openai } from "@/lib/openai-client";
import {
  CONTRACT_TAXONOMY,
  ContractCategoryId,
  ContractClassification,
  ContractTags,
  DocumentRoleId,
  PricingModel,
  DeliveryModel,
  DataProfile,
  RiskFlag,
  ExtendedContractMetadata
} from "data-orchestration/types";
import {
  getCategoryById,
  findCategoryByAlias,
  createClassification,
  isValidClassification
} from "data-orchestration";

// ============================================================================
// TYPES
// ============================================================================

interface ClassificationInput {
  text: string;
  filename?: string;
  existingMetadata?: Record<string, any>;
}

interface ClassificationResponse {
  category_id: ContractCategoryId;
  subtype?: string;
  document_role?: DocumentRoleId;
  confidence: number;
  detected_aliases: string[];
  reasoning: string;
  alternatives?: Array<{
    category_id: ContractCategoryId;
    subtype?: string;
    confidence: number;
  }>;
}

interface TagsResponse {
  pricing_models: PricingModel[];
  delivery_models: DeliveryModel[];
  data_profiles: DataProfile[];
  risk_flags: RiskFlag[];
  reasoning: string;
}

// ============================================================================
// CLASSIFICATION PROMPTS
// ============================================================================

function buildClassificationPrompt(input: ClassificationInput): string {
  const categories = CONTRACT_TAXONOMY.contract_categories
    .map(cat => {
      return `
**${cat.id}**: ${cat.label}
- Description: ${cat.description}
- Subtypes: ${cat.subtypes.join(", ")}
- Aliases: ${cat.aliases.join(", ")}
- Default Role: ${cat.default_role}`;
    })
    .join("\n");

  const roles = CONTRACT_TAXONOMY.document_roles
    .map(role => `- **${role.id}**: ${role.description}`)
    .join("\n");

  return `You are a contract classification expert. Analyze the following contract and classify it according to our taxonomy.

# Contract Taxonomy

## Categories
${categories}

## Document Roles
${roles}

# Contract to Classify

**Filename**: ${input.filename || "Unknown"}

**Content Preview** (first 3000 characters):
${input.text.substring(0, 3000)}

# Classification Task

Analyze the contract and provide:
1. **Primary Category ID**: Choose the best matching category_id
2. **Subtype**: Identify the specific subtype if possible
3. **Document Role**: Determine the document's role
4. **Confidence**: Your confidence level (0.0 to 1.0)
5. **Detected Aliases**: Any aliases or keywords that helped identify the type
6. **Reasoning**: Brief explanation of your classification
7. **Alternatives**: Up to 2 alternative classifications with confidence scores

Respond in JSON format matching this structure:
{
  "category_id": "string",
  "subtype": "string or null",
  "document_role": "string",
  "confidence": 0.95,
  "detected_aliases": ["array", "of", "strings"],
  "reasoning": "Your explanation",
  "alternatives": [
    {"category_id": "string", "subtype": "string or null", "confidence": 0.75}
  ]
}`;
}

function buildTagsPrompt(
  input: ClassificationInput,
  classification: ContractClassification
): string {
  const category = getCategoryById(classification.category_id);
  
  return `You are analyzing a contract for tag-based metadata extraction.

# Contract Classification
- Category: ${category?.label || classification.category_id}
- Subtype: ${classification.subtype || "Not specified"}
- Role: ${classification.role}

# Contract Content Preview
${input.text.substring(0, 3000)}

# Tag Dimensions to Identify

## 1. Pricing Models (select all that apply):
- fixed_fee: Fixed price for the entire engagement
- time_and_materials: Hourly/daily rates plus expenses
- subscription: Recurring subscription fees
- milestone: Payment tied to specific milestones
- unit_based: Per-unit pricing (per user, per transaction, etc.)
- revenue_share: Revenue sharing arrangement

## 2. Delivery Models (select all that apply):
- consulting: Professional consulting services
- managed_services: Ongoing managed services
- outsourcing_bpo: Business process outsourcing
- outsourcing_ito: IT outsourcing
- staff_augmentation: Staff augmentation
- software_saas: SaaS software delivery
- software_perpetual: Perpetual software license

## 3. Data Profiles (select all that apply):
- no_personal_data: No personal data processed
- personal_data: Personal data is processed
- special_category_data: Special category/sensitive personal data
- cross_border_transfer: Cross-border data transfers

## 4. Risk Flags (select all that apply):
- auto_renewal: Auto-renewal clause present
- uncapped_liability: Liability is uncapped or has very high cap
- broad_indemnity: Broad indemnification obligations
- customer_unilateral_termination: Customer can terminate unilaterally
- audit_rights_broad: Broad audit rights granted
- nonstandard_governing_law: Non-standard or unfavorable governing law

Respond in JSON format:
{
  "pricing_models": ["array of applicable models"],
  "delivery_models": ["array of applicable models"],
  "data_profiles": ["array of applicable profiles"],
  "risk_flags": ["array of identified flags"],
  "reasoning": "Brief explanation of your tag selections"
}`;
}

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Classify a contract using the taxonomy
 */
export async function classifyContract(
  input: ClassificationInput
): Promise<ExtendedContractMetadata> {
  try {
    if (!openai) {
      throw new Error('OpenAI client not configured');
    }

    // Step 1: Classify the contract
    const classificationPrompt = buildClassificationPrompt(input);
    
    const classificationResponse = await openai.chat({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a contract classification expert. Always respond with valid JSON."
        },
        {
          role: "user",
          content: classificationPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1000
    });

    const rawClassification = JSON.parse(
      classificationResponse.choices[0]?.message?.content || "{}"
    ) as ClassificationResponse;

    // Create classification object
    const classification = createClassification(
      rawClassification.category_id,
      {
        subtype: rawClassification.subtype,
        role: rawClassification.document_role,
        confidence: rawClassification.confidence,
        alternatives: rawClassification.alternatives,
        detected_aliases: rawClassification.detected_aliases,
        reasoning: rawClassification.reasoning,
        classifier_version: "taxonomy-v1.0-gpt4"
      }
    );

    // Validate classification
    if (!isValidClassification(classification)) {
      throw new Error("Invalid classification generated");
    }

    // Step 2: Extract tags
    const tagsPrompt = buildTagsPrompt(input, classification);
    
    const tagsResponse = await openai.chat({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a contract analysis expert. Always respond with valid JSON."
        },
        {
          role: "user",
          content: tagsPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800
    });

    const tags = JSON.parse(
      tagsResponse.choices[0]?.message?.content || "{}"
    ) as TagsResponse;

    // Step 3: Extract key fields based on category
    const category = getCategoryById(classification.category_id);
    const extracted_fields = await extractKeyFields(
      input.text,
      category?.key_extractions || []
    );

    return {
      classification,
      tags: {
        pricing_models: tags.pricing_models,
        delivery_models: tags.delivery_models,
        data_profiles: tags.data_profiles,
        risk_flags: tags.risk_flags
      },
      extracted_fields
    };

  } catch {
    // Fallback classification
    return {
      classification: createClassification("services_delivery", {
        confidence: 0.3,
        reasoning: "Fallback classification due to processing error",
        classifier_version: "taxonomy-v1.0-fallback"
      }),
      tags: {
        pricing_models: [],
        delivery_models: [],
        data_profiles: [],
        risk_flags: []
      }
    };
  }
}

/**
 * Quick classification without detailed extraction (faster)
 */
export async function quickClassifyContract(
  text: string,
  filename?: string
): Promise<ContractClassification> {
  try {
    // Try filename-based classification first
    if (filename) {
      const filenameCategory = findCategoryByAlias(filename);
      if (filenameCategory) {
        return createClassification(filenameCategory.id, {
          confidence: 0.7,
          detected_aliases: [filename],
          reasoning: "Classified based on filename",
          classifier_version: "taxonomy-v1.0-filename"
        });
      }
    }

    // Use AI classification
    const result = await classifyContract({ text, filename });
    return result.classification;

  } catch {
    return createClassification("services_delivery", {
      confidence: 0.3,
      reasoning: "Fallback classification",
      classifier_version: "taxonomy-v1.0-fallback"
    });
  }
}

/**
 * Extract key fields based on category
 */
async function extractKeyFields(
  text: string,
  fields: string[]
): Promise<Record<string, any>> {
  if (fields.length === 0) return {};

  try {
    if (!openai) {
      throw new Error('OpenAI client not configured');
    }

    const prompt = `Extract the following fields from this contract text:

Fields to extract: ${fields.join(", ")}

Contract text (first 3000 characters):
${text.substring(0, 3000)}

Respond in JSON format with the extracted values. Use null if a field cannot be found.`;

    const response = await openai.chat({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a contract data extraction expert. Extract requested fields and respond in JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1000
    });

    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch {
    return {};
  }
}

/**
 * Batch classify multiple contracts
 */
export async function batchClassifyContracts(
  inputs: ClassificationInput[]
): Promise<ExtendedContractMetadata[]> {
  const results: ExtendedContractMetadata[] = [];
  
  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(input => classifyContract(input))
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Re-classify a contract with existing classification (for verification)
 */
export async function reclassifyContract(
  input: ClassificationInput,
  existingClassification: ContractClassification
): Promise<{
  classification: ContractClassification;
  changed: boolean;
  diff: {
    category_changed: boolean;
    subtype_changed: boolean;
    role_changed: boolean;
    confidence_delta: number;
  };
}> {
  const result = await classifyContract(input);
  const newClassification = result.classification;

  const changed =
    newClassification.category_id !== existingClassification.category_id ||
    newClassification.subtype !== existingClassification.subtype ||
    newClassification.role !== existingClassification.role;

  return {
    classification: newClassification,
    changed,
    diff: {
      category_changed:
        newClassification.category_id !== existingClassification.category_id,
      subtype_changed:
        newClassification.subtype !== existingClassification.subtype,
      role_changed:
        newClassification.role !== existingClassification.role,
      confidence_delta:
        newClassification.confidence - existingClassification.confidence
    }
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get recommended actions based on classification
 */
export function getRecommendedActions(
  classification: ContractClassification,
  tags: ContractTags
): string[] {
  const actions: string[] = [];
  const category = getCategoryById(classification.category_id);

  // Category-specific actions
  if (classification.category_id === "master_framework") {
    actions.push("Link related SOWs and work orders to this master agreement");
  }

  if (classification.category_id === "data_security_privacy") {
    actions.push("Ensure GDPR compliance review");
    actions.push("Verify data processing records");
  }

  // Tag-based actions
  if (tags.risk_flags?.includes("auto_renewal")) {
    actions.push("Set calendar reminder 90 days before renewal date");
  }

  if (tags.risk_flags?.includes("uncapped_liability")) {
    actions.push("Flag for legal review of liability terms");
  }

  if (tags.data_profiles?.includes("cross_border_transfer")) {
    actions.push("Verify international data transfer mechanisms");
  }

  // Confidence-based actions
  if (classification.confidence < 0.7) {
    actions.push("Manual verification recommended due to low confidence");
  }

  return actions;
}

/**
 * Format classification for display
 */
export function formatClassificationForDisplay(
  classification: ContractClassification
): string {
  const category = getCategoryById(classification.category_id);
  const parts: string[] = [];

  if (category) {
    parts.push(category.label);
  }

  if (classification.subtype) {
    parts.push(`(${classification.subtype})`);
  }

  const confidence = Math.round(classification.confidence * 100);
  parts.push(`[${confidence}% confidence]`);

  return parts.join(" ");
}

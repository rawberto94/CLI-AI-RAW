/**
 * Contract Taxonomy RAG Integration
 * 
 * Provides contract taxonomy context to the RAG system and chatbot.
 * Enables the AI to understand and query contracts based on taxonomy.
 */

import {
  CONTRACT_TAXONOMY,
  ContractCategoryId,
  ContractClassification,
  ExtendedContractMetadata
} from "../types/contract-taxonomy.types";
import {
  getCategoryById,
  formatCategoryLabel,
  formatRoleLabel,
  getTaxonomyStats,
  searchCategories
} from "../utils/contract-taxonomy.utils";

// ============================================================================
// TAXONOMY CONTEXT FOR RAG
// ============================================================================

/**
 * Generate taxonomy context for RAG system
 */
export function generateTaxonomyContext(): string {
  const stats = getTaxonomyStats();
  
  let context = `# Contract Taxonomy System (Version ${stats.version})

## Overview
This system uses a comprehensive taxonomy with ${stats.total_categories} contract categories, ${stats.total_roles} document roles, and ${stats.total_subtypes} subtypes to classify and organize contracts.

## Contract Categories

`;

  // Add each category
  for (const category of CONTRACT_TAXONOMY.contract_categories) {
    context += `### ${category.label} (${category.id})
**Description**: ${category.description}
**Document Role**: ${category.default_role}
**Subtypes**: ${category.subtypes.join(", ")}
**Common Aliases**: ${category.aliases.join(", ")}

`;
  }

  context += `## Document Roles

`;

  // Add each role
  for (const role of CONTRACT_TAXONOMY.document_roles) {
    context += `### ${role.label} (${role.id})
${role.description}

`;
  }

  context += `## Tag Dimensions

### Pricing Models
${CONTRACT_TAXONOMY.tag_dimensions.find(d => d.id === "pricing_model")?.values.join(", ")}

### Delivery Models
${CONTRACT_TAXONOMY.tag_dimensions.find(d => d.id === "delivery_model")?.values.join(", ")}

### Data Profiles
${CONTRACT_TAXONOMY.tag_dimensions.find(d => d.id === "data_profile")?.values.join(", ")}

### Risk Flags
${CONTRACT_TAXONOMY.tag_dimensions.find(d => d.id === "risk_flags")?.values.join(", ")}

`;

  return context;
}

/**
 * Generate contract-specific context for RAG
 */
export function generateContractContext(
  contractMetadata: ExtendedContractMetadata,
  contractName?: string
): string {
  const category = getCategoryById(contractMetadata.classification.category_id);
  
  let context = `# Contract Classification\n\n`;
  
  if (contractName) {
    context += `**Contract**: ${contractName}\n`;
  }
  
  context += `**Category**: ${category?.label || contractMetadata.classification.category_id}\n`;
  
  if (contractMetadata.classification.subtype) {
    context += `**Subtype**: ${contractMetadata.classification.subtype}\n`;
  }
  
  context += `**Document Role**: ${formatRoleLabel(contractMetadata.classification.role)}\n`;
  context += `**Classification Confidence**: ${Math.round(contractMetadata.classification.confidence * 100)}%\n`;
  
  if (contractMetadata.classification.reasoning) {
    context += `**Classification Reasoning**: ${contractMetadata.classification.reasoning}\n`;
  }
  
  // Add tags
  if (contractMetadata.tags) {
    context += `\n## Tags\n\n`;
    
    if (contractMetadata.tags.pricing_models?.length) {
      context += `**Pricing Models**: ${contractMetadata.tags.pricing_models.join(", ")}\n`;
    }
    
    if (contractMetadata.tags.delivery_models?.length) {
      context += `**Delivery Models**: ${contractMetadata.tags.delivery_models.join(", ")}\n`;
    }
    
    if (contractMetadata.tags.data_profiles?.length) {
      context += `**Data Profiles**: ${contractMetadata.tags.data_profiles.join(", ")}\n`;
    }
    
    if (contractMetadata.tags.risk_flags?.length) {
      context += `**Risk Flags**: ${contractMetadata.tags.risk_flags.join(", ")}\n`;
    }
  }
  
  // Add extracted fields
  if (contractMetadata.extracted_fields && Object.keys(contractMetadata.extracted_fields).length > 0) {
    context += `\n## Extracted Key Fields\n\n`;
    
    for (const [field, value] of Object.entries(contractMetadata.extracted_fields)) {
      if (value !== null && value !== undefined) {
        context += `**${field}**: ${JSON.stringify(value)}\n`;
      }
    }
  }
  
  // Add alternatives if present
  if (contractMetadata.classification.alternatives?.length) {
    context += `\n## Alternative Classifications\n\n`;
    
    for (const alt of contractMetadata.classification.alternatives) {
      const altCategory = getCategoryById(alt.category_id);
      context += `- ${altCategory?.label || alt.category_id}`;
      if (alt.subtype) {
        context += ` (${alt.subtype})`;
      }
      context += ` - ${Math.round(alt.confidence * 100)}% confidence\n`;
    }
  }
  
  return context;
}

/**
 * Generate chatbot system prompt with taxonomy knowledge
 */
export function generateTaxonomySystemPrompt(): string {
  return `You are an AI assistant specialized in contract management and analysis. You have access to a comprehensive contract taxonomy system that classifies contracts into categories, subtypes, and document roles.

# Your Capabilities

1. **Contract Classification**: You understand ${CONTRACT_TAXONOMY.contract_categories.length} contract categories including:
   ${CONTRACT_TAXONOMY.contract_categories.map(c => `- ${c.label}: ${c.description}`).join("\n   ")}

2. **Document Roles**: You recognize different document roles:
   ${CONTRACT_TAXONOMY.document_roles.map(r => `- ${r.label}: ${r.description}`).join("\n   ")}

3. **Tag Dimensions**: You can identify:
   - Pricing models (fixed fee, T&M, subscription, etc.)
   - Delivery models (consulting, managed services, SaaS, etc.)
   - Data profiles (personal data, cross-border transfers, etc.)
   - Risk flags (auto-renewal, uncapped liability, etc.)

# Your Responsibilities

- Help users understand contract classifications and what they mean
- Answer questions about contract categories, roles, and relationships
- Explain the differences between contract types
- Identify risks and important clauses based on contract type
- Suggest appropriate contract types for different scenarios
- Guide users through contract hierarchies (e.g., MSA → SOW relationships)

# Guidelines

- Always use the official taxonomy terms when discussing contract types
- Explain classification confidence levels when relevant
- Point out when contracts have multiple applicable classifications
- Highlight important fields to extract based on contract category
- Warn about common risks associated with specific contract types
- Use clear, business-friendly language while remaining technically accurate

When a user asks about a specific contract, use its classification metadata to provide context-aware responses.`;
}

/**
 * Generate query context for RAG based on user question
 */
export function generateQueryContext(userQuery: string): string {
  // Try to identify relevant categories from the query
  const relevantCategories = searchCategories(userQuery);
  
  if (relevantCategories.length === 0) {
    return "";
  }
  
  let context = `# Relevant Contract Categories for Query\n\n`;
  
  for (const category of relevantCategories.slice(0, 3)) {
    context += `## ${category.label}\n`;
    context += `${category.description}\n\n`;
    context += `**Key Fields**: ${category.key_extractions.join(", ")}\n\n`;
  }
  
  return context;
}

/**
 * Enrich contract metadata for RAG embedding
 */
export function enrichContractForRAG(
  contract: {
    id: string;
    fileName: string;
    rawText?: string;
    contractCategoryId?: string;
    contractSubtype?: string;
    documentRole?: string;
    classificationMeta?: Record<string, unknown>;
    pricingModels?: string[];
    deliveryModels?: string[];
    dataProfiles?: string[];
    riskFlags?: string[];
  }
): string {
  let enrichedText = `# Contract: ${contract.fileName}\n\n`;
  
  // Add classification
  if (contract.contractCategoryId) {
    const category = getCategoryById(contract.contractCategoryId as ContractCategoryId);
    if (category) {
      enrichedText += `## Classification\n`;
      enrichedText += `**Category**: ${category.label}\n`;
      enrichedText += `**Description**: ${category.description}\n`;
      
      if (contract.contractSubtype) {
        enrichedText += `**Subtype**: ${contract.contractSubtype}\n`;
      }
      
      if (contract.documentRole) {
        enrichedText += `**Role**: ${formatRoleLabel(contract.documentRole as any)}\n`;
      }
      
      enrichedText += `\n**Key Fields to Extract**: ${category.key_extractions.join(", ")}\n\n`;
    }
  }
  
  // Add tags
  const tags: string[] = [];
  
  if (Array.isArray(contract.pricingModels) && contract.pricingModels.length > 0) {
    tags.push(`Pricing: ${contract.pricingModels.join(", ")}`);
  }
  
  if (Array.isArray(contract.deliveryModels) && contract.deliveryModels.length > 0) {
    tags.push(`Delivery: ${contract.deliveryModels.join(", ")}`);
  }
  
  if (Array.isArray(contract.dataProfiles) && contract.dataProfiles.length > 0) {
    tags.push(`Data: ${contract.dataProfiles.join(", ")}`);
  }
  
  if (Array.isArray(contract.riskFlags) && contract.riskFlags.length > 0) {
    tags.push(`⚠️ Risks: ${contract.riskFlags.join(", ")}`);
  }
  
  if (tags.length > 0) {
    enrichedText += `## Tags\n${tags.join(" | ")}\n\n`;
  }
  
  // Add contract text
  if (contract.rawText) {
    enrichedText += `## Contract Content\n\n${contract.rawText}`;
  }
  
  return enrichedText;
}

/**
 * Get suggested questions based on contract classification
 */
export function getSuggestedQuestions(
  classification: ContractClassification
): string[] {
  const category = getCategoryById(classification.category_id);
  const questions: string[] = [];
  
  if (!category) return questions;
  
  // Category-specific questions
  switch (classification.category_id) {
    case "master_framework":
      questions.push(
        "What are the liability caps in this MSA?",
        "What is the governing law and jurisdiction?",
        "Are there any IP ownership clauses?",
        "What are the termination provisions?"
      );
      break;
      
    case "scope_work_authorization":
      questions.push(
        "What are the key deliverables and milestones?",
        "What is the acceptance criteria?",
        "What is the payment schedule?",
        "Are there any dependencies or assumptions?"
      );
      break;
      
    case "data_security_privacy":
      questions.push(
        "What personal data categories are processed?",
        "Are there any sub-processors?",
        "What are the breach notification requirements?",
        "Are international data transfers allowed?"
      );
      break;
      
    case "performance_operations":
      questions.push(
        "What are the SLA targets and service credits?",
        "What are the response and resolution time commitments?",
        "What exclusions apply to the SLA?",
        "What are the reporting requirements?"
      );
      break;
      
    case "software_cloud":
      questions.push(
        "What are the usage limits or license restrictions?",
        "What support levels are included?",
        "What are the data handling and security terms?",
        "What are the renewal and termination terms?"
      );
      break;
      
    default:
      questions.push(
        "What are the key obligations of each party?",
        "What are the payment terms?",
        "What is the contract term and renewal process?",
        "Are there any important deadlines or milestones?"
      );
  }
  
  return questions;
}

/**
 * Format classification for chatbot response
 */
export function formatClassificationForChatbot(
  classification: ContractClassification
): string {
  const category = getCategoryById(classification.category_id);
  
  let response = `This contract is classified as:\n\n`;
  response += `📋 **${category?.label || classification.category_id}**\n`;
  response += `${category?.description || ""}\n\n`;
  
  if (classification.subtype) {
    response += `**Specific Type**: ${classification.subtype}\n`;
  }
  
  response += `**Document Role**: ${formatRoleLabel(classification.role)}\n`;
  response += `**Confidence**: ${Math.round(classification.confidence * 100)}%\n`;
  
  if (classification.confidence < 0.7) {
    response += `\n⚠️ *Note: Classification confidence is below 70%. Manual verification recommended.*\n`;
  }
  
  if (category) {
    response += `\n**Key areas to review**:\n`;
    category.key_extractions.slice(0, 5).forEach(field => {
      response += `• ${field.replace(/_/g, " ")}\n`;
    });
  }
  
  return response;
}

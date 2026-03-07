/**
 * Contract Taxonomy Utilities
 * 
 * Helper functions for working with the contract taxonomy including:
 * - Classification and mapping
 * - Alias resolution
 * - Category lookups
 * - Validation
 */

import {
  CONTRACT_TAXONOMY,
  ContractCategoryId,
  ContractCategory,
  DocumentRole,
  DocumentRoleId,
  ContractClassification,
  ContractTags,
  PricingModel,
  DeliveryModel,
  DataProfile,
  RiskFlag
} from '../types/contract-taxonomy.types';

// ============================================================================
// CATEGORY LOOKUPS
// ============================================================================

/**
 * Get category by ID
 */
export function getCategoryById(id: ContractCategoryId): ContractCategory | undefined {
  return CONTRACT_TAXONOMY.contract_categories.find(c => c.id === id);
}

/**
 * Get all categories
 */
export function getAllCategories(): ContractCategory[] {
  return CONTRACT_TAXONOMY.contract_categories;
}

/**
 * Get category by alias or subtype
 */
export function findCategoryByAlias(text: string): ContractCategory | undefined {
  const normalized = text.toLowerCase().trim();
  
  return CONTRACT_TAXONOMY.contract_categories.find(category => {
    // Check aliases
    if (category.aliases.some(alias => alias.toLowerCase() === normalized)) {
      return true;
    }
    
    // Check subtypes
    if (category.subtypes.some(subtype => subtype.toLowerCase().includes(normalized))) {
      return true;
    }
    
    // Check label
    if (category.label.toLowerCase().includes(normalized)) {
      return true;
    }
    
    return false;
  });
}

/**
 * Find subtype within a category
 */
export function findSubtypeInCategory(
  categoryId: ContractCategoryId,
  text: string
): string | undefined {
  const category = getCategoryById(categoryId);
  if (!category) return undefined;
  
  const normalized = text.toLowerCase().trim();
  
  return category.subtypes.find(subtype => 
    subtype.toLowerCase().includes(normalized) ||
    normalized.includes(subtype.toLowerCase())
  );
}

// ============================================================================
// DOCUMENT ROLE LOOKUPS
// ============================================================================

/**
 * Get document role by ID
 */
export function getDocumentRoleById(id: DocumentRoleId): DocumentRole | undefined {
  return CONTRACT_TAXONOMY.document_roles.find(r => r.id === id);
}

/**
 * Get all document roles
 */
export function getAllDocumentRoles(): DocumentRole[] {
  return CONTRACT_TAXONOMY.document_roles;
}

// ============================================================================
// CLASSIFICATION HELPERS
// ============================================================================

/**
 * Create a contract classification object
 */
export function createClassification(
  categoryId: ContractCategoryId,
  options: {
    subtype?: string;
    role?: DocumentRoleId;
    confidence?: number;
    alternatives?: Array<{ category_id: ContractCategoryId; subtype?: string; confidence: number }>;
    detected_aliases?: string[];
    reasoning?: string;
    classifier_version?: string;
  } = {}
): ContractClassification {
  const category = getCategoryById(categoryId);
  
  return {
    category_id: categoryId,
    subtype: options.subtype,
    role: options.role || category?.default_role || 'execution_document',
    confidence: options.confidence ?? 0.8,
    alternatives: options.alternatives,
    detected_aliases: options.detected_aliases,
    reasoning: options.reasoning,
    classified_at: new Date(),
    classifier_version: options.classifier_version || 'taxonomy-v1.0'
  };
}

/**
 * Validate a classification
 */
export function isValidClassification(classification: ContractClassification): boolean {
  const category = getCategoryById(classification.category_id);
  if (!category) return false;
  
  const role = getDocumentRoleById(classification.role);
  if (!role) return false;
  
  if (classification.confidence < 0 || classification.confidence > 1) {
    return false;
  }
  
  if (classification.subtype) {
    const validSubtype = category.subtypes.some(st => 
      st.toLowerCase() === classification.subtype?.toLowerCase()
    );
    if (!validSubtype) return false;
  }
  
  return true;
}

/**
 * Get key extraction fields for a category
 */
export function getKeyExtractionFields(categoryId: ContractCategoryId): string[] {
  const category = getCategoryById(categoryId);
  return category?.key_extractions || [];
}

// ============================================================================
// TAG UTILITIES
// ============================================================================

/**
 * Create empty tags object
 */
export function createEmptyTags(): ContractTags {
  return {
    pricing_models: [],
    delivery_models: [],
    data_profiles: [],
    risk_flags: []
  };
}

/**
 * Validate pricing model
 */
export function isValidPricingModel(value: string): value is PricingModel {
  const validModels: PricingModel[] = [
    'fixed_fee',
    'time_and_materials',
    'subscription',
    'milestone',
    'unit_based',
    'revenue_share'
  ];
  return validModels.includes(value as PricingModel);
}

/**
 * Validate delivery model
 */
export function isValidDeliveryModel(value: string): value is DeliveryModel {
  const validModels: DeliveryModel[] = [
    'consulting',
    'managed_services',
    'outsourcing_bpo',
    'outsourcing_ito',
    'staff_augmentation',
    'software_saas',
    'software_perpetual'
  ];
  return validModels.includes(value as DeliveryModel);
}

/**
 * Validate data profile
 */
export function isValidDataProfile(value: string): value is DataProfile {
  const validProfiles: DataProfile[] = [
    'no_personal_data',
    'personal_data',
    'special_category_data',
    'cross_border_transfer'
  ];
  return validProfiles.includes(value as DataProfile);
}

/**
 * Validate risk flag
 */
export function isValidRiskFlag(value: string): value is RiskFlag {
  const validFlags: RiskFlag[] = [
    'auto_renewal',
    'uncapped_liability',
    'broad_indemnity',
    'customer_unilateral_termination',
    'audit_rights_broad',
    'nonstandard_governing_law'
  ];
  return validFlags.includes(value as RiskFlag);
}

// ============================================================================
// MAPPING HELPERS
// ============================================================================

/**
 * Map old contract type to new taxonomy
 */
export function mapLegacyContractType(legacyType: string): ContractCategoryId | undefined {
  const mapping: Record<string, ContractCategoryId> = {
    'MSA': 'master_framework',
    'SOW': 'scope_work_authorization',
    'NDA': 'confidentiality_ip',
    'SLA': 'performance_operations',
    'DPA': 'data_security_privacy',
    'LICENSE': 'software_cloud',
    'EMPLOYMENT': 'services_delivery',
    'CONSULTING': 'services_delivery',
    'VENDOR': 'purchase_supply',
    'PURCHASE': 'purchase_supply',
    'service': 'services_delivery',
    'software': 'software_cloud',
    'supply': 'purchase_supply'
  };
  
  const normalized = legacyType.toUpperCase().trim();
  return mapping[normalized] || mapping[legacyType.toLowerCase()];
}

/**
 * Format category label for display
 */
export function formatCategoryLabel(categoryId: ContractCategoryId): string {
  const category = getCategoryById(categoryId);
  return category?.label || categoryId;
}

/**
 * Format role label for display
 */
export function formatRoleLabel(roleId: DocumentRoleId): string {
  const role = getDocumentRoleById(roleId);
  return role?.label || roleId;
}

/**
 * Get category color for UI
 */
export function getCategoryColor(categoryId: ContractCategoryId): string {
  const colors: Record<ContractCategoryId, string> = {
    'master_framework': '#3b82f6',       // blue
    'scope_work_authorization': '#8b5cf6', // purple
    'purchase_supply': '#10b981',        // green
    'services_delivery': '#f59e0b',      // amber
    'software_cloud': '#06b6d4',         // cyan
    'performance_operations': '#6366f1', // indigo
    'confidentiality_ip': '#ec4899',     // pink
    'data_security_privacy': '#ef4444',  // red
    'commercial_finance': '#14b8a6',     // teal
    'corporate_legal_changes': '#6b7280' // gray
  };
  
  return colors[categoryId] || '#6b7280';
}

/**
 * Get role color for UI
 */
export function getRoleColor(roleId: DocumentRoleId): string {
  const colors: Record<DocumentRoleId, string> = {
    'governing_agreement': '#3b82f6',
    'execution_document': '#10b981',
    'operational_appendix': '#f59e0b',
    'compliance_attachment': '#ef4444',
    'commercial_attachment': '#14b8a6',
    'modification': '#6b7280',
    'standalone_agreement': '#8b5cf6'
  };
  
  return colors[roleId] || '#6b7280';
}

// ============================================================================
// SEARCH & FILTERING
// ============================================================================

/**
 * Search categories by text
 */
export function searchCategories(query: string): ContractCategory[] {
  const normalized = query.toLowerCase().trim();
  
  if (!normalized) return getAllCategories();
  
  return CONTRACT_TAXONOMY.contract_categories.filter(category => {
    // Search in label
    if (category.label.toLowerCase().includes(normalized)) return true;
    
    // Search in description
    if (category.description.toLowerCase().includes(normalized)) return true;
    
    // Search in aliases
    if (category.aliases.some(alias => alias.toLowerCase().includes(normalized))) return true;
    
    // Search in subtypes
    if (category.subtypes.some(subtype => subtype.toLowerCase().includes(normalized))) return true;
    
    return false;
  });
}

/**
 * Get categories by role
 */
export function getCategoriesByRole(roleId: DocumentRoleId): ContractCategory[] {
  return CONTRACT_TAXONOMY.contract_categories.filter(
    category => category.default_role === roleId
  );
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Export taxonomy as JSON
 */
export function exportTaxonomyJSON(): string {
  return JSON.stringify(CONTRACT_TAXONOMY, null, 2);
}

/**
 * Get taxonomy statistics
 */
export function getTaxonomyStats() {
  return {
    version: CONTRACT_TAXONOMY.taxonomy_version,
    total_categories: CONTRACT_TAXONOMY.contract_categories.length,
    total_roles: CONTRACT_TAXONOMY.document_roles.length,
    total_subtypes: CONTRACT_TAXONOMY.contract_categories.reduce(
      (sum, cat) => sum + cat.subtypes.length,
      0
    ),
    total_aliases: CONTRACT_TAXONOMY.contract_categories.reduce(
      (sum, cat) => sum + cat.aliases.length,
      0
    ),
    tag_dimensions: CONTRACT_TAXONOMY.tag_dimensions.length
  };
}

/**
 * Contract Taxonomy Package
 * 
 * Comprehensive contract classification and management system.
 * 
 * @example
 * ```typescript
 * import {
 *   CONTRACT_TAXONOMY,
 *   classifyContract,
 *   getCategoryById,
 *   generateTaxonomyContext
 * } from 'data-orchestration/src/taxonomy';
 * 
 * // Get taxonomy information
 * const stats = getTaxonomyStats();
 * console.log(`Taxonomy has ${stats.total_categories} categories`);
 * 
 * // Classify a contract
 * const result = await classifyContract({
 *   text: contractText,
 *   filename: 'MSA-Acme-Corp.pdf'
 * });
 * 
 * console.log(`Classified as: ${result.classification.category_id}`);
 * console.log(`Confidence: ${result.classification.confidence}`);
 * 
 * // Get category details
 * const category = getCategoryById(result.classification.category_id);
 * console.log(`Key fields: ${category.key_extractions.join(', ')}`);
 * ```
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Core taxonomy types
  ContractCategoryId,
  DocumentRoleId,
  ContractCategory,
  DocumentRole,
  ContractTaxonomy,
  
  // Classification types
  ContractClassification,
  ContractTags,
  ExtendedContractMetadata,
  
  // Tag dimension types
  PricingModel,
  DeliveryModel,
  DataProfile,
  RiskFlag,
  TagDimension
} from '../types/contract-taxonomy.types';

// ============================================================================
// DATA EXPORTS
// ============================================================================

export {
  CONTRACT_TAXONOMY,
  TAXONOMY_VERSION
} from '../types/contract-taxonomy.types';

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export {
  // Category lookups
  getCategoryById,
  getAllCategories,
  findCategoryByAlias,
  findSubtypeInCategory,
  
  // Document role lookups
  getDocumentRoleById,
  getAllDocumentRoles,
  
  // Classification helpers
  createClassification,
  isValidClassification,
  getKeyExtractionFields,
  
  // Tag utilities
  createEmptyTags,
  isValidPricingModel,
  isValidDeliveryModel,
  isValidDataProfile,
  isValidRiskFlag,
  
  // Mapping helpers
  mapLegacyContractType,
  formatCategoryLabel,
  formatRoleLabel,
  getCategoryColor,
  getRoleColor,
  
  // Search & filtering
  searchCategories,
  getCategoriesByRole,
  
  // Export helpers
  exportTaxonomyJSON,
  getTaxonomyStats
} from '../utils/contract-taxonomy.utils';

// ============================================================================
// RAG INTEGRATION EXPORTS
// ============================================================================

export {
  generateTaxonomyContext,
  generateContractContext,
  generateTaxonomySystemPrompt,
  generateQueryContext,
  enrichContractForRAG,
  getSuggestedQuestions,
  formatClassificationForChatbot
} from '../services/taxonomy-rag-integration.service';

// ============================================================================
// MIGRATION EXPORTS
// ============================================================================

export {
  migrateContractToTaxonomy,
  migrateTenantContracts,
  generateMigrationReport,
  rollbackContractMigration
} from '../utils/taxonomy-migration.utils';

// ============================================================================
// CLASSIFIER EXPORTS (for web app)
// ============================================================================

// Note: Classifier is exported separately from apps/web/lib/ai/contract-classifier-taxonomy
// to avoid circular dependencies. Import it directly when needed:
// import { classifyContract } from '@/lib/ai/contract-classifier-taxonomy';

// ============================================================================
// CONTRACT HIERARCHY EXPORTS
// ============================================================================

export type {
  ContractRelationshipType,
  ContractHierarchyNode,
  ContractLinkingOptions,
  LinkingValidationResult
} from '../utils/contract-hierarchy.utils';

export {
  linkContracts,
  unlinkContract,
  validateLinking,
  getContractHierarchy,
  getSuggestedParents,
  getContractFamily,
  formatRelationshipType
} from '../utils/contract-hierarchy.utils';

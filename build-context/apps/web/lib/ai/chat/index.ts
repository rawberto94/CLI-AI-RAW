/**
 * Chat Module Barrel Export
 *
 * Centralized exports for all AI chat sub-modules.
 */

// Types
export * from './types';

// Intent Detection
export { detectIntent } from './intent-detection';

// Contract Queries (list / filter helpers)
export {
  findMatchingContracts, listContractsBySupplier, listExpiringContracts,
  listContractsByStatus, listHighValueContracts, listContractsBySignatureStatus,
  listContractsByDocumentType, listNonContractDocuments, listContractsNeedingSignature,
  countContracts, getSupplierSummary,
} from './contract-queries';

// Contract Intelligence (insights, proactive alerts, flexible search)
export {
  getContractIntelligence, getProactiveInsights, searchContractsFlexible, compareContracts,
} from './contract-intelligence';

// Procurement Analytics
export {
  getSpendAnalysis, getCostSavingsOpportunities, getTopSuppliers,
  getRiskAssessment, getAutoRenewalContracts, getCategorySpend,
  getPaymentTermsAnalysis, getComplianceStatus, getSupplierPerformance,
} from './procurement-analytics';

// Deep Analysis
export { performDeepAnalysis, getRateComparison } from './deep-analysis';

// Contract Comparison
export {
  performContractComparison, compareContractClauses, performGroupComparison,
} from './contract-comparison';

// Taxonomy Operations
export {
  getTaxonomyCategories, getCategoryDetails,
  suggestCategoryForContract, getContractsInCategory,
} from './taxonomy-operations';

// Contract Hierarchy & Workflows
export {
  findMasterAgreements, getContractHierarchy, getChildContracts,
  createLinkedContractDraft, findSuitableParent,
  findRenewalWorkflows, startWorkflowExecution,
} from './contract-hierarchy';

// Contract Context
export { getContractContext } from './contract-context';

// Response Builder (OpenAI orchestration)
export { getOpenAIResponse, shouldUseRAG, generateSmartSuggestedActions, generateSmartFollowUpSuggestions } from './response-builder';

// Legacy contract operations (pre-existing module)
export * from './contract-operations';

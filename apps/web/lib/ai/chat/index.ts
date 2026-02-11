/**
 * Chat Module Barrel Export
 * 
 * Centralized exports for chat-related utilities
 * 
 * @version 1.0.0
 */

// Types
export * from './types';

// Intent Detection
export { detectIntent, shouldUseRAG } from './intent-detection';

// Contract Operations
export {
  findMatchingContracts,
  listContractsBySupplier,
  listExpiringContracts,
  listContractsByStatus,
  listHighValueContracts,
  listContractsBySignatureStatus,
  listContractsNeedingSignature,
  listContractsByDocumentType,
  listNonContractDocuments,
  getContractIntelligence,
  countContracts,
  getContractHierarchy,
} from './contract-operations';

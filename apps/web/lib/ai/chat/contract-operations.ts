/**
 * Contract Database Operations
 * 
 * Extracted database query functions for contract operations.
 * Provides clean interface for chatbot to query contract data.
 * 
 * @version 1.0.0
 */

import { prisma } from '@/lib/prisma';
import type { SignatureStatusType, DocumentClassificationType } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface ContractSearchResult {
  id: string;
  contractTitle?: string;
  supplierName?: string;
  status?: string;
  totalValue?: number;
  expirationDate?: Date;
  uploadedAt?: Date;
}

interface ContractWithMetadata extends ContractSearchResult {
  signatureStatus?: string;
  signatureRequiredFlag?: boolean;
  documentClassification?: string;
  documentClassificationWarning?: string;
}

interface ContractIntelligence extends ContractWithMetadata {
  overview?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  risks?: Record<string, unknown>;
  keyDates?: Record<string, unknown>;
  obligations?: Record<string, unknown>;
  financials?: Record<string, unknown>;
  parentContract?: { id: string; contractTitle: string; contractType: string } | null;
  childContracts?: Array<{ id: string; contractTitle: string; contractType: string; status: string }>;
}

// ============================================================================
// CORE SEARCH FUNCTIONS
// ============================================================================

/**
 * Find contracts matching search entities
 */
export async function findMatchingContracts(
  entities: { contractName?: string; supplierName?: string },
  tenantId: string
): Promise<ContractSearchResult[]> {
  try {
    const searchTerms: Record<string, unknown>[] = [];
    
    if (entities.contractName) {
      searchTerms.push({
        contractTitle: { contains: entities.contractName, mode: 'insensitive' },
      });
    }
    
    if (entities.supplierName) {
      searchTerms.push({
        supplierName: { contains: entities.supplierName, mode: 'insensitive' },
      });
    }

    if (searchTerms.length === 0) {
      return [];
    }

    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        OR: searchTerms,
      },
      include: {
        contractMetadata: true,
      },
      take: 5,
    });
    
    return contracts;
  } catch {
    return [];
  }
}

/**
 * List contracts by supplier name
 */
export async function listContractsBySupplier(
  supplierName: string,
  tenantId: string
): Promise<ContractSearchResult[]> {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: supplierName, mode: 'insensitive' },
      },
      orderBy: { expirationDate: 'asc' },
      take: 20,
    });
    return contracts;
  } catch {
    return [];
  }
}

/**
 * List contracts expiring within N days
 */
export async function listExpiringContracts(
  daysUntilExpiry: number,
  tenantId: string,
  supplierName?: string
): Promise<ContractSearchResult[]> {
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);
    
    const where: Record<string, unknown> = {
      tenantId,
      expirationDate: {
        lte: expiryDate,
        gte: new Date(),
      },
      status: { notIn: ['EXPIRED', 'ARCHIVED', 'CANCELLED'] },
    };
    
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }

    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { expirationDate: 'asc' },
      take: 20,
    });
    return contracts;
  } catch {
    return [];
  }
}

/**
 * List contracts by status
 */
export async function listContractsByStatus(
  status: string,
  tenantId: string
): Promise<ContractSearchResult[]> {
  try {
    const validStatus = status.toUpperCase();
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        status: validStatus,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return contracts;
  } catch {
    return [];
  }
}

/**
 * List high-value contracts above threshold
 */
export async function listHighValueContracts(
  threshold: number,
  tenantId: string
): Promise<ContractSearchResult[]> {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        totalValue: { gte: threshold },
      },
      orderBy: { totalValue: 'desc' },
      take: 20,
    });
    return contracts;
  } catch {
    return [];
  }
}

// ============================================================================
// SIGNATURE STATUS FUNCTIONS
// ============================================================================

/**
 * List contracts by signature status
 */
export async function listContractsBySignatureStatus(
  signatureStatus: SignatureStatusType,
  tenantId: string
): Promise<ContractWithMetadata[]> {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      include: {
        artifacts: {
          where: { type: 'OVERVIEW' },
          select: { id: true, data: true },
          take: 1,
        },
      },
      orderBy: { uploadedAt: 'desc' },
      take: 50,
    });

    type ContractWithArtifacts = (typeof contracts)[number] & {
      artifacts: Array<{ id: string; data: unknown }>;
    };

    const filtered = (contracts as ContractWithArtifacts[])
      .filter((contract) => {
        const metadataArtifact = contract.artifacts[0];
        if (!metadataArtifact?.data) {
          return signatureStatus === 'unknown';
        }

        try {
          const metadata =
            typeof metadataArtifact.data === 'string'
              ? JSON.parse(metadataArtifact.data)
              : metadataArtifact.data;
          return (metadata as Record<string, unknown>).signature_status === signatureStatus;
        } catch {
          return signatureStatus === 'unknown';
        }
      })
      .slice(0, 20);

    return filtered.map((c) => {
      const metadata = c.artifacts[0]?.data;
      let parsed: Record<string, unknown> = {};
      try {
        parsed =
          typeof metadata === 'string'
            ? JSON.parse(metadata)
            : (metadata as Record<string, unknown>) || {};
      } catch {
        // ignore parse error
      }
      return {
        ...c,
        signatureStatus:
          (parsed?.signature_status as string) ||
          (c as Record<string, unknown>).signatureStatus as string ||
          'unknown',
        signatureRequiredFlag:
          (parsed?.signature_required_flag as boolean) ||
          (c as Record<string, unknown>).signatureRequiredFlag as boolean ||
          false,
        documentClassification:
          (parsed?.document_classification as string) ||
          (c as Record<string, unknown>).documentClassification as string ||
          'contract',
        documentClassificationWarning:
          (parsed?.document_classification_warning as string) || null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * List contracts that need signature attention
 */
export async function listContractsNeedingSignature(
  tenantId: string
): Promise<ContractWithMetadata[]> {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      include: {
        artifacts: {
          where: { type: 'OVERVIEW' },
          select: { id: true, data: true },
          take: 1,
        },
      },
      orderBy: { uploadedAt: 'desc' },
      take: 50,
    });

    type ContractWithArtifacts = (typeof contracts)[number] & {
      artifacts: Array<{ id: string; data: unknown }>;
    };

    const filtered = (contracts as ContractWithArtifacts[])
      .filter((contract) => {
        const metadataArtifact = contract.artifacts[0];
        if (!metadataArtifact?.data) return false;

        try {
          const metadata =
            typeof metadataArtifact.data === 'string'
              ? JSON.parse(metadataArtifact.data)
              : metadataArtifact.data;
          const meta = metadata as Record<string, unknown>;
          return (
            meta.signature_required_flag === true ||
            meta.signature_status === 'unsigned' ||
            meta.signature_status === 'partially_signed'
          );
        } catch {
          return false;
        }
      })
      .slice(0, 20);

    return filtered.map((c) => {
      const metadata = c.artifacts[0]?.data;
      let parsed: Record<string, unknown> = {};
      try {
        parsed =
          typeof metadata === 'string'
            ? JSON.parse(metadata)
            : (metadata as Record<string, unknown>) || {};
      } catch {
        // ignore parse error
      }
      return {
        ...c,
        signatureStatus:
          (parsed?.signature_status as string) ||
          (c as Record<string, unknown>).signatureStatus as string ||
          'unknown',
        signatureRequiredFlag:
          (parsed?.signature_required_flag as boolean) ||
          (c as Record<string, unknown>).signatureRequiredFlag as boolean ||
          false,
        documentClassification:
          (parsed?.document_classification as string) ||
          (c as Record<string, unknown>).documentClassification as string ||
          'contract',
        documentClassificationWarning:
          (parsed?.document_classification_warning as string) || null,
      };
    });
  } catch {
    return [];
  }
}

// ============================================================================
// DOCUMENT CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * List contracts by document type
 */
export async function listContractsByDocumentType(
  documentType: DocumentClassificationType,
  tenantId: string
): Promise<ContractWithMetadata[]> {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      include: {
        artifacts: {
          where: { type: 'OVERVIEW' },
          select: { id: true, data: true },
          take: 1,
        },
      },
      orderBy: { uploadedAt: 'desc' },
      take: 50,
    });

    type ContractWithArtifacts = (typeof contracts)[number] & {
      artifacts: Array<{ id: string; data: unknown }>;
    };

    const filtered = (contracts as ContractWithArtifacts[])
      .filter((contract) => {
        // First check direct database field
        if ((contract as Record<string, unknown>).documentClassification) {
          return (contract as Record<string, unknown>).documentClassification === documentType;
        }

        // Then check metadata
        const metadataArtifact = contract.artifacts[0];
        if (!metadataArtifact?.data) {
          return documentType === 'contract'; // Default
        }

        try {
          const metadata =
            typeof metadataArtifact.data === 'string'
              ? JSON.parse(metadataArtifact.data)
              : metadataArtifact.data;
          return (metadata as Record<string, unknown>).document_classification === documentType;
        } catch {
          return documentType === 'contract';
        }
      })
      .slice(0, 20);

    return filtered.map((c) => {
      const metadata = c.artifacts[0]?.data;
      let parsed: Record<string, unknown> = {};
      try {
        parsed =
          typeof metadata === 'string'
            ? JSON.parse(metadata)
            : (metadata as Record<string, unknown>) || {};
      } catch {
        // ignore parse error
      }
      return {
        ...c,
        documentClassification:
          (parsed?.document_classification as string) ||
          (c as Record<string, unknown>).documentClassification as string ||
          'contract',
        documentClassificationWarning:
          (parsed?.document_classification_warning as string) || null,
        signatureStatus:
          (parsed?.signature_status as string) ||
          (c as Record<string, unknown>).signatureStatus as string ||
          'unknown',
        signatureRequiredFlag:
          (parsed?.signature_required_flag as boolean) ||
          (c as Record<string, unknown>).signatureRequiredFlag as boolean ||
          false,
      };
    });
  } catch {
    return [];
  }
}

/**
 * List non-contract documents (POs, invoices, quotes, etc.)
 */
export async function listNonContractDocuments(
  tenantId: string
): Promise<ContractWithMetadata[]> {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      include: {
        artifacts: {
          where: { type: 'OVERVIEW' },
          select: { id: true, data: true },
          take: 1,
        },
      },
      orderBy: { uploadedAt: 'desc' },
      take: 100,
    });

    const nonContractTypes = [
      'purchase_order',
      'invoice',
      'quote',
      'proposal',
      'work_order',
      'letter_of_intent',
      'memorandum',
    ];

    type ContractWithArtifacts = (typeof contracts)[number] & {
      artifacts: Array<{ id: string; data: unknown }>;
    };

    const filtered = (contracts as ContractWithArtifacts[])
      .filter((contract) => {
        const directClass = (contract as Record<string, unknown>).documentClassification;
        if (directClass) {
          return nonContractTypes.includes(directClass as string);
        }

        const metadataArtifact = contract.artifacts[0];
        if (!metadataArtifact?.data) return false;

        try {
          const metadata =
            typeof metadataArtifact.data === 'string'
              ? JSON.parse(metadataArtifact.data)
              : metadataArtifact.data;
          return nonContractTypes.includes(
            (metadata as Record<string, unknown>).document_classification as string
          );
        } catch {
          return false;
        }
      })
      .slice(0, 30);

    return filtered.map((c) => {
      const metadata = c.artifacts[0]?.data;
      let parsed: Record<string, unknown> = {};
      try {
        parsed =
          typeof metadata === 'string'
            ? JSON.parse(metadata)
            : (metadata as Record<string, unknown>) || {};
      } catch {
        // ignore parse error
      }
      return {
        ...c,
        documentClassification:
          (parsed?.document_classification as string) ||
          (c as Record<string, unknown>).documentClassification as string ||
          'unknown',
        documentClassificationWarning:
          (parsed?.document_classification_warning as string) || null,
      };
    });
  } catch {
    return [];
  }
}

// ============================================================================
// CONTRACT INTELLIGENCE
// ============================================================================

/**
 * Get full contract intelligence with all artifacts
 */
export async function getContractIntelligence(
  contractId: string,
  tenantId: string
): Promise<ContractIntelligence | null> {
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        artifacts: {
          where: { status: 'active' },
          select: {
            id: true,
            type: true,
            data: true,
            confidence: true,
          },
        },
        contractMetadata: true,
        parentContract: {
          select: { id: true, contractTitle: true, contractType: true },
        },
        childContracts: {
          select: { id: true, contractTitle: true, contractType: true, status: true },
          take: 10,
        },
      },
    });

    if (!contract) return null;

    // Parse artifact data for insights
    const getArtifactData = (type: string): Record<string, unknown> => {
      const contractWithArtifacts = contract as {
        artifacts?: Array<{ type: string; data?: unknown }>;
      };
      const artifact = contractWithArtifacts.artifacts?.find((a) => a.type === type);
      return (artifact?.data as Record<string, unknown>) || {};
    };

    return {
      ...contract,
      overview: getArtifactData('OVERVIEW'),
      summary: getArtifactData('SUMMARY'),
      risks: getArtifactData('RISK_ANALYSIS'),
      keyDates: getArtifactData('KEY_DATES'),
      obligations: getArtifactData('OBLIGATIONS'),
      financials: getArtifactData('FINANCIAL_TERMS'),
      parentContract: contract.parentContract
        ? {
            id: contract.parentContract.id,
            contractTitle: contract.parentContract.contractTitle || '',
            contractType: contract.parentContract.contractType || '',
          }
        : null,
      childContracts: contract.childContracts?.map((c) => ({
        id: c.id,
        contractTitle: c.contractTitle || '',
        contractType: c.contractType || '',
        status: c.status || '',
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Count contracts with optional filters
 */
export async function countContracts(
  tenantId: string,
  filters?: {
    supplierName?: string;
    status?: string;
    minValue?: number;
  }
): Promise<number> {
  try {
    const where: Record<string, unknown> = { tenantId };

    if (filters?.supplierName) {
      where.supplierName = { contains: filters.supplierName, mode: 'insensitive' };
    }
    if (filters?.status) {
      where.status = filters.status.toUpperCase();
    }
    if (filters?.minValue) {
      where.totalValue = { gte: filters.minValue };
    }

    return await prisma.contract.count({ where });
  } catch {
    return 0;
  }
}

/**
 * Get contract hierarchy (parent and children)
 */
export async function getContractHierarchy(
  contractId: string,
  tenantId: string
): Promise<{
  contract: ContractSearchResult | null;
  parent: ContractSearchResult | null;
  children: ContractSearchResult[];
}> {
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        parentContract: true,
        childContracts: {
          take: 20,
        },
      },
    });

    if (!contract) {
      return { contract: null, parent: null, children: [] };
    }

    return {
      contract,
      parent: contract.parentContract || null,
      children: contract.childContracts || [],
    };
  } catch {
    return { contract: null, parent: null, children: [] };
  }
}

export default {
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
};

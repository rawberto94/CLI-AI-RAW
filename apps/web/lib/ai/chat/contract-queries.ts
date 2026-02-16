import { prisma } from '@/lib/prisma';
import type { DetectedIntent } from './intent-detection';

// Search for matching contracts
export async function findMatchingContracts(entities: DetectedIntent['entities'], tenantId: string) {
  try {
    const searchTerms: Record<string, unknown>[] = [];
    
    if (entities.contractName) {
      // Search in contractTitle field only
      searchTerms.push(
        { contractTitle: { contains: entities.contractName, mode: 'insensitive' } }
      );
    }
    
    if (entities.supplierName) {
      // Search in supplierName field only
      searchTerms.push(
        { supplierName: { contains: entities.supplierName, mode: 'insensitive' } }
      );
    }

    // If no search terms, return empty
    if (searchTerms.length === 0) {
      return [];
    }


    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        OR: searchTerms },
      include: {
        contractMetadata: true },
      take: 5 });
    
    return contracts;
  } catch {
    return [];
  }
}

// ============================================
// PROCUREMENT AGENT DATABASE QUERIES
// ============================================

// List contracts by supplier
export async function listContractsBySupplier(supplierName: string, tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: supplierName, mode: 'insensitive' } },
      orderBy: { expirationDate: 'asc' },
      take: 20 });
    return contracts;
  } catch {
    return [];
  }
}

// List expiring contracts
export async function listExpiringContracts(daysUntilExpiry: number, tenantId: string, supplierName?: string) {
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);
    
    const where: Record<string, unknown> = {
      tenantId,
      expirationDate: {
        lte: expiryDate,
        gte: new Date() },
      status: { notIn: ['EXPIRED', 'ARCHIVED', 'CANCELLED'] } };
    
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }

    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { expirationDate: 'asc' },
      take: 20 });
    return contracts;
  } catch {
    return [];
  }
}

// List contracts by status
export async function listContractsByStatus(status: string, tenantId: string) {
  try {
    const validStatus = status.toUpperCase() as any; // ContractStatus enum
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        status: validStatus },
      orderBy: { updatedAt: 'desc' },
      take: 20 });
    return contracts;
  } catch {
    return [];
  }
}

// List high-value contracts
export async function listHighValueContracts(threshold: number, tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        totalValue: { gte: threshold } },
      orderBy: { totalValue: 'desc' },
      take: 20 });
    return contracts;
  } catch {
    return [];
  }
}

// ============================================
// SIGNATURE STATUS QUERY FUNCTIONS
// ============================================

export type SignatureStatusType = 'signed' | 'partially_signed' | 'unsigned' | 'unknown';

export async function listContractsBySignatureStatus(signatureStatus: SignatureStatusType, tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      include: {
        artifacts: {
          where: { type: 'OVERVIEW' },
          select: { id: true, data: true },
          take: 1 } },
      orderBy: { uploadedAt: 'desc' },
      take: 50 });

    // Filter by signature status from metadata
    type ContractWithArtifacts = typeof contracts[number] & { artifacts: Array<{ id: string; data: unknown }> };
    const filtered = (contracts as ContractWithArtifacts[]).filter(contract => {
      const metadataArtifact = contract.artifacts[0];
      if (!metadataArtifact?.data) {
        return signatureStatus === 'unknown';
      }
      
      try {
        const metadata = typeof metadataArtifact.data === 'string' 
          ? JSON.parse(metadataArtifact.data) 
          : metadataArtifact.data;
        return (metadata as Record<string, unknown>).signature_status === signatureStatus;
      } catch {
        return signatureStatus === 'unknown';
      }
    }).slice(0, 20);

    // Map with signature status and document classification
    return filtered.map(c => {
      const metadata = c.artifacts[0]?.data;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata as Record<string, unknown>) || {};
      } catch {
        // ignore parse error
      }
      return {
        ...c,
        signatureStatus: parsed?.signature_status || (c as Record<string, unknown>).signatureStatus || 'unknown',
        signatureRequiredFlag: parsed?.signature_required_flag || (c as Record<string, unknown>).signatureRequiredFlag || false,
        documentClassification: parsed?.document_classification || (c as Record<string, unknown>).documentClassification || 'contract',
        documentClassificationWarning: parsed?.document_classification_warning || (c as Record<string, unknown>).documentClassificationWarning || null };
    });
  } catch {
    return [];
  }
}

// ============================================
// DOCUMENT CLASSIFICATION QUERY FUNCTIONS
// ============================================

export type DocumentClassificationType = 'contract' | 'purchase_order' | 'invoice' | 'quote' | 'proposal' | 'work_order' | 'letter_of_intent' | 'memorandum' | 'amendment' | 'addendum' | 'unknown';

export async function listContractsByDocumentType(documentType: DocumentClassificationType, tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      include: {
        artifacts: {
          where: { type: 'OVERVIEW' },
          select: { id: true, data: true },
          take: 1 } },
      orderBy: { uploadedAt: 'desc' },
      take: 50 });

    // Filter by document classification from metadata or direct field
    type ContractWithArtifacts = typeof contracts[number] & { artifacts: Array<{ id: string; data: unknown }> };
    const filtered = (contracts as ContractWithArtifacts[]).filter(contract => {
      // First check the direct database field
      if ((contract as Record<string, unknown>).documentClassification) {
        return (contract as Record<string, unknown>).documentClassification === documentType;
      }
      
      // Then check metadata
      const metadataArtifact = contract.artifacts[0];
      if (!metadataArtifact?.data) {
        return documentType === 'contract'; // Default to contract
      }
      
      try {
        const metadata = typeof metadataArtifact.data === 'string' 
          ? JSON.parse(metadataArtifact.data) 
          : metadataArtifact.data;
        return (metadata as Record<string, unknown>).document_classification === documentType;
      } catch {
        return documentType === 'contract';
      }
    }).slice(0, 20);

    // Map with full document info
    return filtered.map(c => {
      const metadata = c.artifacts[0]?.data;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata as Record<string, unknown>) || {};
      } catch {
        // ignore parse error
      }
      return {
        ...c,
        documentClassification: parsed?.document_classification || (c as Record<string, unknown>).documentClassification || 'contract',
        documentClassificationWarning: parsed?.document_classification_warning || (c as Record<string, unknown>).documentClassificationWarning || null,
        signatureStatus: parsed?.signature_status || (c as Record<string, unknown>).signatureStatus || 'unknown',
        signatureRequiredFlag: parsed?.signature_required_flag || (c as Record<string, unknown>).signatureRequiredFlag || false };
    });
  } catch {
    return [];
  }
}

export async function listNonContractDocuments(tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      include: {
        artifacts: {
          where: { type: 'OVERVIEW' },
          select: { id: true, data: true },
          take: 1 } },
      orderBy: { uploadedAt: 'desc' },
      take: 100 });

    // Filter to non-contract documents
    const nonContractTypes = ['purchase_order', 'invoice', 'quote', 'proposal', 'work_order', 'letter_of_intent', 'memorandum'];
    type ContractWithArtifacts = typeof contracts[number] & { artifacts: Array<{ id: string; data: unknown }> };
    const filtered = (contracts as ContractWithArtifacts[]).filter(contract => {
      // First check the direct database field
      const directClass = (contract as Record<string, unknown>).documentClassification;
      if (directClass) {
        return nonContractTypes.includes(directClass as string);
      }
      
      // Then check metadata
      const metadataArtifact = contract.artifacts[0];
      if (!metadataArtifact?.data) return false;
      
      try {
        const metadata = typeof metadataArtifact.data === 'string' 
          ? JSON.parse(metadataArtifact.data) 
          : metadataArtifact.data;
        return nonContractTypes.includes((metadata as Record<string, unknown>).document_classification as string);
      } catch {
        return false;
      }
    }).slice(0, 30);

    // Map with full document info
    return filtered.map(c => {
      const metadata = c.artifacts[0]?.data;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata as Record<string, unknown>) || {};
      } catch {
        // ignore parse error
      }
      return {
        ...c,
        documentClassification: parsed?.document_classification || (c as Record<string, unknown>).documentClassification || 'unknown',
        documentClassificationWarning: parsed?.document_classification_warning || (c as Record<string, unknown>).documentClassificationWarning || null };
    });
  } catch {
    return [];
  }
}

export async function listContractsNeedingSignature(tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId },
      include: {
        artifacts: {
          where: { type: 'OVERVIEW' },
          select: { id: true, data: true },
          take: 1 } },
      orderBy: { uploadedAt: 'desc' },
      take: 50 });

    // Filter by signature_required_flag or signature status needing attention
    type ContractWithArtifacts = typeof contracts[number] & { artifacts: Array<{ id: string; data: unknown }> };
    const filtered = (contracts as ContractWithArtifacts[]).filter(contract => {
      const metadataArtifact = contract.artifacts[0];
      if (!metadataArtifact?.data) return false;
      
      try {
        const metadata = typeof metadataArtifact.data === 'string' 
          ? JSON.parse(metadataArtifact.data) 
          : metadataArtifact.data;
        const meta = metadata as Record<string, unknown>;
        return meta.signature_required_flag === true ||
               meta.signature_status === 'unsigned' ||
               meta.signature_status === 'partially_signed';
      } catch {
        return false;
      }
    }).slice(0, 20);

    // Map with signature status and document classification
    return filtered.map(c => {
      const metadata = c.artifacts[0]?.data;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata as Record<string, unknown>) || {};
      } catch {
        // ignore parse error
      }
      return {
        ...c,
        signatureStatus: parsed?.signature_status || (c as Record<string, unknown>).signatureStatus || 'unknown',
        signatureRequiredFlag: parsed?.signature_required_flag || (c as Record<string, unknown>).signatureRequiredFlag || false,
        documentClassification: parsed?.document_classification || (c as Record<string, unknown>).documentClassification || 'contract',
        documentClassificationWarning: parsed?.document_classification_warning || (c as Record<string, unknown>).documentClassificationWarning || null };
    });
  } catch {
    return [];
  }
}

// Count contracts (with optional supplier filter)
export async function countContracts(tenantId: string, supplierName?: string) {
  try {
    const where: Record<string, unknown> = { tenantId };
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }
    
    const total = await prisma.contract.count({ where });
    const active = await prisma.contract.count({ 
      where: { ...where, status: 'ACTIVE' } 
    });
    const draft = await prisma.contract.count({ 
      where: { ...where, status: 'DRAFT' } 
    });
    const expired = await prisma.contract.count({ 
      where: { ...where, status: 'EXPIRED' } 
    });
    const expiringSoon = await prisma.contract.count({
      where: {
        ...where,
        expirationDate: {
          lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          gte: new Date() } } });
    
    return { total, active, expiringSoon, draft, expired, supplierName };
  } catch {
    return { total: 0, active: 0, expiringSoon: 0, draft: 0, expired: 0, supplierName };
  }
}

// Get supplier summary
export async function getSupplierSummary(supplierName: string, tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: supplierName, mode: 'insensitive' } } });
    
    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    const statusCounts = contracts.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;
    const contractTypes = [...new Set(contracts.map(c => c.contractType).filter(Boolean))];
    
    const expiringContracts = contracts.filter(c => 
      c.expirationDate && 
      new Date(c.expirationDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) &&
      new Date(c.expirationDate) >= new Date()
    );
    
    return {
      supplierName,
      totalContracts: contracts.length,
      totalValue,
      statusBreakdown: statusCounts,
      activeContracts,
      contractTypes,
      expiringIn90Days: expiringContracts.length,
      contracts };
  } catch {
    return null;
  }
}

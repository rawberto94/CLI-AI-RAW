/**
 * List Actions Handler
 * Handles contract listing operations
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';
import { prisma } from '@/lib/prisma';

export async function handleListActions(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action, entities } = intent;
  const { tenantId } = context;

  try {
    switch (action) {
      case 'list_by_supplier':
        return await listBySupplier(tenantId, entities.supplierName);

      case 'list_expiring':
        return await listExpiring(tenantId, entities.daysUntilExpiry, entities.supplierName);

      case 'list_by_status':
        return await listByStatus(tenantId, entities.status);

      case 'list_by_value':
        return await listByValue(tenantId, entities.valueThreshold);

      case 'find_master':
        return await findMasterAgreement(tenantId, entities.supplierName);

      // Signature status actions
      case 'show_unsigned':
        return await listBySignatureStatus(tenantId, 'unsigned');

      case 'show_signed':
        return await listBySignatureStatus(tenantId, 'signed');

      case 'show_partially_signed':
        return await listBySignatureStatus(tenantId, 'partially_signed');

      case 'show_needing_signature':
        return await listNeedingSignature(tenantId);

      default:
        return {
          success: false,
          message: `Unknown list action: ${action}`,
        };
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: 'Failed to process list request',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

async function listBySupplier(
  tenantId: string,
  supplierName?: string
): Promise<ActionResponse> {
  if (!supplierName) {
    return {
      success: false,
      message: 'Please specify a supplier name',
    };
  }

  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
      supplierName: {
        contains: supplierName,
        mode: 'insensitive',
      },
    },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { uploadedAt: 'desc' },
    take: 20,
  });

  return {
    success: true,
    message: `Found ${contracts.length} contract(s) with ${supplierName}`,
    data: { contracts, count: contracts.length },
  };
}

async function listExpiring(
  tenantId: string,
  daysUntilExpiry: number = 30,
  supplierName?: string
): Promise<ActionResponse> {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + daysUntilExpiry);

  const where: any = {
    tenantId,
    status: 'ACTIVE',
    expirationDate: {
      lte: expirationDate,
      gte: new Date(),
    },
  };

  if (supplierName) {
    where.supplierName = {
      contains: supplierName,
      mode: 'insensitive',
    };
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: { expirationDate: 'asc' },
    take: 20,
  });

  return {
    success: true,
    message: `Found ${contracts.length} contract(s) expiring within ${daysUntilExpiry} days`,
    data: { contracts, count: contracts.length, daysUntilExpiry },
  };
}

async function listByStatus(
  tenantId: string,
  status?: string
): Promise<ActionResponse> {
  if (!status) {
    return {
      success: false,
      message: 'Please specify a status',
    };
  }

  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
      status: status as any,
    },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: { uploadedAt: 'desc' },
    take: 20,
  });

  return {
    success: true,
    message: `Found ${contracts.length} ${status.toLowerCase()} contract(s)`,
    data: { contracts, count: contracts.length, status },
  };
}

async function listByValue(
  tenantId: string,
  valueThreshold: number = 100000
): Promise<ActionResponse> {
  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
      totalValue: {
        gte: valueThreshold,
      },
    },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: { totalValue: 'desc' },
    take: 20,
  });

  return {
    success: true,
    message: `Found ${contracts.length} contract(s) over $${valueThreshold.toLocaleString()}`,
    data: { contracts, count: contracts.length, valueThreshold },
  };
}

async function findMasterAgreement(
  tenantId: string,
  supplierName?: string
): Promise<ActionResponse> {
  if (!supplierName) {
    return {
      success: false,
      message: 'Please specify a supplier name',
    };
  }

  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
      supplierName: {
        contains: supplierName,
        mode: 'insensitive',
      },
      contractType: 'MSA',
    },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: {
          id: true,
          status: true,
        },
      },
      childContracts: {
        select: {
          id: true,
          contractTitle: true,
          contractType: true,
          status: true,
        },
      },
    },
    orderBy: { uploadedAt: 'desc' },
  });

  return {
    success: true,
    message: `Found ${contracts.length} master agreement(s) with ${supplierName}`,
    data: { contracts, count: contracts.length },
  };
}

// ============================================
// SIGNATURE STATUS QUERIES
// ============================================

type SignatureStatus = 'signed' | 'partially_signed' | 'unsigned' | 'unknown';

async function listBySignatureStatus(
  tenantId: string,
  signatureStatus: SignatureStatus
): Promise<ActionResponse> {
  // Query contracts and their metadata for signature status
  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
    },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: {
          id: true,
          data: true,
        },
        take: 1,
      },
    },
    orderBy: { uploadedAt: 'desc' },
    take: 50,
  });

  // Filter by signature status from metadata
  type ContractWithArtifacts = typeof contracts[number] & { artifacts: Array<{ id: string; data: unknown }> };
  const filtered = (contracts as ContractWithArtifacts[]).filter(contract => {
    const metadataArtifact = contract.artifacts[0];
    if (!metadataArtifact?.data) {
      // If no metadata, treat as 'unknown' - only include if looking for unknown
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

  const statusLabels: Record<SignatureStatus, string> = {
    signed: 'fully signed',
    partially_signed: 'partially signed',
    unsigned: 'unsigned',
    unknown: 'with unknown signature status',
  };

  return {
    success: true,
    message: `Found ${filtered.length} ${statusLabels[signatureStatus]} contract(s)`,
    data: { 
      contracts: filtered.map(c => {
        return {
          id: c.id,
          contractTitle: c.contractTitle,
          supplierName: c.supplierName,
          status: c.status,
          signatureStatus,
        };
      }), 
      count: filtered.length,
      signatureStatus,
    },
  };
}

async function listNeedingSignature(tenantId: string): Promise<ActionResponse> {
  // Query contracts and their metadata for signature_required_flag
  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
    },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: {
          id: true,
          data: true,
        },
        take: 1,
      },
    },
    orderBy: { uploadedAt: 'desc' },
    take: 50,
  });

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
      
      // Flag is true OR status is unsigned/partially_signed
      return meta.signature_required_flag === true ||
             meta.signature_status === 'unsigned' ||
             meta.signature_status === 'partially_signed';
    } catch {
      return false;
    }
  }).slice(0, 20);

  return {
    success: true,
    message: `Found ${filtered.length} contract(s) needing signature attention`,
    data: { 
      contracts: filtered.map(c => {
        const metadata = c.artifacts[0]?.data;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata as Record<string, unknown>) || {};
        } catch {
          parsed = {};
        }
        return {
          id: c.id,
          contractTitle: c.contractTitle,
          supplierName: c.supplierName,
          status: c.status,
          signatureStatus: parsed?.signature_status || 'unknown',
          flagged: parsed?.signature_required_flag || false,
        };
      }), 
      count: filtered.length,
    },
    actions: [
      { label: 'View All Unsigned', action: 'show_unsigned', params: {} },
      { label: 'View Partially Signed', action: 'show_partially_signed', params: {} },
    ],
  };
}

// ============================================
// DOCUMENT CLASSIFICATION QUERIES
// ============================================

type DocumentType = 'contract' | 'purchase_order' | 'invoice' | 'quote' | 'proposal' | 'work_order' | 'letter_of_intent' | 'memorandum' | 'amendment' | 'addendum' | 'unknown';

async function listByDocumentType(
  tenantId: string,
  documentType: DocumentType
): Promise<ActionResponse> {
  // Query contracts and their metadata for document classification
  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
    },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: {
          id: true,
          data: true,
        },
        take: 1,
      },
    },
    orderBy: { uploadedAt: 'desc' },
    take: 50,
  });

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

  const typeLabels: Record<DocumentType, string> = {
    contract: 'contracts',
    purchase_order: 'purchase orders',
    invoice: 'invoices',
    quote: 'quotes',
    proposal: 'proposals',
    work_order: 'work orders',
    letter_of_intent: 'letters of intent',
    memorandum: 'memoranda',
    amendment: 'amendments',
    addendum: 'addenda',
    unknown: 'documents with unknown classification',
  };

  return {
    success: true,
    message: `Found ${filtered.length} ${typeLabels[documentType] || documentType}`,
    data: { 
      contracts: filtered.map(c => {
        const metadata = c.artifacts[0]?.data;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata as Record<string, unknown>) || {};
        } catch {
          parsed = {};
        }
        return {
          id: c.id,
          contractTitle: c.contractTitle,
          supplierName: c.supplierName,
          status: c.status,
          documentType: parsed?.document_classification || (c as Record<string, unknown>).documentClassification || 'contract',
          hasWarning: !!parsed?.document_classification_warning,
        };
      }), 
      count: filtered.length,
      documentType: documentType,
    },
  };
}

async function listNonContractDocuments(
  tenantId: string
): Promise<ActionResponse> {
  // Query contracts and their metadata
  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
    },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: {
          id: true,
          data: true,
        },
        take: 1,
      },
    },
    orderBy: { uploadedAt: 'desc' },
    take: 100,
  });

  // Filter to non-contract documents
  type ContractWithArtifacts = typeof contracts[number] & { artifacts: Array<{ id: string; data: unknown }> };
  const nonContractTypes = ['purchase_order', 'invoice', 'quote', 'proposal', 'work_order', 'letter_of_intent', 'memorandum'];
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

  // Group by document type for better reporting
  const byType: Record<string, number> = {};
  filtered.forEach(c => {
    const metadata = c.artifacts[0]?.data;
    let docType = 'unknown';
    try {
      const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata as Record<string, unknown>) || {};
      docType = (parsed?.document_classification || (c as Record<string, unknown>).documentClassification || 'unknown') as string;
    } catch {
      docType = (c as Record<string, unknown>).documentClassification as string || 'unknown';
    }
    byType[docType] = (byType[docType] || 0) + 1;
  });

  const typeLabels: Record<string, string> = {
    purchase_order: 'purchase orders',
    invoice: 'invoices',
    quote: 'quotes',
    proposal: 'proposals',
    work_order: 'work orders',
    letter_of_intent: 'letters of intent',
    memorandum: 'memoranda',
  };

  const summaryParts = Object.entries(byType).map(([type, count]) => 
    `${count} ${typeLabels[type] || type}`
  );

  return {
    success: true,
    message: `Found ${filtered.length} non-contract document(s): ${summaryParts.join(', ')}`,
    data: { 
      contracts: filtered.map(c => {
        const metadata = c.artifacts[0]?.data;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata as Record<string, unknown>) || {};
        } catch {
          parsed = {};
        }
        return {
          id: c.id,
          contractTitle: c.contractTitle,
          supplierName: c.supplierName,
          status: c.status,
          documentType: parsed?.document_classification || (c as Record<string, unknown>).documentClassification || 'unknown',
          warning: parsed?.document_classification_warning || null,
        };
      }), 
      count: filtered.length,
      byType,
    },
  };
}

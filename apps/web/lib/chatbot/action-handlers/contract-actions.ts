/**
 * Contract Actions Handler
 * Handles contract lifecycle operations (create, renew, approve, etc.)
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';
import { prisma } from '@/lib/prisma';
import { addActivityLogEntry } from '@/lib/activity-log';

export async function handleContractActions(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action, entities, confidence } = intent;
  const { tenantId, userId, currentContractId } = context;

  try {
    switch (action) {
      case 'renew':
        return await handleRenewContract(entities.contractId || currentContractId, tenantId, userId || 'system');

      case 'approve':
        return await handleApproveContract(entities.contractId || currentContractId, tenantId, userId || 'system');

      case 'terminate':
        return await handleTerminateContract(entities.contractId || currentContractId, tenantId, userId || 'system', entities.reason);

      case 'archive':
        return await handleArchiveContract(entities.contractId || currentContractId, tenantId, userId || 'system');

      case 'generate':
        return await handleGenerateContract(entities, tenantId, userId || 'system');

      case 'create':
        return await handleCreateContract(entities, tenantId, userId || 'system');

      case 'create_linked':
        return await handleCreateLinkedContract(entities, tenantId, userId || 'system');

      case 'link_contracts':
        return await handleLinkContracts(entities, tenantId, userId || 'system');

      case 'show_hierarchy':
        return await handleShowHierarchy(entities.contractId || currentContractId, tenantId);

      case 'find_master':
        return await handleFindMaster(entities.supplierName, tenantId);

      case 'set_reminder':
        return await handleSetReminder(entities.contractId || currentContractId, entities, tenantId, userId || 'system');

      case 'export_contract':
        return await handleExportContract(entities.contractId || currentContractId, tenantId);

      case 'clone_contract':
        return await handleCloneContract(entities.contractId || currentContractId, tenantId, userId || 'system');

      default:
        return {
          success: false,
          message: `Unknown contract action: ${action}`,
        };
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: 'Failed to process contract action',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

async function handleRenewContract(
  contractId: string | undefined,
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'No contract specified for renewal. Which contract would you like to renew?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: { childContracts: true },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  // Update renewal status
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      renewalStatus: 'STARTED',
      updatedAt: new Date(),
    },
  });

  await addActivityLogEntry({
    tenantId,
    contractId,
    action: 'RENEWAL_STARTED',
    performedBy: userId,
    details: { source: 'chatbot' },
  });

  return {
    success: true,
    message: `Renewal process started for "${contract.contractTitle}". I've updated the renewal status to STARTED.`,
    data: { contractId, title: contract.contractTitle },
    actions: [
      {
        label: 'View Contract',
        action: 'navigate',
        params: { url: `/contracts/${contractId}` },
      },
    ],
  };
}

async function handleApproveContract(
  contractId: string | undefined,
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'No contract specified for approval. Which contract would you like to approve?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  // Check for pending approval workflow
  const pendingApproval = await prisma.workflowExecution.findFirst({
    where: {
      contractId,
      status: 'PENDING',
    },
    include: { workflow: true },
  });

  if (pendingApproval) {
    // Complete the approval step
    await prisma.workflowExecution.update({
      where: { id: pendingApproval.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    await addActivityLogEntry({
      tenantId,
      contractId,
      action: 'WORKFLOW_APPROVED',
      performedBy: userId,
      details: { workflowId: pendingApproval.workflowId, source: 'chatbot' },
    });

    return {
      success: true,
      message: `Approval recorded for "${contract.contractTitle}"`,
      data: { contractId, approved: true },
    };
  }

  // No pending workflow - just update status
  await prisma.contract.update({
    where: { id: contractId },
    data: { status: 'ACTIVE' },
  });

  return {
    success: true,
    message: `Contract "${contract.contractTitle}" has been approved and is now active`,
    data: { contractId, status: 'ACTIVE' },
  };
}

async function handleTerminateContract(
  contractId: string | undefined,
  tenantId: string,
  userId: string,
  reason?: string
): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'Which contract would you like to terminate?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: 'EXPIRED',
      terminationClause: reason,
    },
  });

  await addActivityLogEntry({
    tenantId,
    contractId,
    action: 'CONTRACT_TERMINATED',
    performedBy: userId,
    details: { reason, source: 'chatbot' },
  });

  return {
    success: true,
    message: `Contract "${contract.contractTitle}" has been terminated${reason ? ` (Reason: ${reason})` : ''}`,
    data: { contractId, status: 'TERMINATED' },
  };
}

async function handleArchiveContract(
  contractId: string | undefined,
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'Which contract would you like to archive?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: 'ARCHIVED' },
  });

  await addActivityLogEntry({
    tenantId,
    contractId,
    action: 'CONTRACT_ARCHIVED',
    performedBy: userId,
    details: { source: 'chatbot' },
  });

  return {
    success: true,
    message: `Contract "${contract.contractTitle}" has been archived`,
    data: { contractId, archived: true },
  };
}

async function handleGenerateContract(
  entities: DetectedIntent['entities'],
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  // Find templates
  const templates = await prisma.contractTemplate.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(entities.category ? { category: { contains: entities.category, mode: 'insensitive' } } : {}),
    },
    take: 5,
    orderBy: { usageCount: 'desc' },
  });

  if (templates.length === 0) {
    return {
      success: true,
      message: 'No contract templates found. Would you like to create one from scratch?',
      data: { templates: [] },
      actions: [
        { label: 'Create New Template', action: 'navigate', params: { url: '/templates/new' } },
      ],
    };
  }

  return {
    success: true,
    message: `Found ${templates.length} template(s) you can use`,
    data: { templates },
    actions: templates.map((t) => ({
      label: `Use "${t.name}"`,
      action: 'generate_from_template',
      params: { templateId: t.id },
    })),
  };
}

async function handleCreateContract(
  entities: DetectedIntent['entities'],
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  // Create a draft contract with whatever info we have
  const contractTitle = entities.contractTitle || 'New Contract (Draft)';
  const contract = await prisma.contract.create({
    data: {
      tenantId,
      contractTitle,
      supplierName: entities.supplierName || null,
      category: entities.category || null,
      status: 'DRAFT',
      mimeType: 'application/pdf',
      fileName: contractTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
      fileSize: BigInt(0),
    },
  });

  await addActivityLogEntry({
    tenantId,
    contractId: contract.id,
    action: 'CONTRACT_CREATED',
    performedBy: userId,
    details: { source: 'chatbot', draft: true },
  });

  return {
    success: true,
    message: `Created draft contract "${contract.contractTitle}"`,
    data: { contractId: contract.id, contract },
    actions: [
      { label: 'Edit Contract', action: 'navigate', params: { url: `/contracts/${contract.id}/edit` } },
    ],
  };
}

async function handleCreateLinkedContract(
  entities: DetectedIntent['entities'],
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  const { contractId: parentId, contractTitle } = entities;

  if (!parentId) {
    return {
      success: false,
      message: 'Please specify the parent contract to link to',
    };
  }

  const parent = await prisma.contract.findFirst({
    where: { id: parentId, tenantId },
  });

  if (!parent) {
    return { success: false, message: 'Parent contract not found' };
  }

  const childTitle = contractTitle || `${parent.contractTitle} - Amendment`;
  const child = await prisma.contract.create({
    data: {
      tenantId,
      contractTitle: childTitle,
      supplierName: parent.supplierName,
      category: parent.category,
      status: 'DRAFT',
      parentContractId: parentId,
      contractType: 'CHILD',
      mimeType: 'application/pdf',
      fileName: childTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
      fileSize: BigInt(0),
    },
  });

  await addActivityLogEntry({
    tenantId,
    contractId: child.id,
    action: 'CONTRACT_LINKED',
    performedBy: userId,
    details: { parentId, source: 'chatbot' },
  });

  return {
    success: true,
    message: `Created linked contract under "${parent.contractTitle}"`,
    data: { contractId: child.id, parentId },
    actions: [
      { label: 'View New Contract', action: 'navigate', params: { url: `/contracts/${child.id}` } },
      { label: 'View Hierarchy', action: 'navigate', params: { url: `/contracts/${parentId}/hierarchy` } },
    ],
  };
}

async function handleLinkContracts(
  entities: DetectedIntent['entities'],
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  const childId = entities.contractId;
  const parentId = entities.contractA; // contractA used as parent reference

  if (!childId || !parentId) {
    return {
      success: false,
      message: 'Please specify both contracts to link',
    };
  }

  const [child, parent] = await Promise.all([
    prisma.contract.findFirst({ where: { id: childId, tenantId } }),
    prisma.contract.findFirst({ where: { id: parentId, tenantId } }),
  ]);

  if (!child || !parent) {
    return { success: false, message: 'One or both contracts not found' };
  }

  await prisma.contract.update({
    where: { id: childId },
    data: {
      parentContractId: parentId,
      contractType: 'CHILD',
    },
  });

  await addActivityLogEntry({
    tenantId,
    contractId: childId,
    action: 'CONTRACT_LINKED',
    performedBy: userId,
    details: { parentId, source: 'chatbot' },
  });

  return {
    success: true,
    message: `Linked "${child.contractTitle}" under "${parent.contractTitle}"`,
    data: { contractId: childId, parentId },
  };
}

async function handleShowHierarchy(
  contractId: string | undefined,
  tenantId: string
): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'Which contract hierarchy would you like to see?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: {
      parentContract: true,
      childContracts: {
        include: {
          childContracts: true,
        },
      },
    },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  // Build hierarchy tree
  const hierarchy = {
    id: contract.id,
    title: contract.contractTitle,
    type: contract.contractType,
    parent: contract.parentContract
      ? { id: contract.parentContract.id, title: contract.parentContract.contractTitle }
      : null,
    children: contract.childContracts.map((c) => ({
      id: c.id,
      title: c.contractTitle,
      type: c.contractType,
      children: c.childContracts.map((gc) => ({
        id: gc.id,
        title: gc.contractTitle,
        type: gc.contractType,
      })),
    })),
  };

  return {
    success: true,
    message: `Contract hierarchy for "${contract.contractTitle}"`,
    data: { hierarchy },
    actions: [
      { label: 'View Full Hierarchy', action: 'navigate', params: { url: `/contracts/${contractId}/hierarchy` } },
    ],
  };
}

async function handleFindMaster(
  supplierName: string | undefined,
  tenantId: string
): Promise<ActionResponse> {
  if (!supplierName) {
    return {
      success: false,
      message: 'Which supplier\'s master agreement are you looking for?',
    };
  }

  const masterAgreements = await prisma.contract.findMany({
    where: {
      tenantId,
      supplierName: { contains: supplierName, mode: 'insensitive' },
      contractType: 'MASTER',
      status: 'ACTIVE',
    },
    include: {
      _count: { select: { childContracts: true } },
    },
    orderBy: { effectiveDate: 'desc' },
  });

  if (masterAgreements.length === 0) {
    return {
      success: true,
      message: `No active master agreements found for "${supplierName}"`,
      data: { masters: [] },
    };
  }

  return {
    success: true,
    message: `Found ${masterAgreements.length} master agreement(s) for "${supplierName}"`,
    data: {
      masters: masterAgreements.map((m) => ({
        id: m.id,
        title: m.contractTitle,
        effectiveDate: m.effectiveDate,
        expirationDate: m.expirationDate,
        childCount: m._count.childContracts,
      })),
    },
    actions: masterAgreements.map((m) => ({
      label: `View "${m.contractTitle}"`,
      action: 'navigate',
      params: { url: `/contracts/${m.id}` },
    })),
  };
}

async function handleSetReminder(
  contractId: string | undefined,
  entities: DetectedIntent['entities'],
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'Which contract would you like to set a reminder for?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  // Set expiration alert - we don't have a task model, use contract fields
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 1 week

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      expirationAlertSent: false,
      expirationAlertAt: dueDate,
    },
  });

  return {
    success: true,
    message: `Reminder set for ${dueDate.toLocaleDateString()}`,
    data: { contractId, dueDate },
  };
}

async function handleExportContract(
  contractId: string | undefined,
  tenantId: string
): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'Which contract would you like to export?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: {
      clauses: true,
      artifacts: { where: { type: 'OVERVIEW' }, take: 1 },
    },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  return {
    success: true,
    message: `Ready to export "${contract.contractTitle}"`,
    data: { contractId, hasDocument: contract.artifacts.length > 0 },
    actions: [
      { label: 'Download PDF', action: 'export', params: { contractId, format: 'pdf' } },
      { label: 'Download Excel', action: 'export', params: { contractId, format: 'xlsx' } },
      { label: 'Download JSON', action: 'export', params: { contractId, format: 'json' } },
    ],
  };
}

async function handleCloneContract(
  contractId: string | undefined,
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'Which contract would you like to clone?',
    };
  }

  const original = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: { clauses: true },
  });

  if (!original) {
    return { success: false, message: 'Contract not found' };
  }

  // Create clone
  const cloneTitle = `${original.contractTitle} (Copy)`;
  const clone = await prisma.contract.create({
    data: {
      tenantId,
      contractTitle: cloneTitle,
      supplierName: original.supplierName,
      category: original.category,
      status: 'DRAFT',
      contractType: original.contractType,
      totalValue: original.totalValue,
      paymentTerms: original.paymentTerms,
      autoRenewalEnabled: original.autoRenewalEnabled,
      mimeType: original.mimeType || 'application/pdf',
      fileName: cloneTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
      fileSize: original.fileSize || BigInt(0),
    },
  });

  // Clone clauses
  if (original.clauses.length > 0) {
    await prisma.clause.createMany({
      data: original.clauses.map((c) => ({
        contractId: clone.id,
        category: c.category,
        text: c.text,
        position: c.position,
        riskLevel: c.riskLevel,
      })),
    });
  }

  await addActivityLogEntry({
    tenantId,
    contractId: clone.id,
    action: 'CONTRACT_CLONED',
    performedBy: userId,
    details: { sourceId: contractId, source: 'chatbot' },
  });

  return {
    success: true,
    message: `Created copy of "${original.contractTitle}"`,
    data: { originalId: contractId, cloneId: clone.id },
    actions: [
      { label: 'View Copy', action: 'navigate', params: { url: `/contracts/${clone.id}` } },
      { label: 'Edit Copy', action: 'navigate', params: { url: `/contracts/${clone.id}/edit` } },
    ],
  };
}


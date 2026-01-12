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
  const { tenantId, userId, contractId } = context;

  try {
    switch (action) {
      case 'renew':
        return await handleRenewContract(entities.contractId || contractId, tenantId, userId);

      case 'approve':
        return await handleApproveContract(entities.contractId || contractId, tenantId, userId);

      case 'terminate':
        return await handleTerminateContract(entities.contractId || contractId, tenantId, userId, entities.reason);

      case 'archive':
        return await handleArchiveContract(entities.contractId || contractId, tenantId, userId);

      case 'generate':
        return await handleGenerateContract(entities, tenantId, userId);

      case 'create':
        return await handleCreateContract(entities, tenantId, userId);

      case 'create_linked':
        return await handleCreateLinkedContract(entities, tenantId, userId);

      case 'link_contracts':
        return await handleLinkContracts(entities, tenantId, userId);

      case 'show_hierarchy':
        return await handleShowHierarchy(entities.contractId || contractId, tenantId);

      case 'find_master':
        return await handleFindMaster(entities.supplierName, tenantId);

      case 'set_reminder':
        return await handleSetReminder(entities.contractId || contractId, entities, tenantId, userId);

      case 'export_contract':
        return await handleExportContract(entities.contractId || contractId, tenantId);

      case 'clone_contract':
        return await handleCloneContract(entities.contractId || contractId, tenantId, userId);

      default:
        return {
          success: false,
          message: `Unknown contract action: ${action}`,
        };
    }
  } catch (error) {
    console.error('[Contract Actions] Error:', error);
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
    include: { linkedChildren: true },
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
        completedBy: userId,
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
      status: 'TERMINATED',
      terminatedAt: new Date(),
      terminationReason: reason,
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
    data: { isArchived: true },
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
  const contract = await prisma.contract.create({
    data: {
      tenantId,
      contractTitle: entities.contractTitle || 'New Contract (Draft)',
      supplierName: entities.supplierName || null,
      category: entities.category || null,
      status: 'DRAFT',
      effectiveDate: entities.effectiveDate ? new Date(entities.effectiveDate) : null,
      expirationDate: entities.expirationDate ? new Date(entities.expirationDate) : null,
      totalValue: entities.contractValue ? parseFloat(String(entities.contractValue)) : null,
      createdBy: userId,
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
  const { parentContractId, contractTitle } = entities;

  if (!parentContractId) {
    return {
      success: false,
      message: 'Please specify the parent contract to link to',
    };
  }

  const parent = await prisma.contract.findFirst({
    where: { id: parentContractId, tenantId },
  });

  if (!parent) {
    return { success: false, message: 'Parent contract not found' };
  }

  const child = await prisma.contract.create({
    data: {
      tenantId,
      contractTitle: contractTitle || `${parent.contractTitle} - Amendment`,
      supplierName: parent.supplierName,
      category: parent.category,
      status: 'DRAFT',
      masterAgreementId: parentContractId,
      contractType: 'CHILD',
      createdBy: userId,
    },
  });

  await addActivityLogEntry({
    tenantId,
    contractId: child.id,
    action: 'CONTRACT_LINKED',
    performedBy: userId,
    details: { parentId: parentContractId, source: 'chatbot' },
  });

  return {
    success: true,
    message: `Created linked contract under "${parent.contractTitle}"`,
    data: { contractId: child.id, parentId: parentContractId },
    actions: [
      { label: 'View New Contract', action: 'navigate', params: { url: `/contracts/${child.id}` } },
      { label: 'View Hierarchy', action: 'navigate', params: { url: `/contracts/${parentContractId}/hierarchy` } },
    ],
  };
}

async function handleLinkContracts(
  entities: DetectedIntent['entities'],
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  const { contractId, parentContractId } = entities;

  if (!contractId || !parentContractId) {
    return {
      success: false,
      message: 'Please specify both contracts to link',
    };
  }

  const [child, parent] = await Promise.all([
    prisma.contract.findFirst({ where: { id: contractId, tenantId } }),
    prisma.contract.findFirst({ where: { id: parentContractId, tenantId } }),
  ]);

  if (!child || !parent) {
    return { success: false, message: 'One or both contracts not found' };
  }

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      masterAgreementId: parentContractId,
      contractType: 'CHILD',
    },
  });

  await addActivityLogEntry({
    tenantId,
    contractId,
    action: 'CONTRACT_LINKED',
    performedBy: userId,
    details: { parentId: parentContractId, source: 'chatbot' },
  });

  return {
    success: true,
    message: `Linked "${child.contractTitle}" under "${parent.contractTitle}"`,
    data: { contractId, parentId: parentContractId },
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
      masterAgreement: true,
      linkedChildren: {
        include: {
          linkedChildren: true,
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
    parent: contract.masterAgreement
      ? { id: contract.masterAgreement.id, title: contract.masterAgreement.contractTitle }
      : null,
    children: contract.linkedChildren.map((c) => ({
      id: c.id,
      title: c.contractTitle,
      type: c.contractType,
      children: c.linkedChildren.map((gc) => ({
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
      _count: { select: { linkedChildren: true } },
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
        childCount: m._count.linkedChildren,
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

  // Create a task/reminder
  const dueDate = entities.reminderDate
    ? new Date(entities.reminderDate)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 1 week

  const task = await prisma.task.create({
    data: {
      tenantId,
      contractId,
      title: entities.reminderNote || `Reminder: Review ${contract.contractTitle}`,
      dueDate,
      assignedTo: userId,
      status: 'PENDING',
      createdBy: userId,
    },
  });

  return {
    success: true,
    message: `Reminder set for ${dueDate.toLocaleDateString()}`,
    data: { taskId: task.id, dueDate },
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
      obligations: true,
      artifacts: { where: { type: 'DOCUMENT' }, take: 1 },
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
  const clone = await prisma.contract.create({
    data: {
      tenantId,
      contractTitle: `${original.contractTitle} (Copy)`,
      supplierName: original.supplierName,
      category: original.category,
      status: 'DRAFT',
      contractType: original.contractType,
      totalValue: original.totalValue,
      paymentTerms: original.paymentTerms,
      autoRenewal: original.autoRenewal,
      createdBy: userId,
    },
  });

  // Clone clauses
  if (original.clauses.length > 0) {
    await prisma.contractClause.createMany({
      data: original.clauses.map((c) => ({
        contractId: clone.id,
        clauseType: c.clauseType,
        content: c.content,
        position: c.position,
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


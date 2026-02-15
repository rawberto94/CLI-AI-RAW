import { prisma } from '@/lib/prisma';

// ============================================
// CONTRACT HIERARCHY & LINKING FUNCTIONS
// ============================================

// Find master agreements for a supplier
export async function findMasterAgreements(supplierName: string, tenantId: string, year?: string) {
  try {
    const where: Record<string, unknown> = {
      tenantId,
      supplierName: { contains: supplierName, mode: 'insensitive' },
      contractType: { in: ['MSA', 'MASTER', 'MASTER_AGREEMENT', 'MASTER SERVICE AGREEMENT'] },
      status: { notIn: ['EXPIRED', 'CANCELLED', 'ARCHIVED'] } };
    
    // If year specified, filter by effective date
    if (year) {
      const startOfYear = new Date(`${year}-01-01`);
      const endOfYear = new Date(`${year}-12-31`);
      where.effectiveDate = {
        gte: startOfYear,
        lte: endOfYear };
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        childContracts: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            status: true,
            relationshipType: true } } },
      orderBy: { effectiveDate: 'desc' },
      take: 10 });
    
    return contracts;
  } catch {
    return [];
  }
}

// Get contract hierarchy (parent and children)
export async function getContractHierarchy(contractId: string, tenantId: string) {
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        parentContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            supplierName: true,
            status: true,
            effectiveDate: true,
            expirationDate: true } },
        childContracts: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            relationshipType: true,
            status: true,
            effectiveDate: true,
            totalValue: true },
          orderBy: { createdAt: 'desc' } } } });
    
    return contract;
  } catch {
    return null;
  }
}

// Find all contracts linked to a master agreement
export async function getChildContracts(parentContractId: string, tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        parentContractId },
      orderBy: { createdAt: 'desc' } });
    
    return contracts;
  } catch {
    return [];
  }
}

// Create a draft contract linked to a parent
export async function createLinkedContractDraft(
  tenantId: string,
  supplierName: string,
  contractType: string,
  parentContractId?: string,
  relationshipType?: string
) {
  try {
    // This creates a draft contract entry that can be filled in
    const contract = await prisma.contract.create({
      data: {
        tenantId,
        supplierName,
        contractType,
        contractTitle: `New ${contractType} - ${supplierName}`,
        status: 'DRAFT',
        fileName: `draft-${contractType.toLowerCase()}-${Date.now()}.pdf`,
        fileSize: 0,
        mimeType: 'application/pdf',
        parentContractId,
        relationshipType: relationshipType || `${contractType}_UNDER_MSA`,
        linkedAt: new Date() },
      include: {
        parentContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            supplierName: true } } } });
    
    return contract;
  } catch {
    return null;
  }
}

// Find suitable parent contract for linking
export async function findSuitableParent(
  supplierName: string,
  tenantId: string,
  year?: string
) {
  const masterAgreements = await findMasterAgreements(supplierName, tenantId, year);
  
  if (masterAgreements.length === 0) {
    // Try to find any active contract with this supplier that could be a parent
    const activeContracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: supplierName, mode: 'insensitive' },
        status: 'ACTIVE',
        parentContractId: null, // Only top-level contracts
      },
      orderBy: { effectiveDate: 'desc' },
      take: 5 });
    return activeContracts;
  }
  
  return masterAgreements;
}

// Find available renewal workflows
export async function findRenewalWorkflows(tenantId: string) {
  try {
    const workflows = await prisma.workflow.findMany({
      where: {
        tenantId,
        isActive: true,
        type: { in: ['RENEWAL', 'APPROVAL'] } },
      include: {
        steps: { orderBy: { order: 'asc' } } },
      take: 3 });
    return workflows;
  } catch {
    return [];
  }
}

// Start a workflow execution
export async function startWorkflowExecution(
  workflowId: string,
  contractId: string,
  tenantId: string,
  userId: string
) {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { order: 'asc' } } } });

    if (!workflow) return null;

    const execution = await prisma.workflowExecution.create({
      data: {
        tenantId,
        workflowId,
        contractId,
        status: 'PENDING',
        currentStep: '1',
        startedBy: userId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        stepExecutions: {
          create: workflow.steps.map(step => ({
            stepId: step.id,
            stepName: step.name,
            stepOrder: step.order,
            status: step.order === 0 ? 'PENDING' : 'WAITING',
            assignedTo: step.assignedUser || step.assignedRole })) } },
      include: {
        stepExecutions: true,
        workflow: true,
        contract: true } });

    return execution;
  } catch {
    return null;
  }
}

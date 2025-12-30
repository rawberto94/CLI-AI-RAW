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

      default:
        return {
          success: false,
          message: `Unknown list action: ${action}`,
        };
    }
  } catch (error) {
    console.error('[List Actions] Error:', error);
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
          generatedAt: true,
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
      status,
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
      value: {
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
    orderBy: { value: 'desc' },
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
      type: 'MSA',
    },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: {
          id: true,
          status: true,
        },
      },
      children: {
        select: {
          id: true,
          title: true,
          type: true,
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

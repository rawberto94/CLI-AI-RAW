import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

/** Data connection configuration stored in tenant settings */
interface DataConnection {
  id: string;
  type: string;
  name: string;
  status: string;
  host?: string;
  database?: string;
  syncMode?: string;
  autoSync?: boolean;
  syncFrequency?: string;
  contractTableName?: string;
  createdAt: string;
  encryptedConfig?: string;
}

/**
 * GET /api/admin/data-connections
 * List all data connections for the tenant
 */
export const GET = withAuthApiHandler(async (_request, ctx) => {
  const connections = await prisma.tenantSettings.findFirst({
    where: { tenantId: ctx.tenantId },
    select: {
      id: true,
      customFields: true,
    },
  });

  let dataConnections: DataConnection[] = [];

  if (connections?.customFields) {
    try {
      const customFields = typeof connections.customFields === 'string'
        ? JSON.parse(connections.customFields)
        : connections.customFields;
      dataConnections = (customFields as Record<string, unknown>).dataConnections as DataConnection[] || [];
    } catch {
      dataConnections = [];
    }
  }

  return createSuccessResponse(ctx, { connections: dataConnections });
});

/**
 * POST /api/admin/data-connections
 * Create a new data connection
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const body = await request.json();
  const { type, name, config, syncMode, autoSync, syncFrequency } = body;

  if (!type || !name) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Type and name are required', 400);
  }

  const newConnection = {
    id: randomUUID(),
    type,
    name,
    status: 'disconnected',
    host: config.host,
    database: config.database,
    syncMode: syncMode || 'reference',
    autoSync: autoSync !== false,
    syncFrequency: syncFrequency || 'daily',
    contractTableName: config.contractTableName,
    createdAt: new Date().toISOString(),
    // Store the full config (base64 encoded) — credentials are preserved for sync
    // In production, use AES-256 encryption with a KMS-managed key
    encryptedConfig: Buffer.from(JSON.stringify(config)).toString('base64'),
  };

  const settings = await prisma.tenantSettings.findFirst({
    where: { tenantId: ctx.tenantId },
  });

  let existingConnections: DataConnection[] = [];

  if (settings?.customFields) {
    try {
      const customFields = typeof settings.customFields === 'string'
        ? JSON.parse(settings.customFields)
        : settings.customFields;
      existingConnections = (customFields as Record<string, unknown>).dataConnections as DataConnection[] || [];
    } catch {
      existingConnections = [];
    }
  }

  const updatedConnections = [...existingConnections, newConnection];

  if (settings) {
    const existingCustomFields = typeof settings.customFields === 'string'
      ? JSON.parse(settings.customFields)
      : (settings.customFields || {});

    await prisma.tenantSettings.update({
      where: { id: settings.id },
      data: {
        customFields: JSON.stringify({
          ...existingCustomFields,
          dataConnections: updatedConnections,
        }),
      },
    });
  } else {
    await prisma.tenantSettings.create({
      data: {
        tenantId: ctx.tenantId,
        customFields: JSON.stringify({
          dataConnections: updatedConnections,
        }),
      },
    });
  }

  return createSuccessResponse(ctx, {
    connection: {
      ...newConnection,
      encryptedConfig: undefined,
    },
  });
});

/**
 * Contract Sources API
 * 
 * Endpoints for managing contract sources (pull model integrations).
 * 
 * GET /api/contract-sources - List all sources
 * GET /api/contract-sources?id=xxx - Get single source
 * POST /api/contract-sources - Create source
 * PUT /api/contract-sources - Update source
 * DELETE /api/contract-sources - Delete source
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId, getTenantContext } from '@/lib/tenant-server';
import { ContractSourceProvider, SyncMode } from '@prisma/client';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
// Validation schemas
const createSourceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  provider: z.nativeEnum(ContractSourceProvider),
  credentials: z.record(z.unknown()),
  syncFolder: z.string().optional().default('/'),
  filePatterns: z.array(z.string()).optional().default(['*.pdf', '*.docx', '*.doc']),
  syncInterval: z.number().min(5).max(1440).optional().default(60),
  syncMode: z.nativeEnum(SyncMode).optional().default(SyncMode.INCREMENTAL),
  autoProcess: z.boolean().optional().default(true),
  maxFileSizeMb: z.number().min(1).max(500).optional().default(50),
});

const updateSourceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  syncFolder: z.string().optional(),
  filePatterns: z.array(z.string()).optional(),
  syncInterval: z.number().min(5).max(1440).optional(),
  syncMode: z.nativeEnum(SyncMode).optional(),
  autoProcess: z.boolean().optional(),
  maxFileSizeMb: z.number().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
  syncEnabled: z.boolean().optional(),
});

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get('id');

  if (sourceId) {
    // Get single source
    const source = await prisma.contractSource.findFirst({
      where: { id: sourceId, tenantId },
      include: {
        syncedFiles: {
          orderBy: { lastSyncedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            processingStatus: true,
            contractId: true,
            lastSyncedAt: true,
            errorMessage: true,
          },
        },
        sourceSyncs: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            syncMode: true,
            triggeredBy: true,
            filesFound: true,
            filesProcessed: true,
            filesFailed: true,
            startedAt: true,
            completedAt: true,
            duration: true,
            errorMessage: true,
          },
        },
        _count: {
          select: {
            syncedFiles: true,
          },
        },
      },
    });

    if (!source) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Source not found', 404);
    }

    // Remove sensitive credentials from response
    const { credentials: _credentials, accessToken, refreshToken: _refreshToken, ...safeSource } = source;

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        ...safeSource,
        hasCredentials: !!_credentials,
        isOAuthConnected: !!accessToken,
      },
    });
  }

  // List all sources
  const sources = await prisma.contractSource.findMany({
    where: { tenantId },
    include: {
      _count: {
        select: { syncedFiles: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Remove sensitive data
  const safeSources = sources.map(({ credentials: _creds, accessToken, refreshToken: _refreshToken, ...source }) => ({
    ...source,
    hasCredentials: !!_creds,
    isOAuthConnected: !!accessToken,
  }));

  // Calculate stats
  const stats = {
    total: sources.length,
    connected: sources.filter(s => s.status === 'CONNECTED').length,
    syncing: sources.filter(s => s.status === 'SYNCING').length,
    errors: sources.filter(s => s.status === 'ERROR').length,
    totalFilesSynced: sources.reduce((sum, s) => sum + s.totalFilesSynced, 0),
  };

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      sources: safeSources,
      stats,
    },
  });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { tenantId, userId } = await getTenantContext();

  if (!tenantId || !userId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await request.json();
  const parsed = createSourceSchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid request', 400);
  }

  const data = parsed.data;

  // Check for duplicate
  const existing = await prisma.contractSource.findFirst({
    where: {
      tenantId,
      provider: data.provider,
      syncFolder: data.syncFolder,
    },
  });

  if (existing) {
    return createErrorResponse(ctx, 'CONFLICT', 'A source with this provider and folder already exists', 409);
  }

  // Create the source
  const source = await prisma.contractSource.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description,
      provider: data.provider,
      credentials: JSON.parse(JSON.stringify(data.credentials)),
      syncFolder: data.syncFolder,
      filePatterns: data.filePatterns,
      syncInterval: data.syncInterval,
      syncMode: data.syncMode,
      autoProcess: data.autoProcess,
      maxFileSizeMb: data.maxFileSizeMb,
      status: 'DISCONNECTED',
      createdBy: userId,
    },
  });

  // Remove credentials from response
  const { credentials: _credentials, ...safeSource } = source;

  return createSuccessResponse(ctx, {
    success: true,
    data: safeSource,
  });
});

export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { tenantId, userId } = await getTenantContext();

  if (!tenantId || !userId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await request.json();
  const parsed = updateSourceSchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid request', 400);
  }

  const { id, ...updateData } = parsed.data;

  // Verify ownership
  const existing = await prisma.contractSource.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Source not found', 404);
  }

  // Update the source
  const source = await prisma.contractSource.update({
    where: { id },
    data: updateData,
  });

  // Remove credentials from response
  const { credentials: _c, accessToken: _a, refreshToken: _r, ...safeSource } = source;

  return createSuccessResponse(ctx, {
    success: true,
    data: safeSource,
  });
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get('id');

  if (!sourceId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Source ID is required', 400);
  }

  // Verify ownership
  const existing = await prisma.contractSource.findFirst({
    where: { id: sourceId, tenantId },
  });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Source not found', 404);
  }

  // Delete the source (cascades to synced files and sync logs)
  await prisma.contractSource.delete({
    where: { id: sourceId },
  });

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Source deleted successfully',
  });
});

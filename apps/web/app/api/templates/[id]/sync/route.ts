import { logger } from '@/lib/logger';
/**
 * Template Cloud Sync API
 * 
 * POST /api/templates/[id]/sync
 * 
 * Syncs a template to cloud storage (SharePoint, OneDrive, Google Drive)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  syncTemplateToCloud,
  getAvailableCloudProviders,
  type CloudProvider,
} from '@/lib/templates/cloud-sync-service';
import type { ContractTemplate } from '@/lib/templates/document-service';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { normalizeTemplateClauses } from '@/lib/templates/template-record';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates/sync', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant not found', 400);
  }

  const { id } = await (ctx as any).params as { id: string };
  const body = await request.json();
  const {
    provider,
    format = 'docx',
    folderId,
    folderPath,
  } = body as {
    provider: CloudProvider;
    format?: 'docx' | 'pdf';
    folderId?: string;
    folderPath?: string;
  };

  if (!provider) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Provider is required (sharepoint, onedrive, or google-drive)', 400);
  }

  // Fetch the template
  const template = await prisma.contractTemplate.findUnique({
    where: { id },
  });

  if (!template) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
  }

  // Check tenant access
  if (template.tenantId !== tenantId) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Access denied', 403);
  }

  // Check if provider is available
  const availableProviders = await getAvailableCloudProviders(tenantId);
  if (!availableProviders.includes(provider)) {
    return createErrorResponse(ctx, 'BAD_REQUEST', `${provider} is not connected. Please connect it in Settings → Contract Sources.`, 400);
  }

  // Parse metadata
  const metadata = template.metadata as Record<string, unknown> || {};
  
  const templateClauseRecords = normalizeTemplateClauses(template.clauses as unknown);
  const referencedClauseIds = templateClauseRecords
    .map((clause) => clause.clauseId)
    .filter((clauseId): clauseId is string => typeof clauseId === 'string' && clauseId.length > 0);

  const latestClauseIndex = referencedClauseIds.length > 0
    ? new Map(
        (await prisma.clauseLibrary.findMany({
          where: {
            tenantId,
            id: { in: referencedClauseIds },
          },
          select: {
            id: true,
            title: true,
            content: true,
          },
        })).map((clause) => [clause.id, clause]),
      )
    : new Map<string, { id: string; title: string; content: string }>();

  const parsedClauses = templateClauseRecords.map((clause) => {
    const latestClause = clause.clauseId ? latestClauseIndex.get(clause.clauseId) : undefined;
    return {
      id: clause.id,
      title: latestClause?.title || clause.title,
      content: latestClause?.content || clause.content,
    };
  });

  // Convert to our template format
  const templateData: ContractTemplate = {
    id: template.id,
    name: template.name,
    description: template.description || '',
    category: template.category || 'General',
    language: (metadata.language as string) || 'en-US',
    variables: metadata.variables as string[] | undefined,
    clauses: parsedClauses,
    createdBy: template.createdBy || 'System',
    createdAt: template.createdAt.toISOString(),
    lastModified: template.updatedAt?.toISOString(),
    updatedAt: template.updatedAt?.toISOString(),
    status: template.isActive ? 'active' : 'archived',
    usageCount: template.usageCount || 0,
    content: (metadata.content as string) || undefined,
    tags: metadata.tags as string[] | undefined,
    version: String(template.version || '1'),
  };

  // Sync to cloud
  const result = await syncTemplateToCloud(templateData, tenantId, {
    provider,
    format,
    folderId,
    folderPath,
  });

  if (!result.success) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', result.error ?? 'Sync failed', 500);
  }

  // Update template with sync info
  await prisma.contractTemplate.update({
    where: { id },
    data: {
      metadata: {
        ...(template.metadata as Record<string, unknown> || {}),
        lastCloudSync: {
          provider,
          fileId: result.remoteFileId,
          url: result.remoteUrl,
          syncedAt: new Date().toISOString(),
          format,
        },
      },
    },
  });

  await auditLog({
    action: AuditAction.CONTRACT_UPDATED,
    resourceType: 'template',
    resourceId: id,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    metadata: { operation: 'sync', provider },
  }).catch(err => logger.error('[Template] Audit log failed', err));

  return createSuccessResponse(ctx, {
    success: true,
    message: `Template synced to ${provider} successfully`,
    fileId: result.remoteFileId,
    url: result.remoteUrl,
  });
})

/**
 * GET /api/templates/[id]/sync
 * 
 * Get available cloud providers and sync status for a template
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant not found', 400);
  }

  const { id } = await (ctx as any).params as { id: string };

  // Fetch the template
  const template = await prisma.contractTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      metadata: true,
    },
  });

  if (!template) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
  }

  if (template.tenantId !== tenantId) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Access denied', 403);
  }

  // Get available providers
  const availableProviders = await getAvailableCloudProviders(tenantId);

  // Get last sync info
  const metadata = template.metadata as Record<string, unknown> || {};
  const lastCloudSync = metadata.lastCloudSync as Record<string, unknown> | undefined;

  return createSuccessResponse(ctx, {
    availableProviders,
    lastSync: lastCloudSync || null,
  });
})

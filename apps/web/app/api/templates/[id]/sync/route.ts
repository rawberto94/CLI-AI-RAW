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
import { getServerSession } from '@/lib/auth';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant not found', 400);
    }

    const { id } = await params;
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
    
    // Parse clauses from Json field
    const clausesData = template.clauses as unknown;
    const parsedClauses = Array.isArray(clausesData) 
      ? clausesData.map((c: { id?: string; title?: string; content?: string }) => ({
          id: c.id || crypto.randomUUID(),
          title: c.title || undefined,
          content: c.content || '',
        }))
      : [];

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

    return createSuccessResponse(ctx, {
      success: true,
      message: `Template synced to ${provider} successfully`,
      fileId: result.remoteFileId,
      url: result.remoteUrl,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * GET /api/templates/[id]/sync
 * 
 * Get available cloud providers and sync status for a template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant not found', 400);
    }

    const { id } = await params;

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
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

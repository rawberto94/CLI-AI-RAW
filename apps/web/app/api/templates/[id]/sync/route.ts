/**
 * Template Cloud Sync API
 * 
 * POST /api/templates/[id]/sync
 * 
 * Syncs a template to cloud storage (SharePoint, OneDrive, Google Drive)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  syncTemplateToCloud,
  getAvailableCloudProviders,
  type CloudProvider,
} from '@/lib/templates/cloud-sync-service';
import type { ContractTemplate } from '@/lib/templates/document-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
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
      return NextResponse.json(
        { error: 'Provider is required (sharepoint, onedrive, or google-drive)' },
        { status: 400 }
      );
    }

    // Fetch the template
    const template = await prisma.contractTemplate.findUnique({
      where: { id },
      include: {
        clauses: true,
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check tenant access
    if (template.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if provider is available
    const availableProviders = await getAvailableCloudProviders(tenantId);
    if (!availableProviders.includes(provider)) {
      return NextResponse.json(
        {
          error: `${provider} is not connected. Please connect it in Settings → Contract Sources.`,
          availableProviders,
        },
        { status: 400 }
      );
    }

    // Convert to our template format
    const templateData: ContractTemplate = {
      id: template.id,
      name: template.name,
      description: template.description || '',
      category: template.category || 'General',
      language: template.language || 'en-US',
      variables: template.variables as string[] | undefined,
      clauses: template.clauses?.map(c => ({
        id: c.id,
        title: c.title || undefined,
        content: c.content,
      })),
      createdBy: template.createdBy || 'System',
      createdAt: template.createdAt.toISOString(),
      lastModified: template.updatedAt?.toISOString(),
      updatedAt: template.updatedAt?.toISOString(),
      status: template.status as 'draft' | 'active' | 'archived' | 'pending_approval',
      usageCount: template.usageCount || 0,
      content: template.content || undefined,
      tags: template.tags as string[] | undefined,
      version: template.version || '1.0.0',
    };

    // Sync to cloud
    const result = await syncTemplateToCloud(templateData, tenantId, {
      provider,
      format,
      folderId,
      folderPath,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Sync failed' },
        { status: 500 }
      );
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

    return NextResponse.json({
      success: true,
      message: `Template synced to ${provider} successfully`,
      fileId: result.remoteFileId,
      url: result.remoteUrl,
    });
  } catch (error) {
    console.error('Template sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
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
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
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
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get available providers
    const availableProviders = await getAvailableCloudProviders(tenantId);

    // Get last sync info
    const metadata = template.metadata as Record<string, unknown> || {};
    const lastCloudSync = metadata.lastCloudSync as Record<string, unknown> | undefined;

    return NextResponse.json({
      availableProviders,
      lastSync: lastCloudSync || null,
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

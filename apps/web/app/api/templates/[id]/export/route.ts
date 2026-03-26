/**
 * Template Export API
 * 
 * GET /api/templates/[id]/export?format=docx|pdf|json
 * 
 * Exports a template to the specified format.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  generateWordDocument,
  generatePDFDocument,
  type ContractTemplate,
} from '@/lib/templates/document-service';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates/export', AI_RATE_LIMITS.lightweight);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const session = await auth();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'docx';

    // Fetch the template
    const template = await prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    }

    // Check tenant access
    if (template.tenantId !== session.user.tenantId) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Access denied', 403);
    }

    // Parse clauses from JSON
    const clausesData = template.clauses as unknown;
    const parsedClauses = Array.isArray(clausesData) 
      ? clausesData.map((c: { id?: string; title?: string; content?: string }) => ({
          id: c.id || crypto.randomUUID(),
          title: c.title,
          content: c.content || '',
        }))
      : [];

    // Parse metadata for additional fields
    const metadata = template.metadata as Record<string, unknown> || {};

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

    // Generate the document based on format
    const sanitizedName = template.name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '_');

    await auditLog({
      action: AuditAction.DATA_EXPORTED,
      resourceType: 'template',
      resourceId: template.id,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      metadata: { operation: 'export', format },
    }).catch(err => console.error('[Template] Audit log failed:', err));

    if (format === 'pdf') {
      const pdfBuffer = await generatePDFDocument(templateData);
      const pdfArray = new Uint8Array(pdfBuffer);
      
      return new NextResponse(pdfArray, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${sanitizedName}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    } else if (format === 'json') {
      const jsonData = JSON.stringify(templateData, null, 2);
      
      return new NextResponse(jsonData, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${sanitizedName}.json"`,
        },
      });
    } else {
      // Default to DOCX
      const docxBuffer = await generateWordDocument(templateData);
      const docxArray = new Uint8Array(docxBuffer);
      
      return new NextResponse(docxArray, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${sanitizedName}.docx"`,
          'Content-Length': String(docxBuffer.length),
        },
      });
    }
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

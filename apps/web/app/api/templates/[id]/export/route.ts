import { logger } from '@/lib/logger';
/**
 * Template Export API
 *
 * GET /api/templates/[id]/export?format=docx|pdf|json
 *
 * Exports a template to the specified format.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateWordDocument,
  generatePDFDocument,
  type ContractTemplate,
} from '@/lib/templates/document-service';
import { normalizeTemplateClauses } from '@/lib/templates/template-record';
import { withAuthApiHandler, createErrorResponse } from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates/export', AI_RATE_LIMITS.lightweight);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  const { id } = await (ctx as any).params as { id: string };
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'docx';

  const template = await prisma.contractTemplate.findUnique({
    where: { id },
  });

  if (!template) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
  }

  if (template.tenantId !== ctx.tenantId) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Access denied', 403);
  }

  const templateClauseRecords = normalizeTemplateClauses(template.clauses as unknown);
  const referencedClauseIds = templateClauseRecords
    .map((clause) => clause.clauseId)
    .filter((clauseId): clauseId is string => typeof clauseId === 'string' && clauseId.length > 0);

  const latestClauseIndex = referencedClauseIds.length > 0
    ? new Map(
        (await prisma.clauseLibrary.findMany({
          where: {
            tenantId: template.tenantId,
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

  const metadata = template.metadata as Record<string, unknown> || {};

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

  const sanitizedName = template.name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '_');

  await auditLog({
    action: AuditAction.DATA_EXPORTED,
    resourceType: 'template',
    resourceId: template.id,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    metadata: { operation: 'export', format },
  }).catch(err => logger.error('[Template] Audit log failed', err));

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
  }

  if (format === 'json') {
    const jsonData = JSON.stringify(templateData, null, 2);

    return new NextResponse(jsonData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${sanitizedName}.json"`,
      },
    });
  }

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
})

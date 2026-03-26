/**
 * GET /api/drafts/:id/export?format=pdf|docx|json
 *
 * Exports a draft in the requested format.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withAuthApiHandler,
  createErrorResponse,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateDraftPDF, generateDraftDOCX } from '@/lib/drafting/draft-export';

const ALLOWED_FORMATS = ['pdf', 'docx', 'json'] as const;
type ExportFormat = (typeof ALLOWED_FORMATS)[number];

export const GET = withAuthApiHandler(
  async (request: NextRequest, ctx: AuthenticatedApiContext) => {
    const { tenantId, userId } = ctx;
    const draftId = ctx.params?.id as string;
    const format = (request.nextUrl.searchParams.get('format') || 'pdf') as ExportFormat;

    if (!draftId) {
      return createErrorResponse('Draft ID is required', 400, ctx.requestId);
    }

    if (!ALLOWED_FORMATS.includes(format)) {
      return createErrorResponse(
        `Invalid format "${format}". Allowed: ${ALLOWED_FORMATS.join(', ')}`,
        400,
        ctx.requestId,
      );
    }

    try {
      const draft = await prisma.contractDraft.findFirst({
        where: { id: draftId, tenantId },
        include: {
          template: { select: { name: true } },
          createdByUser: { select: { firstName: true, lastName: true } },
        },
      });

      if (!draft) {
        return createErrorResponse('Draft not found', 404, ctx.requestId);
      }

      const safeTitle = (draft.title || 'Untitled Draft').replace(/[^a-zA-Z0-9\s-_]/g, '');
      const authorName = draft.createdByUser
        ? `${draft.createdByUser.firstName || ''} ${draft.createdByUser.lastName || ''}`.trim()
        : 'Unknown';

      // JSON export
      if (format === 'json') {
        const payload = {
          id: draft.id,
          title: draft.title,
          type: draft.type,
          status: draft.status,
          content: draft.content,
          clauses: draft.clauses,
          variables: draft.variables,
          structure: draft.structure,
          template: draft.template?.name || null,
          author: authorName,
          estimatedValue: draft.estimatedValue ? Number(draft.estimatedValue) : null,
          currency: draft.currency,
          externalParties: draft.externalParties,
          proposedStartDate: draft.proposedStartDate,
          proposedEndDate: draft.proposedEndDate,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
          version: draft.version,
          exportedAt: new Date().toISOString(),
        };

        return new NextResponse(JSON.stringify(payload, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${safeTitle}.json"`,
            'X-Request-Id': ctx.requestId,
          },
        });
      }

      const exportInput = {
        title: draft.title,
        content: draft.content || '',
        contractType: draft.type,
        author: authorName,
        createdAt: draft.createdAt.toISOString(),
      };

      // PDF export
      if (format === 'pdf') {
        const pdfBytes = generateDraftPDF(exportInput);
        return new NextResponse(pdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
            'Content-Length': String(pdfBytes.length),
            'X-Request-Id': ctx.requestId,
          },
        });
      }

      // DOCX export
      const docxBytes = await generateDraftDOCX(exportInput);
      return new NextResponse(docxBytes, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${safeTitle}.docx"`,
          'Content-Length': String(docxBytes.length),
          'X-Request-Id': ctx.requestId,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      logger.error('Draft export failed', { draftId, format, tenantId, error: msg });
      return createErrorResponse('Failed to export draft', 500, ctx.requestId);
    }
  },
);

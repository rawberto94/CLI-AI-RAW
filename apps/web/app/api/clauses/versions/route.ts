import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Clause Versioning API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const clauseId = searchParams.get('clauseId');
    const { prisma } = await import('@/lib/prisma');

    if (clauseId) {
      // Get version history for a specific clause
      const versions = await (prisma as any).clauseVersion.findMany({
        where: { clauseId, clause: { tenantId: ctx.tenantId } },
        orderBy: { version: 'desc' },
        include: { createdByUser: { select: { name: true, email: true } } },
      });
      return createSuccessResponse(ctx, { versions });
    }

    // Get all clause library entries (ClauseLibrary tracks version via built-in version field)
    const clauses = await prisma.clauseLibrary.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        title: true,
        category: true,
        content: true,
        version: true,
        riskLevel: true,
        isStandard: true,
        isMandatory: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return createSuccessResponse(ctx, { clauses });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch clause versions. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    // Create a new version
    const latestVersion = await (prisma as any).clauseVersion.findFirst({
      where: { clauseId: body.clauseId },
      orderBy: { version: 'desc' },
    });

    const newVersion = (latestVersion?.version || 0) + 1;

    const version = await (prisma as any).clauseVersion.create({
      data: {
        clauseId: body.clauseId,
        version: newVersion,
        text: body.text,
        plainText: body.plainText || body.text?.replace(/<[^>]*>/g, '') || '',
        changeNotes: body.changeNotes || null,
        createdById: ctx.userId,
      },
    });

    // Update the clause library entry with new text
    await prisma.clauseLibrary.update({
      where: { id: body.clauseId },
      data: { content: body.text, updatedAt: new Date() },
    });

    return createSuccessResponse(ctx, { version });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create clause version. Please try again.', 500);
  }
});

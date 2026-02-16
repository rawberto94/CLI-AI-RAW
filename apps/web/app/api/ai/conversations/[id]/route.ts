/**
 * Single conversation endpoint — load full conversation with messages
 *
 * GET /api/ai/conversations/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(
  async (
    _request: NextRequest,
    ctx: AuthenticatedApiContext & { params: Promise<{ id: string }> }
  ) => {
    const { tenantId, userId } = ctx;
    const { id } = await ctx.params;

    const conversation = await prisma.chatConversation.findFirst({
      where: { id, tenantId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  }
);

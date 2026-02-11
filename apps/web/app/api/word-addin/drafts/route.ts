/**
 * Word Add-in Drafts API
 * Manages contract drafts for the Word Add-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedApiContext } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedApiContext(req);
    if (!ctx) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const drafts = await prisma.contractDraft.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: { not: 'deleted' },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        template: {
          select: { name: true },
        },
      },
    });

    const transformed = drafts.map((d) => ({
      id: d.id,
      title: d.title,
      templateName: d.template?.name || 'Custom',
      updatedAt: d.updatedAt.toISOString(),
      status: d.status,
    }));

    return NextResponse.json({ success: true, data: transformed });
  } catch (error) {
    console.error('Word Add-in drafts error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch drafts' } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedApiContext(req);
    if (!ctx) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { templateId, title, content, variables } = body;

    if (!title) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Draft title is required' } },
        { status: 400 }
      );
    }

    const draft = await prisma.contractDraft.create({
      data: {
        tenantId: ctx.tenantId,
        templateId: templateId || null,
        title,
        content: content || '',
        variables: variables || {},
        status: 'draft',
        createdBy: ctx.userId || 'word-addin',
      },
    });

    return NextResponse.json({
      success: true,
      data: { draftId: draft.id },
    });
  } catch (error) {
    console.error('Word Add-in create draft error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to create draft' } },
      { status: 500 }
    );
  }
}

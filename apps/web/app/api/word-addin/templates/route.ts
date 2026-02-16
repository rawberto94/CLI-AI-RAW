/**
 * Word Add-in Templates API
 * Provides template CRUD operations for the Word Add-in
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

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const templates = await prisma.contractTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        content: true,
        variables: true,
        isActive: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Transform to match Word Add-in expected format
    const transformed = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || '',
      category: t.category || 'OTHER',
      content: t.content || { sections: [] },
      variables: Array.isArray(t.variables) ? t.variables : [],
      clauses: [],
      isActive: t.isActive,
      version: t.version || 1,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: transformed });
  } catch (error) {
    console.error('Word Add-in templates error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch templates' } },
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
    const { name, description, category, content, variables } = body;

    if (!name) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Template name is required' } },
        { status: 400 }
      );
    }

    const template = await prisma.contractTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        description: description || '',
        category: category || 'OTHER',
        content: content || { sections: [] },
        variables: variables || [],
        isActive: true,
        version: 1,
        createdBy: ctx.userId || 'word-addin',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        content: template.content,
        variables: template.variables,
        isActive: template.isActive,
        version: template.version,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Word Add-in create template error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to create template' } },
      { status: 500 }
    );
  }
}

/**
 * Word Add-in Clauses API
 * Provides clause library operations for the Word Add-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedApiContext } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
    };

    if (category) {
      where.category = category;
    }

    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { plainText: { contains: search, mode: 'insensitive' } },
      ];
    }

    const clauses = await prisma.clauseLibrary.findMany({
      where,
      orderBy: [
        { isStandard: 'desc' },
        { usageCount: 'desc' },
        { title: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        title: true,
        category: true,
        content: true,
        riskLevel: true,
        isStandard: true,
        tags: true,
        usageCount: true,
        alternativeText: true,
      },
    });

    // Transform to match expected format
    const transformed = clauses.map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title,
      category: c.category || 'General',
      content: c.content,
      riskLevel: c.riskLevel || 'LOW',
      isStandard: c.isStandard || false,
      alternatives: c.alternativeText ? [c.alternativeText] : [],
      tags: Array.isArray(c.tags) ? c.tags : [],
      usageCount: c.usageCount || 0,
    }));

    return NextResponse.json({ success: true, data: transformed });
  } catch (error) {
    console.error('Word Add-in clauses error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch clauses' } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, title, category, content, riskLevel, isStandard, tags } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Clause title and content are required' } },
        { status: 400 }
      );
    }

    // Generate unique name from title if not provided
    const clauseName = name || title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50);

    const clause = await prisma.clauseLibrary.create({
      data: {
        tenantId: ctx.tenantId,
        name: `${clauseName}_${Date.now()}`,
        title,
        category: category || 'General',
        content,
        riskLevel: riskLevel || 'LOW',
        isStandard: isStandard || false,
        tags: tags || [],
        usageCount: 0,
        createdBy: ctx.userId || 'word-addin',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: clause.id,
        name: clause.name,
        title: clause.title,
        category: clause.category,
        content: clause.content,
        riskLevel: clause.riskLevel,
        isStandard: clause.isStandard,
        tags: clause.tags,
        usageCount: clause.usageCount,
      },
    });
  } catch (error) {
    console.error('Word Add-in create clause error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to create clause' } },
      { status: 500 }
    );
  }
}

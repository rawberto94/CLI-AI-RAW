/**
 * Word Add-in Clauses API
 * Provides clause library operations for the Word Add-in
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
    const riskLevel = searchParams.get('riskLevel');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }

    const clauses = await prisma.clause.findMany({
      where,
      orderBy: [
        { isStandard: 'desc' },
        { usageCount: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        category: true,
        content: true,
        riskLevel: true,
        isStandard: true,
        guidance: true,
        tags: true,
        usageCount: true,
        alternatives: true,
      },
    });

    // Transform to match expected format
    const transformed = clauses.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category || 'General',
      content: c.content,
      riskLevel: c.riskLevel || 'LOW',
      isStandard: c.isStandard || false,
      alternatives: Array.isArray(c.alternatives) ? c.alternatives : [],
      guidance: c.guidance || '',
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
    const ctx = await getAuthenticatedApiContext(req);
    if (!ctx) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, category, content, riskLevel, isStandard, guidance, tags } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Clause name and content are required' } },
        { status: 400 }
      );
    }

    const clause = await prisma.clause.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        category: category || 'General',
        content,
        riskLevel: riskLevel || 'LOW',
        isStandard: isStandard || false,
        guidance: guidance || '',
        tags: tags || [],
        usageCount: 0,
        isActive: true,
        createdBy: ctx.userId || 'word-addin',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: clause.id,
        name: clause.name,
        category: clause.category,
        content: clause.content,
        riskLevel: clause.riskLevel,
        isStandard: clause.isStandard,
        guidance: clause.guidance,
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

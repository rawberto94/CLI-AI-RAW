import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';

// GET /api/clauses - List all clauses from clause library
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel');
    const favorite = searchParams.get('favorite');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    
    if (category && category !== 'all') {
      where.category = category;
    }
    if (riskLevel && riskLevel !== 'all') {
      where.riskLevel = riskLevel.toUpperCase();
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
      orderBy: { usageCount: 'desc' },
      take: limit,
    });

    // Transform to expected format
    const transformedClauses = clauses.map(c => ({
      id: c.id,
      title: c.title,
      content: c.content,
      category: c.category,
      subcategory: c.category,
      tags: c.tags as string[],
      riskLevel: c.riskLevel.toLowerCase() as 'low' | 'medium' | 'high',
      isStandard: c.isStandard,
      isFavorite: false, // Can be added to schema later
      usageCount: c.usageCount,
      variables: extractVariables(c.content),
      alternativeVersions: c.alternativeText ? [c.alternativeText] : [],
      legalNotes: '',
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return NextResponse.json({ 
      clauses: transformedClauses, 
      total: clauses.length,
      source: 'database' 
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch clauses' },
      { status: 500 }
    );
  }
}

// POST /api/clauses - Create new clause
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;
    const userId = session.user.id;
    const body = await request.json();
    const { title, content, category, tags, riskLevel, alternativeText, isStandard, isMandatory, isNegotiable } = body;

    if (!title || !content || !category) {
      return NextResponse.json(
        { error: 'Title, content, and category are required' },
        { status: 400 }
      );
    }

    // Generate unique name from title
    const name = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50);

    // Extract plain text for search
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\{\{[^}]+\}\}/g, '');

    // Create in database
    const clause = await prisma.clauseLibrary.create({
      data: {
        tenantId,
        name: `${name}_${Date.now()}`,
        title,
        category: category.toUpperCase().replace(/ /g, '_'),
        content,
        plainText,
        riskLevel: (riskLevel || 'MEDIUM').toUpperCase(),
        isStandard: isStandard ?? false,
        isMandatory: isMandatory ?? false,
        isNegotiable: isNegotiable ?? true,
        tags: tags || [],
        alternativeText: alternativeText || null,
        createdBy: userId,
      },
    });

    // Transform response
    const transformedClause = {
      id: clause.id,
      title: clause.title,
      content: clause.content,
      category: clause.category,
      subcategory: clause.category,
      tags: clause.tags as string[],
      riskLevel: clause.riskLevel.toLowerCase() as 'low' | 'medium' | 'high',
      isStandard: clause.isStandard,
      isFavorite: false,
      usageCount: clause.usageCount,
      variables: extractVariables(clause.content),
      alternativeVersions: clause.alternativeText ? [clause.alternativeText] : [],
      legalNotes: '',
      createdAt: clause.createdAt.toISOString(),
      updatedAt: clause.updatedAt.toISOString(),
    };

    return NextResponse.json({ 
      clause: transformedClause, 
      source: 'database' 
    }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create clause' },
      { status: 500 }
    );
  }
}

// Helper to extract variables from content
function extractVariables(content: string): string[] {
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = variableRegex.exec(content)) !== null) {
    if (match[1] && !variables.includes(match[1].trim())) {
      variables.push(match[1].trim());
    }
  }
  return variables;
}

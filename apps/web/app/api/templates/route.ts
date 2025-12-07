import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiTenantId } from '@/lib/tenant-server'

// GET /api/templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request)
    const { searchParams } = new URL(request.url)
    
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = {
      tenantId,
    }

    if (category) {
      where.category = category
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const templates = await prisma.contractTemplate.findMany({
      where,
      orderBy: [
        { usageCount: 'desc' },
        { lastUsedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
    })

    const total = await prisma.contractTemplate.count({ where })

    return NextResponse.json({
      success: true,
      templates,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request)
    const body = await request.json()

    const {
      name,
      description,
      category,
      clauses,
      structure,
      metadata = {},
    } = body

    if (!name || !clauses) {
      return NextResponse.json(
        { success: false, error: 'Name and clauses are required' },
        { status: 400 }
      )
    }

    const template = await prisma.contractTemplate.create({
      data: {
        tenantId,
        name,
        description,
        category: category || 'GENERAL',
        clauses: clauses || [],
        structure: structure || {},
        metadata,
        createdBy: 'system', // TODO: Get from session when authenticated
      },
    })

    return NextResponse.json({
      success: true,
      template,
    })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    )
  }
}

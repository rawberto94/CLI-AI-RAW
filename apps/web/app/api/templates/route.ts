import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'tenant_demo_001'
    const { searchParams } = new URL(request.url)
    
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    try {
      const where: any = {
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
    } catch (dbError) {
      console.error('Database error, falling back to mock data:', dbError)
      
      return NextResponse.json({
        success: true,
        templates: getMockTemplates(),
        total: getMockTemplates().length,
      })
    }
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'tenant_demo_001'
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
        { error: 'Name and clauses are required' },
        { status: 400 }
      )
    }

    try {
      const template = await prisma.contractTemplate.create({
        data: {
          tenantId,
          name,
          description,
          category: category || 'GENERAL',
          clauses: clauses || [],
          structure: structure || {},
          metadata,
          createdBy: 'user_mock_001', // TODO: Get from auth
        },
      })

      return NextResponse.json({
        success: true,
        template,
      })
    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({
        success: true,
        template: {
          id: `template_${Date.now()}`,
          ...body,
          createdAt: new Date().toISOString(),
        },
      })
    }
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}

// Mock data
function getMockTemplates() {
  return [
    {
      id: 'template_001',
      tenantId: 'tenant_demo_001',
      name: 'Master Services Agreement',
      description: 'Standard MSA template for professional services',
      category: 'MSA',
      clauses: [
        {
          id: 'clause_001',
          title: 'Scope of Services',
          content: 'The Service Provider shall provide the services as described in the attached Statement of Work.',
          category: 'Services',
          required: true,
          editable: true,
        },
        {
          id: 'clause_002',
          title: 'Payment Terms',
          content: 'Client agrees to pay Service Provider within net-30 days of invoice date.',
          category: 'Financial',
          required: true,
          editable: true,
        },
        {
          id: 'clause_003',
          title: 'Confidentiality',
          content: 'Both parties agree to maintain confidentiality of proprietary information shared during the engagement.',
          category: 'Legal',
          required: true,
          editable: false,
        },
        {
          id: 'clause_004',
          title: 'Intellectual Property',
          content: 'All work product created during the engagement shall be owned by the Client upon full payment.',
          category: 'Legal',
          required: true,
          editable: true,
        },
        {
          id: 'clause_005',
          title: 'Termination',
          content: 'Either party may terminate this agreement with 30 days written notice.',
          category: 'Legal',
          required: true,
          editable: true,
        },
      ],
      structure: {
        sections: [
          'Definitions',
          'Scope of Services',
          'Payment Terms',
          'Confidentiality',
          'Intellectual Property',
          'Warranties',
          'Indemnification',
          'Limitation of Liability',
          'Term and Termination',
          'General Provisions',
        ],
      },
      metadata: {
        industryVertical: 'Technology',
        contractType: 'B2B',
        averageValue: 50000,
        averageDuration: 12,
      },
      version: 1,
      isActive: true,
      usageCount: 45,
      lastUsedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'template_002',
      tenantId: 'tenant_demo_001',
      name: 'Non-Disclosure Agreement',
      description: 'Mutual NDA for protecting confidential information',
      category: 'NDA',
      clauses: [
        {
          id: 'clause_006',
          title: 'Definition of Confidential Information',
          content: 'Confidential Information means any information disclosed by either party that is marked confidential or would reasonably be considered confidential.',
          category: 'Definitions',
          required: true,
          editable: true,
        },
        {
          id: 'clause_007',
          title: 'Obligations of Receiving Party',
          content: 'The Receiving Party shall maintain confidentiality and not disclose Confidential Information to third parties.',
          category: 'Obligations',
          required: true,
          editable: false,
        },
        {
          id: 'clause_008',
          title: 'Term',
          content: 'This Agreement shall remain in effect for 2 years from the Effective Date.',
          category: 'Term',
          required: true,
          editable: true,
        },
      ],
      structure: {
        sections: [
          'Definitions',
          'Obligations',
          'Exclusions',
          'Term',
          'Return of Materials',
          'General Provisions',
        ],
      },
      metadata: {
        industryVertical: 'All',
        contractType: 'B2B',
        averageValue: 0,
        averageDuration: 24,
      },
      version: 2,
      isActive: true,
      usageCount: 128,
      lastUsedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'template_003',
      tenantId: 'tenant_demo_001',
      name: 'Software License Agreement',
      description: 'SaaS subscription license agreement',
      category: 'LICENSE',
      clauses: [
        {
          id: 'clause_009',
          title: 'Grant of License',
          content: 'Licensor grants Licensee a non-exclusive, non-transferable license to use the Software.',
          category: 'License',
          required: true,
          editable: true,
        },
        {
          id: 'clause_010',
          title: 'Subscription Fees',
          content: 'Licensee shall pay monthly subscription fees as outlined in the pricing schedule.',
          category: 'Financial',
          required: true,
          editable: true,
        },
        {
          id: 'clause_011',
          title: 'Support and Maintenance',
          content: 'Licensor will provide technical support during business hours and quarterly software updates.',
          category: 'Services',
          required: true,
          editable: true,
        },
      ],
      structure: {
        sections: [
          'Definitions',
          'Grant of License',
          'Restrictions',
          'Subscription Fees',
          'Support and Maintenance',
          'Data Protection',
          'Warranties',
          'Limitation of Liability',
          'Term and Termination',
        ],
      },
      metadata: {
        industryVertical: 'Software',
        contractType: 'B2B',
        averageValue: 25000,
        averageDuration: 12,
      },
      version: 1,
      isActive: true,
      usageCount: 32,
      lastUsedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'template_004',
      tenantId: 'tenant_demo_001',
      name: 'Employment Agreement',
      description: 'Standard employment contract for full-time employees',
      category: 'EMPLOYMENT',
      clauses: [
        {
          id: 'clause_012',
          title: 'Position and Duties',
          content: 'Employee shall serve in the position of [TITLE] and perform duties as assigned.',
          category: 'Employment',
          required: true,
          editable: true,
        },
        {
          id: 'clause_013',
          title: 'Compensation',
          content: 'Employee shall receive base salary of $[AMOUNT] per year, payable bi-weekly.',
          category: 'Financial',
          required: true,
          editable: true,
        },
        {
          id: 'clause_014',
          title: 'Benefits',
          content: 'Employee is eligible for company benefits including health insurance, 401(k), and PTO.',
          category: 'Benefits',
          required: true,
          editable: true,
        },
      ],
      structure: {
        sections: [
          'Position and Duties',
          'Compensation',
          'Benefits',
          'Confidentiality',
          'Non-Compete',
          'Termination',
          'General Provisions',
        ],
      },
      metadata: {
        industryVertical: 'All',
        contractType: 'B2E',
        averageValue: 75000,
        averageDuration: 999,
      },
      version: 1,
      isActive: true,
      usageCount: 67,
      lastUsedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]
}

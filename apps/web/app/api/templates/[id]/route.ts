import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getServerSession } from '@/lib/auth';

// Helper to transform Prisma template to UI-expected format
function transformTemplate(template: Record<string, unknown>) {
  const metadata = (template.metadata || {}) as Record<string, unknown>
  const clauses = template.clauses as Array<Record<string, unknown>> || []
  const variables = (metadata.variables || []) as Array<Record<string, unknown>>
  
  return {
    ...template,
    // Map status from metadata or derive from isActive
    status: metadata.status || (template.isActive ? 'active' : 'draft'),
    // Map tags from metadata
    tags: metadata.tags || [],
    // Map content from metadata
    content: metadata.content || '',
    // Map language from metadata  
    language: metadata.language || 'en-US',
    // Calculate variables count
    variables: variables.length,
    // Calculate clauses count (if array) or keep as-is
    clauses: Array.isArray(clauses) ? clauses.length : (clauses || 0),
    // Add lastModified alias
    lastModified: template.updatedAt,
    // Approval status (from metadata or default)
    approvalStatus: metadata.approvalStatus || 'none',
    // Created by user name (if available)
    createdBy: template.createdBy || 'System',
  }
}

// GET /api/templates/[id] - Get a single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getApiTenantId(request);
    const { id } = await params;

    // Handle "new" route - return empty template structure
    if (id === 'new') {
      return NextResponse.json({
        success: true,
        template: null,
        isNew: true,
      });
    }

    const template = await prisma.contractTemplate.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template: transformTemplate(template as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error('Failed to fetch template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PUT /api/templates/[id] - Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const tenantId = await getApiTenantId(request);
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      description,
      category,
      clauses,
      structure,
      metadata,
      content,
      status,
      tags,
      variables,
      isActive,
    } = body;

    // Check if template exists and belongs to tenant
    const existingTemplate = await prisma.contractTemplate.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (clauses !== undefined) updateData.clauses = clauses;
    if (structure !== undefined) updateData.structure = structure;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Merge metadata
    if (metadata !== undefined || content !== undefined || status !== undefined || tags !== undefined || variables !== undefined) {
      const existingMetadata = (existingTemplate.metadata as Record<string, unknown>) || {};
      updateData.metadata = {
        ...existingMetadata,
        ...(metadata || {}),
        ...(content !== undefined ? { content } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(variables !== undefined ? { variables } : {}),
        updatedBy: session?.user?.id || 'system',
        updatedAt: new Date().toISOString(),
      };
    }

    const template = await prisma.contractTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      template: transformTemplate(template as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error('Failed to update template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getApiTenantId(request);
    const { id } = await params;

    // Check if template exists and belongs to tenant
    const existingTemplate = await prisma.contractTemplate.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Delete the template
    await prisma.contractTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}

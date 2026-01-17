import { NextRequest, NextResponse } from 'next/server';

// POST /api/templates/[id]/duplicate - Duplicate a template
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;

    // Mock response
    return NextResponse.json({
      success: true,
      template: {
        id: `temp-${Date.now()}`,
        name: 'Copy of Template',
        description: 'Duplicated template',
        category: 'NDA',
        type: 'Custom',
        content: 'Template content...',
        variables: [],
        clauses: [],
        version: 1,
        isActive: true,
        isFavorite: false,
        usageCount: 0,
        createdBy: 'User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      source: 'mock'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to duplicate template' },
      { status: 500 }
    );
  }
}

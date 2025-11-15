import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Import mock data from route.ts (in production, use database)
const mockWorkflows: any[] = [];

/**
 * GET /api/workflows/:id - Get specific workflow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;
    
    // In production, fetch from database
    const workflow = mockWorkflows.find(w => w.id === workflowId);
    
    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workflows/:id - Update workflow
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;
    const body = await request.json();
    
    const index = mockWorkflows.findIndex(w => w.id === workflowId);
    
    if (index === -1) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }
    
    mockWorkflows[index] = {
      ...mockWorkflows[index],
      ...body,
      updatedAt: new Date(),
    };
    
    return NextResponse.json({
      success: true,
      workflow: mockWorkflows[index],
      message: 'Workflow updated successfully',
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workflows/:id - Partially update workflow (e.g., toggle active status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;
    const body = await request.json();
    
    const index = mockWorkflows.findIndex(w => w.id === workflowId);
    
    if (index === -1) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }
    
    mockWorkflows[index] = {
      ...mockWorkflows[index],
      ...body,
      updatedAt: new Date(),
    };
    
    return NextResponse.json({
      success: true,
      workflow: mockWorkflows[index],
      message: 'Workflow updated successfully',
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/:id - Delete workflow
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;
    
    const index = mockWorkflows.findIndex(w => w.id === workflowId);
    
    if (index === -1) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }
    
    mockWorkflows.splice(index, 1);
    
    return NextResponse.json({
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

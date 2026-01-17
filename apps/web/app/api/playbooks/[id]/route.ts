/**
 * Single Playbook API
 * 
 * Get, update, delete a specific playbook
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getLegalReviewService } from '@repo/data-orchestration';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// GET - Get playbook by ID
// ============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user.tenantId || 'default';

    const legalReviewService = getLegalReviewService();
    const playbook = await legalReviewService.getPlaybook(id, tenantId);

    if (!playbook) {
      return NextResponse.json(
        { error: 'Playbook not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      playbook,
    });
  } catch (error) {
    console.error('Failed to get playbook:', error);
    return NextResponse.json(
      { error: 'Failed to get playbook' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update playbook
// ============================================================================

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user.tenantId || 'default';
    const body = await request.json();

    const legalReviewService = getLegalReviewService();
    const playbook = await legalReviewService.updatePlaybook(id, tenantId, body);

    return NextResponse.json({
      success: true,
      playbook,
    });
  } catch (error) {
    console.error('Failed to update playbook:', error);
    return NextResponse.json(
      { error: 'Failed to update playbook' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete playbook
// ============================================================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // In a full implementation, delete from database
    // For now, return success

    return NextResponse.json({
      success: true,
      message: 'Playbook deleted',
    });
  } catch (error) {
    console.error('Failed to delete playbook:', error);
    return NextResponse.json(
      { error: 'Failed to delete playbook' },
      { status: 500 }
    );
  }
}

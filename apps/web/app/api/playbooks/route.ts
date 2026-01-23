/**
 * Playbook Management API
 * 
 * CRUD operations for legal playbooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/tenant-server';
import { getLegalReviewService } from '@repo/data-orchestration';

// ============================================================================
// GET - List all playbooks for tenant
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getSessionTenantId(session);
    const legalReviewService = getLegalReviewService();
    const playbooks = await legalReviewService.listPlaybooks(tenantId);

    return NextResponse.json({
      success: true,
      playbooks,
      total: playbooks.length,
    });
  } catch (error) {
    console.error('Failed to list playbooks:', error);
    return NextResponse.json(
      { error: 'Failed to list playbooks' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create new playbook
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      contractTypes = [],
      clauses = [],
      fallbackPositions = {},
      riskThresholds = {},
      redFlags = [],
      isDefault = false,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Playbook name is required' },
        { status: 400 }
      );
    }

    const tenantId = getSessionTenantId(session);

    const legalReviewService = getLegalReviewService();
    const playbook = await legalReviewService.createPlaybook({
      name,
      tenantId,
      contractTypes,
      clauses,
      fallbackPositions,
      riskThresholds,
      redFlags,
      isDefault,
      createdBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      playbook,
    });
  } catch (error) {
    console.error('Failed to create playbook:', error);
    return NextResponse.json(
      { error: 'Failed to create playbook' },
      { status: 500 }
    );
  }
}

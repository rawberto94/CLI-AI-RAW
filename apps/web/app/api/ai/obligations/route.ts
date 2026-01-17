import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET /api/ai/obligations
 * Get obligations, alerts, or compliance status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const contractId = searchParams.get('contractId');
    const obligationId = searchParams.get('obligationId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const dueWithin = searchParams.get('dueWithin'); // days

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const obligationService = (services as any).aiObligationTrackerService;

    if (!obligationService) {
      return NextResponse.json(
        { error: 'AI Obligation Tracker service not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'list':
        result = await obligationService.getObligations({
          tenantId,
          contractId,
          status,
          priority,
          dueWithin: dueWithin ? parseInt(dueWithin) : undefined,
        });
        break;

      case 'detail':
        if (!obligationId) {
          return NextResponse.json(
            { error: 'obligationId is required' },
            { status: 400 }
          );
        }
        result = await obligationService.getObligation(obligationId);
        break;

      case 'alerts':
        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId is required for alerts' },
            { status: 400 }
          );
        }
        result = await obligationService.getAlerts(tenantId);
        break;

      case 'summary':
        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId is required for summary' },
            { status: 400 }
          );
        }
        result = await obligationService.getObligationSummary(tenantId, contractId);
        break;

      case 'compliance':
        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId is required for compliance snapshot' },
            { status: 400 }
          );
        }
        result = await obligationService.getComplianceSnapshot(tenantId);
        break;

      case 'upcoming':
        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId is required' },
            { status: 400 }
          );
        }
        const days = parseInt(dueWithin || '30');
        result = await obligationService.getUpcomingDeadlines(tenantId, days);
        break;

      case 'overdue':
        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId is required' },
            { status: 400 }
          );
        }
        result = await obligationService.getOverdueObligations(tenantId);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to retrieve obligations', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/obligations
 * Extract or create obligations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const body = await request.json();
    const { action = 'extract', ...data } = body;

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const obligationService = (services as any).aiObligationTrackerService;

    if (!obligationService) {
      return NextResponse.json(
        { error: 'AI Obligation Tracker service not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'extract':
        const { contractId, contractText, existingArtifacts } = data;

        if (!contractId || !contractText) {
          return NextResponse.json(
            { error: 'contractId and contractText are required' },
            { status: 400 }
          );
        }

        result = await obligationService.extractObligations(
          tenantId,
          contractId,
          contractText,
          existingArtifacts
        );
        break;

      case 'create':
        const { obligation } = data;

        if (!obligation || !obligation.type || !obligation.description) {
          return NextResponse.json(
            { error: 'Complete obligation object with type and description is required' },
            { status: 400 }
          );
        }

        result = await obligationService.createObligation(obligation);
        break;

      case 'acknowledge-alert':
        const { alertId, userId } = data;

        if (!alertId || !userId) {
          return NextResponse.json(
            { error: 'alertId and userId are required' },
            { status: 400 }
          );
        }

        result = await obligationService.acknowledgeAlert(alertId, userId);
        break;

      case 'bulk-extract':
        const { contracts } = data;

        if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
          return NextResponse.json(
            { error: 'contracts array is required with at least one contract' },
            { status: 400 }
          );
        }

        const results = [];
        for (const contract of contracts) {
          try {
            const extracted = await obligationService.extractObligations(
              contract.tenantId,
              contract.contractId,
              contract.contractText,
              contract.existingArtifacts
            );
            results.push({ contractId: contract.contractId, success: true, obligations: extracted });
          } catch (err) {
            results.push({ contractId: contract.contractId, success: false, error: String(err) });
          }
        }
        result = results;
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to process obligations', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ai/obligations
 * Update obligation status or details
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { obligationId, updates } = body;

    if (!obligationId || !updates) {
      return NextResponse.json(
        { error: 'obligationId and updates are required' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const obligationService = (services as any).aiObligationTrackerService;

    if (!obligationService) {
      return NextResponse.json(
        { error: 'AI Obligation Tracker service not available' },
        { status: 503 }
      );
    }

    const result = await obligationService.updateObligation(obligationId, updates);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to update obligation', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/obligations
 * Remove an obligation
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const obligationId = searchParams.get('obligationId');

    if (!obligationId) {
      return NextResponse.json(
        { error: 'obligationId is required' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const obligationService = (services as any).aiObligationTrackerService;

    if (!obligationService) {
      return NextResponse.json(
        { error: 'AI Obligation Tracker service not available' },
        { status: 503 }
      );
    }

    await obligationService.deleteObligation(obligationId);

    return NextResponse.json({
      success: true,
      message: `Obligation ${obligationId} deleted`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to delete obligation', details: String(error) },
      { status: 500 }
    );
  }
}

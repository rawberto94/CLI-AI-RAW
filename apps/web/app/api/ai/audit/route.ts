import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/ai/audit
 * Get AI decision audit trail, usage stats, or compliance reports
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'decisions';
    const featureId = searchParams.get('featureId');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const auditService = (services as any).aiDecisionAuditService;

    if (!auditService) {
      return NextResponse.json(
        { error: 'AI Decision Audit service not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'decisions':
        result = await auditService.getDecisions({
          tenantId,
          featureId,
          from: fromDate ? new Date(fromDate) : undefined,
          to: toDate ? new Date(toDate) : undefined,
          limit,
        });
        break;

      case 'stats':
        result = await auditService.getUsageStats(
          tenantId,
          fromDate ? new Date(fromDate) : undefined,
          toDate ? new Date(toDate) : undefined
        );
        break;

      case 'compliance':
        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId is required for compliance report' },
            { status: 400 }
          );
        }
        result = await auditService.generateComplianceReport(tenantId);
        break;

      case 'risk-flags':
        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId is required for risk flags' },
            { status: 400 }
          );
        }
        result = await auditService.getRiskFlags(tenantId);
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
      { error: 'Failed to retrieve AI audit data', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/audit
 * Log AI decision or record user feedback
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const body = await request.json();
    const { action = 'log', ...data } = body;

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const auditService = (services as any).aiDecisionAuditService;

    if (!auditService) {
      return NextResponse.json(
        { error: 'AI Decision Audit service not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'log':
        const { 
          contractId, 
          feature, 
          input, 
          output, 
          model, 
          confidence, 
          citations,
          processingTimeMs, 
          tokenUsage 
        } = data;

        if (!feature || !input || !output) {
          return NextResponse.json(
            { error: 'feature, input, and output are required' },
            { status: 400 }
          );
        }

        result = await auditService.logDecision({
          tenantId,
          contractId,
          feature,
          input,
          output,
          model: model || 'gpt-4o',
          confidence: confidence || 0.85,
          citations: citations || [],
          processingTimeMs: processingTimeMs || 0,
          tokenUsage: tokenUsage || { input: 0, output: 0, total: 0 },
        });
        break;

      case 'feedback':
        const { decisionId, userId, rating, correction, comment } = data;

        if (!decisionId || !userId) {
          return NextResponse.json(
            { error: 'decisionId and userId are required for feedback' },
            { status: 400 }
          );
        }

        result = await auditService.recordFeedback({
          decisionId,
          userId,
          rating,
          correction,
          comment,
        });
        break;

      case 'flag':
        const { 
          decisionId: flagDecisionId, 
          flagType, 
          reason, 
          severity 
        } = data;

        if (!flagDecisionId || !flagType || !reason) {
          return NextResponse.json(
            { error: 'decisionId, flagType, and reason are required' },
            { status: 400 }
          );
        }

        result = await auditService.flagDecision(
          flagDecisionId,
          flagType,
          reason,
          severity || 'medium'
        );
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
      { error: 'Failed to log AI decision', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Contract Template Learning API
 * Learn and apply company-specific contract templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

// Dynamic import to avoid build-time resolution issues
async function getTemplateLearningService() {
  const services = await import('@repo/data-orchestration/services');
  return (services as any).contractTemplateLearningService;
}

/**
 * GET /api/ai/templates
 * Retrieve learned templates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const sessionId = searchParams.get('sessionId');

    const templateService = await getTemplateLearningService();

    // Get learning session progress
    if (sessionId) {
      const progress = templateService.getLearningProgress(sessionId);
      
      if (!progress) {
        return NextResponse.json({ error: 'Learning session not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        session: progress,
      });
    }

    // Get specific template
    if (templateId) {
      const templates = templateService.getTemplates(tenantId);
      const template = templates.find((t: any) => t.id === templateId);
      
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        template,
      });
    }

    // List all templates
    const templates = templateService.getTemplates(tenantId);

    return NextResponse.json({
      success: true,
      templates: templates.map((t: any) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        sourceCompany: t.sourceCompany,
        usageCount: t.usageCount,
        confidenceScore: t.confidenceScore,
        status: t.status,
        createdAt: t.createdAt,
        lastUsed: t.lastUsed,
      })),
      totalCount: templates.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/templates
 * Start template learning or match contracts to templates
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const body = await request.json();
    const { action, ...data } = body;

    const templateService = await getTemplateLearningService();

    // Start learning from a contract
    if (action === 'learn') {
      const { contractText, contractId, sourceCompany, knownType } = data;

      if (!contractText) {
        return NextResponse.json(
          { error: 'contractText is required' },
          { status: 400 }
        );
      }

      const sessionId = await templateService.startLearning(tenantId, {
        contractText,
        contractId,
        sourceCompany,
        knownType,
      });

      return NextResponse.json({
        success: true,
        sessionId,
        message: 'Template learning started. Poll for progress using GET with sessionId.',
        progressUrl: `/api/ai/templates?sessionId=${sessionId}`,
      });
    }

    // Match a contract to learned templates
    if (action === 'match') {
      const { contractText, minConfidence = 0.6 } = data;

      if (!contractText) {
        return NextResponse.json(
          { error: 'contractText is required' },
          { status: 400 }
        );
      }

      const matches = templateService.matchTemplate(tenantId, contractText, minConfidence);

      return NextResponse.json({
        success: true,
        matches: matches.map((m: any) => ({
          templateId: m.template.id,
          templateName: m.template.name,
          templateType: m.template.type,
          confidence: m.confidence,
          matchedPatterns: m.matchedPatterns,
          fieldHints: m.fieldHints,
        })),
        bestMatch: matches[0] ? {
          templateId: matches[0].template.id,
          templateName: matches[0].template.name,
          confidence: matches[0].confidence,
        } : null,
      });
    }

    // Apply a template to extract fields from a contract
    if (action === 'apply') {
      const { templateId, contractText } = data;

      if (!templateId || !contractText) {
        return NextResponse.json(
          { error: 'templateId and contractText are required' },
          { status: 400 }
        );
      }

      const result = templateService.applyTemplate(templateId, contractText);

      if (!result) {
        return NextResponse.json(
          { error: 'Template not found or application failed' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        templateId,
        extractedFields: result,
      });
    }

    // Approve a template (make it active)
    if (action === 'approve') {
      const { templateId } = data;

      if (!templateId) {
        return NextResponse.json(
          { error: 'templateId is required' },
          { status: 400 }
        );
      }

      const success = templateService.approveTemplate(templateId);

      if (!success) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Template approved and activated',
      });
    }

    // Reject a template
    if (action === 'reject') {
      const { templateId } = data;

      if (!templateId) {
        return NextResponse.json(
          { error: 'templateId is required' },
          { status: 400 }
        );
      }

      const success = templateService.rejectTemplate(templateId);

      if (!success) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Template rejected',
      });
    }

    // Get field hints for a template
    if (action === 'hints') {
      const { templateId, fieldName } = data;

      if (!templateId) {
        return NextResponse.json(
          { error: 'templateId is required' },
          { status: 400 }
        );
      }

      const templates = templateService.getTemplates(tenantId);
      const template = templates.find((t: any) => t.id === templateId);

      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      const hints = fieldName 
        ? template.structure.fieldMappings.filter((f: any) => f.artifactField === fieldName)
        : template.structure.fieldMappings;

      return NextResponse.json({
        success: true,
        templateId,
        fieldHints: hints,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: learn, match, apply, approve, reject, or hints' },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to process template request' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/templates
 * Delete a learned template
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      );
    }

    const templateService = await getTemplateLearningService();
    const success = templateService.deleteTemplate(tenantId, templateId);

    if (!success) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}

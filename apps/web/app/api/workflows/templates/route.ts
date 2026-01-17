/**
 * Workflow Templates API
 * 
 * Endpoints for:
 * - Listing available workflow templates
 * - Seeding templates for a tenant
 * - Smart workflow routing based on contract characteristics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { 
  getWorkflowManagementService,
  WORKFLOW_TEMPLATES,
  type WorkflowTemplateKey 
} from '@repo/data-orchestration';

// ============================================================================
// GET - List available workflow templates or get routing recommendation
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    switch (action) {
      case 'list': {
        // Return all template definitions
        const templates = Object.entries(WORKFLOW_TEMPLATES).map(([key, template]) => ({
          key,
          name: template.name,
          type: template.type,
          description: template.description,
          contractTypes: template.contractTypes,
          stepCount: template.steps.length,
          totalDurationHours: template.steps.reduce((sum, s) => sum + s.timeoutHours, 0),
          steps: template.steps.map(s => ({
            name: s.name,
            role: s.role,
            timeoutHours: s.timeoutHours,
          })),
        }));

        return NextResponse.json({
          success: true,
          data: templates,
          count: templates.length
        });
      }

      case 'route': {
        // Get smart routing recommendation
        const contractType = searchParams.get('contractType');
        const value = searchParams.get('value');
        const riskLevel = searchParams.get('riskLevel');
        const isAmendment = searchParams.get('isAmendment') === 'true';
        const isTermination = searchParams.get('isTermination') === 'true';
        const isRenewalOptOut = searchParams.get('isRenewalOptOut') === 'true';
        const partyCount = searchParams.get('partyCount');

        const tenantId = (session.user as { tenantId?: string }).tenantId || 'default';
        const workflowService = getWorkflowManagementService();

        const routing = await workflowService.routeToWorkflow(tenantId, {
          contractType: contractType || undefined,
          value: value ? parseFloat(value) : undefined,
          riskLevel: riskLevel || undefined,
          isAmendment,
          isTermination,
          isRenewalOptOut,
          partyCount: partyCount ? parseInt(partyCount) : undefined,
        });

        return NextResponse.json({
          success: true,
          data: {
            recommendedTemplate: routing.templateKey,
            templateName: routing.template.name,
            reason: routing.reason,
            template: {
              name: routing.template.name,
              type: routing.template.type,
              description: routing.template.description,
              steps: routing.template.steps.map(s => ({
                name: s.name,
                role: s.role,
                timeoutHours: s.timeoutHours,
              })),
            }
          }
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: list or route' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Workflow templates GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Seed templates or create workflow from template
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as { tenantId?: string }).tenantId || 'default';
    const body = await request.json();
    const { action } = body;

    const workflowService = getWorkflowManagementService();

    switch (action) {
      case 'seed': {
        // Seed all templates for the tenant
        const result = await workflowService.seedTemplatesForTenant(tenantId);

        return NextResponse.json({
          success: true,
          data: result,
          message: `Created ${result.created.length} workflows, skipped ${result.skipped.length} existing`
        });
      }

      case 'create_from_template': {
        const { templateKey, customName, setAsDefault } = body;

        if (!templateKey || !(templateKey in WORKFLOW_TEMPLATES)) {
          return NextResponse.json(
            { error: 'Invalid template key' },
            { status: 400 }
          );
        }

        const workflowId = await workflowService.createFromTemplate(
          tenantId,
          templateKey as WorkflowTemplateKey,
          { customName, setAsDefault }
        );

        return NextResponse.json({
          success: true,
          data: { workflowId },
          message: `Created workflow from "${templateKey}" template`
        });
      }

      case 'route_and_start': {
        // Smart route and optionally start workflow
        const { contractId, contractType, value, riskLevel, autoStart } = body;

        if (!contractId) {
          return NextResponse.json(
            { error: 'Contract ID is required' },
            { status: 400 }
          );
        }

        const routing = await workflowService.routeToWorkflow(tenantId, {
          contractType,
          value,
          riskLevel,
        });

        let executionId: string | undefined;

        if (autoStart) {
          // Create workflow from template if not exists
          const existingWorkflows = await workflowService.listWorkflows(tenantId, { activeOnly: true });
          let workflowId = existingWorkflows.find(w => w.name === routing.template.name)?.id;

          if (!workflowId) {
            workflowId = await workflowService.createFromTemplate(
              tenantId,
              routing.templateKey as WorkflowTemplateKey
            );
          }

          // Start execution
          executionId = await workflowService.startExecution({
            workflowId,
            contractId,
            tenantId,
            initiatedBy: (session.user as { id?: string }).id || 'unknown',
          });
        }

        return NextResponse.json({
          success: true,
          data: {
            recommendedTemplate: routing.templateKey,
            templateName: routing.template.name,
            reason: routing.reason,
            executionId,
            started: !!executionId,
          },
          message: executionId 
            ? `Started "${routing.template.name}" workflow` 
            : `Recommended: "${routing.template.name}" - ${routing.reason}`
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: seed, create_from_template, or route_and_start' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Workflow templates POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

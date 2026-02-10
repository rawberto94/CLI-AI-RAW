/**
 * Workflow Suggestion API
 * 
 * AI-powered workflow recommendations based on contract analysis
 */

import { NextRequest } from 'next/server';
import { getSessionTenantId } from '@/lib/tenant-server';
import { getWorkflowManagementService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = getSessionTenantId(session);
  const body = await request.json();
  const { contractId } = body;

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  // Get contract details
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      metadata: true,
      extractedData: true
    }
  });

  if (!contract) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
  }

  // Get workflow suggestion
  const workflowService = getWorkflowManagementService();
  const suggestion = await workflowService.suggestWorkflowForContract(
    contractId,
    tenantId
  );

  // Get all available workflows for comparison
  const allWorkflows = await workflowService.listWorkflows(tenantId);

  // Build recommendation rationale
  const extractedValue = contract.extractedData?.find(
    (d: { fieldName: string }) => d.fieldName === 'contract_value'
  )?.fieldValue;

  const contractValue = extractedValue ? parseFloat(extractedValue) : 0;
  const contractType = contract.metadata?.documentType || 'unknown';

  let rationale = '';
  if (suggestion) {
    if (contractValue > 100000) {
      rationale = `High-value contract ($${contractValue.toLocaleString()}) requires executive approval workflow.`;
    } else if (contractValue > 50000) {
      rationale = `Medium-value contract ($${contractValue.toLocaleString()}) requires manager approval workflow.`;
    } else if (contractType.toLowerCase().includes('nda')) {
      rationale = 'NDA contracts follow a simplified legal review workflow.';
    } else {
      rationale = 'Standard approval workflow recommended for this contract type.';
    }
  } else {
    rationale = 'No specific workflow recommendation. Consider creating a custom workflow.';
  }

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      suggestedWorkflow: suggestion,
      allWorkflows,
      contract: {
        id: contract.id,
        name: contract.fileName,
        type: contractType,
        value: contractValue
      },
      rationale,
      autoStartEnabled: true
    }
  });
});

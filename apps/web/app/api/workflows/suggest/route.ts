/**
 * Workflow Suggestion API
 * 
 * AI-powered workflow recommendations based on contract analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/tenant-server';
import { getWorkflowManagementService } from '@repo/data-orchestration';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = getSessionTenantId(session);
    const body = await request.json();
    const { contractId } = body;

    if (!contractId) {
      return NextResponse.json(
        { error: 'Contract ID is required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
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

    return NextResponse.json({
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
  } catch (error) {
    console.error('Workflow suggestion error:', error);
    return NextResponse.json(
      { error: 'Failed to generate workflow suggestion' },
      { status: 500 }
    );
  }
}

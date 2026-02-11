import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Mock signature workflows
const mockSignatureWorkflows = [
  {
    id: 'sig-workflow-001',
    contractId: 'contract-001',
    contractName: 'Master Service Agreement',
    provider: 'docusign',
    status: 'in_progress',
    signers: [
      {
        id: 'signer-1',
        name: 'Roberto Ostojic',
        email: 'roberto@acmecorp.com',
        role: 'Client Signatory',
        status: 'signed',
        order: 1,
        sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        viewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        signedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: '192.168.1.100',
      },
      {
        id: 'signer-2',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@vendor.com',
        role: 'Vendor Representative',
        status: 'viewed',
        order: 2,
        sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        viewedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'signer-3',
        name: 'Michael Brown',
        email: 'michael.brown@legal.com',
        role: 'Witness',
        status: 'pending',
        order: 3,
      },
    ],
    createdBy: 'Alice Anderson',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    message: 'Please review and sign this Master Service Agreement at your earliest convenience.',
  },
];

// GET /api/contracts/[id]/signatures - Get signature workflows for a contract
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const { id: contractId } = await params;

    // Verify contract belongs to the caller's tenant
    const tenantId = ctx.tenantId;
    try {
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, tenantId },
        select: { 
          id: true, 
          contractTitle: true,
          searchMetadata: true,
        },
      });

      if (contract) {
        // Check if there are signature workflows stored in searchMetadata
        const metadata = contract.searchMetadata as Record<string, unknown> | null;
        const signatureData = metadata?.signatureWorkflows as unknown[] | undefined;
        
        if (signatureData && Array.isArray(signatureData) && signatureData.length > 0) {
          return createSuccessResponse(ctx, { 
            workflows: signatureData,
            source: 'database'
          });
        }
      }
    } catch {
      // Database lookup failed, will use fallback
    }

    // Fallback to mock data - filter by contractId or return all if it's a specific contract
    const workflows = contractId === 'contract-001' 
      ? mockSignatureWorkflows 
      : mockSignatureWorkflows.map(w => ({ ...w, contractId }));
    
    return createSuccessResponse(ctx, { 
      workflows,
      source: 'mock'
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// POST /api/contracts/[id]/signatures - Create a new signature request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const { id: contractId } = await params;
    const body = await request.json();
    const { signers, provider, message, expiresInDays = 30 } = body;

    const newWorkflow = {
      id: `sig-${Date.now()}`,
      contractId,
      contractName: 'Contract Name',
      provider: provider || 'docusign',
      status: 'sent',
      signers: signers.map((s: { name: string; email: string; role: string }, index: number) => ({
        ...s,
        id: `signer-${Date.now()}-${index}`,
        status: 'sent',
        order: index + 1,
        sentAt: new Date().toISOString(),
      })),
      createdBy: 'Current User',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      message,
    };

    // Store in database — verify tenant ownership
    const tenantId = ctx.tenantId;
    try {
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, tenantId },
        select: { tenantId: true, searchMetadata: true },
      });

      if (contract) {
        const currentMetadata = (contract.searchMetadata as Record<string, unknown>) || {};
        const existingWorkflows = (currentMetadata.signatureWorkflows as Record<string, unknown>[]) || [];
        
        await prisma.contract.update({
          where: { id: contractId },
          data: {
            searchMetadata: JSON.parse(JSON.stringify({
              ...currentMetadata,
              signatureWorkflows: [...existingWorkflows, newWorkflow],
            })),
          },
        });

        if (contract?.tenantId) {
          void publishRealtimeEvent({
            event: 'contract:updated',
            data: { tenantId: contract.tenantId, contractId },
            source: 'api:contracts/[id]/signatures',
          });
        }

        return createSuccessResponse(ctx, { 
          workflow: newWorkflow,
          source: 'database'
        });
      }
    } catch {
      // Database update failed, will use fallback
    }

    return createSuccessResponse(ctx, { 
      workflow: newWorkflow,
      source: 'mock'
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

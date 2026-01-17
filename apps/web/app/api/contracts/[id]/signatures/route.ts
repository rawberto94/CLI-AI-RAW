import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';

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
  try {
    const { id: contractId } = await params;

    // Try database first
    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
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
          return NextResponse.json({ 
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
    
    return NextResponse.json({ 
      workflows,
      source: 'mock'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch signature workflows' },
      { status: 500 }
    );
  }
}

// POST /api/contracts/[id]/signatures - Create a new signature request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Try to store in database
    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
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

        return NextResponse.json({ 
          workflow: newWorkflow,
          source: 'database'
        });
      }
    } catch {
      // Database update failed, will use fallback
    }

    return NextResponse.json({ 
      workflow: newWorkflow,
      source: 'mock'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create signature request' },
      { status: 500 }
    );
  }
}

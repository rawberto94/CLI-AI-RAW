import { NextRequest, NextResponse } from 'next/server';

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
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;

    // Try database first (when implemented)
    try {
      // const workflows = await prisma.signatureWorkflow.findMany({
      //   where: { contractId },
      //   include: { signers: true },
      //   orderBy: { createdAt: 'desc' },
      // });
      // return NextResponse.json({ workflows, source: 'database' });
    } catch (dbError) {
      console.warn('Database unavailable, using mock data:', dbError);
    }

    // Fallback to mock data
    const workflows = mockSignatureWorkflows.filter(w => w.contractId === contractId);
    
    return NextResponse.json({ 
      workflows,
      source: 'mock'
    });
  } catch (error) {
    console.error('Error fetching signature workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signature workflows' },
      { status: 500 }
    );
  }
}

// POST /api/contracts/[id]/signatures - Create a new signature request
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;
    const body = await request.json();
    const { signers, provider, message, expiresInDays = 30 } = body;

    const newWorkflow = {
      id: `sig-${Date.now()}`,
      contractId,
      contractName: 'Contract Name',
      provider: provider || 'docusign',
      status: 'sent',
      signers: signers.map((s: any, index: number) => ({
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

    return NextResponse.json({ 
      workflow: newWorkflow,
      source: 'mock'
    });
  } catch (error) {
    console.error('Error creating signature request:', error);
    return NextResponse.json(
      { error: 'Failed to create signature request' },
      { status: 500 }
    );
  }
}

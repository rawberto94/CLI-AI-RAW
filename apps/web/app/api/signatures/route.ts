import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { getServerSession } from '@/lib/auth';

// Types
interface Signer {
  id?: string;
  name: string;
  email: string;
  role: 'signer' | 'approver' | 'viewer';
  order: number;
  status?: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  signedAt?: string;
}

interface CreateSignatureRequest {
  contractId: string;
  signers: Signer[];
  message?: string;
  expiresAt?: string;
  provider?: 'docusign' | 'adobe_sign' | 'hellosign' | 'manual';
}

// GET /api/signatures - List signature requests
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build filter
    const where: Record<string, unknown> = { tenantId };
    if (contractId) where.contractId = contractId;
    if (status) where.status = status;

    const [signatureRequests, total] = await Promise.all([
      prisma.signatureRequest.findMany({
        where,
        include: {
          contract: {
            select: {
              id: true,
              fileName: true,
              contractTitle: true,
              supplierName: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.signatureRequest.count({ where }),
    ]);

    // Transform to include parsed signers
    const items = signatureRequests.map(sr => ({
      ...sr,
      signers: sr.signers as unknown as Signer[],
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      },
      source: 'database'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch signature requests', success: false },
      { status: 500 }
    );
  }
}

// POST /api/signatures - Create signature request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;
    const userId = session.user.id;
    const body: CreateSignatureRequest = await request.json();
    const { contractId, signers, message, expiresAt, provider = 'manual' } = body;

    // Validation
    if (!contractId) {
      return NextResponse.json(
        { error: 'Contract ID is required', success: false },
        { status: 400 }
      );
    }

    if (!signers || signers.length === 0) {
      return NextResponse.json(
        { error: 'At least one signer is required', success: false },
        { status: 400 }
      );
    }

    // Validate signers have required fields
    for (const signer of signers) {
      if (!signer.name || !signer.email) {
        return NextResponse.json(
          { error: 'All signers must have name and email', success: false },
          { status: 400 }
        );
      }
    }

    // Prepare signers with IDs and default status
    const signersWithDefaults: Signer[] = signers.map((s, i) => ({
      id: `signer-${Date.now()}-${i}`,
      name: s.name,
      email: s.email,
      role: s.role || 'signer',
      order: s.order ?? i + 1,
      status: 'pending' as const,
    }));

    // Create in database
    const signatureRequest = await prisma.signatureRequest.create({
      data: {
        tenantId,
        contractId,
        provider,
        status: 'draft',
        message: message || 'Please review and sign this contract',
        createdBy: userId,
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        signers: JSON.parse(JSON.stringify(signersWithDefaults)),
      },
    });

    // Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'PENDING' }
    });

    // Publish realtime event
    try {
      void publishRealtimeEvent({
        event: 'signature:created',
        data: { tenantId, contractId, signatureRequestId: signatureRequest.id },
        source: 'api:signatures',
      });
    } catch {
      // best-effort only
    }

    return NextResponse.json({
      success: true,
      data: {
        ...signatureRequest,
        signers: signersWithDefaults,
      },
      message: 'Signature request created successfully',
      source: 'database'
    }, { status: 201 });

  } catch {
    return NextResponse.json(
      { error: 'Failed to create signature request', success: false },
      { status: 500 }
    );
  }
}

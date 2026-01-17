import { NextRequest, NextResponse } from 'next/server';

// POST /api/signatures/[id]/cancel - Cancel a signature workflow
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;

    // Mock response
    return NextResponse.json({
      success: true,
      message: 'Signature request cancelled successfully',
      source: 'mock'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to cancel signature request' },
      { status: 500 }
    );
  }
}

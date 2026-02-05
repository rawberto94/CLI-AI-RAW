import { NextRequest, NextResponse } from 'next/server';

// POST /api/signatures/[id]/remind - Send reminder to signer
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const _workflowId = params.id;
    const { signerId: _signerId, message: _message } = await request.json();

    // Mock response
    return NextResponse.json({
      success: true,
      message: 'Reminder sent successfully',
      source: 'mock'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to send reminder' },
      { status: 500 }
    );
  }
}

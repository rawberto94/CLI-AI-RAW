import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Return empty pending items for demo
  return NextResponse.json({
    items: [],
    total: 0,
    page: 1,
    limit: 50
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // For demo purposes, just return success
    return NextResponse.json({
      id: `pending_${Date.now()}`,
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
      validationErrors: []
    });
  } catch (error) {
    console.error('Error creating pending rate card:', error);
    return NextResponse.json({ error: 'Failed to create pending rate card' }, { status: 500 });
  }
}